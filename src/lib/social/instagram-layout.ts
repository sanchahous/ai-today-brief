export const INSTAGRAM_SLIDE_WIDTH = 1080;
export const INSTAGRAM_SLIDE_HEIGHT = 1350;

export const INSTAGRAM_LAYOUT = {
  safeLeft: 72,
  safeRight: 72,
  safeTop: 168,
  footerTop: 1210,
  coverHeadlineMax: 72,
  headlineMax: 54,
  bodyMax: 40,
  coverHeadlineMin: 40,
  headlineMin: 36,
  bodyMin: 28,
  lineHeight: 1.22,
  headlineBodyGap: 22,
} as const;

export type InstagramTextMeasurer = {
  measure(text: string, fontSize: number, weight: 'regular' | 'bold'): number;
};

export type InstagramLaidOutLine = {
  text: string;
  fontSize: number;
  weight: 'regular' | 'bold';
  x: number;
  y: number;
  width: number;
  height: number;
};

export type InstagramSlideLayout = {
  fontSize: number;
  bodyFontSize?: number;
  lines: InstagramLaidOutLine[];
  bounds: { x: number; y: number; width: number; height: number };
};

export type InstagramLayoutResult =
  | { ok: true; layout: InstagramSlideLayout }
  | { ok: false; code: 'overflow'; message: string };

function textWidth(measurer: InstagramTextMeasurer, text: string, fontSize: number, weight: 'regular' | 'bold') {
  return measurer.measure(text, fontSize, weight);
}

function wrapParagraph(
  value: string,
  fontSize: number,
  maxWidth: number,
  weight: 'regular' | 'bold',
  measurer: InstagramTextMeasurer,
): string[] | null {
  const words = value.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (textWidth(measurer, word, fontSize, weight) > maxWidth) return null;
    const candidate = current ? `${current} ${word}` : word;
    if (current && textWidth(measurer, candidate, fontSize, weight) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function lineHeight(fontSize: number) {
  return Math.round(fontSize * INSTAGRAM_LAYOUT.lineHeight);
}

function layoutBlock(input: {
  headline: string;
  body?: string;
  headlineMax: number;
  headlineMin: number;
  measurer: InstagramTextMeasurer;
  overlay: boolean;
}): InstagramLayoutResult {
  const maxWidth = INSTAGRAM_SLIDE_WIDTH - INSTAGRAM_LAYOUT.safeLeft - INSTAGRAM_LAYOUT.safeRight;
  const availableTop = input.overlay ? 760 : INSTAGRAM_LAYOUT.safeTop;
  const availableHeight = INSTAGRAM_LAYOUT.footerTop - availableTop;

  for (let headlineSize = input.headlineMax; headlineSize >= input.headlineMin; headlineSize -= 2) {
    const bodySize = input.body
      ? Math.max(
          INSTAGRAM_LAYOUT.bodyMin,
          Math.min(INSTAGRAM_LAYOUT.bodyMax, headlineSize - 12),
        )
      : undefined;
    const headlineLines = wrapParagraph(
      input.headline,
      headlineSize,
      maxWidth,
      'bold',
      input.measurer,
    );
    if (!headlineLines) continue;
    const bodyLines =
      input.body && bodySize
        ? wrapParagraph(input.body, bodySize, maxWidth, 'regular', input.measurer)
        : [];
    if (!bodyLines) continue;

    const headlineBlockHeight = headlineLines.length * lineHeight(headlineSize);
    const bodyBlockHeight = bodyLines.length && bodySize ? bodyLines.length * lineHeight(bodySize) : 0;
    const gap = bodyLines.length ? INSTAGRAM_LAYOUT.headlineBodyGap : 0;
    const totalHeight = headlineBlockHeight + gap + bodyBlockHeight;
    if (totalHeight > availableHeight) continue;

    const startY = input.overlay
      ? INSTAGRAM_LAYOUT.footerTop - totalHeight
      : availableTop + Math.floor((availableHeight - totalHeight) / 2);
    const lines: InstagramLaidOutLine[] = [];
    let y = startY;
    for (const text of headlineLines) {
      const width = textWidth(input.measurer, text, headlineSize, 'bold');
      const height = lineHeight(headlineSize);
      lines.push({
        text,
        fontSize: headlineSize,
        weight: 'bold',
        x: INSTAGRAM_LAYOUT.safeLeft,
        y,
        width,
        height,
      });
      y += height;
    }
    y += gap;
    if (bodySize) {
      for (const text of bodyLines) {
        const width = textWidth(input.measurer, text, bodySize, 'regular');
        const height = lineHeight(bodySize);
        lines.push({
          text,
          fontSize: bodySize,
          weight: 'regular',
          x: INSTAGRAM_LAYOUT.safeLeft,
          y,
          width,
          height,
        });
        y += height;
      }
    }

    const overflow = lines.some(
      (line) =>
        line.x < INSTAGRAM_LAYOUT.safeLeft ||
        line.x + line.width > INSTAGRAM_SLIDE_WIDTH - INSTAGRAM_LAYOUT.safeRight ||
        line.y < INSTAGRAM_LAYOUT.safeTop ||
        line.y + line.height > INSTAGRAM_LAYOUT.footerTop,
    );
    if (overflow) continue;

    return {
      ok: true,
      layout: {
        fontSize: headlineSize,
        ...(bodySize ? { bodyFontSize: bodySize } : {}),
        lines,
        bounds: {
          x: INSTAGRAM_LAYOUT.safeLeft,
          y: startY,
          width: maxWidth,
          height: totalHeight,
        },
      },
    };
  }

  return {
    ok: false,
    code: 'overflow',
    message: 'Instagram slide text does not fit inside the safe area at the minimum font size.',
  };
}

export function layoutInstagramSlideText(input: {
  kind: 'cover' | 'story' | 'comparison' | 'caveat' | 'takeaway';
  headline: string;
  body?: string;
  measurer: InstagramTextMeasurer;
}): InstagramLayoutResult {
  const overlay = input.kind === 'cover' || input.kind === 'story';
  return layoutBlock({
    headline: input.headline,
    body: input.body,
    headlineMax: input.kind === 'cover' ? INSTAGRAM_LAYOUT.coverHeadlineMax : INSTAGRAM_LAYOUT.headlineMax,
    headlineMin: input.kind === 'cover' ? INSTAGRAM_LAYOUT.coverHeadlineMin : INSTAGRAM_LAYOUT.headlineMin,
    measurer: input.measurer,
    overlay,
  });
}

/** Deterministic stand-in for canvas measureText in unit tests. */
export function approximateInstagramMeasurer(glyphFactor = 0.58): InstagramTextMeasurer {
  return {
    measure(text, fontSize) {
      return text.length * fontSize * glyphFactor;
    },
  };
}
