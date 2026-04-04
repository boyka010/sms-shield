import { json, LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSearchParams, Link } from '@remix-run/react';
import { 
  Page, 
  Card, 
  BlockStack, 
  Text, 
  Grid,
  InlineStack,
  Button,
  Badge,
  DataTable,
  Select,
  TextField,
  Modal,
  FormLayout,
  ChoiceList,
  ActionList,
  Avatar
} from '@shopify/polaris';
import { useState } from 'react';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const segment = url.searchParams.get('segment') || 'CHAMPIONS';

  const segmentData = {
    CHAMPIONS: {
      description: 'Your best customers - high value, frequent buyers, recent activity',
      color: 'bg-green-500',
      criteria: 'RFM Score ≥ 12, Recent orders, High spend'
    },
    LOYAL: {
      description: 'Consistent buyers who engage regularly',
      color: 'bg-blue-500', 
      criteria: 'Frequency ≥ 3, Recent activity'
    },
    AT_RISK: {
      description: 'Previously active customers showing signs of churn',
      color: 'bg-orange-500',
      criteria: 'Recency ≤ 2, Frequency ≥ 3'
    },
    PRICE_SENSITIVE: {
      description: 'Buyers who need discounts to convert',
      color: 'bg-purple-500',
      criteria: 'Monetary ≤ 2, Frequency ≥ 3'
    },
    NEW: {
      description: 'New customers with limited purchase history',
      color: 'bg-cyan-500',
      criteria: 'First order within 30 days'
    },
    DORMANT: {
      description: 'Inactive customers requiring re-engagement',
      color: 'bg-gray-500',
      criteria: 'No orders in 6+ months'
    }
  };

  const contacts = [
    { id: '1', name: 'Ahmed Mohamed', phone: '+201012345678', email: 'ahmed@example.com', totalOrders: 12, totalSpent: 15000, lastOrderDate: '2024-01-15', rfmScore: 14 },
    { id: '2', name: 'Sara Ali', phone: '+201112345678', email: 'sara@example.com', totalOrders: 8, totalSpent: 8500, lastOrderDate: '2024-01-14', rfmScore: 11 },
    { id: '3', name: 'Omar Hassan', phone: '+201212345678', email: 'omar@example.com', totalOrders: 6, totalSpent: 6200, lastOrderDate: '2024-01-10', rfmScore: 9 },
    { id: '4', name: 'Fatma Ahmed', phone: '+201512345678', email: 'fatma@example.com', totalOrders: 4, totalSpent: 4100, lastOrderDate: '2024-01-15', rfmScore: 8 },
    { id: '5', name: 'Mohamed Ali', phone: '+201012345679', email: 'mali@example.com', totalOrders: 3, totalSpent: 2800, lastOrderDate: '2024-01-12', rfmScore: 7 },
  ];

  const segmentCounts = {
    CHAMPIONS: 120,
    LOYAL: 340,
    AT_RISK: 180,
    PRICE_SENSITIVE: 210,
    NEW: 250,
    DORMANT: 150
  };

  return json({
    segment,
    segmentInfo: segmentData[segment as keyof typeof segmentData],
    contacts,
    segmentCounts,
    totalContacts: 1250
  });
}

export default function DashboardSegments() {
  const { segment, segmentInfo, contacts, segmentCounts, totalContacts } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSegment, setSelectedSegment] = useState(segment);
  const [showCampaignModal, setShowCampaignModal] = useState(false);

  const segments = [
    { value: 'CHAMPIONS', label: 'Champions' },
    { value: 'LOYAL', label: 'Loyal' },
    { value: 'AT_RISK', label: 'At Risk' },
    { value: 'PRICE_SENSITIVE', label: 'Price Sensitive' },
    { value: 'NEW', label: 'New' },
    { value: 'DORMANT', label: 'Dormant' },
  ];

  const rows = contacts.map(contact => [
    <InlineStack key={contact.id} gap="200">
      <Avatar size="small" name={contact.name} />
      <BlockStack gap="0">
        <Text variant="bodyMd" as="p" fontWeight="medium">{contact.name}</Text>
        <Text variant="bodySm" as="span" tone="subdued">{contact.email}</Text>
      </BlockStack>
    </InlineStack>,
    contact.phone,
    contact.totalOrders.toString(),
    `${contact.totalSpent.toLocaleString()} EGP`,
    contact.lastOrderDate,
    <Badge tone={
      contact.rfmScore >= 12 ? 'success' :
      contact.rfmScore >= 9 ? 'info' :
      contact.rfmScore >= 6 ? 'warning' :
      'critical'
    }>
      {contact.rfmScore}
    </Badge>,
    <Button variant="plain" size="slim" onClick={() => {}}>
      Send SMS
    </Button>
  ]);

  return (
    <BlockStack gap="500">
      <Grid columns={{ xs: 1, sm: 2, lg: 3 }} gap="400">
        {Object.entries(segmentCounts).map(([seg, count]) => (
          <Card 
            key={seg}
            sectioned
            onClick={() => setSearchParams({ segment: seg })}
            className={`cursor-pointer transition-all hover:shadow-md ${
              segment === seg ? 'ring-2 ring-primary-500' : ''
            }`}
          >
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingSm" as="h3">{seg.replace('_', ' ')}</Text>
                <div className={`w-3 h-3 rounded-full ${
                  seg === 'CHAMPIONS' ? 'bg-green-500' :
                  seg === 'LOYAL' ? 'bg-blue-500' :
                  seg === 'AT_RISK' ? 'bg-orange-500' :
                  seg === 'PRICE_SENSITIVE' ? 'bg-purple-500' :
                  seg === 'NEW' ? 'bg-cyan-500' :
                  'bg-gray-500'
                }`} />
              </InlineStack>
              <Text variant="headingXl" as="p">{count}</Text>
              <Text variant="bodySm" as="span" tone="subdued">
                {((count / totalContacts) * 100).toFixed(1)}% of total
              </Text>
            </BlockStack>
          </Card>
        ))}
      </Grid>

      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <BlockStack gap="0">
              <Text variant="headingMd" as="h2">{segment.replace('_', ' ')} Segment</Text>
              <Text variant="bodySm" as="span" tone="subdued">{segmentInfo.description}</Text>
            </BlockStack>
            <InlineStack gap="200">
              <Button variant="secondary" onClick={() => setShowCampaignModal(true)}>
                Create Campaign
              </Button>
              <Button variant="primary" onClick={() => {}}>
                Send to All ({segmentCounts[segment as keyof typeof segmentCounts]})
              </Button>
            </InlineStack>
          </InlineStack>

          <div className="p-4 bg-gray-50 rounded-lg">
            <Text variant="bodySm" as="span" tone="subdued">
              <strong>Criteria:</strong> {segmentInfo.criteria}
            </Text>
          </div>

          <DataTable
            columnContentTypes={['text', 'text', 'numeric', 'text', 'text', 'text', 'text']}
            headings={['Contact', 'Phone', 'Orders', 'Total Spent', 'Last Order', 'RFM Score', 'Actions']}
            rows={rows}
          />
        </BlockStack>
      </Card>

      <Modal
        open={showCampaignModal}
        onClose={() => setShowCampaignModal(false)}
        title="Create Campaign for Segment"
        primaryAction={{
          content: 'Create Campaign',
          onAction: () => setShowCampaignModal(false)
        }}
        secondaryActions={[{
          content: 'Cancel',
          onAction: () => setShowCampaignModal(false)
        }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField label="Campaign Name" placeholder="e.g., Champions Special Offer" />
            <TextField label="Message Template" multiline={4} placeholder="Hi {{firstName}}! As one of our valued customers..." />
            <Select
              label="Send Timing"
              options={[
                { label: 'Send Immediately', value: 'immediate' },
                { label: 'Schedule for Later', value: 'scheduled' }
              ]}
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
