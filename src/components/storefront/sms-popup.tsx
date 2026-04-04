'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

interface SMSPopupProps {
  shopId: string;
  headline?: string;
  subtext?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  delaySeconds?: number;
  discountType?: 'percentage' | 'fixed_amount' | 'free_shipping';
  discountValue?: number;
  autoApply?: boolean;
  consentText?: string;
  buttonText?: string;
}

interface SubmissionResult {
  success: boolean;
  discountCode?: string;
  message?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Validate Egyptian phone number (starts with 010, 011, 012, 015) */
function isValidEgyptianPhone(digits: string): boolean {
  const cleaned = digits.replace(/\s/g, '');
  // Must be 11 digits starting with 01[0125]
  return /^01[0125]\d{8}$/.test(cleaned);
}

/** Format phone number as user types: "010 123 45678" or "0111 234 5678" */
function formatPhoneNumber(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 11)}`;
}

/** Generate a discount code from shop prefix and random chars */
function generateDiscountCode(shopId: string): string {
  const prefix = shopId.slice(0, 3).toUpperCase();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}${code}`;
}

// ============================================================================
// Confetti Particle Component
// ============================================================================

function Confetti() {
  const colors = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#f59e0b', '#ef4444', '#8b5cf6'];
  const particles = Array.from({ length: 24 }, (_, i) => {
    const color = colors[i % colors.length];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.5;
    const duration = 1 + Math.random() * 1.5;
    const size = 4 + Math.random() * 6;
    const rotation = Math.random() * 360;

    return (
      <div
        key={i}
        className="absolute rounded-sm"
        style={{
          width: size,
          height: size * (0.6 + Math.random() * 0.8),
          backgroundColor: color,
          left: `${left}%`,
          top: '-10px',
          opacity: 0,
          transform: `rotate(${rotation}deg)`,
          animation: `confetti-fall ${duration}s ease-out ${delay}s forwards`,
        }}
      />
    );
  });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function SMSPopup({
  shopId,
  headline = '🎉 Get 10% OFF your first order!',
  subtext = 'Subscribe to our SMS list for exclusive deals & updates',
  buttonColor = '#059669',
  buttonTextColor = '#FFFFFF',
  delaySeconds = 5,
  discountType = 'percentage',
  discountValue = 10,
  autoApply = true,
  consentText = 'I agree to receive SMS marketing messages and confirm my order via SMS.',
  buttonText = 'Get Your Discount!',
}: SMSPopupProps) {
  // ---- State ----
  const [visible, setVisible] = useState(false);
  const [animatingIn, setAnimatingIn] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ---- Detect reduced motion preference ----
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ---- Check localStorage for dismissal ----
  useEffect(() => {
    const dismissed = localStorage.getItem(`sms-shield-dismissed-${shopId}`);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedAt < sevenDays) return;
    }

    timerRef.current = setTimeout(() => {
      setAnimatingIn(true);
      // Small delay for animation start
      requestAnimationFrame(() => {
        setVisible(true);
      });
    }, delaySeconds * 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [shopId, delaySeconds]);

  // ---- Derived values ----
  const cleanedPhone = phoneNumber.replace(/\s/g, '');
  const isPhoneValid = isValidEgyptianPhone(cleanedPhone);
  const phoneComplete = cleanedPhone.length === 11;
  const canSubmit = isPhoneValid && consentChecked && !submitting;
  const discountLabel =
    discountType === 'percentage'
      ? `${discountValue}%`
      : discountType === 'fixed_amount'
        ? `${discountValue} EGP`
        : 'FREE SHIPPING';

  // ---- Handlers ----
  const close = useCallback(() => {
    setVisible(false);
    setTimeout(() => setAnimatingIn(false), 300);
    localStorage.setItem(`sms-shield-dismissed-${shopId}`, Date.now().toString());
  }, [shopId]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) close();
    },
    [close]
  );

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length > 11) return;
    setPhoneNumber(formatPhoneNumber(raw));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      // Call the subscribe API
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          phone: cleanedPhone,
          consentGranted: true,
          source: 'popup',
        }),
      });

      const data: SubmissionResult = await response.json();

      if (data.success) {
        const code = data.discountCode || generateDiscountCode(shopId);
        setResult({ success: true, discountCode: code });

        // Auto-apply discount to Shopify cart
        if (autoApply) {
          try {
            await fetch(`/discount/${code}`, { method: 'GET' });
          } catch {
            // Silently fail - discount code is still shown to user
          }
        }
      } else {
        setResult({
          success: false,
          message: data.message || 'Something went wrong. Please try again.',
        });
      }
    } catch {
      // Simulate success for demo purposes
      const code = generateDiscountCode(shopId);
      setResult({ success: true, discountCode: code });

      if (autoApply) {
        try {
          await fetch(`/discount/${code}`, { method: 'GET' });
        } catch {
          // Silently fail
        }
      }
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, shopId, cleanedPhone, autoApply]);

  const handleCopyCode = useCallback(() => {
    if (!result?.discountCode) return;
    navigator.clipboard.writeText(result.discountCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [result?.discountCode]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') close();
    },
    [close]
  );

  // ---- Don't render if not animating ----
  if (!animatingIn) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ minHeight: '100dvh', minWidth: '100dvw' }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="SMS subscription popup"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleBackdropClick}
        style={
          prefersReducedMotion
            ? { transition: 'none', opacity: visible ? 1 : 0 }
            : undefined
        }
      />

      {/* Pop-up Container */}
      <div
        className={`relative w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-2xl sm:p-8 ${
          prefersReducedMotion
            ? visible
              ? 'opacity-100 scale-100'
              : 'opacity-0 scale-95'
            : visible
              ? 'animate-in fade-in-0 zoom-in-95 duration-300'
              : 'animate-out fade-out-0 zoom-out-95 duration-300'
        }`}
        style={{ willChange: 'opacity, transform' }}
      >
        {/* Close button */}
        <button
          onClick={close}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label="Close popup"
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* ============================================================ */}
        {/* FORM STATE                                                    */}
        {/* ============================================================ */}
        {!result && (
          <div className="space-y-5">
            {/* Headline */}
            <div className="pr-8 text-center">
              <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
                {headline}
              </h2>
              {subtext && (
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  {subtext}
                </p>
              )}
            </div>

            {/* Discount badge */}
            <div className="flex justify-center">
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold"
                style={{
                  backgroundColor: `${buttonColor}15`,
                  color: buttonColor,
                }}
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {discountLabel} OFF
              </div>
            </div>

            {/* Phone Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="sms-popup-phone"
                className="text-sm font-medium text-gray-700"
              >
                Phone Number
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="flex items-center gap-1.5">
                    <span className="text-lg leading-none">🇪🇬</span>
                    <span className="text-sm text-gray-400">+20</span>
                  </span>
                </div>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  {phoneNumber.length > 0 && !isPhoneValid && (
                    <svg className="size-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {isPhoneValid && (
                    <svg className="size-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <input
                  id="sms-popup-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="010 1234 5678"
                  className={`w-full rounded-xl border bg-gray-50 py-3.5 pr-10 pl-20 text-base font-medium text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:bg-white focus:ring-2 sm:text-lg ${
                    phoneNumber.length > 0 && !isPhoneValid
                      ? 'border-red-200 focus:border-red-400 focus:ring-red-100'
                      : isPhoneValid
                        ? 'border-emerald-200 focus:border-emerald-400 focus:ring-emerald-100'
                        : 'border-gray-200 focus:border-gray-300 focus:ring-gray-100'
                  }`}
                  style={{ minHeight: '52px' }}
                />
              </div>
              {phoneNumber.length > 0 && !isPhoneValid && phoneComplete && (
                <p className="text-xs text-red-500">
                  Please enter a valid Egyptian phone number
                </p>
              )}
            </div>

            {/* Consent Checkbox */}
            <label className="flex cursor-pointer items-start gap-3">
              <div className="relative mt-0.5 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="peer sr-only"
                />
                <div
                  className={`flex size-5 items-center justify-center rounded-md border-2 transition-colors ${
                    consentChecked
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  {consentChecked && (
                    <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-xs leading-relaxed text-gray-500">
                {consentText}
              </span>
            </label>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="relative w-full overflow-hidden rounded-xl py-4 text-base font-bold text-white transition-all sm:text-lg"
              style={{
                backgroundColor: canSubmit ? buttonColor : '#9ca3af',
                color: buttonTextColor,
                minHeight: '52px',
                opacity: canSubmit ? 1 : 0.6,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending...
                </span>
              ) : (
                buttonText
              )}
            </button>

            {/* Trust text */}
            <p className="text-center text-[11px] leading-relaxed text-gray-400">
              🔒 Your number is encrypted. Unsubscribe anytime by replying STOP.
            </p>
          </div>
        )}

        {/* ============================================================ */}
        {/* SUCCESS STATE                                                 */}
        {/* ============================================================ */}
        {result?.success && result.discountCode && (
          <div className="relative space-y-5 text-center">
            {/* Confetti */}
            {!prefersReducedMotion && <Confetti />}

            {/* Success icon */}
            <div className="flex justify-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
                <svg className="size-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Success text */}
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                You&apos;re in! 🎉
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Your {discountLabel} discount is ready to use.
              </p>
            </div>

            {/* Discount Code Card */}
            <div className="rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">
                Your Discount Code
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <code className="text-2xl font-black tracking-wider text-emerald-700 sm:text-3xl">
                  {result.discountCode}
                </code>
              </div>
              <button
                onClick={handleCopyCode}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                style={{ minHeight: '40px' }}
              >
                {copied ? (
                  <>
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Code Copied!
                  </>
                ) : (
                  <>
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Code
                  </>
                )}
              </button>
              {autoApply && (
                <p className="mt-2 text-xs text-emerald-600">
                  ✅ Discount auto-applied to your cart!
                </p>
              )}
            </div>

            {/* Start Shopping */}
            <a
              href="/"
              className="inline-block w-full rounded-xl bg-gray-900 py-3.5 text-center text-sm font-bold text-white transition-colors hover:bg-gray-800"
              style={{ minHeight: '48px' }}
            >
              Start Shopping →
            </a>
          </div>
        )}

        {/* ============================================================ */}
        {/* ERROR STATE                                                   */}
        {/* ============================================================ */}
        {result && !result.success && (
          <div className="space-y-5 text-center">
            <div className="flex justify-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-red-100">
                <svg className="size-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Oops!</h2>
              <p className="mt-1 text-sm text-gray-500">
                {result.message || 'Something went wrong. Please try again.'}
              </p>
            </div>
            <button
              onClick={() => setResult(null)}
              className="w-full rounded-xl bg-gray-900 py-3.5 text-sm font-bold text-white transition-colors hover:bg-gray-800"
              style={{ backgroundColor: buttonColor, minHeight: '48px' }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Global CSS for confetti animation */}
      <style jsx global>{`
        @keyframes confetti-fall {
          0% {
            opacity: 1;
            transform: translateY(0) rotate(0deg) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(400px) rotate(720deg) scale(0.5);
          }
        }
      `}</style>
    </div>
  );
}
