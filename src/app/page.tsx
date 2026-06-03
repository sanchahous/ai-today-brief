import { redirect } from 'next/navigation';
import { DEFAULT_LANG } from '@/lib/site';

// EN-primary: send the bare root to the default locale.
export default function RootIndex() {
  redirect(`/${DEFAULT_LANG}`);
}
