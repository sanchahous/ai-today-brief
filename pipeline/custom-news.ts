/**
 * Hand-picked story flow: research by title → summarize (1 item) → draft brief → Telegram.
 * Reuses the same review/publish webhook as the daily pipeline.
 */

import { loadPipelineConfig } from './config';
import {
  researchCustomStory,
  toFetchedArticle,
  toPoolItem,
  type CustomResearchResult,
} from './custom-research';
import {
  createServiceClient,
  logPipelineRun,
  recentPublishedTitles,
  storeItemEmbeddings,
  type PipelineDb,
} from './db';
import { createEmbedder } from './embeddings';
import { logError, logEvent } from './log';
import { notifyReview } from './notify';
import { publish } from './publish';
import { getPipelineDateKyiv } from './schedule';
import { summarizeEditorPick } from './summarize';

export interface CustomNewsOptions {
  topic: string;
  url?: string;
  dryRun?: boolean;
  notify?: boolean;
}

export interface CustomNewsResult {
  research: CustomResearchResult;
  briefId: string;
  edition: number;
  itemCount: number;
  insertedCount: number;
  notified: boolean;
}

function printDryRun(research: CustomResearchResult): void {
  const sourceLines = research.sources.map(
    (s, i) => `  [${i + 1}] ${s.source_name}: ${s.url}`,
  );
  console.log(
    [
      '',
      '──── CUSTOM NEWS · DRY RUN ────',
      `title    ${research.title}`,
      `primary  ${research.url}`,
      `source   ${research.source_name}`,
      `date     ${research.published_at}`,
      `sources  ${research.sources.length}`,
      ...sourceLines,
      '',
      research.synthesis_notes,
      '',
    ].join('\n'),
  );
}

export async function runCustomNews(
  options: CustomNewsOptions,
  deps: {
    config?: ReturnType<typeof loadPipelineConfig>;
    db?: PipelineDb | null;
  } = {},
): Promise<CustomNewsResult> {
  const config = deps.config ?? loadPipelineConfig();
  const dryRun = options.dryRun ?? config.dryRun;
  const shouldNotify = options.notify !== false;

  const research = await researchCustomStory(options.topic, config.geminiApiKey, {
    url: options.url,
    openRouterApiKey: config.openRouterApiKey,
  });

  if (dryRun) {
    printDryRun(research);
    return {
      research,
      briefId: '',
      edition: 0,
      itemCount: 0,
      insertedCount: 0,
      notified: false,
    };
  }

  const db = deps.db ?? createServiceClient(config.supabaseUrl, config.supabaseServiceKey);
  const date = getPipelineDateKyiv();
  const fetched = toFetchedArticle(research);
  const poolItem = toPoolItem(research);

  const recent = await recentPublishedTitles(db, config.recentTitles);
  const { brief, providerModel } = await summarizeEditorPick(
    [poolItem],
    recent,
    research,
    config.geminiApiKey,
    config.openRouterApiKey,
    3,
  );

  if (brief.items.length === 0) {
    throw new Error('[custom-news] editor dropped the story — try a clearer title or --url');
  }

  const result = await publish(db, date, [fetched], brief, `custom:${providerModel}`);
  await logPipelineRun(db, {
    date,
    stage: 'publish',
    status: 'ok',
    meta: {
      custom_news: true,
      topic: options.topic,
      brief_id: result.briefId,
      edition: result.edition,
      items: result.itemCount,
      source_url: research.url,
      source_count: research.sources.length,
    },
  });

  let notified = false;
  if (
    shouldNotify &&
    result.insertedCount > 0 &&
    config.telegramBotToken &&
    config.telegramReviewChatId
  ) {
    await notifyReview(db, config.telegramBotToken, config.telegramReviewChatId, result.briefId, {
      channel: 'custom',
      editorTopic: options.topic,
    });
    notified = true;
  }

  if (result.itemCount > 0) {
    try {
      const embed = await createEmbedder(config.geminiApiKey);
      await storeItemEmbeddings(db, result.briefId, embed);
    } catch (e) {
      logError('custom-news', 'storeItemEmbeddings failed (non-fatal)', e);
    }
  }

  logEvent('info', 'custom-news', 'Custom story drafted', {
    brief_id: result.briefId,
    edition: result.edition,
    items: result.itemCount,
    notified,
    url: research.url,
    sources: research.sources.length,
  });

  return {
    research,
    briefId: result.briefId,
    edition: result.edition,
    itemCount: result.itemCount,
    insertedCount: result.insertedCount,
    notified,
  };
}
