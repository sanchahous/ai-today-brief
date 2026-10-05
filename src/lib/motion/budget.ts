import { MAX_ACTIVE_UI_ANIMATIONS } from '@/lib/motion/constants';

/** Tracks active UI WAAPI animations against the Tension v3 cap. */
export class MotionBudget {
  private readonly active = new Set<Animation>();
  private peak = 0;

  get activeCount(): number {
    return this.active.size;
  }

  get peakCount(): number {
    return this.peak;
  }

  canStart(): boolean {
    return this.active.size < MAX_ACTIVE_UI_ANIMATIONS;
  }

  track(animation: Animation, onRelease?: () => void): void {
    this.active.add(animation);
    this.peak = Math.max(this.peak, this.active.size);
    const done = () => {
      this.active.delete(animation);
      onRelease?.();
    };
    animation.onfinish = done;
    animation.oncancel = done;
  }

  cancelAll(): void {
    for (const animation of [...this.active]) animation.cancel();
    this.active.clear();
  }

  resetPeak(): void {
    this.peak = 0;
  }
}
