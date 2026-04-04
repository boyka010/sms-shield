'use client';

import { useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

interface LandingPageClientProps {
  slug: string;
  confirmButtonText: string;
  cancelButtonText: string;
  themeColor: string;
}

type ActionState = 'idle' | 'loading' | 'success' | 'error';

// ============================================================================
// Component
// ============================================================================

export default function LandingPageClient({
  slug,
  confirmButtonText,
  cancelButtonText,
  themeColor,
}: LandingPageClientProps) {
  const [confirmState, setConfirmState] = useState<ActionState>('idle');
  const [cancelState, setCancelState] = useState<ActionState>('idle');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [cancelMessage, setCancelMessage] = useState('');

  const handleConfirm = useCallback(async () => {
    setConfirmState('loading');
    setConfirmMessage('');

    try {
      const response = await fetch(`/api/landing/${slug}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });

      if (response.ok) {
        const data = await response.json();
        setConfirmState('success');
        setConfirmMessage(data.message || 'Your order has been confirmed!');
      } else {
        const data = await response.json().catch(() => ({}));
        setConfirmState('error');
        setConfirmMessage(
          data.message || 'Failed to confirm order. Please try again.'
        );
      }
    } catch {
      setConfirmState('error');
      setConfirmMessage('Network error. Please check your connection and try again.');
    }
  }, [slug]);

  const handleCancel = useCallback(async () => {
    setCancelState('loading');
    setCancelMessage('');

    try {
      const response = await fetch(`/api/landing/${slug}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });

      if (response.ok) {
        const data = await response.json();
        setCancelState('success');
        setCancelMessage(data.message || 'Your order has been cancelled.');
      } else {
        const data = await response.json().catch(() => ({}));
        setCancelState('error');
        setCancelMessage(
          data.message || 'Failed to cancel order. Please try again.'
        );
      }
    } catch {
      setCancelState('error');
      setCancelMessage('Network error. Please check your connection and try again.');
    }
  }, [slug]);

  const isAnyAction = confirmState !== 'idle' || cancelState !== 'idle';
  const isDisabled = confirmState === 'loading' || cancelState === 'loading';

  return (
    <div className="mt-6 space-y-3">
      {/* Confirm Button */}
      <button
        onClick={handleConfirm}
        disabled={isDisabled || confirmState === 'success'}
        className={`flex w-full items-center justify-center gap-2 rounded-xl text-lg font-bold text-white transition-all sm:text-xl ${
          confirmState === 'success'
            ? 'bg-emerald-600'
            : confirmState === 'error'
              ? 'bg-red-500 hover:bg-red-600'
              : 'hover:opacity-90 active:scale-[0.98]'
        }`}
        style={{
          backgroundColor:
            confirmState === 'success'
              ? '#059669'
              : confirmState === 'error'
                ? '#ef4444'
                : themeColor || '#059669',
          minHeight: '56px',
          opacity: isDisabled && confirmState !== 'loading' ? 0.5 : 1,
          cursor:
            isDisabled || confirmState === 'success' ? 'not-allowed' : 'pointer',
        }}
      >
        {confirmState === 'loading' ? (
          <>
            <svg
              className="size-5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Confirming...
          </>
        ) : confirmState === 'success' ? (
          <>
            <svg
              className="size-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
            Order Confirmed!
          </>
        ) : (
          confirmButtonText
        )}
      </button>

      {/* Confirm error message */}
      {confirmState === 'error' && confirmMessage && (
        <p className="text-center text-sm text-red-500">{confirmMessage}</p>
      )}

      {/* Cancel Button */}
      <button
        onClick={handleCancel}
        disabled={isDisabled || cancelState === 'success'}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 text-base font-semibold transition-all sm:text-lg ${
          cancelState === 'success'
            ? 'border-red-300 bg-red-50 text-red-600'
            : cancelState === 'error'
              ? 'border-red-300 bg-red-50 text-red-500'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98]'
        }`}
        style={{
          minHeight: '56px',
          opacity: isDisabled && cancelState !== 'loading' ? 0.5 : 1,
          cursor:
            isDisabled || cancelState === 'success' ? 'not-allowed' : 'pointer',
        }}
      >
        {cancelState === 'loading' ? (
          <>
            <svg
              className="size-5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Cancelling...
          </>
        ) : cancelState === 'success' ? (
          <>
            <svg
              className="size-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Order Cancelled
          </>
        ) : (
          cancelButtonText
        )}
      </button>

      {/* Cancel error message */}
      {cancelState === 'error' && cancelMessage && (
        <p className="text-center text-sm text-red-500">{cancelMessage}</p>
      )}

      {/* Success overlay — full replacement after either action */}
      {(confirmState === 'success' || cancelState === 'success') && (
        <div
          className={`mt-4 rounded-xl border-2 p-6 text-center ${
            confirmState === 'success'
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-red-200 bg-red-50'
          }`}
        >
          {confirmState === 'success' ? (
            <>
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-emerald-100">
                <svg
                  className="size-8 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-emerald-800">
                Order Confirmed! 🎉
              </h3>
              <p className="mt-1 text-sm text-emerald-600">
                {confirmMessage ||
                  'Your order is confirmed and will be prepared for delivery. You will receive an SMS confirmation shortly.'}
              </p>
              <p className="mt-3 text-xs text-emerald-500">
                You can close this page. A confirmation SMS will be sent to your
                phone.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="size-8 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-red-700">Order Cancelled</h3>
              <p className="mt-1 text-sm text-red-500">
                {cancelMessage ||
                  'Your order has been cancelled. If this was a mistake, please contact the store directly.'}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
