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

function heading(doc: PDFKit.PDFDocument, value: string, y: number, size = 28) {
  doc
    .font('Serif')
    .fontSize(size)
    .fillColor('#f7f6f1')
    .text(value, MARGIN, y, {
      width: WIDTH - MARGIN * 2,
      lineGap: 3,
    });
  return doc.y;
}

function section(doc: PDFKit.PDFDocument, label: string, value: string, y: number) {
  doc.font('SansBold').fontSize(8).fillColor('#47e4d3').text(label.toUpperCase(), MARGIN, y);
  doc
    .font('Sans')
    .fontSize(value.length > 420 ? 10 : 11.5)
    .fillColor('#d7dcde')
    .text(value, MARGIN, y + 18, { width: WIDTH - MARGIN * 2, lineGap: 4 });
  return doc.y;
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
    .text(input.theme.toUpperCase(), MARGIN, 170, { characterSpacing: 1.2 });
  const coverBottom = heading(doc, input.title, 205, input.title.length > 80 ? 30 : 36);
  doc
    .font('Sans')
    .fontSize(13)
    .fillColor('#c5cccf')
    .text(input.standfirst, MARGIN, coverBottom + 24, { width: WIDTH - MARGIN * 2, lineGap: 5 });

  features.forEach((story, index) => {
    addPage(doc, index + 2, `Top 3 · ${index + 1}`);
    const titleBottom = heading(doc, story.headline, 115, story.headline.length > 90 ? 23 : 27);
    let y = section(doc, 'The change', story.hook || story.summary, titleBottom + 24);
    y = section(doc, 'Why it matters', story.why, y + 24);
    section(doc, 'Decision', story.takeaway, y + 24);
  });

  addPage(doc, 5, 'Radar');
  let radarY = heading(doc, 'Four signals worth keeping on your radar', 105, 25) + 24;
  radar.forEach((story) => {
    doc
      .font('SansBold')
      .fontSize(11)
      .fillColor('#f7f6f1')
      .text(story.headline, MARGIN, radarY, {
        width: WIDTH - MARGIN * 2,
      });
    doc
      .font('Sans')
      .fontSize(9.5)
      .fillColor('#aeb7bb')
      .text(story.takeaway, MARGIN, doc.y + 5, { width: WIDTH - MARGIN * 2, lineGap: 2 });
    radarY = doc.y + 17;
  });

  addPage(doc, 6, 'Next week');
  let actionY = heading(doc, 'What to do next week', 105, 29) + 25;
  input.keyTakeaways.slice(0, 5).forEach((takeaway, index) => {
    doc
      .font('SansBold')
      .fontSize(16)
      .fillColor('#47e4d3')
      .text(String(index + 1), MARGIN, actionY);
    doc
      .font('Sans')
      .fontSize(11)
      .fillColor('#d7dcde')
      .text(takeaway, MARGIN + 32, actionY, { width: WIDTH - MARGIN * 2 - 32, lineGap: 3 });
    actionY = doc.y + 18;
  });
  section(doc, 'Editor’s closing note', input.conclusion, actionY + 12);

  addPage(doc, 7, 'Sources');
  let sourceY = heading(doc, 'Read the evidence, not just the summary', 105, 25) + 25;
  input.stories.forEach((story) => {
    doc
      .font('SansBold')
      .fontSize(9.5)
      .fillColor('#f7f6f1')
      .text(`${story.rank}. ${story.headline}`, MARGIN, sourceY, { width: WIDTH - MARGIN * 2 });
    doc
      .font('Sans')
      .fontSize(7.5)
      .fillColor('#8f9aa0')
      .text(story.sourceUrl, MARGIN, doc.y + 3, {
        width: WIDTH - MARGIN * 2,
        link: story.sourceUrl,
      });
    sourceY = doc.y + 12;
  });
  doc
    .font('SansBold')
    .fontSize(11)
    .fillColor('#47e4d3')
    .text('Read the full edition', MARGIN, Math.min(sourceY + 18, HEIGHT - 90), {
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
