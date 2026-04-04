import { useState, useEffect, useCallback } from 'react';
import { usePopupStore } from '../stores/app.store';

const EGYPTIAN_PHONE_REGEX = /^(?:\+20|0)?(10|11|12|15)\d{8}$/;

interface PopupProps {
  storeUrl: string;
  discountCode?: string;
  discountPercentage?: number;
  triggerDelay?: number;
  showExitIntent?: boolean;
  theme?: 'light' | 'dark';
}

export function SmsShieldPopup({
  storeUrl,
  discountCode = 'WELCOME10',
  discountPercentage = 10,
  triggerDelay = 5000,
  showExitIntent = true,
  theme = 'dark'
}: PopupProps) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    isOpen,
    hasSubscribed,
    dismissedAt,
    triggerCount,
    openPopup,
    closePopup,
    markSubscribed,
    dismissPopup,
    incrementTrigger
  } = usePopupStore();

  const validatePhone = useCallback((phoneNumber: string): boolean => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    return EGYPTIAN_PHONE_REGEX.test(cleaned);
  }, []);

  const formatPhone = useCallback((phoneNumber: string): string => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0,3)} ${cleaned.slice(3)}`;
    if (cleaned.length <= 8) return `${cleaned.slice(0,3)} ${cleaned.slice(3,6)} ${cleaned.slice(6)}`;
    return `${cleaned.slice(0,3)} ${cleaned.slice(3,6)} ${cleaned.slice(6,8)} ${cleaned.slice(8,11)}`;
  }, []);

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
    setError('');
  }, [formatPhone]);

  const applyDiscountToCart = useCallback(async (code: string) => {
    try {
      const response = await fetch(`${storeUrl}/cart.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {},
          discount_code: code
        })
      });

      if (response.ok) {
        setIsApplied(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [storeUrl]);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(discountCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy');
    }
  }, [discountCode]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePhone(phone)) {
      setError('Please enter a valid Egyptian phone number');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/sms-subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          storeUrl
        })
      });

      if (response.ok) {
        markSubscribed();
        
        const cartUpdated = await applyDiscountToCart(discountCode);
        if (!cartUpdated) {
          await copyToClipboard();
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [phone, storeUrl, discountCode, validatePhone, applyDiscountToCart, copyToClipboard, markSubscribed]);

  useEffect(() => {
    if (hasSubscribed || dismissedAt) return;

    const timer = setTimeout(() => {
      incrementTrigger();
      openPopup();
    }, triggerDelay);

    return () => clearTimeout(timer);
  }, [hasSubscribed, dismissedAt, triggerDelay, incrementTrigger, openPopup]);

  useEffect(() => {
    if (!showExitIntent || hasSubscribed || dismissedAt) return;

    const handleExitIntent = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        incrementTrigger();
        openPopup();
      }
    };

    document.addEventListener('mouseleave', handleExitIntent);
    return () => document.removeEventListener('mouseleave', handleExitIntent);
  }, [showExitIntent, hasSubscribed, dismissedAt, incrementTrigger, openPopup]);

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={closePopup}
      />
      
      <div className={`relative w-full max-w-md mx-4 ${isDark ? 'bg-surface-dark' : 'bg-white'} rounded-2xl shadow-popup animate-scale-in overflow-hidden`}>
        <button
          onClick={() => { dismissPopup(); closePopup(); }}
          className={`absolute top-4 right-4 ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-8">
          <div className="text-center mb-6">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${isDark ? 'bg-primary-900/50' : 'bg-primary-50'} mb-4`}>
              <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className={`text-2xl font-display font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Get {discountPercentage}% Off
            </h2>
            <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Enter your phone number to unlock your exclusive discount
            </p>
          </div>

          {isApplied ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 text-green-500 mb-4">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Discount applied to your cart!
              </p>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Order now and save {discountPercentage}%
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="phone" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="010 123 45678"
                  className={`w-full px-4 py-3 rounded-xl ${isDark 
                    ? 'bg-surface-elevated border border-gray-700 text-white placeholder-gray-500 focus:border-primary-500 focus:ring-primary-500/20' 
                    : 'border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500/20'
                  } focus:outline-none focus:ring-4 transition-all`}
                  autoComplete="tel"
                  inputMode="tel"
                />
                {error && (
                  <p className="mt-2 text-sm text-red-500">{error}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !phone}
                className={`w-full py-3 px-4 rounded-xl font-semibold transition-all ${
                  isSubmitting || !phone
                    ? 'bg-gray-600 cursor-not-allowed opacity-50'
                    : 'bg-primary-600 hover:bg-primary-500 shadow-glow hover:shadow-lg'
                } text-white`}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  `Unlock {discountPercentage}% Discount`
                )}
              </button>

              {!isApplied && (
                <div className="pt-2">
                  <p className={`text-center text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Or use code manually:
                  </p>
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className={`mt-2 w-full py-2 px-4 rounded-lg border ${
                      isDark 
                        ? 'border-gray-700 hover:border-gray-600 bg-surface-elevated' 
                        : 'border-gray-200 hover:bg-gray-50'
                    } transition-colors flex items-center justify-center gap-2`}
                  >
                    <code className={`font-mono font-bold ${isDark ? 'text-accent-400' : 'text-accent-600'}`}>
                      {discountCode}
                    </code>
                    {copied ? (
                      <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>

        <div className={`px-8 py-4 ${isDark ? 'bg-black/20' : 'bg-gray-50'} border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
          <p className={`text-xs text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            By subscribing, you agree to receive SMS updates. Reply STOP to unsubscribe.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SmsShieldPopup;
