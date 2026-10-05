import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const RESOLVERS = new Set(['categoryColor', 'categoryArtColor', 'resolveCategoryColor']);
const SLUG_PROP = new Map([
  ['CategoryBadge', 'slug'], ['CategoryBanner', 'slug'],
  ['FilterChip', 'categorySlug'],
]);

function isResolvedOrForwarded(node: ts.PropertyAccessExpression): boolean {
  const parent = node.parent;
  if (ts.isCallExpression(parent) && RESOLVERS.has(parent.expression.getText())) return true;
  if (!ts.isJsxExpression(parent) || !ts.isJsxAttribute(parent.parent)) return false;
  const attribute = parent.parent;
  const opening = attribute.parent.parent;
  if (!ts.isJsxSelfClosingElement(opening) && !ts.isJsxOpeningElement(opening)) return false;
  const slugProp = SLUG_PROP.get(opening.tagName.getText());
  return !!slugProp && ['color', 'categoryColor'].includes(attribute.name.getText()) &&
    opening.attributes.properties.some((prop) => ts.isJsxAttribute(prop) && prop.name.getText() === slugProp);
}

function unsafeDbReads(source: string): string[] {
  const file = ts.createSourceFile('consumer.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isPropertyAccessExpression(node) && ['color', 'categoryColor'].includes(node.name.text) &&
        !isResolvedOrForwarded(node)) hits.push(node.getText());
    ts.forEachChild(node, visit);
  }
  visit(file);
  return hits;
}

function uiFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'admin' || entry.name === 'api') return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return uiFiles(path);
    return path.endsWith('.tsx') && !/(?:opengraph-image|twitter-image|\.test)\./.test(path) ? [path] : [];
  });
}

describe('category DB colour boundary', () => {
  it('blocks direct styles, aliases and missing slug forwarding', () => {
    expect(unsafeDbReads(`const color = category.color; <span style={{ color }} />`)).toEqual(['category.color']);
    expect(unsafeDbReads(`<span style={{ '--cat-color': item.categoryColor }} />`)).toEqual(['item.categoryColor']);
    expect(unsafeDbReads(`<CategoryBadge color={item.categoryColor} />`)).toEqual(['item.categoryColor']);
    expect(unsafeDbReads(`const color = categoryColor(c.slug, c.color); <CategoryBadge slug={item.categorySlug} color={item.categoryColor} />`)).toEqual([]);
  });

  it('routes all public UI DB colours through slug resolvers', () => {
    const hits = ['src/components', 'src/app'].flatMap((dir) => uiFiles(join(process.cwd(), dir)))
      .flatMap((file) => unsafeDbReads(readFileSync(file, 'utf8')).map((hit) => `${file}: ${hit}`));
    expect(hits).toEqual([]);
  });
});
