import { json, LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { 
  Page, 
  Card, 
  BlockStack, 
  Text, 
  Grid, 
  InlineStack,
  Badge,
  ProgressBar
} from '@shopify/polaris';

export async function loader({ request }: LoaderFunctionArgs) {
  return json({
    stats: {
      totalContacts: 1250,
      activeContacts: 890,
      totalSmsSent: 4567,
      delivered: 4498,
      failed: 69,
      deliveryRate: 98.5,
      revenue: 125000,
      activeCampaigns: 3,
      scheduledCampaigns: 2
    },
    recentContacts: [
      { id: '1', name: 'Ahmed Mohamed', phone: '+201012345678', segment: 'CHAMPIONS', lastOrder: '2024-01-15' },
      { id: '2', name: 'Sara Ali', phone: '+201112345678', segment: 'LOYAL', lastOrder: '2024-01-14' },
      { id: '3', name: 'Omar Hassan', phone: '+201212345678', segment: 'AT_RISK', lastOrder: '2024-01-10' },
      { id: '4', name: 'Fatma Ahmed', phone: '+201512345678', segment: 'NEW', lastOrder: '2024-01-15' },
    ],
    segments: [
      { name: 'Champions', count: 120, color: 'bg-green-500' },
      { name: 'Loyal', count: 340, color: 'bg-blue-500' },
      { name: 'At Risk', count: 180, color: 'bg-orange-500' },
      { name: 'Price Sensitive', count: 210, color: 'bg-purple-500' },
      { name: 'New', count: 250, color: 'bg-cyan-500' },
      { name: 'Dormant', count: 150, color: 'bg-gray-500' },
    ]
  });
}

function StatCard({ title, value, trend, trendValue, icon, color }: {
  title: string;
  value: string | number;
  trend?: 'up' | 'down';
  trendValue?: string;
  icon: JSX.Element;
  color: string;
}) {
  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <Text variant="bodySm" as="span" tone="subdued">{title}</Text>
          <div className={`p-2 rounded-lg ${color}`}>
            {icon}
          </div>
        </InlineStack>
        <Text variant="headingXl" as="p">{value}</Text>
        {trend && (
          <InlineStack gap="200">
            <Badge tone={trend === 'up' ? 'success' : 'critical'}>
              {trend === 'up' ? '↑' : '↓'} {trendValue}
            </Badge>
            <Text variant="bodySm" as="span" tone="subdued">vs last month</Text>
          </InlineStack>
        )}
      </BlockStack>
    </Card>
  );
}

export default function DashboardOverview() {
  const { stats, recentContacts, segments } = useLoaderData<typeof loader>();

  return (
    <BlockStack gap="500">
      <Grid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
        <StatCard
          title="Total Contacts"
          value={stats.totalContacts.toLocaleString()}
          trend="up"
          trendValue="12%"
          icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          color="bg-primary-600"
        />
        <StatCard
          title="SMS Delivered"
          value={`${stats.deliveryRate}%`}
          trend="up"
          trendValue="2.3%"
          icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>}
          color="bg-green-600"
        />
        <StatCard
          title="Total SMS Sent"
          value={stats.totalSmsSent.toLocaleString()}
          trend="up"
          trendValue="18%"
          icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
          color="bg-blue-600"
        />
        <StatCard
          title="Revenue Generated"
          value={`${(stats.revenue / 1000).toFixed(0)}K EGP`}
          trend="up"
          trendValue="24%"
          icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          color="bg-accent-500"
        />
      </Grid>

      <Grid columns={{ xs: 1, lg: 2 }} gap="400">
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text variant="headingMd" as="h2">Segment Distribution</Text>
              <Link to="/dashboard/segments" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                View All →
              </Link>
            </InlineStack>
            <BlockStack gap="200">
              {segments.map((segment) => (
                <Grid key={segment.name} columns={2}>
                  <InlineStack>
                    <div className={`w-3 h-3 rounded-full ${segment.color}`} />
                    <Text variant="bodyMd" as="span">{segment.name}</Text>
                  </InlineStack>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    {segment.count} ({((segment.count / stats.totalContacts) * 100).toFixed(0)}%)
                  </Text>
                </Grid>
              ))}
            </BlockStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text variant="headingMd" as="h2">Recent Contacts</Text>
              <Link to="/dashboard/contacts" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                View All →
              </Link>
            </InlineStack>
            <BlockStack gap="200">
              {recentContacts.map((contact) => (
                <InlineStack key={contact.id} align="space-between">
                  <InlineStack gap="200">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <Text variant="bodySm" as="span" fontWeight="medium">
                        {contact.name.charAt(0)}
                      </Text>
                    </div>
                    <BlockStack gap="0">
                      <Text variant="bodyMd" as="p" fontWeight="medium">{contact.name}</Text>
                      <Text variant="bodySm" as="span" tone="subdued">{contact.phone}</Text>
                    </BlockStack>
                  </InlineStack>
                  <Badge tone={
                    contact.segment === 'CHAMPIONS' ? 'success' :
                    contact.segment === 'LOYAL' ? 'info' :
                    contact.segment === 'AT_RISK' ? 'warning' :
                    'new'
                  }>
                    {contact.segment}
                  </Badge>
                </InlineStack>
              ))}
            </BlockStack>
          </BlockStack>
        </Card>
      </Grid>

      <Grid columns={{ xs: 1, sm: 3 }} gap="400">
        <Card>
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text variant="headingSm" as="h3">Active Campaigns</Text>
              <Badge tone="success">{stats.activeCampaigns}</Badge>
            </InlineStack>
            <ProgressBar progress={65} tone="success" />
            <Text variant="bodySm" as="span" tone="subdued">3 campaigns running</Text>
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text variant="headingSm" as="h3">SMS Credits</Text>
              <Badge tone="warning">1000 left</Badge>
            </InlineStack>
            <ProgressBar progress={0} color="warning" />
            <Text variant="bodySm" as="span" tone="subdued">Monthly limit: 1000</Text>
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text variant="headingSm" as="h3">Delivery Rate</Text>
              <Badge tone="success">{stats.deliveryRate}%</Badge>
            </InlineStack>
            <ProgressBar progress={stats.deliveryRate} tone="success" />
            <Text variant="bodySm" as="span" tone="subdued">Above average</Text>
          </BlockStack>
        </Card>
      </Grid>
    </BlockStack>
  );
}
