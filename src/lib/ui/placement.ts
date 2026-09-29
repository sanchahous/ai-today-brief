export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Placement {
  vertical: 'bottom' | 'top';
  horizontal: 'start' | 'end';
}

/**
 * Collision-aware placement for a panel anchored to a trigger. Prefers below/`preferred` alignment,
 * flips when the panel would overflow the viewport and the opposite side has more room.
 * `gap` is the trigger↔panel distance in px.
 */
export function computePlacement(
  trigger: Box,
  panel: Size,
  viewport: Size,
  preferred: Placement['horizontal'] = 'start',
  gap = 8,
): Placement {
  const roomBelow = viewport.height - trigger.bottom - gap;
  const roomAbove = trigger.top - gap;
  const vertical: Placement['vertical'] =
    panel.height > roomBelow && roomAbove > roomBelow ? 'top' : 'bottom';

  // `start` grows rightwards from trigger.left, `end` grows leftwards from trigger.right.
  const fitsStart = trigger.left + panel.width <= viewport.width;
  const fitsEnd = trigger.right - panel.width >= 0;
  let horizontal = preferred;
  if (preferred === 'start' && !fitsStart && fitsEnd) horizontal = 'end';
  else if (preferred === 'end' && !fitsEnd && fitsStart) horizontal = 'start';

  return { vertical, horizontal };
}
