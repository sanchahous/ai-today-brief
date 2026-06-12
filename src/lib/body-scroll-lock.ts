export interface BodyScrollLockSnapshot {
  scrollY: number;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  bodyPaddingRight: string;
}

export function lockBodyScroll(): BodyScrollLockSnapshot | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  const { body, documentElement } = document;
  const scrollY = window.scrollY;
  const scrollbarWidth = Math.max(0, window.innerWidth - documentElement.clientWidth);

  const snapshot: BodyScrollLockSnapshot = {
    scrollY,
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyWidth: body.style.width,
    bodyPaddingRight: body.style.paddingRight,
  };

  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.width = '100%';
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

  return snapshot;
}

export function unlockBodyScroll(snapshot: BodyScrollLockSnapshot | null): void {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !snapshot) return;

  const { body } = document;
  body.style.overflow = snapshot.bodyOverflow;
  body.style.position = snapshot.bodyPosition;
  body.style.top = snapshot.bodyTop;
  body.style.width = snapshot.bodyWidth;
  body.style.paddingRight = snapshot.bodyPaddingRight;

  window.scrollTo(0, snapshot.scrollY);
}
