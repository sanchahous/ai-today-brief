import {
  SITE_NAME,
  SITE_URL,
  SITE_TAGLINE,
  EDITOR_NAME,
  CONTACT_EMAIL,
  RSS_URL,
} from '@/lib/site';

export const revalidate = 86400;

/**
 * /llms.txt — a concise, machine-readable map of the site for LLM crawlers and
 * answer engines (AEO). Mirrors the rss.xml route pattern: a plain-text Response
 * built from the single-source-of-truth brand constants. Lists the canonical
 * EN/UK entry points so a model citing us links to the right page.
 */
export async function GET() {
  const body = `# ${SITE_NAME}

> ${SITE_TAGLINE.en} A human-edited daily brief on the models, agents, MCP, developer tools and MLOps that move engineering work forward. English primary, Ukrainian secondary.

## About
- Editor: ${EDITOR_NAME}. Every story is hand-approved and checked against its primary source.
- Languages: English (${SITE_URL}/en), Ukrainian (${SITE_URL}/uk)
- Contact: ${CONTACT_EMAIL}

## Key pages (English)
- Home: ${SITE_URL}/en
- Latest news: ${SITE_URL}/en/news
- Concept hubs (evergreen explainers): ${SITE_URL}/en/concepts
- Guides: ${SITE_URL}/en/guides
- Tools: ${SITE_URL}/en/tools
- About: ${SITE_URL}/en/about
- Editorial policy: ${SITE_URL}/en/editorial-policy
- Author: ${SITE_URL}/en/author

## Key pages (Ukrainian)
- Home: ${SITE_URL}/uk
- News: ${SITE_URL}/uk/news
- Concepts: ${SITE_URL}/uk/concepts
- Guides: ${SITE_URL}/uk/guides

## Feeds
- RSS: ${RSS_URL}
- Sitemap: ${SITE_URL}/sitemap.xml
- News sitemap: ${SITE_URL}/news-sitemap.xml

## Usage
- Content may be cited with attribution to "${SITE_NAME}" and a link to the source page.
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
