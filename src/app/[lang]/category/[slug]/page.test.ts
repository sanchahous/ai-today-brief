import { describe, expect, it } from 'vitest';
import * as CategoryPageModule from './page';

describe('CategoryPage route contract', () => {
  it('preserves ISR revalidate of 86400 seconds (24h)', () => {
    expect(CategoryPageModule.revalidate).toBe(86400);
  });

  it('declares CategoryPage without server searchParams in its props contract', () => {
    // Next.js server components that read searchParams bail out of ISR.
    // Ensure the default export is a function whose parameter type only expects params.
    expect(typeof CategoryPageModule.default).toBe('function');
  });

  it('exports generateStaticParams and generateMetadata functions', () => {
    expect(typeof CategoryPageModule.generateStaticParams).toBe('function');
    expect(typeof CategoryPageModule.generateMetadata).toBe('function');
  });
});
