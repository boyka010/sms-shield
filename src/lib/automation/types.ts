// ─────────────────────────────────────────────────────────────────────────────
// SMS-Shield — Multi-Touch Automation State Machine Types
// ─────────────────────────────────────────────────────────────────────────────

// ── Flow Types ───────────────────────────────────────────────────────────────

export type FlowType =
  | 'CART_ABANDONMENT'
  | 'POST_PURCHASE'
  | 'COD_CONFIRMATION'
  | 'WIN_BACK'
  | 'RFM_CAMPAIGN'
  | 'BIRTHDAY'
  | 'REENGAGEMENT';

// ── Flow States ──────────────────────────────────────────────────────────────

export type FlowState =
  | 'initialized'
  | 'waiting'
  | 'first_touch_sent'
  | 'first_touch_delivered'
  | 'second_touch_pending'
  | 'second_touch_sent'
  | 'second_touch_delivered'
  | 'third_touch_pending'
  | 'third_touch_sent'
  | 'completed'
  | 'expired'
  | 'cancelled';

// ── Flow Triggers ────────────────────────────────────────────────────────────

export type FlowTrigger =
  | 'CART_ABANDONED'
  | 'TIMER_EXPIRED_30MIN'
  | 'TIMER_EXPIRED_4HOURS'
  | 'TIMER_EXPIRED_24HOURS'
  | 'TIMER_EXPIRED_7DAYS'
  | 'TIMER_EXPIRED_14DAYS'
  | 'TIMER_EXPIRED_30DAYS'
  | 'SMS_DELIVERED'
  | 'SMS_FAILED'
  | 'LINK_CLICKED'
  | 'ORDER_RECOVERED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_CANCELLED'
  | 'MANUAL_TRIGGER'
  | 'MAX_RETRIES_EXCEEDED'
  | 'SCHEDULE'
  | 'OPT_OUT'
  | 'FLOW_TIMEOUT';

// ── State Transition ─────────────────────────────────────────────────────────

export type FlowTransition = {
  from: FlowState;
  to: FlowState;
  trigger: FlowTrigger;
};

// ── Flow Configuration ───────────────────────────────────────────────────────

export interface FlowConfiguration {
  flowType: FlowType;
  steps: FlowStep[];
  maxDurationHours: number;
  retryOnFailure: boolean;
  maxRetriesPerStep: number;
}

// ── Flow Step ────────────────────────────────────────────────────────────────

export interface FlowStep {
  stepNumber: number;
  action: FlowAction;
  delayMinutes: number; // delay before executing this step
  condition?: (context: FlowContext) => boolean;
  template: string; // message template with {{variable}} placeholders
  fallbackGateway?: boolean;
}

// ── Flow Action ──────────────────────────────────────────────────────────────

export type FlowAction =
  | 'SEND_SMS'
  | 'WAIT'
  | 'CHECK_CONDITION'
  | 'GENERATE_LANDING_PAGE'
  | 'END';

// ── Flow Context ─────────────────────────────────────────────────────────────

export interface FlowContext {
  shopId: string;
  subscriberId: string;
  subscriberPhone: string;
  subscriberName?: string;
  flowType: FlowType;
  currentState: FlowState;
  currentStep: number;
  startedAt: Date;
  cartData?: CartData;
  orderData?: OrderData;
  customData?: Record<string, unknown>;
}

// ── Cart Data ────────────────────────────────────────────────────────────────

export interface CartData {
  cartToken: string;
  total: number;
  currency: string;
  lineItemsCount: number;
  lineItems: Array<{ title: string; quantity: number; price: number }>;
}

// ── Order Data ───────────────────────────────────────────────────────────────

export interface OrderData {
  orderName: string;
  orderId: string;
  total: number;
  currency: string;
}

// ── Automation Execution Record ──────────────────────────────────────────────

export interface AutomationExecutionRecord {
  id: string;
  shopId: string;
  subscriberId?: string;
  flowType: FlowType;
  status: FlowState;
  currentStep: number;
  contextData: string; // JSON
  configId?: string;
  startedAt: Date;
  completedAt?: Date;
  expiredAt?: Date;
  cancelledAt?: Date;
  lastTrigger?: FlowTrigger;
  totalTouches: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── Automation Config ────────────────────────────────────────────────────────

export interface AutomationConfigRecord {
  id: string;
  shopId: string;
  flowType: FlowType;
  isActive: boolean;
  name: string;
  description?: string;
  configJson: string; // FlowConfiguration serialized
  schedule?: string; // cron expression for scheduled flows
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Touch Point Record (for tracking sent messages) ─────────────────────────

export interface TouchPointRecord {
  id: string;
  shopId: string;
  subscriberId?: string;
  subscriberPhone: string;
  touchType: string;
  flowType?: FlowType;
  flowExecutionId?: string;
  channel: 'sms' | 'email' | 'whatsapp';
  messageId?: string;
  template: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'clicked';
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  clickedAt?: Date;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ── Utility types ────────────────────────────────────────────────────────────

/** Complete set of all valid flow states. */
export const ALL_FLOW_STATES: readonly FlowState[] = [
  'initialized',
  'waiting',
  'first_touch_sent',
  'first_touch_delivered',
  'second_touch_pending',
  'second_touch_sent',
  'second_touch_delivered',
  'third_touch_pending',
  'third_touch_sent',
  'completed',
  'expired',
  'cancelled',
] as const;

/** Complete set of all valid flow triggers. */
export const ALL_FLOW_TRIGGERS: readonly FlowTrigger[] = [
  'CART_ABANDONED',
  'TIMER_EXPIRED_30MIN',
  'TIMER_EXPIRED_4HOURS',
  'TIMER_EXPIRED_24HOURS',
  'TIMER_EXPIRED_7DAYS',
  'TIMER_EXPIRED_14DAYS',
  'TIMER_EXPIRED_30DAYS',
  'SMS_DELIVERED',
  'SMS_FAILED',
  'LINK_CLICKED',
  'ORDER_RECOVERED',
  'ORDER_CONFIRMED',
  'ORDER_CANCELLED',
  'MANUAL_TRIGGER',
  'MAX_RETRIES_EXCEEDED',
  'SCHEDULE',
  'OPT_OUT',
  'FLOW_TIMEOUT',
] as const;

/** Complete set of all valid flow types. */
export const ALL_FLOW_TYPES: readonly FlowType[] = [
  'CART_ABANDONMENT',
  'POST_PURCHASE',
  'COD_CONFIRMATION',
  'WIN_BACK',
  'RFM_CAMPAIGN',
  'BIRTHDAY',
  'REENGAGEMENT',
] as const;

/** Terminal states — no further transitions possible. */
export const TERMINAL_STATES: readonly FlowState[] = [
  'completed',
  'expired',
  'cancelled',
] as const;

/** Active states — the flow is still in progress. */
export const ACTIVE_STATES: readonly FlowState[] = [
  'initialized',
  'waiting',
  'first_touch_sent',
  'first_touch_delivered',
  'second_touch_pending',
  'second_touch_sent',
  'second_touch_delivered',
  'third_touch_pending',
  'third_touch_sent',
] as const;
