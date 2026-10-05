/** Text nodes and other non-Element targets lack `.closest` — guard before delegating. */
export function closestFromEventTarget(
  target: EventTarget | null,
  selector: string,
): Element | null {
  return target instanceof Element ? target.closest(selector) : null;
}
