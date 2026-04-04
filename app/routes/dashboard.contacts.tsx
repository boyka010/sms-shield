import { json, LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSearchParams, useFetcher } from '@remix-run/react';
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
  IndexTable,
  ChoiceList,
  Thumbnail,
  Avatar
} from '@shopify/polaris';
import { useState, useCallback } from 'react';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const segment = url.searchParams.get('segment') || '';
  const page = parseInt(url.searchParams.get('page') || '1');

  const contacts = [
    { id: '1', name: 'Ahmed Mohamed', phone: '+201012345678', email: 'ahmed@example.com', segment: 'CHAMPIONS', totalOrders: 12, totalSpent: 15000, lastOrderDate: '2024-01-15', smsOptIn: true },
    { id: '2', name: 'Sara Ali', phone: '+201112345678', email: 'sara@example.com', segment: 'LOYAL', totalOrders: 8, totalSpent: 8500, lastOrderDate: '2024-01-14', smsOptIn: true },
    { id: '3', name: 'Omar Hassan', phone: '+201212345678', email: 'omar@example.com', segment: 'AT_RISK', totalOrders: 6, totalSpent: 6200, lastOrderDate: '2024-01-10', smsOptIn: true },
    { id: '4', name: 'Fatma Ahmed', phone: '+201512345678', email: 'fatma@example.com', segment: 'NEW', totalOrders: 4, totalSpent: 4100, lastOrderDate: '2024-01-15', smsOptIn: true },
    { id: '5', name: 'Mohamed Ali', phone: '+201012345679', email: 'mali@example.com', segment: 'DORMANT', totalOrders: 2, totalSpent: 1800, lastOrderDate: '2023-12-20', smsOptIn: false },
  ];

  return json({
    contacts,
    totalCount: 1250,
    page,
    pageSize: 25
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get('action');
  const contactIds = formData.get('contactIds') as string;

  if (action === 'sendSms') {
    return json({ success: true, message: 'SMS queued successfully' });
  }

  if (action === 'export') {
    return json({ success: true, message: 'Export started' });
  }

  return json({ error: 'Invalid action' }, { status: 400 });
}

export default function DashboardContacts() {
  const { contacts, totalCount, page, pageSize } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [message, setMessage] = useState('');

  const handleSelection = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  const handleBulkSms = useCallback(() => {
    if (selectedIds.length === 0) return;
    setShowSmsModal(true);
  }, [selectedIds]);

  const sendBulkSms = useCallback(() => {
    fetcher.submit(
      { action: 'sendSms', contactIds: selectedIds.join(','), message },
      { method: 'post' }
    );
    setShowSmsModal(false);
    setMessage('');
  }, [selectedIds, message, fetcher]);

  const segmentFilters = [
    { value: '', label: 'All Segments' },
    { value: 'CHAMPIONS', label: 'Champions' },
    { value: 'LOYAL', label: 'Loyal' },
    { value: 'AT_RISK', label: 'At Risk' },
    { value: 'PRICE_SENSITIVE', label: 'Price Sensitive' },
    { value: 'NEW', label: 'New' },
    { value: 'DORMANT', label: 'Dormant' },
  ];

  return (
    <BlockStack gap="500">
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <BlockStack gap="0">
              <Text variant="headingMd" as="h2">Contacts</Text>
              <Text variant="bodySm" as="span" tone="subdued">
                {totalCount.toLocaleString()} total contacts
              </Text>
            </BlockStack>
            <InlineStack gap="200">
              <Button variant="secondary" onClick={() => {}}>
                Export
              </Button>
              <Button variant="primary" onClick={handleBulkSms} disabled={selectedIds.length === 0}>
                Send SMS ({selectedIds.length})
              </Button>
            </InlineStack>
          </InlineStack>

          <Grid columns={{ xs: 1, sm: 3 }} gap="400">
            <TextField
              label="Search"
              placeholder="Search by name, phone, or email..."
              prefix={<svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
              value={searchParams.get('search') || ''}
              onChange={(value) => {
                const params = new URLSearchParams(searchParams);
                if (value) params.set('search', value);
                else params.delete('search');
                setSearchParams(params);
              }}
            />
            <Select
              label="Segment"
              options={segmentFilters}
              value={searchParams.get('segment') || ''}
              onChange={(value) => {
                const params = new URLSearchParams(searchParams);
                if (value) params.set('segment', value);
                else params.delete('segment');
                setSearchParams(params);
              }}
            />
            <Select
              label="SMS Opt-In"
              options={[
                { value: '', label: 'All' },
                { value: 'true', label: 'Opted In' },
                { value: 'false', label: 'Opted Out' }
              ]}
              value={searchParams.get('smsOptIn') || ''}
              onChange={(value) => {
                const params = new URLSearchParams(searchParams);
                if (value) params.set('smsOptIn', value);
                else params.delete('smsOptIn');
                setSearchParams(params);
              }}
            />
          </Grid>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="400">
          <IndexTable
            resourceName={{ singular: 'contact', plural: 'contacts' }}
            itemCount={contacts.length}
            selectedItems={selectedIds}
            onSelectionChange={handleSelection}
            headings={[
              { title: 'Contact' },
              { title: 'Phone' },
              { title: 'Segment' },
              { title: 'Orders' },
              { title: 'Total Spent' },
              { title: 'Last Order' },
              { title: 'SMS' },
              { title: 'Actions' },
            ]}
          >
            {contacts.map((contact, index) => (
              <IndexTable.Row
                key={contact.id}
                id={contact.id}
                selected={selectedIds.includes(contact.id)}
              >
                <IndexTable.Cell>
                  <InlineStack gap="200">
                    <Avatar size="small" name={contact.name} />
                    <BlockStack gap="0">
                      <Text variant="bodyMd" as="p" fontWeight="medium">{contact.name}</Text>
                      <Text variant="bodySm" as="span" tone="subdued">{contact.email}</Text>
                    </BlockStack>
                  </InlineStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodyMd" as="span">{contact.phone}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone={
                    contact.segment === 'CHAMPIONS' ? 'success' :
                    contact.segment === 'LOYAL' ? 'info' :
                    contact.segment === 'AT_RISK' ? 'warning' :
                    contact.segment === 'NEW' ? 'new' :
                    'critical'
                  }>
                    {contact.segment}
                  </Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodyMd" as="span">{contact.totalOrders}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodyMd" as="span">{contact.totalSpent.toLocaleString()} EGP</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodyMd" as="span">{contact.lastOrderDate}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  {contact.smsOptIn ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="critical">Off</Badge>
                  )}
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Button variant="plain" size="slim" onClick={() => {}}>
                    Send SMS
                  </Button>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </BlockStack>
      </Card>

      <Modal
        open={showSmsModal}
        onClose={() => setShowSmsModal(false)}
        title={`Send SMS to ${selectedIds.length} contacts`}
        primaryAction={{
          content: 'Send',
          onAction: sendBulkSms
        }}
        secondaryActions={[{
          content: 'Cancel',
          onAction: () => setShowSmsModal(false)
        }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Message"
              value={message}
              onChange={setMessage}
              multiline={4}
              placeholder="Enter your message..."
              helpText="Use {{firstName}} to personalize messages"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
