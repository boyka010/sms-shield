import { json, LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Outlet, NavLink, useLocation } from '@remix-run/react';
import { Page, Layout, BlockStack, Box, Text, InlineStack, Avatar, Icon } from '@shopify/polaris';
import { useState } from 'react';

export async function loader({ request }: LoaderFunctionArgs) {
  return json({
    shop: 'demo-store.myshopify.com',
    merchant: {
      id: '1',
      companyName: 'Demo Store',
      email: 'demo@store.com'
    },
    stats: {
      totalContacts: 1250,
      totalSmsSent: 4567,
      deliveryRate: 98.5,
      activeCampaigns: 3
    }
  });
}

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Overview', icon: 'home' },
  { path: '/dashboard/contacts', label: 'Contacts', icon: 'customers' },
  { path: '/dashboard/segments', label: 'Segments', icon: 'groups' },
  { path: '/dashboard/campaigns', label: 'Campaigns', icon: 'marketing' },
  { path: '/dashboard/automations', label: 'Automations', icon: 'automation' },
  { path: '/dashboard/settings', label: 'Settings', icon: 'settings' },
];

function IconComponent({ source }: { source: string }) {
  const icons: Record<string, JSX.Element> = {
    home: <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    customers: <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
    groups: <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
    marketing: <path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />,
    automation: <path d="M13 10V3L4 14h7v7l9-11h-7z" />,
    settings: <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  };
  
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {icons[source] || icons.home}
    </svg>
  );
}

export default function DashboardLayout() {
  const { shop, merchant, stats } = useLoaderData<typeof loader>();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 transition-all duration-300">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <Text variant="headingSm" as="h1">SMS Shield</Text>
              <Text variant="bodySm" as="span" tone="subdued">{shop}</Text>
            </div>
          </div>
        </div>

        <nav className="p-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Icon source={() => <IconComponent source={item.icon} />} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <Text variant="bodyMd" as="span" fontWeight="medium">
                {merchant.companyName?.charAt(0) || 'M'}
              </Text>
            </div>
            <div className="flex-1 min-w-0">
              <Text variant="bodySm" as="p" fontWeight="medium" truncate>
                {merchant.companyName}
              </Text>
              <Text variant="bodyXs" as="span" tone="subdued" truncate>
                {merchant.email}
              </Text>
            </div>
          </div>
        </div>
      </div>

      <div className="ml-64 min-h-screen">
        <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
          <Text variant="headingMd" as="h1">
            {NAV_ITEMS.find(item => location.pathname === item.path)?.label || 'Dashboard'}
          </Text>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <Text variant="bodySm" as="span" tone="success">Credits: {1000}</Text>
            </div>
          </div>
        </header>

        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
