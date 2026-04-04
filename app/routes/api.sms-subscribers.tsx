import { ActionFunctionArgs, json } from '@remix-run/node';
import { createContactSchema, normalizedPhoneSchema } from '../lib/validation';
import { validateEgyptianPhone, normalizeEgyptianPhone, hashPhoneNumber, hashEmail } from '../utils/security.server';
import { checkSmsRateLimit } from '../lib/rate-limiter';
import { createAuditLog, logContactAccess, logSmsSend } from '../lib/audit-log';
import { prisma, invalidateContactCache } from '../lib/database';
import { addToDeadLetterQueue } from '../lib/dead-letter-queue';
import { getClientIp } from '../utils/request.server';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = createContactSchema.safeParse(body);
  
  if (!validation.success) {
    return json(
      { error: 'Validation failed', details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { phone, storeUrl, email, firstName, source } = validation.data;

  const merchant = await prisma.merchant.findUnique({
    where: { shopifyStoreUrl: storeUrl },
    include: { settings: true }
  });

  if (!merchant) {
    return json({ error: 'Store not found' }, { status: 404 });
  }

  const rateLimit = await checkSmsRateLimit(merchant.id);
  if (!rateLimit.allowed) {
    return json(
      { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    );
  }

  const normalizedPhone = normalizeEgyptianPhone(phone);
  const phoneHash = hashPhoneNumber(normalizedPhone);
  const emailHash = email ? hashEmail(email) : null;

  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || undefined;

  let contact: any;

  try {
    contact = await prisma.contact.upsert({
      where: {
        merchantId_phoneNumber: {
          merchantId: merchant.id,
          phoneNumber: normalizedPhone
        }
      },
      create: {
        merchantId: merchant.id,
        phoneNumber: normalizedPhone,
        phoneNumberHash: phoneHash,
        email,
        emailHash: emailHash || undefined,
        firstName: firstName || undefined,
        smsOptIn: true,
        smsOptInDate: new Date()
      },
      update: {
        smsOptIn: true,
        smsOptInDate: new Date(),
        firstName: firstName,
        email,
        emailHash: emailHash || undefined
      }
    });

    await logContactAccess(
      merchant.id,
      contact.id,
      'VIEW',
      undefined,
      ipAddress,
      ['phoneNumber', 'firstName']
    );

    await createAuditLog(merchant.id, 'CONTACT_CREATE', 'CONTACT', {
      resourceId: contact.id,
      details: { source, phoneHash: phoneHash.slice(0, 8) + '...' },
      ipAddress,
      userAgent,
      piiAccessed: true
    });

    if (merchant.settings?.discountCode && merchant.settings.discountPercentage) {
      try {
        const discountMessage = `Welcome! Your discount code is ${merchant.settings.discountCode}. Use it to get ${merchant.settings.discountPercentage}% off!`;
        
        const smsJob = await prisma.smsJob.create({
          data: {
            contactId: contact.id,
            phoneNumber: normalizedPhone,
            message: discountMessage,
            status: 'PENDING'
          }
        });

        await prisma.campaign.create({
          data: {
            merchantId: merchant.id,
            name: 'Welcome SMS',
            type: 'WELCOME',
            status: 'RUNNING',
            messageTemplate: discountMessage,
            sentCount: 1,
            deliveredCount: 0,
            startedAt: new Date()
          }
        });

        await logSmsSend(merchant.id, contact.id, undefined, undefined, ipAddress);

        await createAuditLog(merchant.id, 'SMS_SEND', 'SMS', {
          resourceId: smsJob.id,
          details: { messageLength: discountMessage.length },
          ipAddress,
          userAgent,
          piiAccessed: true
        });

      } catch (smsError) {
        console.error('[SMS Subscribers] Failed to create welcome SMS job:', smsError);
      }
    }

    await invalidateContactCache(contact.id);

    return json({
      success: true,
      contactId: contact.id,
      phone: normalizedPhone
    });

  } catch (error) {
    console.error('[SMS Subscribers] Error:', error);

    if (contact?.id) {
      await addToDeadLetterQueue(
        'sms',
        contact.id,
        { phone: normalizedPhone, email, firstName, source },
        error instanceof Error ? error : 'Unknown error',
        'sms-subscribers',
        { merchantId: merchant.id, contactId: contact.id, phoneNumber: normalizedPhone }
      );
    }

    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function loader() {
  return json({ status: 'ok', timestamp: new Date().toISOString() });
}
