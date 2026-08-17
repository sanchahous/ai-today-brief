import 'server-only';

import { join } from 'node:path';
import PDFDocument from 'pdfkit';

const FONT_DIRECTORY = join(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf');
const SANS = join(FONT_DIRECTORY, 'DejaVuSans.ttf');
const SANS_BOLD = join(FONT_DIRECTORY, 'DejaVuSans-Bold.ttf');
const SERIF = join(FONT_DIRECTORY, 'DejaVuSerif.ttf');
const WIDTH = 540;
const HEIGHT = 675;
const MARGIN = 46;
const CONTENT_WIDTH = WIDTH - MARGIN * 2;
const CONTENT_BOTTOM = HEIGHT - MARGIN - 55;

export interface WeeklyLinkedInDocumentInput {
  title: string;
  theme: string;
  standfirst: string;
  conclusion: string;
  webUrl: string;
  keyTakeaways: string[];
  stories: Array<{
    rank: number;
    placement: 'feature' | 'radar';
    headline: string;
    hook: string;
    summary: string;
    why: string;
    takeaway: string;
    sourceUrl: string;
  }>;
}

function addPage(doc: PDFKit.PDFDocument, page: number, label: string) {
  doc.addPage({ size: [WIDTH, HEIGHT], margin: MARGIN });
  doc.rect(0, 0, WIDTH, HEIGHT).fill('#0b1013');
  doc.font('SansBold').fontSize(12).fillColor('#f7f6f1').text('AI Today Brief', MARGIN, 35);
  doc
    .font('SansBold')
    .fontSize(8)
    .fillColor('#47e4d3')
    .text(label.toUpperCase(), WIDTH - MARGIN - 180, 38, { width: 180, align: 'right' });
  doc
    .font('Sans')
    .fontSize(7)
    .fillColor('#77838a')
    .text(`${page} / 7`, WIDTH - MARGIN - 50, HEIGHT - MARGIN - 48, {
      width: 50,
      align: 'right',
      lineBreak: false,
    });
}

function heading(doc: PDFKit.PDFDocument, value: string, y: number, size = 28, maxHeight = 105) {
  doc.font('Serif').fontSize(size).fillColor('#f7f6f1').text(value, MARGIN, y, {
    width: CONTENT_WIDTH,
    height: maxHeight,
    ellipsis: true,
    lineGap: 3,
  });
  return Math.min(doc.y, y + maxHeight);
}

function section(doc: PDFKit.PDFDocument, label: string, value: string, y: number, maxHeight = 78) {
  doc
    .font('SansBold')
    .fontSize(8)
    .fillColor('#47e4d3')
    .text(label.toUpperCase(), MARGIN, y, { width: CONTENT_WIDTH, lineBreak: false });
  doc
    .font('Sans')
    .fontSize(value.length > 420 ? 10 : 11.5)
    .fillColor('#d7dcde')
    .text(value, MARGIN, y + 18, {
      width: CONTENT_WIDTH,
      height: maxHeight,
      ellipsis: true,
      lineGap: 4,
    });
  return Math.min(doc.y, y + 18 + maxHeight);
}

function sourceLabel(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '').slice(0, 72);
  } catch {
    return sourceUrl.slice(0, 72);
  }
}

export async function renderWeeklyLinkedInDocument(input: WeeklyLinkedInDocumentInput) {
  const features = input.stories.filter((story) => story.placement === 'feature').slice(0, 3);
  const radar = input.stories.filter((story) => story.placement === 'radar');
  if (features.length !== 3 || radar.length < 3 || radar.length > 4) {
    throw new Error('LinkedIn document requires Top 3 plus three or four Radar stories.');
  }

  const doc = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    compress: true,
    size: [WIDTH, HEIGHT],
    margin: MARGIN,
    font: SANS,
    info: {
      Title: input.title,
      Author: 'AI Today Brief',
      Subject: 'Weekly Digest LinkedIn document',
      Creator: 'AI Today Brief Content Studio v2',
    },
  });
  doc.registerFont('Sans', SANS);
  doc.registerFont('SansBold', SANS_BOLD);
  doc.registerFont('Serif', SERIF);
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  addPage(doc, 1, 'Weekly Digest');
  doc
    .font('SansBold')
    .fontSize(10)
    .fillColor('#47e4d3')
    .text(input.theme.toUpperCase(), MARGIN, 170, {
      width: CONTENT_WIDTH,
      height: 18,
      ellipsis: true,
      lineBreak: false,
      characterSpacing: 1.2,
    });
  const coverBottom = heading(doc, input.title, 205, input.title.length > 80 ? 30 : 36, 120);
  const standfirstY = coverBottom + 24;
  doc
    .font('Sans')
    .fontSize(13)
    .fillColor('#c5cccf')
    .text(input.standfirst, MARGIN, standfirstY, {
      width: CONTENT_WIDTH,
      height: Math.max(40, CONTENT_BOTTOM - standfirstY),
      ellipsis: true,
      lineGap: 5,
    });

  features.forEach((story, index) => {
    addPage(doc, index + 2, `Top 3 · ${index + 1}`);
    const titleBottom = heading(
      doc,
      story.headline,
      115,
      story.headline.length > 90 ? 23 : 27,
      105,
    );
    let y = section(doc, 'The change', story.hook || story.summary, titleBottom + 20);
    y = section(doc, 'Why it matters', story.why, y + 18);
    const decisionY = y + 18;
    section(
      doc,
      'Decision',
      story.takeaway,
      decisionY,
      Math.max(36, CONTENT_BOTTOM - decisionY - 18),
    );
  });

  addPage(doc, 5, 'Radar');
  const radarY = heading(doc, 'Four signals worth keeping on your radar', 105, 25, 72) + 18;
  const radarSlotHeight = (CONTENT_BOTTOM - radarY) / radar.length;
  radar.forEach((story, index) => {
    const itemY = radarY + index * radarSlotHeight;
    const headlineHeight = Math.min(36, radarSlotHeight * 0.42);
    doc.font('SansBold').fontSize(11).fillColor('#f7f6f1').text(story.headline, MARGIN, itemY, {
      width: CONTENT_WIDTH,
      height: headlineHeight,
      ellipsis: true,
    });
    doc
      .font('Sans')
      .fontSize(9.5)
      .fillColor('#aeb7bb')
      .text(story.takeaway, MARGIN, itemY + headlineHeight + 5, {
        width: CONTENT_WIDTH,
        height: Math.max(24, radarSlotHeight - headlineHeight - 12),
        ellipsis: true,
        lineGap: 2,
      });
  });

  addPage(doc, 6, 'Next week');
  const actionY = heading(doc, 'What to do next week', 105, 29, 65) + 20;
  const closingY = CONTENT_BOTTOM - 105;
  const takeaways = input.keyTakeaways.slice(0, 5);
  const takeawaySlotHeight = (closingY - actionY - 16) / Math.max(takeaways.length, 1);
  takeaways.forEach((takeaway, index) => {
    const itemY = actionY + index * takeawaySlotHeight;
    doc
      .font('SansBold')
      .fontSize(16)
      .fillColor('#47e4d3')
      .text(String(index + 1), MARGIN, itemY, { width: 20, lineBreak: false });
    doc
      .font('Sans')
      .fontSize(11)
      .fillColor('#d7dcde')
      .text(takeaway, MARGIN + 32, itemY, {
        width: CONTENT_WIDTH - 32,
        height: Math.max(24, takeawaySlotHeight - 8),
        ellipsis: true,
        lineGap: 3,
      });
  });
  section(doc, 'Editor’s closing note', input.conclusion, closingY, CONTENT_BOTTOM - closingY - 18);

  addPage(doc, 7, 'Sources');
  const sourceY = heading(doc, 'Read the evidence, not just the summary', 105, 25, 65) + 20;
  const ctaY = CONTENT_BOTTOM - 24;
  const sourceSlotHeight = (ctaY - sourceY - 10) / input.stories.length;
  input.stories.forEach((story, index) => {
    const itemY = sourceY + index * sourceSlotHeight;
    doc
      .font('SansBold')
      .fontSize(9.5)
      .fillColor('#f7f6f1')
      .text(`${story.rank}. ${story.headline}`, MARGIN, itemY, {
        width: CONTENT_WIDTH,
        height: Math.min(30, sourceSlotHeight - 16),
        ellipsis: true,
      });
    doc
      .font('Sans')
      .fontSize(7.5)
      .fillColor('#8f9aa0')
      .text(sourceLabel(story.sourceUrl), MARGIN, itemY + Math.min(32, sourceSlotHeight - 14), {
        width: CONTENT_WIDTH,
        lineBreak: false,
        link: story.sourceUrl,
      });
  });
  doc
    .font('SansBold')
    .fontSize(11)
    .fillColor('#47e4d3')
    .text('Read the full edition', MARGIN, ctaY, {
      link: input.webUrl,
      underline: true,
    });

  if (doc.bufferedPageRange().count !== 7) {
    throw new Error(
      `LinkedIn document rendered ${doc.bufferedPageRange().count} pages; expected 7.`,
    );
  }
  doc.end();
  return completed;
}
