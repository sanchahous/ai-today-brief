/**
 * Shared loading fallback for every /admin/* CMS page (providers, weekly,
 * results, costs, ...) -- (cms)/layout.tsx renders AdminNav + this page's
 * children, so one file here covers the whole route group instead of one
 * per subroute.
 */
export default function CmsLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <span
        aria-hidden="true"
        className="size-8 animate-spin rounded-full border-2 border-[#47e4d3] border-r-transparent"
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
