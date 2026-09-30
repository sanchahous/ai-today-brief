import type { Page } from '@playwright/test';

export type PageInspection = {
  overflow: string[];
  smallText: string[];
  smallTargets: string[];
  headings: number[];
  h1: number;
  skips: number;
  images: string[];
  clipped: string[];
  scrollWidth: number;
  clientWidth: number;
};

/** DOM measurements shared by the fast gate and the full legacy report. */
export async function inspectPage(page: Page, coarsePointer: boolean): Promise<PageInspection> {
  return page.evaluate((coarse) => {
    const out: PageInspection = {
      overflow: [],
      smallText: [],
      smallTargets: [],
      headings: [],
      h1: 0,
      skips: 0,
      images: [],
      clipped: [],
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
    const vw = out.clientWidth;
    const visible = (el: Element): boolean => {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)
        return false;
      if (el.closest('[aria-hidden="true"],.sr-only,[hidden],dialog:not([open]),template'))
        return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const intentionalScroller = (el: Element): boolean => {
      const region = el.closest('[role="region"]');
      if (!region) return false;
      const style = getComputedStyle(region);
      return (
        ['auto', 'scroll'].includes(style.overflowX) && region.scrollWidth > region.clientWidth
      );
    };

    if (out.scrollWidth > vw + 1) {
      for (const el of document.querySelectorAll('body *')) {
        const rect = el.getBoundingClientRect();
        if (!rect.width || rect.right <= vw + 1 || getComputedStyle(el).position === 'fixed')
          continue;
        if (intentionalScroller(el)) continue;
        out.overflow.push(
          `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')} → ${Math.round(rect.right)}px`,
        );
        if (out.overflow.length >= 8) break;
      }
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent?.trim()) continue;
      const el = node.parentElement;
      if (!el || seen.has(el) || el.closest('svg,script,style')) continue;
      seen.add(el);
      if (!visible(el)) continue;
      const size = Number.parseFloat(getComputedStyle(el).fontSize);
      if (size < 12)
        out.smallText.push(
          `${size}px ${el.tagName.toLowerCase()} “${node.textContent.trim().slice(0, 28)}”`,
        );
    }
    for (const el of document.querySelectorAll('svg text')) {
      const svg = el.closest('svg');
      if (!svg || !visible(svg)) continue;
      const width = svg.getBoundingClientRect().width;
      const scale = width / (svg.viewBox?.baseVal?.width || width || 1);
      const size =
        Number.parseFloat(el.getAttribute('font-size') || getComputedStyle(el).fontSize) * scale;
      if (size < 12)
        out.smallText.push(`svg ${size.toFixed(1)}px “${el.textContent?.trim().slice(0, 20)}”`);
    }

    if (coarse) {
      const targets = document.querySelectorAll(
        'a[href],button,input,select,textarea,summary,[role="button"],label:has(input)',
      );
      for (const el of targets) {
        if (!visible(el)) continue;
        if (
          el.matches('a') &&
          el.closest('p,li,td,dd,figcaption,label,.reading,.prose') &&
          !el.matches('.button,.chip')
        )
          continue;
        if (el.matches('a') && getComputedStyle(el, '::after').position === 'absolute') continue;
        if (el.matches('input[type="checkbox"],input[type="radio"]') && el.closest('label'))
          continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 44 || rect.height < 44) {
          const label = (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24);
          out.smallTargets.push(
            `${Math.round(rect.width)}×${Math.round(rect.height)} ${el.tagName.toLowerCase()} “${label}”`,
          );
        }
      }
    }

    out.headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .filter(visible)
      .map((el) => Number(el.tagName[1]));
    out.h1 = out.headings.filter((level) => level === 1).length;
    out.skips = out.headings.reduce(
      (count, level, index, all) => (index && level > all[index - 1] + 1 ? count + 1 : count),
      0,
    );
    out.images = [...document.images]
      .filter((img) => img.getAttribute('alt') === null)
      .map((img) => img.currentSrc || img.src);

    for (const el of document.querySelectorAll('h1,h2,h3,p,a,button,label,span,li,dt,dd,td,th')) {
      if (!visible(el)) continue;
      const style = getComputedStyle(el);
      if (![style.overflow, style.overflowX, style.overflowY].includes('hidden')) continue;
      if (!el.textContent?.trim() || style.textOverflow === 'ellipsis') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1 || style.clipPath === 'inset(50%)') continue;
      if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) {
        out.clipped.push(`${el.tagName.toLowerCase()} “${el.textContent.trim().slice(0, 30)}”`);
        if (out.clipped.length >= 8) break;
      }
    }
    return out;
  }, coarsePointer);
}
