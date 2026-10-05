import { RouteViewTransition } from '@/components/motion/route-view-transition';

/** Cross-fades route content inside `<main>`; header/footer stay outside (AH-6.3). */
export default function LangTemplate({ children }: { children: React.ReactNode }) {
  return <RouteViewTransition>{children}</RouteViewTransition>;
}
