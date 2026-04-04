import { json, LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useFetcher } from '@remix-run/react';
import { 
  Page, 
  Card, 
  BlockStack, 
  Text, 
  Grid,
  InlineStack,
  Button,
  Badge,
  TextField,
  Select,
  Modal,
  FormLayout,
  Tabs
} from '@shopify/polaris';
import { useState } from 'react';

export async function loader({ request }: LoaderFunctionArgs) {
  return json({
    campaigns: [
      { 
        id: '1', 
        name: 'Welcome Campaign', 
        type: 'WELCOME', 
        status: 'RUNNING', 
        sentCount: 450, 
        deliveredCount: 442, 
        failedCount: 8,
        scheduledAt: null,
        createdAt: '2024-01-01'
      },
      { 
        id: '2', 
        name: 'Abandoned Cart Reminder', 
        type: 'ABANDONED_CART', 
        status: 'RUNNING', 
        sentCount: 1200, 
        deliveredCount: 1176, 
        failedCount: 24,
        scheduledAt: null,
        createdAt: '2024-01-05'
      },
      { 
        id: '3', 
        name: 'Champions Special Offer', 
        type: 'SEGMENT', 
        status: 'SCHEDULED', 
        sentCount: 0, 
        deliveredCount: 0, 
        failedCount: 0,
        scheduledAt: '2024-01-20',
        createdAt: '2024-01-15'
      },
      { 
        id: '4', 
        name: 'Win Back Campaign', 
        type: 'WIN_BACK', 
        status: 'COMPLETED', 
        sentCount: 180, 
        deliveredCount: 175, 
        failedCount: 5,
        scheduledAt: null,
        createdAt: '2023-12-20'
      },
    ],
    automations: [
      { id: '1', name: 'Abandoned Cart (30 min)', triggerType: 'ABANDONED_CART', isActive: true, delayMinutes: 30, sentCount: 1200 },
      { id: '2', name: 'Post-Purchase Thank You', triggerType: 'POST_PURCHASE', isActive: true, delayMinutes: 0, sentCount: 3400 },
      { id: '3', name: 'Win Back (72 hours)', triggerType: 'WIN_BACK', isActive: true, delayMinutes: 4320, sentCount: 180 },
    ]
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get('action');

  if (action === 'createCampaign') {
    return json({ success: true, campaignId: 'new-campaign-id' });
  }

  if (action === 'toggleAutomation') {
    return json({ success: true });
  }

  return json({ error: 'Invalid action' }, { status: 400 });
}

export default function DashboardCampaigns() {
  const { campaigns, automations } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [selectedTab, setSelectedTab] = useState(0);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showAutomationModal, setShowAutomationModal] = useState(false);

  const tabs = [
    { id: 'campaigns', content: 'Campaigns' },
    { id: 'automations', content: 'Automations' }
  ];

  return (
    <BlockStack gap="500">
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <Text variant="headingMd" as="h2">Marketing</Text>
            <InlineStack gap="200">
              <Button variant="secondary" onClick={() => setShowAutomationModal(true)}>
                New Automation
              </Button>
              <Button variant="primary" onClick={() => setShowCampaignModal(true)}>
                Create Campaign
              </Button>
            </InlineStack>
          </InlineStack>

          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />
        </BlockStack>
      </Card>

      {selectedTab === 0 && (
        <BlockStack gap="400">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <InlineStack gap="300">
                    <BlockStack gap="0">
                      <Text variant="headingSm" as="h3">{campaign.name}</Text>
                      <Text variant="bodySm" as="span" tone="subdued">
                        {campaign.type.replace('_', ' ')} • Created {campaign.createdAt}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  <Badge tone={
                    campaign.status === 'RUNNING' ? 'success' :
                    campaign.status === 'SCHEDULED' ? 'warning' :
                    campaign.status === 'COMPLETED' ? 'info' :
                    'new'
                  }>
                    {campaign.status}
                  </Badge>
                </InlineStack>

                <Grid columns={{ xs: 2, sm: 4 }} gap="400">
                  <BlockStack gap="0">
                    <Text variant="headingSm" as="p">{campaign.sentCount}</Text>
                    <Text variant="bodySm" as="span" tone="subdued">Sent</Text>
                  </BlockStack>
                  <BlockStack gap="0">
                    <Text variant="headingSm" as="p">{campaign.deliveredCount}</Text>
                    <Text variant="bodySm" as="span" tone="subdued">Delivered</Text>
                  </BlockStack>
                  <BlockStack gap="0">
                    <Text variant="headingSm" as="p">{campaign.failedCount}</Text>
                    <Text variant="bodySm" as="span" tone="subdued">Failed</Text>
                  </BlockStack>
                  <BlockStack gap="0">
                    <Text variant="headingSm" as="p">
                      {campaign.deliveredCount > 0 
                        ? ((campaign.deliveredCount / campaign.sentCount) * 100).toFixed(1) 
                        : 0}%
                    </Text>
                    <Text variant="bodySm" as="span" tone="subdued">Success Rate</Text>
                  </BlockStack>
                </Grid>

                {campaign.scheduledAt && (
                  <Text variant="bodySm" as="p" tone="subdued">
                    Scheduled for: {campaign.scheduledAt}
                  </Text>
                )}

                <InlineStack gap="200">
                  {campaign.status === 'SCHEDULED' && (
                    <Button variant="secondary" size="slim">Send Now</Button>
                  )}
                  {campaign.status === 'RUNNING' && (
                    <Button variant="secondary" size="slim">Pause</Button>
                  )}
                  <Button variant="plain" size="slim">View Report</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          ))}
        </BlockStack>
      )}

      {selectedTab === 1 && (
        <BlockStack gap="400">
          {automations.map((automation) => (
            <Card key={automation.id}>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <BlockStack gap="0">
                    <Text variant="headingSm" as="h3">{automation.name}</Text>
                    <Text variant="bodySm" as="span" tone="subdued">
                      {automation.triggerType.replace('_', ' ')} • {automation.delayMinutes > 0 ? `${Math.round(automation.delayMinutes / 60)}h delay` : 'Immediate'}
                    </Text>
                  </BlockStack>
                  <InlineStack gap="200">
                    <Button 
                      variant="plain" 
                      size="slim" 
                      onClick={() => {
                        fetcher.submit(
                          { action: 'toggleAutomation', automationId: automation.id },
                          { method: 'post' }
                        );
                      }}
                    >
                      {automation.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="plain" size="slim">Edit</Button>
                  </InlineStack>
                </InlineStack>

                <Grid columns={{ xs: 2, sm: 3 }} gap="400">
                  <BlockStack gap="0">
                    <Text variant="headingSm" as="p">{automation.sentCount}</Text>
                    <Text variant="bodySm" as="span" tone="subdued">Total Sent</Text>
                  </BlockStack>
                  <BlockStack gap="0">
                    <Text variant="headingSm" as="p">{automation.isActive ? 'Active' : 'Inactive'}</Text>
                    <Text variant="bodySm" as="span" tone="subdued">Status</Text>
                  </BlockStack>
                </Grid>
              </BlockStack>
            </Card>
          ))}
        </BlockStack>
      )}

      <Modal
        open={showCampaignModal}
        onClose={() => setShowCampaignModal(false)}
        title="Create Campaign"
        primaryAction={{
          content: 'Create',
          onAction: () => setShowCampaignModal(false)
        }}
        secondaryActions={[{
          content: 'Cancel',
          onAction: () => setShowCampaignModal(false)
        }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField label="Campaign Name" placeholder="e.g., Summer Sale" />
            <Select
              label="Campaign Type"
              options={[
                { label: 'Welcome', value: 'WELCOME' },
                { label: 'Abandoned Cart', value: 'ABANDONED_CART' },
                { label: 'Win Back', value: 'WIN_BACK' },
                { label: 'Segment', value: 'SEGMENT' },
                { label: 'Loyalty', value: 'LOYALTY' },
              ]}
            />
            <Select
              label="Target Segment"
              options={[
                { label: 'All Contacts', value: 'all' },
                { label: 'Champions', value: 'CHAMPIONS' },
                { label: 'Loyal', value: 'LOYAL' },
                { label: 'At Risk', value: 'AT_RISK' },
                { label: 'New', value: 'NEW' },
              ]}
            />
            <TextField label="Message Template" multiline={4} placeholder="Hi {{firstName}}..." />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
