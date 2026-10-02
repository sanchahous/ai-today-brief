'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight } from '@/components/icons';
import { trackEvent, type Params } from '@/lib/analytics-client';
import {
  ANALYTICS_EVENTS,
  newsletterFunnelParams,
  newsletterSubmitErrorParams,
  shouldCountNewsletterImpression,
} from '@/lib/analytics-events';
import type { Lang } from '@/lib/site';
import { Button, Checkbox, Notice, SegmentedControl, TextInput } from '@/components/ui';
import {
  newsletterCopy,
  normalizeNewsletterStatus,
  parseSubscribeResponse,
  validateNewsletterInput,
  type NewsletterStatus,
  type NewsletterVariant,
} from '@/lib/ui/newsletter';
import { reportWeeklySignup } from '@/lib/weekly-digest/attribution-client';

export type { NewsletterStatus, NewsletterVariant } from '@/lib/ui/newsletter';

export interface NewsletterFormProps {
  lang: Lang;
  variant?: NewsletterVariant;
  status?: NewsletterStatus | string;
  placement?: string;
  className?: string;
  placeholder?: string;
  button?: string;
  done?: string;
  notConfigured?: string;
  failed?: string;
  showProof?: boolean;
}

/**
 * Shared NewsletterForm component supporting band, inline and full variants,
 * with full state matrix: empty/idle, invalid, pending, success, already_subscribed,
 * error and not_configured.
 */
export function NewsletterForm({
  lang,
  variant = 'band',
  status: statusProp,
  placement = 'newsletter-band',
  className = '',
  placeholder,
  button,
  done,
  notConfigured,
  failed,
  showProof = true,
}: NewsletterFormProps) {
  const copy = newsletterCopy(lang);
  const normalizedPropStatus = normalizeNewsletterStatus(statusProp);

  const [email, setEmail] = useState('');
  const [edition, setEdition] = useState<Lang>(lang);
  const [consent, setConsent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [internalStatus, setInternalStatus] = useState<NewsletterStatus>('idle');

  const isSubmittingRef = useRef(false);
  const startedRef = useRef(false);

  const effectiveStatus: NewsletterStatus = normalizedPropStatus ?? internalStatus;
  const funnelParams = newsletterFunnelParams(placement, lang);

  const emitAnalytics = (event: string, params: Params) => {
    trackEvent(event, params);
    if (typeof window !== 'undefined') {
      const w = window as unknown as { dataLayer?: Array<{ event?: string; [key: string]: unknown }> };
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ event, ...params });
    }
  };

  useEffect(() => {
    if (shouldCountNewsletterImpression(placement)) {
      emitAnalytics(ANALYTICS_EVENTS.newsletterImpression, funnelParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- placement and lang are static per mount
  }, [placement]);

  const markStarted = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    emitAnalytics(ANALYTICS_EVENTS.newsletterFormStart, funnelParams);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmittingRef.current || effectiveStatus === 'pending') {
      return;
    }

    markStarted();

    const validation = validateNewsletterInput(
      { email, consent, variant },
      { invalidEmail: copy.invalidEmail, invalidConsent: copy.invalidConsent },
    );

    if (!validation.valid) {
      setEmailError(validation.emailError || null);
      setConsentError(validation.consentError || null);
      setInternalStatus('invalid');
      const reason = validation.emailError ? 'invalid_email' : 'invalid_consent';
      emitAnalytics(
        ANALYTICS_EVENTS.newsletterSubmitError,
        newsletterSubmitErrorParams(placement, lang, reason),
      );
      return;
    }

    setEmailError(null);
    setConsentError(null);
    setGeneralError(null);
    setInternalStatus('pending');
    isSubmittingRef.current = true;

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          lang: edition,
          placement,
        }),
      });

      const data = await res.json().catch(() => ({}));
      const outcome = parseSubscribeResponse(res.status, data);

      if (outcome === 'not_configured') {
        setInternalStatus('not_configured');
        emitAnalytics(
          ANALYTICS_EVENTS.newsletterSubmitError,
          newsletterSubmitErrorParams(placement, lang, 'not_configured', res.status),
        );
        return;
      }

      if (outcome === 'already_subscribed') {
        setInternalStatus('already_subscribed');
        return;
      }

      if (outcome === 'error') {
        setInternalStatus('error');
        setGeneralError(failed || copy.failed);
        const reason =
          typeof data === 'object' && data && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'provider_failed';
        emitAnalytics(
          ANALYTICS_EVENTS.newsletterSubmitError,
          newsletterSubmitErrorParams(placement, lang, reason, res.status),
        );
        return;
      }

      // Success branch: only on genuine 2xx
      setInternalStatus('success');
      emitAnalytics('newsletter_subscribe', { placement, lang: edition });
      void reportWeeklySignup();
    } catch {
      setInternalStatus('error');
      setGeneralError(failed || copy.failed);
      emitAnalytics(
        ANALYTICS_EVENTS.newsletterSubmitError,
        newsletterSubmitErrorParams(placement, lang, 'network_error', 0),
      );
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // Render completed status feedback
  if (effectiveStatus === 'success') {
    return (
      <div aria-live="polite" className={`w-full max-w-md ${className}`}>
        <Notice tone="success" className="min-h-12 w-full">
          {done || copy.successMessage}
        </Notice>
      </div>
    );
  }

  if (effectiveStatus === 'already_subscribed') {
    return (
      <div aria-live="polite" className={`w-full max-w-md ${className}`}>
        <Notice tone="info" className="min-h-12 w-full">
          {copy.alreadySubscribed}
        </Notice>
      </div>
    );
  }

  if (effectiveStatus === 'not_configured') {
    return (
      <div aria-live="polite" className={`w-full max-w-md ${className}`}>
        <Notice tone="warning" className="min-h-12 w-full">
          {notConfigured || copy.notConfigured}
        </Notice>
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-busy={effectiveStatus === 'pending'}
        className={`bg-surface border-border rounded-card w-full max-w-lg border p-6 sm:p-8 space-y-5 ${className}`}
      >
        {effectiveStatus === 'error' && (generalError || failed || copy.failed) ? (
          <div className="w-full">
            <Notice tone="error">{generalError || failed || copy.failed}</Notice>
          </div>
        ) : null}

        <div>
          <TextInput
            id="sub-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            label={copy.emailLabel}
            value={email}
            disabled={effectiveStatus === 'pending'}
            error={emailError ?? undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            onFocus={markStarted}
            placeholder={placeholder ?? copy.emailPlaceholder}
          />
        </div>

        <div>
          <SegmentedControl
            label={copy.editionLabel}
            name="edition"
            value={edition}
            onValueChange={(val) => setEdition(val as Lang)}
            disabled={effectiveStatus === 'pending'}
            options={[
              { value: 'en', label: copy.editionEn },
              { value: 'uk', label: copy.editionUk },
            ]}
          />
        </div>

        <div>
          <Checkbox
            id="sub-consent"
            name="consent"
            checked={consent}
            disabled={effectiveStatus === 'pending'}
            error={consentError ?? undefined}
            onChange={(e) => {
              setConsent(e.target.checked);
              if (consentError) setConsentError(null);
            }}
            label={
              <span>
                {copy.consentLabel}{' '}
                <a
                  href={`/${lang}/privacy`}
                  className="text-muted hover:text-text underline underline-offset-2"
                >
                  {copy.privacyPolicy}
                </a>
                .
              </span>
            }
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          pending={effectiveStatus === 'pending'}
          disabled={effectiveStatus === 'pending'}
          onClick={markStarted}
          className="w-full mt-2"
          rightIcon={<ArrowRight size={18} aria-hidden="true" />}
        >
          {effectiveStatus === 'pending' ? copy.buttonPending : button ?? copy.button}
        </Button>

        {showProof ? (
          <ul className="text-muted flex flex-wrap gap-x-4 gap-y-2 pt-2 text-xs sm:text-sm">
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="text-accent">✓</span>
              {copy.proofDoubleOptIn}
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="text-accent">✓</span>
              {copy.proofSources}
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="text-accent">✓</span>
              {copy.proofOnePerDay}
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="text-accent">✓</span>
              {copy.proofUnsubscribe}
            </li>
          </ul>
        ) : null}
      </form>
    );
  }

  if (variant === 'inline') {
    return (
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-busy={effectiveStatus === 'pending'}
        className={`w-full max-w-md ${className}`}
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            disabled={effectiveStatus === 'pending'}
            aria-invalid={effectiveStatus === 'invalid' && Boolean(emailError)}
            aria-describedby={emailError ? 'nl-inline-email-error' : undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            onFocus={markStarted}
            placeholder={placeholder ?? copy.emailPlaceholder}
            aria-label={placeholder ?? copy.emailLabel}
            className="bg-surface border-border text-text rounded-md focus-visible:border-accent min-h-[44px] flex-1 border px-3 py-2.5 text-sm outline-none transition-colors"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            pending={effectiveStatus === 'pending'}
            disabled={effectiveStatus === 'pending'}
            onClick={markStarted}
            rightIcon={<ArrowRight size={16} aria-hidden="true" />}
          >
            {effectiveStatus === 'pending' ? copy.buttonPending : button ?? copy.button}
          </Button>
        </div>
        {emailError ? (
          <p id="nl-inline-email-error" role="alert" className="text-error mt-1.5 text-xs font-medium">
            {emailError}
          </p>
        ) : null}
        {effectiveStatus === 'error' && (generalError || failed || copy.failed) ? (
          <div className="mt-2 w-full">
            <Notice tone="error">{generalError || failed || copy.failed}</Notice>
          </div>
        ) : null}
        <p className="text-faint mt-2 text-xs">
          {copy.note}{' '}
          <a
            href={`/${lang}/privacy`}
            className="text-muted hover:text-text underline underline-offset-2"
          >
            {copy.privacyPolicy}
          </a>
          .
        </p>
      </form>
    );
  }

  // variant === 'band' (default)
  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-busy={effectiveStatus === 'pending'}
      className={`w-full max-w-md ${className}`}
    >
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          disabled={effectiveStatus === 'pending'}
          aria-invalid={effectiveStatus === 'invalid' && Boolean(emailError)}
          aria-describedby={emailError ? 'nl-band-email-error' : undefined}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
          }}
          onFocus={markStarted}
          placeholder={placeholder ?? copy.emailPlaceholder}
          aria-label={placeholder ?? copy.emailLabel}
          className="bg-bg border-border text-text rounded-pill focus-visible:border-accent min-h-[44px] flex-1 basis-52 border px-4 py-3 text-sm outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={effectiveStatus === 'pending'}
          aria-busy={effectiveStatus === 'pending'}
          onClick={markStarted}
          className="rounded-pill bg-accent-fill text-on-accent min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-opacity disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed shrink-0"
        >
          <span>{effectiveStatus === 'pending' ? copy.buttonPending : button ?? copy.button}</span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      {emailError ? (
        <p id="nl-band-email-error" role="alert" className="text-error mt-1.5 text-xs font-medium">
          {emailError}
        </p>
      ) : null}
      {effectiveStatus === 'error' && (generalError || failed || copy.failed) ? (
        <div className="mt-2 w-full">
          <Notice tone="error">{generalError || failed || copy.failed}</Notice>
        </div>
      ) : null}
      <p className="text-faint mt-2.5 text-xs">
        {copy.note}{' '}
        <a
          href={`/${lang}/privacy`}
          className="text-muted hover:text-text underline underline-offset-2"
        >
          {copy.privacyPolicy}
        </a>
        .
      </p>
    </form>
  );
}
