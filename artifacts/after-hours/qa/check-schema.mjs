// Structured-data contract check: every route's JSON-LD graph is parsed from the live prototype and
// each node is checked for the properties Google's rich-result docs require or recommend.
// Usage (preview server on 4318): node artifacts/after-hours/qa/check-schema.mjs [--lang=en]
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.QA_BASE || "http://127.0.0.1:4318/after-hours/";
const langArg = process.argv.find((a) => a.startsWith("--lang="))?.split("=")[1];
const langs = langArg ? [langArg] : ["en", "uk"];
const REQUIRED = {
  NewsArticle: ["headline", "image", "datePublished", "dateModified", "author", "publisher", "mainEntityOfPage"],
  TechArticle: ["headline", "dateModified", "author", "publisher"],
  VideoObject: ["name", "description", "thumbnailUrl", "uploadDate"],
  FAQPage: ["mainEntity"],
  Question: ["name", "acceptedAnswer"],
  Answer: ["text"],
  BreadcrumbList: ["itemListElement"],
  ItemList: ["itemListElement"],
  ListItem: ["position"],
  CollectionPage: ["name", "url"],
  WebSite: ["name", "url"],
  SearchAction: ["target", "query-input"],
  Organization: ["name", "url", "logo"],
  Person: ["name"],
  WebApplication: ["name", "applicationCategory", "offers"],
  Offer: ["price", "priceCurrency"],
  DefinedTermSet: ["name", "hasDefinedTerm"],
  DefinedTerm: ["name"],
  ProfilePage: ["mainEntity"],
  AboutPage: ["name"],
};
const problems = [];
const seenTypes = new Set();
function walk(node, where, route) {
  if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${where}[${i}]`, route));
  if (!node || typeof node !== "object") return;
  const type = node["@type"];
  if (type) {
    seenTypes.add(type);
    // A bare {"@id"} reference is fine; a typed node must carry its required properties.
    for (const key of REQUIRED[type] || []) {
      const value = node[key];
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) problems.push(`${route}: ${type} ${where} missing "${key}"`);
    }
    if (type === "ListItem" && !(node.item || node.url || node.name)) problems.push(`${route}: ListItem ${where} needs item/url/name`);
  }
  for (const [key, value] of Object.entries(node)) if (value && typeof value === "object") walk(value, `${where}.${key}`, route);
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(base + "#/home", { waitUntil: "load" });
const routes = await page.evaluate(() => routes.slice()); // eslint-disable-line no-undef
let graphs = 0;
for (const lang of langs) {
  for (const route of routes) {
    await page.goto(`${base}?lang=${lang}#/${route}`, { waitUntil: "load" });
    await page.evaluate((lg) => window.__qaSet({ lang: lg }), lang);
    const raw = await page.evaluate(() => document.getElementById("route-jsonld")?.textContent || null);
    if (!raw) continue;
    let json;
    try {
      json = JSON.parse(raw);
    } catch (error) {
      problems.push(`${lang}/${route}: invalid JSON (${error.message})`);
      continue;
    }
    graphs++;
    if (json["@context"] !== "https://schema.org") problems.push(`${lang}/${route}: @context is not https://schema.org`);
    walk(json["@graph"], "@graph", `${lang}/${route}`);
  }
}
await browser.close();
const report = { date: new Date().toISOString(), langs, graphs, types: [...seenTypes].sort(), problems };
await writeFile(path.join(here, "schema-report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ graphs, types: report.types.length, problems: problems.length }, null, 2));
problems.slice(0, 40).forEach((p) => console.log(" -", p));
if (problems.length) process.exitCode = 1;
