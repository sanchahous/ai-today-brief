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
      href={`mailto:${email}`}
      onClick={() => trackEvent('sponsor_inquiry_click', { source: 'advertise' })}
      className="rounded-pill bg-accent mt-5 inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-on-accent no-underline"
    >
      <MailIcon size={16} />
      {label}
    </a>
  );
}
