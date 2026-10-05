import { describe, expect, it, vi } from 'vitest';
import { getSubscribeSampleItems, getSubscribeSampleEdition } from './subscribe-page';
import * as homeModule from '@/lib/home';
import * as briefsModule from '@/lib/briefs';
import type { HomeData, HomeItem } from '@/lib/home';
import type { BriefSummary, BriefItemCard } from '@/lib/briefs';

describe('subscribe-page', () => {
  it('collects up to 4 items from getHomeData featured and secondary', async () => {
    const mockItem = (id: string): HomeItem => ({
      id,
      rank: 1,
      title: `Story ${id}`,
      summary: `Summary ${id}`,
      why: 'Why it matters',
      date: '2026-10-01',
      hasVideo: false,
      tools: [],
      topics: [],
      categorySlug: 'agents',
      categoryName: 'Agents',
      categoryColor: '#fff',
      sourceName: 'test',
      readMinutes: 3,
      imageUrl: null,
      href: `/en/news/agents/${id}`,
    });

    vi.spyOn(homeModule, 'getHomeData').mockResolvedValueOnce({
      featured: mockItem('1'),
      secondary: [mockItem('2'), mockItem('3'), mockItem('4'), mockItem('5')],
    } as unknown as HomeData);

    const items = await getSubscribeSampleItems('en');
    expect(items).toHaveLength(4);
    expect(items.map((i) => i.id)).toEqual(['1', '2', '3', '4']);
  });

  it('handles getHomeData without featured item', async () => {
    const mockItem = (id: string): HomeItem => ({
      id,
      rank: 1,
      title: `Story ${id}`,
      summary: `Summary ${id}`,
      why: 'Why it matters',
      date: '2026-10-01',
      hasVideo: false,
      tools: [],
      topics: [],
      categorySlug: 'tools',
      categoryName: 'Tools',
      categoryColor: '#fff',
      sourceName: 'test',
      readMinutes: 2,
      imageUrl: null,
      href: `/en/news/tools/${id}`,
    });

    vi.spyOn(homeModule, 'getHomeData').mockResolvedValueOnce({
      featured: null,
      secondary: [mockItem('a'), mockItem('b')],
    } as unknown as HomeData);

    const items = await getSubscribeSampleItems('uk');
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('a');
  });

  it('returns real latest daily brief edition when available', async () => {
    const mockBriefItem: BriefItemCard = {
      id: 'item-1',
      rank: 1,
      categorySlug: 'agents',
      categoryName: 'Agents',
      categoryColor: '#abc',
      slug: 'item-1',
      title: 'Agent breakthrough',
      summary: 'Summary text',
      why: 'Why it matters',
      takeaways: ['Key takeaway'],
      actionItems: ['Action item'],
      sourceName: 'Lab Blog',
      readMinutes: 3,
      tools: ['Claude'],
    };

    const mockBrief: BriefSummary = {
      id: 'brief-1',
      date: '2026-10-04',
      slug: '2026-10-04-brief',
      title: 'AI Today Brief · 4 Oct 2026',
      intro: 'Intro text',
      items: [mockBriefItem],
    };

    vi.spyOn(briefsModule, 'getLatestBrief').mockResolvedValueOnce(mockBrief);

    const edition = await getSubscribeSampleEdition('en');
    expect(edition.title).toBe('AI Today Brief · 4 Oct 2026');
    expect(edition.href).toBe('/en/2026-10-04-brief');
    expect(edition.items).toHaveLength(1);
    expect(edition.items[0]).toEqual({
      id: 'item-1',
      title: 'Agent breakthrough',
      categorySlug: 'agents',
      categoryName: 'Agents',
      categoryColor: '#abc',
    });
  });

  it('falls back gracefully to home items if getLatestBrief returns null', async () => {
    vi.spyOn(briefsModule, 'getLatestBrief').mockResolvedValueOnce(null);

    const mockHomeItem: HomeItem = {
      id: 'fallback-1',
      rank: 1,
      title: 'Fallback story',
      summary: 'Fallback summary',
      why: 'Why it matters',
      date: '2026-10-01',
      hasVideo: false,
      tools: [],
      topics: [],
      categorySlug: 'models',
      categoryName: 'Models',
      categoryColor: '#def',
      sourceName: 'test',
      readMinutes: 2,
      imageUrl: null,
      href: '/en/news/models/fallback-1',
    };

    vi.spyOn(homeModule, 'getHomeData').mockResolvedValueOnce({
      featured: mockHomeItem,
      secondary: [],
    } as unknown as HomeData);

    const edition = await getSubscribeSampleEdition('uk');
    expect(edition.title).toBe('Щоденний випуск');
    expect(edition.href).toBe('/uk/digests');
    expect(edition.items).toHaveLength(1);
    expect(edition.items[0].id).toBe('fallback-1');
  });

  it('falls back gracefully if getLatestBrief throws', async () => {
    vi.spyOn(briefsModule, 'getLatestBrief').mockRejectedValueOnce(new Error('DB failure'));

    vi.spyOn(homeModule, 'getHomeData').mockResolvedValueOnce({
      featured: null,
      secondary: [],
    } as unknown as HomeData);

    const edition = await getSubscribeSampleEdition('en');
    expect(edition.title).toBe('Daily edition');
    expect(edition.href).toBe('/en/digests');
    expect(edition.items).toHaveLength(0);
  });
});
