'use client';

import { trackEvent } from '@/lib/analytics-client';
import { MailIcon } from '@/components/icons';

export function AdvertiseInquiryCta({
  email,
  label,
}: {
  email: string;
  label: string;
}) {
  return (
    <a
      href={`mailto:${email}?subject=Media%20kit`}
      onClick={() => trackEvent('sponsor_inquiry_click', { source: 'advertise' })}
      className="rounded-pill bg-accent-fill text-on-accent min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity no-underline shrink-0"
    >
      <MailIcon size={18} aria-hidden="true" />
      <span>{label}</span>
    </a>
  );
}
