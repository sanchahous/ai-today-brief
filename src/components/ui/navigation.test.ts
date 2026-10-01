import { describe, expect, it } from 'vitest';
import { getPageNumbers } from './pagination';
import { breadcrumbJsonLd, type BreadcrumbItem } from '@/components/breadcrumbs';

describe('getPageNumbers', () => {
  it('returns all pages when total is 7 or fewer', () => {
    expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageNumbers(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(getPageNumbers(1, 1)).toEqual([1]);
  });

  it('shows trailing ellipsis when near the beginning (<= 4)', () => {
    expect(getPageNumbers(1, 10)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 10]);
    expect(getPageNumbers(4, 10)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 10]);
  });

  it('shows leading ellipsis when near the end (>= total - 3)', () => {
    expect(getPageNumbers(7, 10)).toEqual([1, 'ellipsis', 6, 7, 8, 9, 10]);
    expect(getPageNumbers(10, 10)).toEqual([1, 'ellipsis', 6, 7, 8, 9, 10]);
  });

  it('shows both ellipses when in the middle', () => {
    expect(getPageNumbers(5, 10)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
    expect(getPageNumbers(6, 12)).toEqual([1, 'ellipsis', 5, 6, 7, 'ellipsis', 12]);
  });
});

describe('breadcrumbJsonLd', () => {
  it('builds valid Schema.org BreadcrumbList payload', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', href: '/en' },
      { label: 'News', href: '/en/news' },
      { label: 'Current Story' },
    ];
    const json = breadcrumbJsonLd(items, 'https://aitodaybrief.com');

    expect(json['@type']).toBe('BreadcrumbList');
    expect(json.itemListElement).toHaveLength(3);
    expect(json.itemListElement[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://aitodaybrief.com/en',
    });
    expect(json.itemListElement[1]).toEqual({
      '@type': 'ListItem',
      position: 2,
      name: 'News',
      item: 'https://aitodaybrief.com/en/news',
    });
    expect(json.itemListElement[2]).toEqual({
      '@type': 'ListItem',
      position: 3,
      name: 'Current Story',
    });
  });

  it('handles empty items array without error', () => {
    const json = breadcrumbJsonLd([], 'https://aitodaybrief.com');
    expect(json).toEqual({
      '@type': 'BreadcrumbList',
      itemListElement: [],
    });
  });
});
