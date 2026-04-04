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
  TextField,
  Select,
  Banner,
  Divider,
  BlockLayout,
  FormLayout
} from '@shopify/polaris';
import { useState } from 'react';

export async function loader({ request }: LoaderFunctionArgs) {
  return json({
    merchant: {
      companyName: 'Demo Store',
      email: 'demo@store.com',
      phone: '+201012345678'
    },
    settings: {
      discountCode: 'WELCOME10',
      discountPercentage: 10,
      discountType: 'percentage',
      popupEnabled: true,
      popupTriggerDelay: 5000,
      popupExitIntent: true,
      popupShowAfterDismiss: 24,
      automationsEnabled: true,
      abandonedCartDelay: 30,
      winBackDelay: 72,
      timezone: 'Africa/Cairo',
      smsCredits: 1000,
      monthlySmsLimit: 1000
    },
    gateways: [
      { name: 'smsmisr', label: 'SMS Misr', enabled: true },
      { name: 'victorylink', label: 'Victory Link', enabled: true },
      { name: 'weapi', label: 'WE API', enabled: false }
    ]
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get('action');

  if (action === 'saveSettings') {
    return json({ success: true });
  }

  if (action === 'addCredits') {
    return json({ success: true, credits: 500 });
  }

  return json({ error: 'Invalid action' }, { status: 400 });
}

export default function DashboardSettings() {
  const { merchant, settings, gateways } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [localSettings, setLocalSettings] = useState(settings);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    fetcher.submit(
      { action: 'saveSettings', ...localSettings },
      { method: 'post' }
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const updateSetting = (key: string, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <BlockStack gap="500">
      {saved && (
        <Banner title="Settings saved" tone="success" onDismiss={() => setSaved(false)}>
          Your settings have been updated successfully.
        </Banner>
      )}

      <Grid columns={{ xs: 1, lg: 2 }} gap="500">
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Store Information</Text>
              
              <FormLayout>
                <TextField
                  label="Company Name"
                  value={merchant.companyName}
                  onChange={() => {}}
                />
                <TextField
                  label="Email"
                  type="email"
                  value={merchant.email}
                  onChange={() => {}}
                />
                <TextField
                  label="Phone"
                  type="tel"
                  value={merchant.phone}
                  onChange={() => {}}
                />
              </FormLayout>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Popup Settings</Text>
              
              <FormLayout>
                <Select
                  label="Discount Type"
                  options={[
                    { label: 'Percentage', value: 'percentage' },
                    { label: 'Fixed Amount', value: 'fixed' }
                  ]}
                  value={localSettings.discountType}
                  onChange={(value) => updateSetting('discountType', value)}
                />
                <TextField
                  label="Discount Value"
                  type="number"
                  value={localSettings.discountPercentage.toString()}
                  onChange={(value) => updateSetting('discountPercentage', parseInt(value))}
                />
                <TextField
                  label="Discount Code"
                  value={localSettings.discountCode}
                  onChange={(value) => updateSetting('discountCode', value)}
                />
                <Divider />
                <Text variant="headingSm" as="h3">Trigger Settings</Text>
                <TextField
                  label="Trigger Delay (seconds)"
                  type="number"
                  value={(localSettings.popupTriggerDelay / 1000).toString()}
                  onChange={(value) => updateSetting('popupTriggerDelay', parseInt(value) * 1000)}
                />
                <InlineStack gap="200">
                  <input
                    type="checkbox"
                    id="popupExitIntent"
                    checked={localSettings.popupExitIntent}
                    onChange={(e) => updateSetting('popupExitIntent', e.target.checked)}
                  />
                  <label htmlFor="popupExitIntent">Show on exit intent</label>
                </InlineStack>
                <InlineStack gap="200">
                  <input
                    type="checkbox"
                    id="popupEnabled"
                    checked={localSettings.popupEnabled}
                    onChange={(e) => updateSetting('popupEnabled', e.target.checked)}
                  />
                  <label htmlFor="popupEnabled">Enable popup</label>
                </InlineStack>
              </FormLayout>
            </BlockStack>
          </Card>
        </BlockStack>

        <BlockStack gap="400">
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">SMS Credits</Text>
              
              <div className="p-4 bg-primary-50 rounded-lg">
                <InlineStack align="space-between">
                  <BlockStack gap="0">
                    <Text variant="headingSm" as="span">Available Credits</Text>
                    <Text variant="headingXl" as="p">{localSettings.smsCredits}</Text>
                  </BlockStack>
                  <Button variant="primary">Add Credits</Button>
                </InlineStack>
              </div>
              
              <InlineStack gap="200">
                <Text variant="bodySm" as="span">Monthly Limit:</Text>
                <Text variant="bodySm" as="span" fontWeight="medium">{localSettings.monthlySmsLimit}</Text>
              </InlineStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Automation Settings</Text>
              
              <FormLayout>
                <InlineStack gap="200">
                  <input
                    type="checkbox"
                    id="automationsEnabled"
                    checked={localSettings.automationsEnabled}
                    onChange={(e) => updateSetting('automationsEnabled', e.target.checked)}
                  />
                  <label htmlFor="automationsEnabled">Enable automations</label>
                </InlineStack>
                <TextField
                  label="Abandoned Cart Delay (minutes)"
                  type="number"
                  value={localSettings.abandonedCartDelay.toString()}
                  onChange={(value) => updateSetting('abandonedCartDelay', parseInt(value))}
                />
                <TextField
                  label="Win Back Delay (hours)"
                  type="number"
                  value={(localSettings.winBackDelay / 60).toString()}
                  onChange={(value) => updateSetting('winBackDelay', parseInt(value) * 60)}
                />
                <Select
                  label="Timezone"
                  options={[
                    { label: 'Africa/Cairo', value: 'Africa/Cairo' },
                    { label: 'Africa/Alexandria', value: 'Africa/Alexandria' },
                  ]}
                  value={localSettings.timezone}
                  onChange={(value) => updateSetting('timezone', value)}
                />
              </FormLayout>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">SMS Gateways</Text>
              
              <BlockStack gap="200">
                {gateways.map((gw) => (
                  <InlineStack key={gw.name} align="space-between">
                    <InlineStack gap="200">
                      <div className={`w-3 h-3 rounded-full ${gw.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <Text variant="bodyMd" as="span">{gw.label}</Text>
                    </InlineStack>
                    <Button variant="secondary" size="slim">Configure</Button>
                  </InlineStack>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>

          <Button variant="primary" onClick={handleSave} size="large" fullWidth>
            Save Settings
          </Button>
        </BlockStack>
      </Grid>
    </BlockStack>
  );
}
