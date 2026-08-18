const SERVICE_MARKER_RE = /<(PART|SLIDE|CAPTION)>/i;

export function containsServiceMarkers(value: string) {
  return SERVICE_MARKER_RE.test(value);
}

export function serviceMarkerIssueMessage() {
  return 'Remove service markers such as <PART>, <SLIDE>, or <CAPTION> from visible copy.';
}
