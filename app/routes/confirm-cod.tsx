import { json, LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, Form, useActionData, useNavigation } from '@remix-run/react';
import { Card, BlockStack, Text, InlineStack, Button, Banner } from '@shopify/polaris';
import { verifyHmacSignature, generateSecureToken } from '../utils/security.server';
import { PrismaClient } from '@prisma/client';
import { sendSmsWithFallback } from '../adapters/sms-router.server';

const prisma = new PrismaClient();

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const orderNumber = url.searchParams.get('order');

  if (!token || !orderNumber) {
    return json({ error: 'Missing parameters', orderNumber: null }, { status: 400 });
  }

  const contact = await prisma.contact.findFirst({
    where: {
      preferences: {
        path: ['codConfirmationToken'],
        equals: token
      }
    },
    include: {
      orders: {
        where: { orderNumber },
        take: 1
      }
    }
  });

  if (!contact || contact.orders.length === 0) {
    return json({ error: 'Invalid token', orderNumber: null }, { status: 404 });
  }

  const order = contact.orders[0];

  return json({
    order: {
      orderNumber: order.orderNumber,
      totalPrice: order.totalPrice,
      currency: order.currency,
      lineItems: order.lineItems
    },
    customer: {
      firstName: contact.firstName,
      phone: contact.phoneNumber
    },
    token
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get('action');
  const token = formData.get('token') as string;
  const orderNumber = formData.get('orderNumber') as string;

  if (action === 'confirm') {
    const contact = await prisma.contact.findFirst({
      where: {
        preferences: {
          path: ['codConfirmationToken'],
          equals: token
        }
      }
    });

    if (!contact) {
      return json({ success: false, error: 'Invalid token' });
    }

    await prisma.order.updateMany({
      where: { orderNumber },
      data: {
        financialStatus: 'confirmed'
      }
    });

    return json({ success: true, confirmed: true });
  }

  if (action === 'cancel') {
    const contact = await prisma.contact.findFirst({
      where: {
        preferences: {
          path: ['codConfirmationToken'],
          equals: token
        }
      }
    });

    if (contact) {
      await prisma.order.updateMany({
        where: { orderNumber },
        data: {
          financialStatus: 'cancelled'
        }
      });
    }

    return json({ success: true, cancelled: true });
  }

  return json({ error: 'Invalid action' }, { status: 400 });
}

export default function CodConfirmation() {
  const { order, customer, token, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card>
          <BlockStack gap="400" align="center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <Text variant="headingMd" as="h1">Invalid Link</Text>
            <Text variant="bodyMd" as="p" tone="subdued">
              This confirmation link is invalid or has expired.
            </Text>
          </BlockStack>
        </Card>
      </div>
    );
  }

  if (actionData?.confirmed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card>
          <BlockStack gap="400" align="center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <Text variant="headingMd" as="h1">Order Confirmed!</Text>
            <Text variant="bodyMd" as="p" tone="subdued">
              Thank you for confirming your COD order. We'll process it shortly.
            </Text>
          </BlockStack>
        </Card>
      </div>
    );
  }

  if (actionData?.cancelled) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card>
          <BlockStack gap="400" align="center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <Text variant="headingMd" as="h1">Order Cancelled</Text>
            <Text variant="bodyMd" as="p" tone="subdued">
              Your COD order has been cancelled.
            </Text>
          </BlockStack>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="0" align="center">
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <Text variant="headingMd" as="h1">Confirm Your Order</Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Order #{order?.orderNumber}
              </Text>
            </BlockStack>

            <div className="p-4 bg-gray-50 rounded-lg">
              <Grid columns={2}>
                <Text variant="bodySm" as="span" tone="subdued">Total:</Text>
                <Text variant="headingSm" as="p" alignment="right">
                  {order?.totalPrice} {order?.currency}
                </Text>
              </Grid>
            </div>

            <Form method="post">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="orderNumber" value={order?.orderNumber} />
              
              <BlockStack gap="200">
                <Button
                  type="submit"
                  name="action"
                  value="confirm"
                  variant="primary"
                  size="large"
                  fullWidth
                  submit
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Confirming...' : '✓ Confirm Order'}
                </Button>
                
                <Button
                  type="submit"
                  name="action"
                  value="cancel"
                  variant="secondary"
                  size="large"
                  fullWidth
                  submit
                  disabled={isSubmitting}
                >
                  ✗ Cancel Order
                </Button>
              </BlockStack>
            </Form>

            <Text variant="bodySm" as="p" tone="subdued" alignment="center">
              Reply YES to confirm via SMS
            </Text>
          </BlockStack>
        </Card>
      </div>
    </div>
  );
}
