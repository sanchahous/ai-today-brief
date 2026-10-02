import { describe, expect, it } from 'vitest';
import {
  EMAIL_REGEX,
  newsletterCopy,
  normalizeNewsletterStatus,
  parseSubscribeResponse,
  validateNewsletterInput,
} from './newsletter';

describe('newsletter helpers', () => {
  const copyEn = newsletterCopy('en');
  const copyUk = newsletterCopy('uk');

  describe('EMAIL_REGEX', () => {
    it('accepts valid email addresses', () => {
      expect(EMAIL_REGEX.test('dev@example.com')).toBe(true);
      expect(EMAIL_REGEX.test('user.name+tag@sub.domain.org')).toBe(true);
    });

    it('rejects invalid email formats', () => {
      expect(EMAIL_REGEX.test('')).toBe(false);
      expect(EMAIL_REGEX.test('not-an-email')).toBe(false);
      expect(EMAIL_REGEX.test('@missinguser.com')).toBe(false);
      expect(EMAIL_REGEX.test('user@domain')).toBe(false);
      expect(EMAIL_REGEX.test('spaces in@email.com')).toBe(false);
    });
  });

  describe('validateNewsletterInput', () => {
    it('validates band/inline variant requiring only email', () => {
      const invalid = validateNewsletterInput(
        { email: 'bad-email', variant: 'band' },
        copyEn,
      );
      expect(invalid.valid).toBe(false);
      expect(invalid.emailError).toBe(copyEn.invalidEmail);
      expect(invalid.consentError).toBeUndefined();

      const valid = validateNewsletterInput(
        { email: 'reader@example.com', variant: 'inline' },
        copyEn,
      );
      expect(valid.valid).toBe(true);
      expect(valid.emailError).toBeUndefined();
      expect(valid.consentError).toBeUndefined();
    });

    it('validates full variant requiring both email and consent', () => {
      const noConsent = validateNewsletterInput(
        { email: 'reader@example.com', consent: false, variant: 'full' },
        copyEn,
      );
      expect(noConsent.valid).toBe(false);
      expect(noConsent.consentError).toBe(copyEn.invalidConsent);
      expect(noConsent.emailError).toBeUndefined();

      const noEmailNoConsent = validateNewsletterInput(
        { email: '', consent: false, variant: 'full' },
        copyUk,
      );
      expect(noEmailNoConsent.valid).toBe(false);
      expect(noEmailNoConsent.emailError).toBe(copyUk.invalidEmail);
      expect(noEmailNoConsent.consentError).toBe(copyUk.invalidConsent);

      const allOk = validateNewsletterInput(
        { email: 'reader@example.com', consent: true, variant: 'full' },
        copyUk,
      );
      expect(allOk.valid).toBe(true);
      expect(allOk.emailError).toBeUndefined();
      expect(allOk.consentError).toBeUndefined();
    });
  });

  describe('parseSubscribeResponse', () => {
    it('returns not_configured on 503', () => {
      expect(parseSubscribeResponse(503, { error: 'not_configured' })).toBe('not_configured');
    });

    it('returns already_subscribed on 409', () => {
      expect(parseSubscribeResponse(409, { error: 'already_subscribed' })).toBe('already_subscribed');
    });

    it('detects already subscribed signals in 200 payload', () => {
      expect(parseSubscribeResponse(200, { ok: true, already: true })).toBe('already_subscribed');
      expect(parseSubscribeResponse(200, { ok: true, already_subscribed: true })).toBe('already_subscribed');
      expect(parseSubscribeResponse(200, { status: 'already_subscribed' })).toBe('already_subscribed');
      expect(parseSubscribeResponse(200, { state: 'already' })).toBe('already_subscribed');
    });

    it('returns success on 200 without already signals', () => {
      expect(parseSubscribeResponse(200, { ok: true })).toBe('success');
      expect(parseSubscribeResponse(201, { id: 'sub_123' })).toBe('success');
    });

    it('never returns success on non-2xx', () => {
      expect(parseSubscribeResponse(400, { error: 'invalid_email' })).toBe('error');
      expect(parseSubscribeResponse(500, { error: 'server_error' })).toBe('error');
      expect(parseSubscribeResponse(502, { error: 'provider_failed' })).toBe('error');
      expect(parseSubscribeResponse(0, null)).toBe('error');
    });
  });

  describe('normalizeNewsletterStatus', () => {
    it('normalizes legacy and alias status names', () => {
      expect(normalizeNewsletterStatus('empty')).toBe('idle');
      expect(normalizeNewsletterStatus('loading')).toBe('pending');
      expect(normalizeNewsletterStatus('confirm')).toBe('success');
      expect(normalizeNewsletterStatus('already')).toBe('already_subscribed');
      expect(normalizeNewsletterStatus('subscribed')).toBe('already_subscribed');
      expect(normalizeNewsletterStatus('idle')).toBe('idle');
      expect(normalizeNewsletterStatus('pending')).toBe('pending');
      expect(normalizeNewsletterStatus('success')).toBe('success');
      expect(normalizeNewsletterStatus('error')).toBe('error');
      expect(normalizeNewsletterStatus(undefined)).toBeUndefined();
    });
  });

  describe('newsletterCopy', () => {
    it('contains all required keys in en and uk', () => {
      const keys = [
        'emailLabel',
        'emailPlaceholder',
        'button',
        'buttonPending',
        'editionLabel',
        'editionEn',
        'editionUk',
        'consentLabel',
        'privacyPolicy',
        'note',
        'invalidEmail',
        'invalidConsent',
        'successMessage',
        'alreadySubscribed',
        'notConfigured',
        'failed',
        'proofDoubleOptIn',
        'proofSources',
        'proofOnePerDay',
        'proofUnsubscribe',
      ] as const;

      for (const k of keys) {
        expect(typeof copyEn[k]).toBe('string');
        expect(copyEn[k].length).toBeGreaterThan(0);
        expect(typeof copyUk[k]).toBe('string');
        expect(copyUk[k].length).toBeGreaterThan(0);
      }
    });
  });
});
