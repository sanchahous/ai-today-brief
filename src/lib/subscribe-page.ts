import type { Lang } from '@/lib/site';
import type { HomeItem } from '@/lib/home';
import { getHomeData } from '@/lib/home';

/** Lead + up to three secondary stories for the subscribe landing sample block. */
export async function getSubscribeSampleItems(lang: Lang): Promise<HomeItem[]> {
  const { featured, secondary } = await getHomeData(lang);
  const sample: HomeItem[] = [];
  if (featured) sample.push(featured);
  for (const item of secondary) {
    if (sample.length >= 4) break;
    sample.push(item);
  }
  return sample;
}
