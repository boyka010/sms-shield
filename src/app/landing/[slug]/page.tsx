import { db } from '@/lib/db';
import { Metadata } from 'next';
import LandingPageClient from './landing-client';

// ============================================================================
// Types
// ============================================================================

interface LineItem {
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

// ============================================================================
// Server Component
// ============================================================================

interface LandingPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: LandingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const landingPage = await db.landingPage.findUnique({
    where: { slug },
    include: { shop: true },
  });

  if (!landingPage) {
    return {
      title: 'Order Not Found',
      description: 'This order link is invalid or has expired.',
    };
  }

  return {
    title: `Confirm Your Order - ${landingPage.storeName}`,
    description: `Please confirm your Cash on Delivery order #${landingPage.orderName} from ${landingPage.storeName}.`,
    openGraph: {
      title: `Confirm Your Order - ${landingPage.storeName}`,
      description: `Please confirm your Cash on Delivery order #${landingPage.orderName}.`,
      siteName: landingPage.storeName,
      type: 'website',
    },
  };
}

export default async function LandingPage({ params }: LandingPageProps) {
  const { slug } = await params;

  const landingPage = await db.landingPage.findUnique({
    where: { slug },
    include: { shop: true, subscriber: true },
  });

  // ---- Not Found ----
  if (!landingPage) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-gray-100">
            <svg
              className="size-10 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Order Not Found</h1>
          <p className="mt-2 text-gray-500">
            This order link is invalid or has been removed.
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Please contact the store for assistance.
          </p>
        </div>
      </div>
    );
  }

  // ---- Expired Check ----
  const now = new Date();
  const expiresAt = new Date(landingPage.expiresAt);
  const isExpired = now > expiresAt;

  // ---- Already Responded ----
  if (landingPage.isConfirmed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-emerald-100">
            <svg
              className="size-10 text-emerald-600"
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
          <h1 className="text-2xl font-bold text-gray-900">
            Order Confirmed ✓
          </h1>
          <p className="mt-2 text-gray-500">
            Your order <strong>{landingPage.orderName}</strong> has been
            confirmed and is being prepared for delivery.
          </p>
          <div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-400">Store</p>
            <p className="font-semibold text-gray-900">
              {landingPage.storeName}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (landingPage.isCancelled) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-red-100">
            <svg
              className="size-10 text-red-500"
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
          <h1 className="text-2xl font-bold text-gray-900">
            Order Cancelled
          </h1>
          <p className="mt-2 text-gray-500">
            Your order <strong>{landingPage.orderName}</strong> has been
            cancelled.
          </p>
          <div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-400">Store</p>
            <p className="font-semibold text-gray-900">
              {landingPage.storeName}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- Expired State ----
  if (isExpired) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-amber-100">
            <svg
              className="size-10 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Link Expired
          </h1>
          <p className="mt-2 text-gray-500">
            This order confirmation link has expired.
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Please contact{' '}
            <strong>{landingPage.storeName}</strong> for a new confirmation
            link.
          </p>
        </div>
      </div>
    );
  }

  // ---- Parse order details ----
  let lineItems: LineItem[] = [];
  try {
    lineItems = JSON.parse(landingPage.orderDetails);
  } catch {
    lineItems = [];
  }

  const customerName = landingPage.customerName || 'there';
  const greetingFirstName = customerName.split(' ')[0];
  const total = landingPage.orderTotal;
  const currency = landingPage.currency || 'EGP';

  // ---- Calculate time remaining ----
  const timeRemaining = expiresAt.getTime() - now.getTime();
  const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor(
    (timeRemaining % (1000 * 60 * 60)) / (1000 * 60)
  );

  return (
    <main className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-center gap-3">
          {/* Store Logo Placeholder */}
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100">
            <svg
              className="size-5 text-emerald-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.15c0 .415.336.75.75.75z"
              />
            </svg>
          </div>
          <span className="text-lg font-bold text-gray-900">
            {landingPage.storeName}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-lg px-4 py-6 sm:py-10">
        {/* Greeting */}
        <div className="mb-6 text-center">
          <p className="text-xl font-bold text-gray-900 sm:text-2xl">
            Hi {greetingFirstName}! 👋
          </p>
          <p className="mt-2 text-base text-gray-500">
            Please confirm your order to proceed with delivery
          </p>
        </div>

        {/* Order Summary Card */}
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          {/* Order header */}
          <div className="border-b bg-gray-50 px-5 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">
                Order {landingPage.orderName}
              </span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                Cash on Delivery
              </span>
            </div>
          </div>

          {/* Line Items */}
          <div className="divide-y px-5">
            {lineItems.map((item, index) => (
              <div key={index} className="flex items-center gap-3 py-3.5">
                {/* Product image placeholder */}
                <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  <svg
                    className="size-6 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-gray-900">
                  {(item.price * item.quantity).toLocaleString()} {currency}
                </span>
              </div>
            ))}

            {lineItems.length === 0 && (
              <div className="py-6 text-center text-sm text-gray-400">
                Order details not available
              </div>
            )}
          </div>

          {/* Total */}
          <div className="border-t bg-gray-50 px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-gray-700">
                Total
              </span>
              <span className="text-2xl font-black text-gray-900">
                {total.toLocaleString()}{' '}
                <span className="text-base font-semibold">{currency}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons — Client Component */}
        <LandingPageClient
          slug={landingPage.slug}
          confirmButtonText={landingPage.confirmButtonText}
          cancelButtonText={landingPage.cancelButtonText}
          themeColor={landingPage.themeColor}
        />

        {/* Trust Indicators */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <svg
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            <span>Your information is secure</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <svg
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
              />
            </svg>
            <span>Need help? Contact us</span>
          </div>
        </div>

        {/* Expiration Notice */}
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm text-amber-700">
            <svg
              className="size-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              This link expires in {hoursRemaining}h {minutesRemaining}m
            </span>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-gray-300">
          Powered by SMS-Shield
        </p>
      </div>
    </main>
  );
}
