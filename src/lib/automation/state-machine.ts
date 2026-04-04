// ─────────────────────────────────────────────────────────────────────────────
// SMS-Shield — Multi-Touch Automation State Machine
// ─────────────────────────────────────────────────────────────────────────────

import type {
  FlowType,
  FlowState,
  FlowTrigger,
  FlowTransition,
  FlowConfiguration,
  FlowStep,
  FlowContext,
  FlowAction,
} from './types';
import { TERMINAL_STATES } from './types';

// ── State Transition Table ───────────────────────────────────────────────────
//
// Each flow type has its own transition map. A transition is valid if:
//   - the current state matches `from`
//   - the trigger matches
//   - the result state is `to`
//
// The machine is *deterministic*: for a given (state, trigger) pair, there
// is at most one target state.

type TransitionMap = Map<string, Map<FlowTrigger, FlowState>>;

/** Build a transition map from an array of FlowTransition objects. */
function buildTransitionMap(transitions: FlowTransition[]): TransitionMap {
  const map: TransitionMap = new Map();

  for (const t of transitions) {
    if (!map.has(t.from)) {
      map.set(t.from, new Map());
    }
    map.get(t.from)!.set(t.trigger, t.to);
  }

  return map;
}

/** Merge multiple transition maps (later maps override on conflict). */
function mergeTransitionMaps(...maps: TransitionMap[]): TransitionMap {
  const result: TransitionMap = new Map();

  for (const map of maps) {
    for (const [state, triggerMap] of map.entries()) {
      if (!result.has(state)) {
        result.set(state, new Map(triggerMap));
      } else {
        for (const [trigger, nextState] of triggerMap.entries()) {
          result.get(state)!.set(trigger, nextState);
        }
      }
    }
  }

  return result;
}

// ── Cart Abandonment Transitions ─────────────────────────────────────────────

const CART_ABANDONMENT_TRANSITIONS: FlowTransition[] = [
  // Initial trigger
  { from: 'initialized', to: 'waiting', trigger: 'CART_ABANDONED' },

  // Timer-based progression (3-touch flow: 30min, 4h, 24h)
  { from: 'waiting', to: 'first_touch_sent', trigger: 'TIMER_EXPIRED_30MIN' },
  { from: 'first_touch_sent', to: 'first_touch_delivered', trigger: 'SMS_DELIVERED' },
  { from: 'first_touch_delivered', to: 'second_touch_pending', trigger: 'TIMER_EXPIRED_4HOURS' },
  { from: 'first_touch_sent', to: 'second_touch_pending', trigger: 'TIMER_EXPIRED_4HOURS' },
  { from: 'second_touch_pending', to: 'second_touch_sent', trigger: 'SCHEDULE' },
  { from: 'second_touch_sent', to: 'second_touch_delivered', trigger: 'SMS_DELIVERED' },
  { from: 'second_touch_delivered', to: 'third_touch_pending', trigger: 'TIMER_EXPIRED_24HOURS' },
  { from: 'second_touch_sent', to: 'third_touch_pending', trigger: 'TIMER_EXPIRED_24HOURS' },
  { from: 'third_touch_pending', to: 'third_touch_sent', trigger: 'SCHEDULE' },

  // Recovery — any state
  { from: 'waiting', to: 'completed', trigger: 'ORDER_RECOVERED' },
  { from: 'first_touch_sent', to: 'completed', trigger: 'ORDER_RECOVERED' },
  { from: 'first_touch_delivered', to: 'completed', trigger: 'ORDER_RECOVERED' },
  { from: 'second_touch_pending', to: 'completed', trigger: 'ORDER_RECOVERED' },
  { from: 'second_touch_sent', to: 'completed', trigger: 'ORDER_RECOVERED' },
  { from: 'second_touch_delivered', to: 'completed', trigger: 'ORDER_RECOVERED' },
  { from: 'third_touch_pending', to: 'completed', trigger: 'ORDER_RECOVERED' },
  { from: 'third_touch_sent', to: 'completed', trigger: 'ORDER_RECOVERED' },

  // Failure paths
  { from: 'first_touch_sent', to: 'second_touch_pending', trigger: 'SMS_FAILED' },
  { from: 'second_touch_sent', to: 'third_touch_pending', trigger: 'SMS_FAILED' },
  { from: 'third_touch_sent', to: 'expired', trigger: 'MAX_RETRIES_EXCEEDED' },

  // Cancellation
  { from: 'waiting', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'first_touch_sent', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'first_touch_delivered', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'second_touch_pending', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'second_touch_sent', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'second_touch_delivered', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'third_touch_pending', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'third_touch_sent', to: 'cancelled', trigger: 'OPT_OUT' },

  // Timeout
  { from: 'third_touch_sent', to: 'expired', trigger: 'FLOW_TIMEOUT' },
];

// ── Post Purchase Transitions ────────────────────────────────────────────────

const POST_PURCHASE_TRANSITIONS: FlowTransition[] = [
  { from: 'initialized', to: 'waiting', trigger: 'ORDER_CONFIRMED' },
  { from: 'waiting', to: 'first_touch_sent', trigger: 'TIMER_EXPIRED_30MIN' },
  { from: 'first_touch_sent', to: 'first_touch_delivered', trigger: 'SMS_DELIVERED' },
  { from: 'first_touch_delivered', to: 'second_touch_pending', trigger: 'TIMER_EXPIRED_7DAYS' },
  { from: 'first_touch_sent', to: 'second_touch_pending', trigger: 'TIMER_EXPIRED_7DAYS' },
  { from: 'second_touch_pending', to: 'second_touch_sent', trigger: 'SCHEDULE' },
  { from: 'second_touch_sent', to: 'completed', trigger: 'SMS_DELIVERED' },
  { from: 'second_touch_sent', to: 'completed', trigger: 'LINK_CLICKED' },

  // Cancellation
  { from: 'waiting', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'first_touch_sent', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'first_touch_delivered', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'second_touch_pending', to: 'cancelled', trigger: 'OPT_OUT' },

  // Failure
  { from: 'first_touch_sent', to: 'expired', trigger: 'MAX_RETRIES_EXCEEDED' },
  { from: 'second_touch_sent', to: 'expired', trigger: 'MAX_RETRIES_EXCEEDED' },
  { from: 'second_touch_sent', to: 'completed', trigger: 'FLOW_TIMEOUT' },
];

// ── COD Confirmation Transitions ─────────────────────────────────────────────

const COD_CONFIRMATION_TRANSITIONS: FlowTransition[] = [
  { from: 'initialized', to: 'waiting', trigger: 'ORDER_CONFIRMED' },
  { from: 'waiting', to: 'first_touch_sent', trigger: 'TIMER_EXPIRED_30MIN' },
  { from: 'first_touch_sent', to: 'first_touch_delivered', trigger: 'SMS_DELIVERED' },
  { from: 'first_touch_delivered', to: 'completed', trigger: 'LINK_CLICKED' },
  { from: 'first_touch_delivered', to: 'completed', trigger: 'ORDER_CANCELLED' },
  { from: 'first_touch_sent', to: 'completed', trigger: 'ORDER_CANCELLED' },

  // Cancellation
  { from: 'waiting', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'first_touch_sent', to: 'cancelled', trigger: 'OPT_OUT' },

  // Failure
  { from: 'first_touch_sent', to: 'expired', trigger: 'MAX_RETRIES_EXCEEDED' },
  { from: 'first_touch_sent', to: 'expired', trigger: 'FLOW_TIMEOUT' },
];

// ── Win Back Transitions ─────────────────────────────────────────────────────

const WIN_BACK_TRANSITIONS: FlowTransition[] = [
  { from: 'initialized', to: 'waiting', trigger: 'SCHEDULE' },
  { from: 'initialized', to: 'waiting', trigger: 'MANUAL_TRIGGER' },
  { from: 'waiting', to: 'first_touch_sent', trigger: 'TIMER_EXPIRED_7DAYS' },
  { from: 'waiting', to: 'first_touch_sent', trigger: 'SCHEDULE' },
  { from: 'first_touch_sent', to: 'first_touch_delivered', trigger: 'SMS_DELIVERED' },
  { from: 'first_touch_delivered', to: 'second_touch_pending', trigger: 'TIMER_EXPIRED_7DAYS' },
  { from: 'first_touch_sent', to: 'second_touch_pending', trigger: 'TIMER_EXPIRED_7DAYS' },
  { from: 'second_touch_pending', to: 'second_touch_sent', trigger: 'SCHEDULE' },
  { from: 'second_touch_sent', to: 'completed', trigger: 'SMS_DELIVERED' },
  { from: 'second_touch_sent', to: 'completed', trigger: 'LINK_CLICKED' },
  { from: 'second_touch_sent', to: 'completed', trigger: 'ORDER_RECOVERED' },

  // Cancellation
  { from: 'waiting', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'first_touch_sent', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'first_touch_delivered', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'second_touch_pending', to: 'cancelled', trigger: 'OPT_OUT' },

  // Failure
  { from: 'first_touch_sent', to: 'second_touch_pending', trigger: 'SMS_FAILED' },
  { from: 'second_touch_sent', to: 'expired', trigger: 'MAX_RETRIES_EXCEEDED' },
  { from: 'second_touch_sent', to: 'expired', trigger: 'FLOW_TIMEOUT' },
];

// ── RFM Campaign Transitions ─────────────────────────────────────────────────

const RFM_CAMPAIGN_TRANSITIONS: FlowTransition[] = [
  { from: 'initialized', to: 'waiting', trigger: 'SCHEDULE' },
  { from: 'waiting', to: 'first_touch_sent', trigger: 'SCHEDULE' },
  { from: 'first_touch_sent', to: 'first_touch_delivered', trigger: 'SMS_DELIVERED' },
  { from: 'first_touch_delivered', to: 'completed', trigger: 'LINK_CLICKED' },
  { from: 'first_touch_sent', to: 'completed', trigger: 'FLOW_TIMEOUT' },

  // Cancellation
  { from: 'waiting', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'first_touch_sent', to: 'cancelled', trigger: 'OPT_OUT' },

  // Failure
  { from: 'first_touch_sent', to: 'expired', trigger: 'MAX_RETRIES_EXCEEDED' },
];

// ── Birthday Transitions ─────────────────────────────────────────────────────

const BIRTHDAY_TRANSITIONS: FlowTransition[] = [
  { from: 'initialized', to: 'waiting', trigger: 'SCHEDULE' },
  { from: 'waiting', to: 'first_touch_sent', trigger: 'SCHEDULE' },
  { from: 'first_touch_sent', to: 'first_touch_delivered', trigger: 'SMS_DELIVERED' },
  { from: 'first_touch_delivered', to: 'completed', trigger: 'LINK_CLICKED' },
  { from: 'first_touch_delivered', to: 'completed', trigger: 'FLOW_TIMEOUT' },

  // Cancellation
  { from: 'waiting', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'first_touch_sent', to: 'cancelled', trigger: 'OPT_OUT' },

  // Failure
  { from: 'first_touch_sent', to: 'expired', trigger: 'MAX_RETRIES_EXCEEDED' },
];

// ── Reengagement Transitions ─────────────────────────────────────────────────

const REENGAGEMENT_TRANSITIONS: FlowTransition[] = [
  { from: 'initialized', to: 'waiting', trigger: 'SCHEDULE' },
  { from: 'initialized', to: 'waiting', trigger: 'MANUAL_TRIGGER' },
  { from: 'waiting', to: 'first_touch_sent', trigger: 'TIMER_EXPIRED_14DAYS' },
  { from: 'waiting', to: 'first_touch_sent', trigger: 'SCHEDULE' },
  { from: 'first_touch_sent', to: 'first_touch_delivered', trigger: 'SMS_DELIVERED' },
  { from: 'first_touch_delivered', to: 'second_touch_pending', trigger: 'TIMER_EXPIRED_30DAYS' },
  { from: 'first_touch_sent', to: 'second_touch_pending', trigger: 'TIMER_EXPIRED_30DAYS' },
  { from: 'second_touch_pending', to: 'second_touch_sent', trigger: 'SCHEDULE' },
  { from: 'second_touch_sent', to: 'completed', trigger: 'SMS_DELIVERED' },
  { from: 'second_touch_sent', to: 'completed', trigger: 'LINK_CLICKED' },
  { from: 'second_touch_sent', to: 'completed', trigger: 'ORDER_RECOVERED' },

  // Cancellation
  { from: 'waiting', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'first_touch_sent', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'first_touch_delivered', to: 'cancelled', trigger: 'OPT_OUT' },
  { from: 'second_touch_pending', to: 'cancelled', trigger: 'OPT_OUT' },

  // Failure
  { from: 'first_touch_sent', to: 'second_touch_pending', trigger: 'SMS_FAILED' },
  { from: 'second_touch_sent', to: 'expired', trigger: 'MAX_RETRIES_EXCEEDED' },
  { from: 'second_touch_sent', to: 'expired', trigger: 'FLOW_TIMEOUT' },
];

// ── Build Transition Maps ────────────────────────────────────────────────────

const TRANSITION_MAPS: Record<FlowType, TransitionMap> = {
  CART_ABANDONMENT: buildTransitionMap(CART_ABANDONMENT_TRANSITIONS),
  POST_PURCHASE: buildTransitionMap(POST_PURCHASE_TRANSITIONS),
  COD_CONFIRMATION: buildTransitionMap(COD_CONFIRMATION_TRANSITIONS),
  WIN_BACK: buildTransitionMap(WIN_BACK_TRANSITIONS),
  RFM_CAMPAIGN: buildTransitionMap(RFM_CAMPAIGN_TRANSITIONS),
  BIRTHDAY: buildTransitionMap(BIRTHDAY_TRANSITIONS),
  REENGAGEMENT: buildTransitionMap(REENGAGEMENT_TRANSITIONS),
};

// ── Default Flow Configurations ──────────────────────────────────────────────

const DEFAULT_CONFIGS: Record<FlowType, FlowConfiguration> = {
  CART_ABANDONMENT: {
    flowType: 'CART_ABANDONMENT',
    maxDurationHours: 48,
    retryOnFailure: true,
    maxRetriesPerStep: 3,
    steps: [
      {
        stepNumber: 1,
        action: 'WAIT',
        delayMinutes: 30,
        template: '',
      },
      {
        stepNumber: 2,
        action: 'SEND_SMS',
        delayMinutes: 30,
        template:
          'Hey {{customer_name}}! You left items in your cart 🛒\n\n' +
          '🛍️ {{top_item}} ({{item_count}} items)\n' +
          '💰 Total: {{cart_total}}\n\n' +
          'Complete your order now:\n{{recovery_link}}',
        fallbackGateway: true,
      },
      {
        stepNumber: 3,
        action: 'WAIT',
        delayMinutes: 210, // 3.5 hours after first touch
        template: '',
      },
      {
        stepNumber: 4,
        action: 'SEND_SMS',
        delayMinutes: 240, // 4 hours total from first touch
        template:
          'Still thinking about it, {{customer_name}}? 😊\n\n' +
          'Your cart with {{item_count}} items ({{cart_total}}) is waiting!\n\n' +
          'Grab it before it sells out:\n{{recovery_link}}',
        fallbackGateway: true,
      },
      {
        stepNumber: 5,
        action: 'WAIT',
        delayMinutes: 1200, // 20 hours after second touch
        template: '',
      },
      {
        stepNumber: 6,
        action: 'SEND_SMS',
        delayMinutes: 1440, // 24 hours total from second touch
        template:
          'Last chance, {{customer_name}}! 🚨\n\n' +
          'Your {{cart_total}} cart is about to expire.\n' +
          'Don\'t miss out on your items!\n\n' +
          '{{recovery_link}}',
        fallbackGateway: true,
      },
      {
        stepNumber: 7,
        action: 'END',
        delayMinutes: 0,
        template: '',
      },
    ],
  },

  POST_PURCHASE: {
    flowType: 'POST_PURCHASE',
    maxDurationHours: 168, // 7 days
    retryOnFailure: true,
    maxRetriesPerStep: 2,
    steps: [
      {
        stepNumber: 1,
        action: 'WAIT',
        delayMinutes: 1, // near-immediate
        template: '',
      },
      {
        stepNumber: 2,
        action: 'SEND_SMS',
        delayMinutes: 1,
        template:
          'Thank you for your order, {{customer_name}}! 🎉\n\n' +
          'Order {{order_name}} — {{order_total}}\n\n' +
          'We\'re working on it! Track your order anytime.',
        fallbackGateway: false,
      },
      {
        stepNumber: 3,
        action: 'WAIT',
        delayMinutes: 10079, // ~7 days minus 1 minute
        template: '',
      },
      {
        stepNumber: 4,
        action: 'SEND_SMS',
        delayMinutes: 10080, // 7 days
        template:
          'Hey {{customer_name}}! Loved your recent purchase? 💕\n\n' +
          'Here\'s an exclusive offer just for you:\n' +
          'Get 15% off your next order with code THANKYOU15\n\n' +
          '{{shop_url}}',
        fallbackGateway: true,
      },
      {
        stepNumber: 5,
        action: 'END',
        delayMinutes: 0,
        template: '',
      },
    ],
  },

  COD_CONFIRMATION: {
    flowType: 'COD_CONFIRMATION',
    maxDurationHours: 48,
    retryOnFailure: true,
    maxRetriesPerStep: 3,
    steps: [
      {
        stepNumber: 1,
        action: 'WAIT',
        delayMinutes: 5,
        template: '',
      },
      {
        stepNumber: 2,
        action: 'SEND_SMS',
        delayMinutes: 5,
        template:
          'Hi {{customer_name}}! Your Cash on Delivery order is confirmed 📦\n\n' +
          'Order {{order_name}} — {{order_total}}\n\n' +
          'Please confirm by replying YES so we can prepare your shipment.\n' +
          'Reply NO to cancel.',
        fallbackGateway: true,
      },
      {
        stepNumber: 3,
        action: 'END',
        delayMinutes: 0,
        template: '',
      },
    ],
  },

  WIN_BACK: {
    flowType: 'WIN_BACK',
    maxDurationHours: 336, // 14 days
    retryOnFailure: true,
    maxRetriesPerStep: 3,
    steps: [
      {
        stepNumber: 1,
        action: 'WAIT',
        delayMinutes: 0,
        template: '',
      },
      {
        stepNumber: 2,
        action: 'SEND_SMS',
        delayMinutes: 0,
        template:
          'We miss you, {{customer_name}}! 😢\n\n' +
          'It\'s been a while since your last visit. ' +
          'Here\'s a special 20% discount to welcome you back:\n' +
          'Use code COMEBACK20 at checkout.\n\n' +
          '{{shop_url}}',
        fallbackGateway: true,
      },
      {
        stepNumber: 3,
        action: 'WAIT',
        delayMinutes: 10080, // 7 days
        template: '',
      },
      {
        stepNumber: 4,
        action: 'SEND_SMS',
        delayMinutes: 10080,
        template:
          'Still there, {{customer_name}}? 🤔\n\n' +
          'Your 20% discount (COMEBACK20) is still valid!\n' +
          'Don\'t miss it — expires in 48 hours.\n\n' +
          '{{shop_url}}',
        fallbackGateway: true,
      },
      {
        stepNumber: 5,
        action: 'END',
        delayMinutes: 0,
        template: '',
      },
    ],
  },

  RFM_CAMPAIGN: {
    flowType: 'RFM_CAMPAIGN',
    maxDurationHours: 72,
    retryOnFailure: true,
    maxRetriesPerStep: 2,
    steps: [
      {
        stepNumber: 1,
        action: 'WAIT',
        delayMinutes: 0,
        template: '',
      },
      {
        stepNumber: 2,
        action: 'SEND_SMS',
        delayMinutes: 0,
        template:
          'Hi {{customer_name}}! We\'ve curated something special for you ✨\n\n' +
          'Based on your preferences, we think you\'ll love our latest collection.\n\n' +
          '{{campaign_link}}',
        fallbackGateway: true,
      },
      {
        stepNumber: 3,
        action: 'END',
        delayMinutes: 0,
        template: '',
      },
    ],
  },

  BIRTHDAY: {
    flowType: 'BIRTHDAY',
    maxDurationHours: 24,
    retryOnFailure: true,
    maxRetriesPerStep: 2,
    steps: [
      {
        stepNumber: 1,
        action: 'WAIT',
        delayMinutes: 0,
        template: '',
      },
      {
        stepNumber: 2,
        action: 'SEND_SMS',
        delayMinutes: 0,
        template:
          '🎂 Happy Birthday, {{customer_name}}! 🎂\n\n' +
          'Wishing you an amazing day filled with joy!\n' +
          'Here\'s a birthday gift from us: 25% off your next order.\n' +
          'Use code BDAY{{subscriber_id_suffix}}\n\n' +
          'Enjoy! 🎁\n{{shop_url}}',
        fallbackGateway: true,
      },
      {
        stepNumber: 3,
        action: 'END',
        delayMinutes: 0,
        template: '',
      },
    ],
  },

  REENGAGEMENT: {
    flowType: 'REENGAGEMENT',
    maxDurationHours: 720, // 30 days
    retryOnFailure: true,
    maxRetriesPerStep: 3,
    steps: [
      {
        stepNumber: 1,
        action: 'WAIT',
        delayMinutes: 0,
        template: '',
      },
      {
        stepNumber: 2,
        action: 'SEND_SMS',
        delayMinutes: 0,
        template:
          'Hi {{customer_name}}, it\'s been a while! 👋\n\n' +
          'We\'ve added some exciting new products since your last visit.\n' +
          'Come check them out and get 10% off with code WELCOME10\n\n' +
          '{{shop_url}}',
        fallbackGateway: true,
      },
      {
        stepNumber: 3,
        action: 'WAIT',
        delayMinutes: 20160, // 14 days
        template: '',
      },
      {
        stepNumber: 4,
        action: 'SEND_SMS',
        delayMinutes: 20160,
        template:
          '{{customer_name}}, we\'d love to hear from you! 💬\n\n' +
          'What would make you come back? Reply with your thoughts.\n' +
          'Plus, here\'s a final 15% off: FINAL15\n\n' +
          '{{shop_url}}',
        fallbackGateway: true,
      },
      {
        stepNumber: 5,
        action: 'END',
        delayMinutes: 0,
        template: '',
      },
    ],
  },
};

// ── State Machine Class ──────────────────────────────────────────────────────

export class AutomationStateMachine {
  private transitionMaps: Record<FlowType, TransitionMap>;
  private customConfigs: Map<FlowType, FlowConfiguration> = new Map();

  constructor() {
    // Deep-copy the default transition maps so each instance is independent
    this.transitionMaps = {} as Record<FlowType, TransitionMap>;
    for (const [flowType, map] of Object.entries(TRANSITION_MAPS)) {
      this.transitionMaps[flowType as FlowType] = new Map(
        Array.from(map.entries()).map(([state, triggerMap]) => [
          state,
          new Map(triggerMap),
        ]),
      );
    }
  }

  // ── Core State Machine Operations ──────────────────────────────────────

  /**
   * Check if a transition is valid for a given state and trigger in a flow type.
   */
  canTransition(flowType: FlowType, state: FlowState, trigger: FlowTrigger): boolean {
    const map = this.transitionMaps[flowType];
    if (!map) return false;

    const stateMap = map.get(state);
    if (!stateMap) return false;

    return stateMap.has(trigger);
  }

  /**
   * Get the next state for a given state and trigger.
   * Returns null if the transition is not valid.
   */
  getNextState(flowType: FlowType, state: FlowState, trigger: FlowTrigger): FlowState | null {
    const map = this.transitionMaps[flowType];
    if (!map) return null;

    const stateMap = map.get(state);
    if (!stateMap) return null;

    return stateMap.get(trigger) ?? null;
  }

  /**
   * Get all valid triggers for a given state in a flow type.
   */
  getValidTriggers(flowType: FlowType, state: FlowState): FlowTrigger[] {
    const map = this.transitionMaps[flowType];
    if (!map) return [];

    const stateMap = map.get(state);
    if (!stateMap) return [];

    return Array.from(stateMap.keys());
  }

  /**
   * Get all possible transitions from a given state in a flow type.
   */
  getTransitionsFrom(flowType: FlowType, state: FlowState): FlowTransition[] {
    const map = this.transitionMaps[flowType];
    if (!map) return [];

    const stateMap = map.get(state);
    if (!stateMap) return [];

    const transitions: FlowTransition[] = [];
    for (const [trigger, to] of stateMap.entries()) {
      transitions.push({ from: state, to, trigger });
    }
    return transitions;
  }

  /**
   * Process a trigger and return the new state.
   * This is the main entry point for driving the state machine.
   * Throws if the transition is invalid.
   */
  processTrigger(context: FlowContext, trigger: FlowTrigger): FlowState {
    const { flowType, currentState } = context;

    // Guard: terminal states
    if (this.isFlowComplete(currentState)) {
      throw new Error(
        `Cannot process trigger "${trigger}" on flow "${flowType}": flow is already in terminal state "${currentState}"`,
      );
    }

    const nextState = this.getNextState(flowType, currentState, trigger);

    if (!nextState) {
      throw new Error(
        `Invalid transition on flow "${flowType}": no target state for state "${currentState}" + trigger "${trigger}"`,
      );
    }

    return nextState;
  }

  /**
   * Get the next step to execute based on the current context.
   * Returns null if the flow is complete or no step should be executed.
   */
  getNextStep(context: FlowContext): FlowStep | null {
    const config = this.getFlowConfiguration(context.flowType);
    const { currentStep, currentState } = context;

    // If the flow is in a terminal state, no more steps
    if (this.isFlowComplete(currentState)) {
      return null;
    }

    // Find the next SEND_SMS or CHECK_CONDITION step after currentStep
    for (let i = currentStep; i < config.steps.length; i++) {
      const step = config.steps[i];

      // Check if the step has a condition and if it passes
      if (step.condition && !step.condition(context)) {
        continue;
      }

      if (step.action === 'SEND_SMS' || step.action === 'CHECK_CONDITION' || step.action === 'GENERATE_LANDING_PAGE') {
        return step;
      }

      if (step.action === 'END') {
        return null;
      }
    }

    return null;
  }

  /**
   * Advance the step counter past a WAIT step to the next action step.
   * Returns the next step number that has an action, or the steps.length if no more.
   */
  advanceToNextActionStep(context: FlowContext): number {
    const config = this.getFlowConfiguration(context.flowType);
    let step = context.currentStep + 1;

    while (step < config.steps.length) {
      const s = config.steps[step];
      if (s.action !== 'WAIT') {
        return step;
      }
      step++;
    }

    return config.steps.length;
  }

  /**
   * Check if a state is a terminal (completed/expired/cancelled) state.
   */
  isFlowComplete(state: FlowState): boolean {
    return (TERMINAL_STATES as readonly FlowState[]).includes(state);
  }

  /**
   * Check if a flow has exceeded its maximum duration.
   */
  isFlowExpired(context: FlowContext): boolean {
    const config = this.getFlowConfiguration(context.flowType);
    const maxDurationMs = config.maxDurationHours * 60 * 60 * 1000;
    const elapsedMs = Date.now() - context.startedAt.getTime();
    return elapsedMs >= maxDurationMs;
  }

  /**
   * Get the remaining time (in ms) before the flow expires.
   * Returns 0 if already expired.
   */
  getRemainingTime(context: FlowContext): number {
    const config = this.getFlowConfiguration(context.flowType);
    const maxDurationMs = config.maxDurationHours * 60 * 60 * 1000;
    const elapsedMs = Date.now() - context.startedAt.getTime();
    return Math.max(0, maxDurationMs - elapsedMs);
  }

  // ── Configuration ─────────────────────────────────────────────────────

  /**
   * Get the flow configuration, preferring custom config if set.
   */
  getFlowConfiguration(flowType: FlowType): FlowConfiguration {
    // Check for custom override first
    const custom = this.customConfigs.get(flowType);
    if (custom) return custom;

    // Fall back to default
    const defaultConfig = DEFAULT_CONFIGS[flowType];
    if (!defaultConfig) {
      throw new Error(`No configuration found for flow type "${flowType}"`);
    }

    // Return a deep copy to prevent mutation
    return JSON.parse(JSON.stringify(defaultConfig)) as FlowConfiguration;
  }

  /**
   * Set a custom flow configuration (overrides the default).
   */
  setFlowConfiguration(flowType: FlowType, config: FlowConfiguration): void {
    this.customConfigs.set(flowType, JSON.parse(JSON.stringify(config)) as FlowConfiguration);
  }

  /**
   * Reset a flow type to use its default configuration.
   */
  resetFlowConfiguration(flowType: FlowType): void {
    this.customConfigs.delete(flowType);
  }

  /**
   * Add or override a transition for a specific flow type.
   */
  addTransition(flowType: FlowType, transition: FlowTransition): void {
    let map = this.transitionMaps[flowType];
    if (!map) {
      map = new Map();
      this.transitionMaps[flowType] = map;
    }

    let stateMap = map.get(transition.from);
    if (!stateMap) {
      stateMap = new Map();
      map.set(transition.from, stateMap);
    }

    stateMap.set(transition.trigger, transition.to);
  }

  /**
   * Remove all transitions for a specific flow type and state.
   */
  clearTransitions(flowType: FlowType, state: FlowState): void {
    const map = this.transitionMaps[flowType];
    if (map) {
      map.delete(state);
    }
  }

  /**
   * Get the complete transition map for a flow type (for debugging/visualization).
   */
  getTransitionMap(flowType: FlowType): FlowTransition[] {
    const map = this.transitionMaps[flowType];
    if (!map) return [];

    const transitions: FlowTransition[] = [];
    for (const [from, stateMap] of map.entries()) {
      for (const [trigger, to] of stateMap.entries()) {
        transitions.push({ from: from as FlowState, to, trigger });
      }
    }
    return transitions;
  }

  // ── Template Rendering ────────────────────────────────────────────────

  /**
   * Render a message template by replacing {{variable}} placeholders with values
   * extracted from the flow context.
   *
   * Supported variables:
   *   {{customer_name}}     — subscriber name
   *   {{customer_first}}    — first name only
   *   {{customer_last}}     — last name only
   *   {{customer_phone}}    — phone number (masked)
   *   {{subscriber_id}}     — subscriber ID
   *   {{subscriber_id_suffix}} — last 6 chars of subscriber ID (for codes)
   *   {{cart_total}}        — cart total with currency
   *   {{cart_total_raw}}    — cart total number
   *   {{item_count}}        — number of line items
   *   {{top_item}}          — first item title
   *   {{items_summary}}     — summary of items
   *   {{recovery_link}}     — cart recovery URL
   *   {{order_name}}        — order name (e.g. #1001)
   *   {{order_total}}       — order total with currency
   *   {{order_id}}          — order ID
   *   {{shop_name}}         — shop name
   *   {{shop_url}}          — shop URL
   *   {{campaign_link}}     — campaign landing page URL
   *   {{unsubscribe_link}}  — opt-out URL
   *   {{custom.*}}          — any key from context.customData
   */
  renderTemplate(template: string, context: FlowContext): string {
    const variables = this.extractTemplateVariables(context);
    let rendered = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      if (rendered.includes(placeholder)) {
        rendered = rendered.split(placeholder).join(value != null ? String(value) : '');
      }
    }

    // Clean up any unresolved {{variable}} placeholders
    rendered = rendered.replace(/\{\{[^}]+\}\}/g, '');

    return rendered.trim();
  }

  /**
   * Extract all available template variables from the flow context.
   */
  extractTemplateVariables(context: FlowContext): Record<string, string | number | undefined> {
    const { subscriberName, subscriberPhone, subscriberId, cartData, orderData, customData } = context;

    const parts = subscriberName?.split(' ') ?? [];
    const firstName = parts[0] ?? '';
    const lastName = parts.slice(1).join(' ') ?? '';

    // Mask phone: +201234567890 → +201****7890
    const maskedPhone = subscriberPhone
      ? subscriberPhone.slice(0, 4) + '****' + subscriberPhone.slice(-4)
      : '';

    const variables: Record<string, string | number | undefined> = {
      customer_name: subscriberName,
      customer_first: firstName,
      customer_last: lastName,
      customer_phone: maskedPhone,
      subscriber_id: subscriberId,
      subscriber_id_suffix: subscriberId ? subscriberId.slice(-6).toUpperCase() : '',
      unsubscribe_link: 'https://sms-shield.app/unsub', // In production: generate signed URL
      shop_name: context.shopId, // In production: load from shop config
      shop_url: '', // In production: load from shop config
    };

    // Cart variables
    if (cartData) {
      variables.cart_total = formatCurrency(cartData.total, cartData.currency);
      variables.cart_total_raw = cartData.total;
      variables.item_count = cartData.lineItemsCount;
      variables.top_item = cartData.lineItems[0]?.title ?? 'your items';
      variables.items_summary =
        cartData.lineItems.length <= 2
          ? cartData.lineItems.map((i) => i.title).join(' and ')
          : `${cartData.lineItems[0]?.title} and ${cartData.lineItemsCount - 1} more items`;
      variables.recovery_link = `https://${context.shopId}.myshopify.com/cart/${cartData.cartToken}`;
    }

    // Order variables
    if (orderData) {
      variables.order_name = orderData.orderName;
      variables.order_total = formatCurrency(orderData.total, orderData.currency);
      variables.order_id = orderData.orderId;
    }

    // Custom data variables (prefixed with custom.)
    if (customData) {
      for (const [key, value] of Object.entries(customData)) {
        if (typeof value === 'string' || typeof value === 'number') {
          variables[`custom.${key}`] = value;
          // Also expose without prefix for convenience
          if (!(key in variables)) {
            variables[key] = value;
          }
        }
      }
    }

    return variables;
  }

  // ── Diagram Generation (for debugging) ────────────────────────────────

  /**
   * Generate a Mermaid.js state diagram for a flow type.
   * Useful for documentation and debugging.
   */
  generateMermaidDiagram(flowType: FlowType): string {
    const transitions = this.getTransitionMap(flowType);
    const states = new Set<string>();
    const lines: string[] = [`stateDiagram-v2`];
    lines.push(`    [*] --> initialized: Start`);

    for (const t of transitions) {
      states.add(t.from);
      states.add(t.to);
      lines.push(`    ${t.from} --> ${t.to}: ${t.trigger}`);
    }

    for (const state of states) {
      if ((TERMINAL_STATES as readonly FlowState[]).includes(state as FlowState)) {
        lines.push(`    ${state} --> [*]`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate a DOT/Graphviz state diagram for a flow type.
   */
  generateDotDiagram(flowType: FlowType): string {
    const transitions = this.getTransitionMap(flowType);
    const lines: string[] = [
      `digraph "${flowType}" {`,
      `  rankdir=LR;`,
      `  node [shape=circle, fontsize=10];`,
      `  "" [shape=point];`,
      `  "" -> initialized;`,
    ];

    for (const t of transitions) {
      lines.push(`  "${t.from}" -> "${t.to}" [label="${t.trigger}"];`);
    }

    for (const terminal of TERMINAL_STATES) {
      lines.push(`  "${terminal}" [shape=doublecircle, style=filled, fillcolor=lightgrey];`);
    }

    lines.push(`}`);
    return lines.join('\n');
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'EGP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || 'EGP'} ${amount.toFixed(2)}`;
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let stateMachineInstance: AutomationStateMachine | null = null;

export function getStateMachine(): AutomationStateMachine {
  if (!stateMachineInstance) {
    stateMachineInstance = new AutomationStateMachine();
  }
  return stateMachineInstance;
}

// ── Convenience Exports ──────────────────────────────────────────────────────

export {
  DEFAULT_CONFIGS,
  TRANSITION_MAPS,
  buildTransitionMap,
  mergeTransitionMaps,
};
