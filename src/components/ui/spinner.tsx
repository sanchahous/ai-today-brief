/** Loading mark with a visible label. The ring is static when the reader prefers reduced motion. */
export function Spinner({ label }: { label: string }) {
  return (
    <p role="status" className="text-muted m-0 inline-flex items-center gap-2 text-sm">
      <span
        aria-hidden="true"
        className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
      />
      {label}
    </p>
  );
}
