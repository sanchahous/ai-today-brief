import 'server-only';

import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import sharp from 'sharp';

const DEJAVU_DIRECTORY = join(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf');
// PDFKit/fontkit cannot reliably subset the variable WOFF2 used by the site.
// DejaVu's static TTFs cover Latin and Ukrainian in one face, so mixed strings,
// punctuation, URLs, and page numbers remain deterministic on the server.
const INTER_FONT = join(DEJAVU_DIRECTORY, 'DejaVuSans.ttf');
const INTER_BOLD_FONT = join(DEJAVU_DIRECTORY, 'DejaVuSans-Bold.ttf');
const INTER_ITALIC_FONT = join(DEJAVU_DIRECTORY, 'DejaVuSans-Oblique.ttf');
const FRAUNCES_FONT =
  require.resolve('@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2');

const PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 52,
} as const;

const COLORS = {
  ink: '#171717',
  muted: '#5f6268',
  paper: '#fbfaf7',
  surface: '#f0ede6',
  dark: '#101418',
  accent: '#f0c040',
  white: '#f7f7f5',
  rule: '#d8d2c8',
} as const;

export type WeeklyPdfLocale = 'en' | 'uk';

export interface WeeklyPdfStory {
  rank: number;
  title: string;
  summary: string;
  body: string;
  why: string;
  practical: string;
  takeaway: string;
  sourceName: string;
  sourceUrl: string;
  eventDate?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
}

export interface WeeklyPdfInput {
  locale: WeeklyPdfLocale;
  issueLabel: string;
  title: string;
  intro: string;
  editorNote?: string | null;
  weekStart: string;
  weekEnd: string;
  webUrl: string;
  videoUrl?: string | null;
  coverImageUrl?: string | null;
  keyTakeaways: string[];
  stories: WeeklyPdfStory[];
}

const COPY = {
  en: {
    weekly: 'WEEKLY DIGEST',
    contents: 'Inside this edition',
    editor: 'Editor note',
    why: 'Why it matters',
    practical: 'Practical example',
    takeaway: 'Takeaway',
    source: 'Primary source',
    closing: 'Key takeaways',
    online: 'Read the live edition',
    video: 'Watch the weekly video',
  },
  uk: {
    weekly: 'ТИЖНЕВИЙ ДАЙДЖЕСТ',
    contents: 'У цьому випуску',
    editor: 'Від редактора',
    why: 'Чому це важливо',
    practical: 'Практичний приклад',
    takeaway: 'Висновок',
    source: 'Першоджерело',
    closing: 'Ключові висновки',
    online: 'Читати вебверсію',
    video: 'Дивитися відеовипуск',
  },
} as const;

function stripMarkdown(value: string) {
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[*_`]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function imageBuffer(url?: string | null) {
  if (!url?.startsWith('http')) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return null;
    const source = Buffer.from(await response.arrayBuffer());
    if (source.length < 1024) return null;
    return await sharp(source).rotate().jpeg({ quality: 88, progressive: true }).toBuffer();
  } catch {
    return null;
  }
}

function registerFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont('Inter', INTER_FONT);
  doc.registerFont('InterBold', INTER_BOLD_FONT);
  doc.registerFont('InterItalic', INTER_ITALIC_FONT);
  doc.registerFont('Fraunces', FRAUNCES_FONT);
}

function headingFont(locale: WeeklyPdfLocale) {
  return locale === 'uk' ? 'InterBold' : 'Fraunces';
}

function drawPageBackground(doc: PDFKit.PDFDocument) {
  doc.save().rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.paper).restore();
}

function addPage(doc: PDFKit.PDFDocument) {
  doc.addPage({ size: 'A4', margin: PAGE.margin });
  drawPageBackground(doc);
}

function ensureSpace(doc: PDFKit.PDFDocument, points: number) {
  if (doc.y + points <= PAGE.height - 72) return;
  addPage(doc);
}

function label(doc: PDFKit.PDFDocument, value: string, x = PAGE.margin, y = doc.y) {
  doc
    .font('Inter')
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(value.toUpperCase(), x, y, { characterSpacing: 1.4, continued: false });
}

function sectionHeading(
  doc: PDFKit.PDFDocument,
  locale: WeeklyPdfLocale,
  value: string,
  options: { size?: number; color?: string } = {},
) {
  doc
    .font(headingFont(locale))
    .fontSize(options.size ?? 22)
    .fillColor(options.color ?? COLORS.ink)
    .text(value, { lineGap: 2 });
}

function bodyText(doc: PDFKit.PDFDocument, value: string, options: PDFKit.Mixins.TextOptions = {}) {
  if (!value.trim()) return;
  doc
    .font('Inter')
    .fontSize(10.5)
    .fillColor(COLORS.ink)
    .text(stripMarkdown(value), {
      lineGap: 4,
      paragraphGap: 8,
      ...options,
    });
}

function infoPanel(
  doc: PDFKit.PDFDocument,
  title: string,
  value: string,
  accent: string = COLORS.accent,
) {
  if (!value.trim()) return;
  ensureSpace(doc, 120);
  const x = PAGE.margin;
  const y = doc.y + 5;
  const width = PAGE.width - PAGE.margin * 2;
  const valueHeight = doc.heightOfString(stripMarkdown(value), {
    width: width - 42,
    lineGap: 3,
  });
  const height = Math.max(84, valueHeight + 50);
  doc.save().roundedRect(x, y, width, height, 10).fill(COLORS.surface).restore();
  doc.save().rect(x, y, 5, height).fill(accent).restore();
  doc
    .font('Inter')
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text(title.toUpperCase(), x + 22, y + 16, {
      characterSpacing: 1,
      width: width - 42,
    });
  doc
    .font('Inter')
    .fontSize(10)
    .fillColor(COLORS.ink)
    .text(stripMarkdown(value), x + 22, y + 35, {
      width: width - 42,
      lineGap: 3,
    });
  doc.y = y + height + 16;
}

function safeImage(
  doc: PDFKit.PDFDocument,
  image: Buffer | null,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (image) {
    doc.image(image, x, y, {
      width,
      height,
      fit: [width, height],
      align: 'center',
      valign: 'center',
    });
    return;
  }
  doc.save().rect(x, y, width, height).fill(COLORS.surface).restore();
  doc
    .font('Inter')
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text('AI TODAY BRIEF', x, y + height / 2 - 5, { width, align: 'center' });
}

async function buildCover(doc: PDFKit.PDFDocument, input: WeeklyPdfInput, cover: Buffer | null) {
  const copy = COPY[input.locale];
  doc.save().rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.dark).restore();
  if (cover) {
    doc
      .save()
      .opacity(0.34)
      .image(cover, 0, 0, {
        width: PAGE.width,
        height: 355,
        fit: [PAGE.width, 355],
        align: 'center',
        valign: 'center',
      });
    doc.restore();
    doc.save().rect(0, 0, PAGE.width, 355).fillOpacity(0.28).fill(COLORS.dark).restore();
  }

  doc.save().roundedRect(PAGE.margin, 44, 168, 29, 14).fill(COLORS.accent).restore();
  doc
    .font('Inter')
    .fontSize(9)
    .fillColor(COLORS.dark)
    .text(copy.weekly, PAGE.margin, 54, { width: 168, align: 'center' });

  doc
    .font(headingFont(input.locale))
    .fontSize(input.locale === 'uk' ? 35 : 39)
    .fillColor(COLORS.white)
    .text(input.title, PAGE.margin, 390, {
      width: PAGE.width - PAGE.margin * 2,
      lineGap: 3,
    });
  doc
    .font('Inter')
    .fontSize(12)
    .fillColor('#cfd4d7')
    .text(input.intro, PAGE.margin, doc.y + 18, {
      width: PAGE.width - PAGE.margin * 2,
      lineGap: 5,
    });

  const detailsY = 700;
  doc
    .save()
    .rect(PAGE.margin, detailsY, PAGE.width - PAGE.margin * 2, 1)
    .fill('#3c4348')
    .restore();
  doc
    .font('Inter')
    .fontSize(9)
    .fillColor(COLORS.accent)
    .text(input.issueLabel, PAGE.margin, detailsY + 18);
  doc
    .fillColor('#cfd4d7')
    .text(`${input.weekStart} - ${input.weekEnd}`, PAGE.margin, detailsY + 37);
  doc.fillColor(COLORS.white).text('aitodaybrief.com', PAGE.margin, detailsY + 68, {
    link: input.webUrl,
    underline: false,
  });
}

function buildContents(doc: PDFKit.PDFDocument, input: WeeklyPdfInput) {
  const copy = COPY[input.locale];
  addPage(doc);
  label(doc, input.issueLabel);
  doc.moveDown(1.2);
  sectionHeading(doc, input.locale, copy.contents, { size: 30 });
  doc.moveDown(0.8);
  input.stories.forEach((story, index) => {
    ensureSpace(doc, 76);
    const y = doc.y;
    doc
      .font(headingFont(input.locale))
      .fontSize(26)
      .fillColor(COLORS.accent)
      .text(String(story.rank).padStart(2, '0'), PAGE.margin, y, { width: 42 });
    doc
      .font('Inter')
      .fontSize(12)
      .fillColor(COLORS.ink)
      .text(story.title, PAGE.margin + 58, y + 2, {
        width: PAGE.width - PAGE.margin * 2 - 58,
        lineGap: 3,
      });
    doc.y = Math.max(doc.y, y + 50);
    if (index < input.stories.length - 1) {
      doc
        .save()
        .rect(PAGE.margin + 58, doc.y + 7, PAGE.width - PAGE.margin * 2 - 58, 1)
        .fill(COLORS.rule)
        .restore();
      doc.y += 22;
    }
  });
  if (input.editorNote?.trim()) {
    doc.moveDown(1);
    infoPanel(doc, copy.editor, input.editorNote);
  }
}

function buildStory(
  doc: PDFKit.PDFDocument,
  input: WeeklyPdfInput,
  story: WeeklyPdfStory,
  image: Buffer | null,
) {
  const copy = COPY[input.locale];
  addPage(doc);
  label(doc, `${input.issueLabel} / ${String(story.rank).padStart(2, '0')}`);
  doc.moveDown(1);
  doc
    .font(headingFont(input.locale))
    .fontSize(input.locale === 'uk' ? 27 : 30)
    .fillColor(COLORS.ink)
    .text(story.title, { lineGap: 3 });
  doc.moveDown(0.55);
  doc.font('Inter').fontSize(12).fillColor(COLORS.muted).text(story.summary, { lineGap: 4 });

  const imageY = doc.y + 20;
  safeImage(doc, image, PAGE.margin, imageY, PAGE.width - PAGE.margin * 2, 224);
  doc.y = imageY + 242;
  if (story.imageAlt?.trim()) {
    doc
      .font('InterItalic')
      .fontSize(7.8)
      .fillColor(COLORS.muted)
      .text(story.imageAlt, PAGE.margin, doc.y, {
        width: PAGE.width - PAGE.margin * 2,
        lineGap: 2,
      });
    doc.moveDown(0.8);
  }

  ensureSpace(doc, 120);
  bodyText(doc, story.body || story.summary);
  infoPanel(doc, copy.why, story.why);
  infoPanel(doc, copy.practical, story.practical, '#47e4d3');
  infoPanel(doc, copy.takeaway, story.takeaway, '#8b7cf6');

  ensureSpace(doc, 64);
  doc
    .font('Inter')
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text(`${copy.source}: `, { continued: true });
  doc.fillColor(COLORS.ink).text(story.sourceName || story.sourceUrl, {
    link: story.sourceUrl,
    underline: true,
  });
  if (story.eventDate) {
    doc.fillColor(COLORS.muted).text(story.eventDate, { lineGap: 2 });
  }
}

async function buildClosing(doc: PDFKit.PDFDocument, input: WeeklyPdfInput) {
  const copy = COPY[input.locale];
  addPage(doc);
  label(doc, input.issueLabel);
  doc.moveDown(1.2);
  sectionHeading(doc, input.locale, copy.closing, { size: 30 });
  doc.moveDown(0.8);
  input.keyTakeaways.forEach((takeaway, index) => {
    ensureSpace(doc, 78);
    const y = doc.y;
    doc
      .save()
      .circle(PAGE.margin + 15, y + 15, 15)
      .fill(COLORS.accent)
      .restore();
    doc
      .font('Inter')
      .fontSize(10)
      .fillColor(COLORS.dark)
      .text(String(index + 1), PAGE.margin, y + 10, { width: 30, align: 'center' });
    doc
      .font('Inter')
      .fontSize(11)
      .fillColor(COLORS.ink)
      .text(takeaway, PAGE.margin + 48, y + 3, {
        width: PAGE.width - PAGE.margin * 2 - 48,
        lineGap: 4,
      });
    doc.y = Math.max(doc.y + 18, y + 56);
  });

  const qr = await QRCode.toBuffer(input.webUrl, {
    type: 'png',
    width: 280,
    margin: 1,
    color: { dark: COLORS.dark, light: '#00000000' },
  });
  ensureSpace(doc, 170);
  const panelY = doc.y + 8;
  doc
    .save()
    .roundedRect(PAGE.margin, panelY, PAGE.width - PAGE.margin * 2, 142, 12)
    .fill(COLORS.surface)
    .restore();
  doc.image(qr, PAGE.margin + 20, panelY + 19, { width: 104, height: 104 });
  doc
    .font(headingFont(input.locale))
    .fontSize(17)
    .fillColor(COLORS.ink)
    .text(copy.online, PAGE.margin + 150, panelY + 28, {
      width: PAGE.width - PAGE.margin * 2 - 174,
      link: input.webUrl,
    });
  doc
    .font('Inter')
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(input.webUrl, PAGE.margin + 150, panelY + 68, {
      width: PAGE.width - PAGE.margin * 2 - 174,
      link: input.webUrl,
      underline: true,
    });
  if (input.videoUrl) {
    doc
      .font('Inter')
      .fontSize(9)
      .fillColor(COLORS.ink)
      .text(copy.video, PAGE.margin + 150, panelY + 100, {
        width: PAGE.width - PAGE.margin * 2 - 174,
        link: input.videoUrl,
        underline: true,
      });
  }
}

function addHeadersAndFooters(doc: PDFKit.PDFDocument, input: WeeklyPdfInput) {
  const range = doc.bufferedPageRange();
  for (let index = 1; index < range.count; index += 1) {
    doc.switchToPage(index);
    // Stay inside PDFKit's bottom margin. Writing below it automatically adds
    // overflow pages even when an explicit y coordinate is provided.
    const footerY = PAGE.height - 62;
    doc
      .save()
      .rect(PAGE.margin, footerY - 11, PAGE.width - PAGE.margin * 2, 1)
      .fill(COLORS.rule)
      .restore();
    doc
      .font('Inter')
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text('AI TODAY BRIEF', PAGE.margin, footerY, { lineBreak: false });
    doc.text(`${input.issueLabel}  /  ${index + 1}`, PAGE.width - PAGE.margin - 130, footerY, {
      width: 130,
      align: 'right',
      lineBreak: false,
    });
  }
}

export async function renderWeeklyDigestPdf(input: WeeklyPdfInput): Promise<Buffer> {
  if (input.stories.length < 3 || input.stories.length > 7) {
    throw new Error('Weekly PDF requires 3 to 7 stories.');
  }
  const doc = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    compress: true,
    size: 'A4',
    margins: {
      top: PAGE.margin,
      right: PAGE.margin,
      bottom: PAGE.margin,
      left: PAGE.margin,
    },
    info: {
      Title: input.title,
      Author: 'AI Today Brief',
      Subject: input.issueLabel,
      Keywords: 'AI, engineering, weekly digest',
      Creator: 'AI Today Brief Weekly Digest v2',
    },
  });
  registerFonts(doc);

  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const [cover, ...storyImages] = await Promise.all([
    imageBuffer(input.coverImageUrl),
    ...input.stories.map((story) => imageBuffer(story.imageUrl)),
  ]);

  doc.addPage({ size: 'A4', margin: 0 });
  await buildCover(doc, input, cover ?? null);
  buildContents(doc, input);
  input.stories.forEach((story, index) => {
    buildStory(doc, input, story, storyImages[index] ?? null);
  });
  await buildClosing(doc, input);
  addHeadersAndFooters(doc, input);
  doc.end();
  return completed;
}
