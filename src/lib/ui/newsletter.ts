import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NewsletterVariant = 'band' | 'inline' | 'full';

export type NewsletterStatus =
  | 'idle'
  | 'invalid'
  | 'pending'
  | 'success'
  | 'already_subscribed'
  | 'error'
  | 'not_configured';

export interface NewsletterValidationInput {
  email: string;
  consent?: boolean;
  variant?: NewsletterVariant;
}

export interface NewsletterValidationResult {
  valid: boolean;
  emailError?: string;
  consentError?: string;
}

export function validateNewsletterInput(
  input: NewsletterValidationInput,
  copy: { invalidEmail: string; invalidConsent: string },
): NewsletterValidationResult {
  const emailTrimmed = input.email.trim();
  let emailError: string | undefined;
  let consentError: string | undefined;

  if (!emailTrimmed || !EMAIL_REGEX.test(emailTrimmed)) {
    emailError = copy.invalidEmail;
  }

  if (input.variant === 'full' && !input.consent) {
    consentError = copy.invalidConsent;
  }

  return {
    valid: !emailError && !consentError,
    emailError,
    consentError,
  };
}

export function parseSubscribeResponse(
  httpStatus: number,
  body: unknown,
): 'success' | 'already_subscribed' | 'not_configured' | 'error' {
  if (httpStatus === 503) {
    return 'not_configured';
  }
  if (httpStatus === 409) {
    return 'already_subscribed';
  }
  if (httpStatus >= 200 && httpStatus < 300) {
    if (
      body &&
      typeof body === 'object' &&
      (('already' in body && Boolean((body as { already: unknown }).already)) ||
        ('already_subscribed' in body &&
          Boolean((body as { already_subscribed: unknown }).already_subscribed)) ||
        ('status' in body &&
          ((body as { status: unknown }).status === 'already' ||
            (body as { status: unknown }).status === 'already_subscribed')) ||
        ('state' in body &&
          ((body as { state: unknown }).state === 'already' ||
            (body as { state: unknown }).state === 'already_subscribed')))
    ) {
      return 'already_subscribed';
    }
    return 'success';
  }
  return 'error';
}

export function normalizeNewsletterStatus(status?: string): NewsletterStatus | undefined {
  if (!status) return undefined;
  if (status === 'empty') return 'idle';
  if (status === 'loading') return 'pending';
  if (status === 'confirm') return 'success';
  if (status === 'already' || status === 'subscribed') return 'already_subscribed';
  return status as NewsletterStatus;
}

export function newsletterCopy(lang: Lang) {
  return getStrings(lang).subscribeForm;
}
