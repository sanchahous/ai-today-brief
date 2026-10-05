import { ViewTransition } from 'react';

/** Cross-fades route content inside `<main>`; header/footer stay outside (AH-6.3). */
export default function LangTemplate({ children }: { children: React.ReactNode }) {
  return <ViewTransition default="route-crossfade">{children}</ViewTransition>;
}
