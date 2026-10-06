import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { SparkleIcon } from '@/components/icons';
import { AiDisclosureNote } from '@/components/ai-disclosure-note';

export type TrustLevel = 'verified' | 'partially-verified' | 'sponsored' | 'ai-assisted';

export function TrustLabel({ lang, level }: { lang: Lang; level: TrustLevel }) {
  const t = getStrings(lang);
  
  if (level === 'ai-assisted') {
    return <AiDisclosureNote lang={lang} variant="pill" />;
  }

  const labelEn = {
    'verified': 'Verified',
    'partially-verified': 'Partially verified',
    'sponsored': 'Sponsored',
  };
  
  const labelUk = {
    'verified': 'Перевірено',
    'partially-verified': 'Частково перевірено',
    'sponsored': 'Партнерський',
  };

  const text = lang === 'uk' ? labelUk[level] : labelEn[level];
  const isVerified = level === 'verified';
  const isSponsored = level === 'sponsored';

  return (
    <div className={`border-line bg-surface text-muted inline-flex flex-wrap items-center gap-2 rounded-pill border px-2.5 py-1.5 text-[0.76rem] ${isVerified ? 'border-success text-success' : ''}`}>
      {isVerified && (
        <span aria-hidden className="inline-flex">
          ✓
        </span>
      )}
      {isSponsored && (
        <span aria-hidden className="inline-flex">
          $
        </span>
      )}
      <span className={isVerified ? 'font-medium text-text' : ''}>{text}</span>
    </div>
  );
}
