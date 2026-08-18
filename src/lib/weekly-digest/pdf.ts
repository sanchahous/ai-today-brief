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
// PDFKit/fontkit accepts static TTF/OTF fonts, not the site's WOFF2 webfont.
// Keep a serif face for English headings while retaining reliable Cyrillic support.
const FRAUNCES_FONT = join(DEJAVU_DIRECTORY, 'DejaVuSerif.ttf');

const PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 52,
} as const;

const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const CONTENT_TOP = PAGE.margin;
// The footer must stay inside PDFKit's bottom margin: writing below it appends
// an overflow page even when an explicit y coordinate is given.
const FOOTER_TEXT_Y = PAGE.height - 62;
const FOOTER_RULE_Y = PAGE.height - 74;
// Hard floor for every body region. Nothing is flowed past it, which is what
// keeps content from landing on top of the footer rule.
const CONTENT_BOTTOM = FOOTER_RULE_Y - 24;

const COLORS = {
  ink: '#171717',
  muted: '#5f6268',
  paper: '#fbfaf7',
  surface: '#f0ede6',
  dark: '#101418',
  accent: '#f0c040',
  white: '#f7f7f5',
  rule: '#d8d2c8',
  coverText: '#cfd4d7',
  coverRule: '#3c4348',
  teal: '#2fbfae',
  violet: '#8b7cf6',
} as const;

export type WeeklyPdfLocale = 'en' | 'uk';

export interface WeeklyPdfStory {
  rank: number;
  title: string;
  summary: string;
  /**
   * Long-form article text (~4k chars in production). The A4 digest prints the
   * distilled lede plus the four panels and links out; the full body is the web
   * edition's job. Kept here as the lede fallback for editions with no summary.
   */
  body: string;
  why: string;
  practical: string;
  takeaway: string;
  /** Empty for editions generated before 2026-08-06 -- the panel no-ops on empty. */
  limitation: string;
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
    feature: 'Feature',
    why: 'Why it matters',
    practical: 'Practical example',
    takeaway: 'Takeaway',
    limitation: 'Limitation',
    source: 'Source',
    fullStory: 'Full story',
    closing: 'Key takeaways',
    online: 'Read the live edition',
    video: 'Watch the weekly video',
    radar: 'Also this week',
    page: 'Page',
    of: 'of',
  },
  uk: {
    weekly: 'ТИЖНЕВИЙ ДАЙДЖЕСТ',
    contents: 'У цьому випуску',
    editor: 'Від редактора',
    feature: 'Головне',
    why: 'Чому це важливо',
    practical: 'Практичний приклад',
    takeaway: 'Висновок',
    limitation: 'Обмеження',
    source: 'Джерело',
    fullStory: 'Повна версія',
    closing: 'Ключові висновки',
    online: 'Читати вебверсію',
    video: 'Дивитися відеовипуск',
    radar: 'Ще цього тижня',
    page: 'Стор.',
    of: 'з',
  },
} as const;

type Copy = (typeof COPY)[WeeklyPdfLocale];
type FontName = 'Inter' | 'InterBold' | 'InterItalic' | 'Fraunces';

interface TextBox {
  font: FontName;
  size: number;
  color: string;
  lineGap?: number;
  characterSpacing?: number;
  align?: 'left' | 'center' | 'right';
  x?: number;
  width?: number;
  link?: string | null;
  underline?: boolean;
}

/** Cover art is full-bleed; feature art spans the text column. */
const COVER_IMAGE = { width: PAGE.width, height: 330 } as const;
const FEATURE_IMAGE = { width: CONTENT_WIDTH, height: 168 } as const;

// The cover is a fixed grid too: the headline block is bottom-anchored so a
// short and a long headline both end on the same line above the standfirst.
const COVER = {
  titleBottom: 436,
  titleMaxHeight: 190,
  introTop: 460,
  introMaxHeight: 132,
  detailsY: 660,
} as const;

// A feature page is a fixed grid, not a flow: the lede block is bottom-anchored
// to `ledeBottom` and everything below it sits at a constant y, so all three
// feature spreads line up and none of them can spill onto a second page.
const FEATURE = {
  titleTop: 76,
  titleMaxHeight: 88,
  summaryMaxHeight: 68,
  ledeBottom: 244,
  imageTop: 262,
  captionTop: 434,
  panelsTop: 458,
  panelHeight: 112,
  panelGap: 12,
  sourceY: CONTENT_BOTTOM - 26,
} as const;

const PANEL = {
  radius: 9,
  paddingX: 18,
  labelOffset: 14,
  valueOffset: 31,
  bottomPadding: 14,
} as const;

/**
 * Where each story lands. The layout is deterministic -- cover, contents, one
 * page per feature, one shared radar page -- so the contents list can print the
 * real page number next to every headline and jump to it.
 */
interface StoryAnchor {
  destination: string;
  page: number;
}

const CONTENTS_PAGE = 2;
const FIRST_FEATURE_PAGE = CONTENTS_PAGE + 1;
/** Column reserved on the contents page for the target page number. */
const CONTENTS_PAGE_COLUMN = 34;

function storyDestination(rank: number) {
  return `story-${rank}`;
}

function planAnchors(features: WeeklyPdfStory[], radar: WeeklyPdfStory[]) {
  const anchors = new Map<number, StoryAnchor>();
  features.forEach((story, index) =>
    anchors.set(story.rank, {
      destination: storyDestination(story.rank),
      page: FIRST_FEATURE_PAGE + index,
    }),
  );
  const radarPage = FIRST_FEATURE_PAGE + features.length;
  radar.forEach((story) =>
    anchors.set(story.rank, { destination: storyDestination(story.rank), page: radarPage }),
  );
  return anchors;
}

/** Registers a jump target at the top of the page being built. */
function anchorPage(doc: PDFKit.PDFDocument, rank: number) {
  doc.addNamedDestination(storyDestination(rank), 'XYZ', 0, 0, null);
}

function stripMarkdown(value: string) {
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[*_`]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compactHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 48);
  }
}

/**
 * Baked into the cover art rather than drawn as a PDF gradient: PDFKit's
 * opacity-stop gradients collapse into a hard step in PDF.js, which renders the
 * admin page previews, and a stack of translucent bands leaves visible seams.
 */
function coverScrim(width: number, height: number) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      '<defs><linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">' +
      `<stop offset="0" stop-color="${COLORS.dark}" stop-opacity="0.4"/>` +
      `<stop offset="0.3" stop-color="${COLORS.dark}" stop-opacity="0.5"/>` +
      `<stop offset="1" stop-color="${COLORS.dark}" stop-opacity="1"/>` +
      '</linearGradient></defs>' +
      '<rect width="100%" height="100%" fill="url(#scrim)"/></svg>',
  );
}

async function imageBuffer(
  url: string | null | undefined,
  box: { width: number; height: number },
  scrim = false,
) {
  if (!url?.startsWith('http')) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return null;
    const source = Buffer.from(await response.arrayBuffer());
    if (source.length < 1024) return null;
    const width = Math.round(box.width * 2);
    const height = Math.round(box.height * 2);
    // Crop to the exact placement box. PDFKit's own `cover` option scales but
    // never clips, so an off-ratio photo would bleed over the text below it,
    // and `fit` would letterbox it into the middle of the column.
    const cropped = sharp(source)
      .rotate()
      .resize(width, height, { fit: 'cover', position: sharp.strategy.attention });
    const composed = scrim
      ? cropped.composite([{ input: coverScrim(width, height), blend: 'over' }])
      : cropped;
    return await composed.jpeg({ quality: 82, progressive: true }).toBuffer();
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

function headingFont(locale: WeeklyPdfLocale): FontName {
  return locale === 'uk' ? 'InterBold' : 'Fraunces';
}

function addPage(doc: PDFKit.PDFDocument) {
  doc.addPage({ size: 'A4', margin: PAGE.margin });
  doc.save().rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.paper).restore();
}

function measure(doc: PDFKit.PDFDocument, value: string, box: TextBox) {
  if (!value) return 0;
  doc.font(box.font).fontSize(box.size);
  return doc.heightOfString(value, {
    width: box.width ?? CONTENT_WIDTH,
    lineGap: box.lineGap ?? 0,
    characterSpacing: box.characterSpacing,
  });
}

function lastSentenceEnd(value: string) {
  for (let index = value.length - 1; index > 0; index -= 1) {
    const char = value[index];
    if (char !== '.' && char !== '!' && char !== '?') continue;
    const next = value[index + 1];
    if (next === undefined || next === ' ' || next === '\n') return index + 1;
  }
  return -1;
}

/**
 * Longest prefix of `value` that fits `maxHeight`, cut at a sentence boundary.
 * PDFKit's own `ellipsis` truncates mid-word, which reads as a rendering bug in
 * a printed digest -- this keeps excerpts ending on a finished thought.
 */
function trimToFit(doc: PDFKit.PDFDocument, rawValue: string, box: TextBox, maxHeight: number) {
  const value = stripMarkdown(rawValue);
  if (!value || measure(doc, value, box) <= maxHeight) return value;

  let low = 0;
  let high = value.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measure(doc, `${value.slice(0, mid).trimEnd()}…`, box) <= maxHeight) low = mid;
    else high = mid - 1;
  }

  const cut = value.slice(0, low).trimEnd();
  const sentence = lastSentenceEnd(cut);
  if (sentence > low * 0.6) return cut.slice(0, sentence);
  return `${cut.replace(/[\s.,;:—–-]+$/u, '')}…`;
}

/** Draws inside a bounded box and returns the y just below the drawn text. */
function drawText(
  doc: PDFKit.PDFDocument,
  rawValue: string,
  y: number,
  maxHeight: number,
  box: TextBox,
) {
  const value = stripMarkdown(rawValue);
  if (!value) return y;
  doc
    .font(box.font)
    .fontSize(box.size)
    .fillColor(box.color)
    .text(value, box.x ?? PAGE.margin, y, {
      width: box.width ?? CONTENT_WIDTH,
      height: maxHeight,
      ellipsis: true,
      lineGap: box.lineGap ?? 0,
      characterSpacing: box.characterSpacing,
      align: box.align,
      link: box.link ?? undefined,
      underline: box.underline,
    });
  return Math.min(doc.y, y + maxHeight);
}

/** Largest candidate size whose rendered height still fits `maxHeight`. */
function fitSize(
  doc: PDFKit.PDFDocument,
  value: string,
  box: TextBox,
  candidates: readonly number[],
  maxHeight: number,
) {
  const text = stripMarkdown(value);
  for (const size of candidates) {
    if (measure(doc, text, { ...box, size }) <= maxHeight) return size;
  }
  return candidates[candidates.length - 1] ?? box.size;
}

function eyebrow(doc: PDFKit.PDFDocument, value: string) {
  return drawText(doc, value.toUpperCase(), CONTENT_TOP, 14, {
    font: 'Inter',
    size: 8.5,
    color: COLORS.muted,
    characterSpacing: 1.4,
  });
}

function pageHeading(
  doc: PDFKit.PDFDocument,
  locale: WeeklyPdfLocale,
  value: string,
  y: number,
  size: number,
) {
  const bottom = drawText(doc, value, y, size * 2.4, {
    font: headingFont(locale),
    size,
    color: COLORS.ink,
    lineGap: 2,
  });
  doc
    .save()
    .rect(PAGE.margin, bottom + 12, 46, 3)
    .fill(COLORS.accent)
    .restore();
  return bottom + 27;
}

interface PanelOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  value: string;
  accent: string;
}

function drawPanel(doc: PDFKit.PDFDocument, options: PanelOptions) {
  const { x, y, width, height } = options;
  doc.save().roundedRect(x, y, width, height, PANEL.radius).fill(COLORS.surface).restore();
  // Clip the accent bar to the panel so it follows the rounded corners.
  doc
    .save()
    .roundedRect(x, y, width, height, PANEL.radius)
    .clip()
    .rect(x, y, 4, height)
    .fill(options.accent)
    .restore();

  const innerX = x + PANEL.paddingX;
  const innerWidth = width - PANEL.paddingX * 2;
  drawText(doc, options.title.toUpperCase(), y + PANEL.labelOffset, 12, {
    font: 'Inter',
    size: 8,
    color: COLORS.muted,
    characterSpacing: 1,
    x: innerX,
    width: innerWidth,
  });
  const valueBox: TextBox = {
    font: 'Inter',
    size: 9.5,
    color: COLORS.ink,
    lineGap: 3,
    x: innerX,
    width: innerWidth,
  };
  const valueHeight = height - PANEL.valueOffset - PANEL.bottomPadding;
  drawText(
    doc,
    trimToFit(doc, options.value, valueBox, valueHeight),
    y + PANEL.valueOffset,
    valueHeight,
    valueBox,
  );
}

/** Content-sized panel anchored to the bottom of the text column. */
function drawNotePanel(
  doc: PDFKit.PDFDocument,
  title: string,
  value: string,
  bottom: number,
  limits: { min: number; max: number },
) {
  const valueBox: TextBox = {
    font: 'Inter',
    size: 10,
    color: COLORS.ink,
    lineGap: 3.5,
    x: PAGE.margin + PANEL.paddingX,
    width: CONTENT_WIDTH - PANEL.paddingX * 2,
  };
  const chrome = PANEL.valueOffset + PANEL.bottomPadding;
  const trimmed = trimToFit(doc, value, valueBox, limits.max - chrome);
  if (!trimmed) return;
  const height = Math.min(
    limits.max,
    Math.max(limits.min, measure(doc, trimmed, valueBox) + chrome),
  );
  drawPanel(doc, {
    x: PAGE.margin,
    y: bottom - height,
    width: CONTENT_WIDTH,
    height,
    title,
    value: trimmed,
    accent: COLORS.accent,
  });
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
    doc.image(image, x, y, { width, height });
    return;
  }
  doc.save().rect(x, y, width, height).fill(COLORS.surface).restore();
  doc
    .font('Inter')
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text('AI TODAY BRIEF', x, y + height / 2 - 6, {
      width,
      align: 'center',
      characterSpacing: 2,
      lineBreak: false,
    });
}

function drawSourceLine(
  doc: PDFKit.PDFDocument,
  copy: Copy,
  story: WeeklyPdfStory,
  y: number,
  extraLink?: { label: string; url: string },
) {
  const name = story.sourceName?.trim() || compactHost(story.sourceUrl);
  doc
    .font('Inter')
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(`${copy.source}: `, PAGE.margin, y, { width: CONTENT_WIDTH, continued: true });
  doc.fillColor(COLORS.ink).text(name, { link: story.sourceUrl, underline: true, continued: true });
  doc.fillColor(COLORS.muted).text(story.eventDate ? `  ·  ${story.eventDate}` : '', {
    link: null,
    underline: false,
    continued: Boolean(extraLink),
  });
  if (extraLink) {
    doc
      .fillColor(COLORS.muted)
      .text(`  ·  ${extraLink.label}: `, { link: null, underline: false, continued: true });
    doc.fillColor(COLORS.ink).text('aitodaybrief.com', { link: extraLink.url, underline: true });
  }
  return doc.y;
}

function buildCover(doc: PDFKit.PDFDocument, input: WeeklyPdfInput, cover: Buffer | null) {
  const copy = COPY[input.locale];
  doc.save().rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.dark).restore();
  // The art already carries its scrim (see `coverScrim`): it dissolves into the
  // page instead of ending on a seam, and the headline that reaches up into it
  // always sits on dark ground.
  if (cover) doc.image(cover, 0, 0, { width: COVER_IMAGE.width, height: COVER_IMAGE.height });

  doc.save().roundedRect(PAGE.margin, 44, 176, 28, 14).fill(COLORS.accent).restore();
  doc.font('Inter').fontSize(8.5).fillColor(COLORS.dark).text(copy.weekly, PAGE.margin, 54, {
    width: 176,
    align: 'center',
    characterSpacing: 1.2,
    lineBreak: false,
  });

  // Auto-fit: a 100+ character headline at a fixed 39pt overflowed the cover and
  // pushed the standfirst -- and the whole issue block with it -- onto a blank
  // page 2, where light-on-dark type landed on paper stock and vanished.
  const titleBox: TextBox = {
    font: headingFont(input.locale),
    size: 36,
    color: COLORS.white,
    lineGap: 2,
  };
  const titleSize = fitSize(
    doc,
    input.title,
    titleBox,
    input.locale === 'uk' ? [32, 29, 26, 23, 20] : [36, 32, 28, 25, 22],
    COVER.titleMaxHeight,
  );
  const sizedTitle: TextBox = { ...titleBox, size: titleSize };
  const titleHeight = Math.min(
    measure(doc, stripMarkdown(input.title), sizedTitle),
    COVER.titleMaxHeight,
  );
  drawText(doc, input.title, COVER.titleBottom - titleHeight, COVER.titleMaxHeight, sizedTitle);

  const introBox: TextBox = { font: 'Inter', size: 11.5, color: COLORS.coverText, lineGap: 5 };
  drawText(
    doc,
    trimToFit(doc, input.intro, introBox, COVER.introMaxHeight),
    COVER.introTop,
    COVER.introMaxHeight,
    introBox,
  );

  doc.save().rect(PAGE.margin, COVER.detailsY, CONTENT_WIDTH, 1).fill(COLORS.coverRule).restore();
  drawText(doc, input.issueLabel, COVER.detailsY + 20, 16, {
    font: 'InterBold',
    size: 10.5,
    color: COLORS.accent,
  });
  drawText(doc, `${input.weekStart} — ${input.weekEnd}`, COVER.detailsY + 40, 16, {
    font: 'Inter',
    size: 10,
    color: COLORS.coverText,
  });
  drawText(doc, 'aitodaybrief.com', COVER.detailsY + 72, 18, {
    font: 'InterBold',
    size: 11,
    color: COLORS.white,
    link: input.webUrl,
  });
}

function buildContents(
  doc: PDFKit.PDFDocument,
  input: WeeklyPdfInput,
  anchors: Map<number, StoryAnchor>,
) {
  const copy = COPY[input.locale];
  addPage(doc);
  eyebrow(doc, `${input.issueLabel}  ·  ${input.weekStart} — ${input.weekEnd}`);
  const listTop = pageHeading(doc, input.locale, copy.contents, CONTENT_TOP + 28, 30) + 10;

  const note = stripMarkdown(input.editorNote ?? '');
  const listBottom = note ? CONTENT_BOTTOM - 172 : CONTENT_BOTTOM;
  const pitch = Math.min(58, (listBottom - listTop) / input.stories.length);

  input.stories.forEach((story, index) => {
    const y = listTop + pitch * index;
    const feature = story.rank <= 3;
    doc
      .font(headingFont(input.locale))
      .fontSize(22)
      .fillColor(feature ? COLORS.accent : COLORS.rule)
      .text(String(story.rank).padStart(2, '0'), PAGE.margin, y + 1, {
        width: 40,
        lineBreak: false,
      });
    drawText(doc, story.title, y, pitch - 16, {
      font: feature ? 'InterBold' : 'Inter',
      size: 11.5,
      color: COLORS.ink,
      lineGap: 3.5,
      x: PAGE.margin + 52,
      width: CONTENT_WIDTH - 52 - CONTENTS_PAGE_COLUMN,
    });
    const anchor = anchors.get(story.rank);
    if (anchor) {
      drawText(doc, String(anchor.page), y + 2, 14, {
        font: 'Inter',
        size: 10,
        color: COLORS.muted,
        align: 'right',
        x: PAGE.width - PAGE.margin - CONTENTS_PAGE_COLUMN,
        width: CONTENTS_PAGE_COLUMN,
      });
      // The whole row is the hit area, not just the headline: a two-line title
      // otherwise leaves a dead strip readers still aim at.
      doc.goTo(PAGE.margin, y - 6, CONTENT_WIDTH, pitch - 10, anchor.destination);
    }
    if (index < input.stories.length - 1) {
      doc
        .save()
        .rect(PAGE.margin + 52, y + pitch - 11, CONTENT_WIDTH - 52, 0.7)
        .fill(COLORS.rule)
        .restore();
    }
  });

  if (note) {
    drawNotePanel(doc, copy.editor, note, CONTENT_BOTTOM, { min: 96, max: 150 });
  }
}

function buildFeature(
  doc: PDFKit.PDFDocument,
  input: WeeklyPdfInput,
  story: WeeklyPdfStory,
  image: Buffer | null,
) {
  const copy = COPY[input.locale];
  addPage(doc);
  anchorPage(doc, story.rank);
  eyebrow(doc, `${copy.feature} ${String(story.rank).padStart(2, '0')}  ·  ${input.issueLabel}`);

  const titleBox: TextBox = {
    font: headingFont(input.locale),
    size: 26,
    color: COLORS.ink,
    lineGap: 2,
  };
  const titleSize = fitSize(
    doc,
    story.title,
    titleBox,
    input.locale === 'uk' ? [24, 21, 19, 17] : [26, 23, 20, 18],
    FEATURE.titleMaxHeight,
  );
  const sizedTitle: TextBox = { ...titleBox, size: titleSize };
  const titleHeight = Math.min(
    measure(doc, stripMarkdown(story.title), sizedTitle),
    FEATURE.titleMaxHeight,
  );

  const ledeBox: TextBox = { font: 'Inter', size: 11.5, color: COLORS.muted, lineGap: 4.5 };
  const lede = trimToFit(doc, story.summary || story.body, ledeBox, FEATURE.summaryMaxHeight);
  const ledeHeight = Math.min(measure(doc, lede, ledeBox), FEATURE.summaryMaxHeight);

  // Bottom-anchored, so the image and the panel grid below keep the same y on
  // every feature page no matter how long the headline runs.
  const titleTop = Math.max(FEATURE.titleTop, FEATURE.ledeBottom - ledeHeight - 12 - titleHeight);
  const ledeTop = drawText(doc, story.title, titleTop, FEATURE.titleMaxHeight, sizedTitle) + 12;
  drawText(doc, lede, ledeTop, FEATURE.summaryMaxHeight, ledeBox);

  safeImage(doc, image, PAGE.margin, FEATURE.imageTop, FEATURE_IMAGE.width, FEATURE_IMAGE.height);
  // Production passes the headline as alt text; printing it under the image
  // would just repeat the title two centimetres lower.
  const caption = story.imageAlt?.trim() ?? '';
  if (caption && caption.toLowerCase() !== story.title.trim().toLowerCase()) {
    drawText(doc, caption, FEATURE.captionTop, 12, {
      font: 'InterItalic',
      size: 7.8,
      color: COLORS.muted,
    });
  }

  const columnWidth = (CONTENT_WIDTH - FEATURE.panelGap) / 2;
  const panels = [
    { title: copy.why, value: story.why, accent: COLORS.accent },
    { title: copy.practical, value: story.practical, accent: COLORS.teal },
    { title: copy.takeaway, value: story.takeaway, accent: COLORS.violet },
    { title: copy.limitation, value: story.limitation, accent: COLORS.muted },
  ].filter((panel) => Boolean(stripMarkdown(panel.value)));

  panels.forEach((panel, index) => {
    drawPanel(doc, {
      ...panel,
      x: PAGE.margin + (index % 2) * (columnWidth + FEATURE.panelGap),
      y: FEATURE.panelsTop + Math.floor(index / 2) * (FEATURE.panelHeight + FEATURE.panelGap),
      width: columnWidth,
      height: FEATURE.panelHeight,
    });
  });

  drawSourceLine(doc, copy, story, FEATURE.sourceY, { label: copy.fullStory, url: input.webUrl });
}

/**
 * Compact, image-free entries for stories ranked below the top 3 -- headline +
 * summary + source, all on one shared page. The illustrated spread is reserved
 * for the top-3 features; giving every item that treatment is what pushed real
 * editions past the page contract enforced in `generation-worker.ts`.
 */
function buildRadarSection(
  doc: PDFKit.PDFDocument,
  input: WeeklyPdfInput,
  items: WeeklyPdfStory[],
) {
  if (items.length === 0) return;
  const copy = COPY[input.locale];
  addPage(doc);
  // Every radar entry shares this page, so they share its top as the jump
  // target -- landing mid-page would scroll the heading out of view.
  items.forEach((story) => anchorPage(doc, story.rank));
  eyebrow(doc, input.issueLabel);
  const listTop = pageHeading(doc, input.locale, copy.radar, CONTENT_TOP + 28, 26) + 8;
  const pitch = Math.min(154, (CONTENT_BOTTOM - listTop) / items.length);
  const summaryBox: TextBox = { font: 'Inter', size: 10, color: COLORS.muted, lineGap: 3.5 };
  const summaryHeight = pitch - 88;

  items.forEach((story, index) => {
    const y = listTop + pitch * index;
    const titleBottom = drawText(doc, story.title, y, 40, {
      font: headingFont(input.locale),
      size: 13,
      color: COLORS.ink,
      lineGap: 2.5,
    });
    const summaryBottom = drawText(
      doc,
      trimToFit(doc, story.summary, summaryBox, summaryHeight),
      titleBottom + 7,
      summaryHeight,
      summaryBox,
    );
    drawSourceLine(doc, copy, story, summaryBottom + 8);
    if (index < items.length - 1) {
      doc
        .save()
        .rect(PAGE.margin, y + pitch - 18, CONTENT_WIDTH, 0.7)
        .fill(COLORS.rule)
        .restore();
    }
  });
}

async function buildClosing(doc: PDFKit.PDFDocument, input: WeeklyPdfInput) {
  const copy = COPY[input.locale];
  addPage(doc);
  eyebrow(doc, input.issueLabel);
  const listTop = pageHeading(doc, input.locale, copy.closing, CONTENT_TOP + 28, 30) + 8;

  const panelHeight = 142;
  const panelY = CONTENT_BOTTOM - panelHeight;
  const takeaways = input.keyTakeaways.filter((value) => Boolean(stripMarkdown(value))).slice(0, 5);
  const pitch = Math.min(88, (panelY - 26 - listTop) / Math.max(takeaways.length, 1));

  takeaways.forEach((takeaway, index) => {
    const y = listTop + pitch * index;
    doc
      .save()
      .circle(PAGE.margin + 14, y + 13, 13)
      .fill(COLORS.accent)
      .restore();
    doc
      .font('InterBold')
      .fontSize(10)
      .fillColor(COLORS.dark)
      .text(String(index + 1), PAGE.margin, y + 9, {
        width: 28,
        align: 'center',
        lineBreak: false,
      });
    drawText(doc, takeaway, y + 1, pitch - 12, {
      font: 'Inter',
      size: 10.5,
      color: COLORS.ink,
      lineGap: 4,
      x: PAGE.margin + 44,
      width: CONTENT_WIDTH - 44,
    });
  });

  const qr = await QRCode.toBuffer(input.webUrl, {
    type: 'png',
    width: 280,
    margin: 1,
    color: { dark: COLORS.dark, light: '#00000000' },
  });
  doc
    .save()
    .roundedRect(PAGE.margin, panelY, CONTENT_WIDTH, panelHeight, 12)
    .fill(COLORS.surface)
    .restore();
  doc.image(qr, PAGE.margin + 20, panelY + 19, { width: 104, height: 104 });

  const textX = PAGE.margin + 148;
  const textWidth = CONTENT_WIDTH - 168;
  drawText(doc, copy.online, panelY + 26, 46, {
    font: headingFont(input.locale),
    size: 16,
    color: COLORS.ink,
    x: textX,
    width: textWidth,
    link: input.webUrl,
  });
  drawText(doc, input.webUrl, panelY + 74, 24, {
    font: 'Inter',
    size: 8.5,
    color: COLORS.muted,
    x: textX,
    width: textWidth,
    link: input.webUrl,
    underline: true,
  });
  if (input.videoUrl) {
    drawText(doc, copy.video, panelY + 104, 16, {
      font: 'InterBold',
      size: 9,
      color: COLORS.ink,
      x: textX,
      width: textWidth,
      link: input.videoUrl,
      underline: true,
    });
  }
}

function addHeadersAndFooters(doc: PDFKit.PDFDocument, input: WeeklyPdfInput) {
  const copy = COPY[input.locale];
  const range = doc.bufferedPageRange();
  for (let index = 1; index < range.count; index += 1) {
    doc.switchToPage(index);
    doc.save().rect(PAGE.margin, FOOTER_RULE_Y, CONTENT_WIDTH, 0.7).fill(COLORS.rule).restore();
    doc
      .font('Inter')
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text(`AI TODAY BRIEF  ·  ${input.issueLabel}`, PAGE.margin, FOOTER_TEXT_Y, {
        lineBreak: false,
      });
    // "Issue 4  /  2" read as an issue-and-story reference, not as pagination.
    // Spell it out instead: "Page 2 of 7" / "Стор. 2 з 7".
    doc.text(
      `${copy.page} ${index + 1} ${copy.of} ${range.count}`,
      PAGE.width - PAGE.margin - 150,
      FOOTER_TEXT_Y,
      { width: 150, align: 'right', lineBreak: false },
    );
  }
}

export async function renderWeeklyDigestPdf(input: WeeklyPdfInput): Promise<Buffer> {
  if (input.stories.length < 3 || input.stories.length > 7) {
    throw new Error('Weekly PDF requires 3 to 7 stories.');
  }
  const doc = new PDFDocument({
    // PDFKit otherwise eagerly loads the built-in Helvetica AFM in the
    // constructor. Starting with our traced DejaVu font keeps production PDFs
    // independent of that optional package-data lookup.
    font: INTER_FONT,
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
      Creator: 'AI Today Brief Weekly Digest v3',
    },
  });
  registerFonts(doc);

  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const features = input.stories.filter((story) => story.rank <= 3);
  const radar = input.stories.filter((story) => story.rank > 3);
  const [cover, ...featureImages] = await Promise.all([
    imageBuffer(input.coverImageUrl, COVER_IMAGE, true),
    ...features.map((story) => imageBuffer(story.imageUrl, FEATURE_IMAGE)),
  ]);

  doc.addPage({ size: 'A4', margin: 0 });
  buildCover(doc, input, cover ?? null);
  buildContents(doc, input, planAnchors(features, radar));
  features.forEach((story, index) => buildFeature(doc, input, story, featureImages[index] ?? null));
  buildRadarSection(doc, input, radar);
  await buildClosing(doc, input);
  addHeadersAndFooters(doc, input);
  doc.end();
  return completed;
}
