'use client';

import { useState } from 'react';
import {
  Plus,
  Settings2,
  Play,
  Pause,
  Pencil,
  Copy,
  Trash2,
  Clock,
  ShoppingCart,
  Package,
  Users,
  CalendarClock,
  Send,
  Hourglass,
  GitBranch,
  FileText,
  GripVertical,
  X,
  Zap,
  Activity,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

type TriggerType = 'cart_abandoned' | 'order_created' | 'checkout_started' | 'rfm_segment_change' | 'schedule';
type ActionType = 'send_sms' | 'wait' | 'check_condition' | 'generate_landing_page';

interface AutomationAction {
  id: string;
  type: ActionType;
  config: {
    messageTemplate?: string;
    delayMinutes?: string;
    delayHours?: string;
    conditionField?: string;
    conditionOperator?: string;
    conditionValue?: string;
    segmentFilter?: string;
    landingPageType?: string;
  };
}

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  triggerType: TriggerType;
  triggerConfig: Record<string, string>;
  actions: AutomationAction[];
  isActive: boolean;
  executionCount: number;
  lastExecuted: string;
  createdAt: string;
}

const triggerConfig: Record<TriggerType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; colorBg: string }> = {
  cart_abandoned: { label: 'Cart Abandoned', icon: ShoppingCart, color: 'text-orange-600 dark:text-orange-400', colorBg: 'bg-orange-100 dark:bg-orange-900/30' },
  order_created: { label: 'Order Created', icon: Package, color: 'text-emerald-600 dark:text-emerald-400', colorBg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  checkout_started: { label: 'Checkout Started', icon: FileText, color: 'text-cyan-600 dark:text-cyan-400', colorBg: 'bg-cyan-100 dark:bg-cyan-900/30' },
  rfm_segment_change: { label: 'RFM Segment Change', icon: Users, color: 'text-violet-600 dark:text-violet-400', colorBg: 'bg-violet-100 dark:bg-violet-900/30' },
  schedule: { label: 'Schedule', icon: CalendarClock, color: 'text-amber-600 dark:text-amber-400', colorBg: 'bg-amber-100 dark:bg-amber-900/30' },
};

const actionConfig: Record<ActionType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; colorBg: string }> = {
  send_sms: { label: 'Send SMS', icon: Send, color: 'text-emerald-600 dark:text-emerald-400', colorBg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  wait: { label: 'Wait', icon: Hourglass, color: 'text-amber-600 dark:text-amber-400', colorBg: 'bg-amber-100 dark:bg-amber-900/30' },
  check_condition: { label: 'Check Condition', icon: GitBranch, color: 'text-cyan-600 dark:text-cyan-400', colorBg: 'bg-cyan-100 dark:bg-cyan-900/30' },
  generate_landing_page: { label: 'Generate Landing Page', icon: FileText, color: 'text-violet-600 dark:text-violet-400', colorBg: 'bg-violet-100 dark:bg-violet-900/30' },
};

const sampleRules: AutomationRule[] = [
  {
    id: '1',
    name: 'Cart Recovery - 3 Touch',
    description: 'Automated 3-step cart abandonment recovery with escalating urgency messages',
    triggerType: 'cart_abandoned',
    triggerConfig: { inactivityMinutes: '30' },
    actions: [
      {
        id: 'a1',
        type: 'send_sms',
        config: {
          messageTemplate: 'Hey {{customer_name}}, you left items in your cart! Complete your purchase now. {{recovery_link}}',
        },
      },
      {
        id: 'a2',
        type: 'wait',
        config: { delayHours: '4' },
      },
      {
        id: 'a3',
        type: 'send_sms',
        config: {
          messageTemplate: '{{customer_name}}, your cart is waiting! Items sell out fast. Complete your order: {{recovery_link}}',
        },
      },
      {
        id: 'a4',
        type: 'wait',
        config: { delayHours: '20' },
      },
      {
        id: 'a5',
        type: 'send_sms',
        config: {
          messageTemplate: 'Final chance {{customer_name}}! Your cart expires soon. Use code SAVE10 for 10% off: {{recovery_link}}',
        },
      },
    ],
    isActive: true,
    executionCount: 12450,
    lastExecuted: '2025-01-15T14:23:00Z',
    createdAt: '2024-11-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Post Purchase Thank You',
    description: 'Send a thank you SMS immediately after order creation',
    triggerType: 'order_created',
    triggerConfig: { condition: 'all_orders' },
    actions: [
      {
        id: 'a6',
        type: 'send_sms',
        config: {
          messageTemplate: 'Thank you {{customer_name}}! Your order has been received. We\'ll notify you when it ships. {{store_name}}',
        },
      },
    ],
    isActive: true,
    executionCount: 31200,
    lastExecuted: '2025-01-15T15:01:00Z',
    createdAt: '2024-10-15T00:00:00Z',
  },
  {
    id: '3',
    name: 'Win Back At-Risk',
    description: 'Automated win-back campaign triggered when customers move to At Risk segment',
    triggerType: 'rfm_segment_change',
    triggerConfig: { targetSegment: 'at_risk', waitDays: '7' },
    actions: [
      {
        id: 'a7',
        type: 'wait',
        config: { delayHours: '168' },
      },
      {
        id: 'a8',
        type: 'check_condition',
        config: { conditionField: 'last_order_days', conditionOperator: 'greater_than', conditionValue: '7' },
      },
      {
        id: 'a9',
        type: 'send_sms',
        config: {
          messageTemplate: 'We miss you {{customer_name}}! Here\'s a special {{discount_code}} for 20% off. Come back and shop today!',
          segmentFilter: 'at_risk',
        },
      },
    ],
    isActive: false,
    executionCount: 1890,
    lastExecuted: '2025-01-10T09:00:00Z',
    createdAt: '2024-12-01T00:00:00Z',
  },
  {
    id: '4',
    name: 'COD Confirmation',
    description: 'Generate a landing page for COD order confirmation immediately after order is placed',
    triggerType: 'order_created',
    triggerConfig: { paymentMethod: 'cod', condition: 'payment_method' },
    actions: [
      {
        id: 'a10',
        type: 'generate_landing_page',
        config: { landingPageType: 'cod_confirmation' },
      },
      {
        id: 'a11',
        type: 'send_sms',
        config: {
          messageTemplate: 'Hi {{customer_name}}, confirm your COD order here: [landing_page_url]. Call us if you have questions.',
        },
      },
    ],
    isActive: true,
    executionCount: 8450,
    lastExecuted: '2025-01-15T13:45:00Z',
    createdAt: '2024-11-15T00:00:00Z',
  },
];

function formatNumber(num: number): string {
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return num.toString();
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function getTriggerDescription(rule: AutomationRule): string {
  const cfg = triggerConfig[rule.triggerType];
  switch (rule.triggerType) {
    case 'cart_abandoned':
      return `After ${rule.triggerConfig.inactivityMinutes} minutes of inactivity`;
    case 'order_created':
      if (rule.triggerConfig.paymentMethod === 'cod') return 'When COD order is placed';
      return 'When any order is created';
    case 'checkout_started':
      return 'When checkout is started';
    case 'rfm_segment_change':
      return `When customer moves to ${rule.triggerConfig.targetSegment?.replace('_', ' ')} segment`;
    case 'schedule':
      return 'On schedule';
    default:
      return cfg.label;
  }
}

function ActionFlow({ actions }: { actions: AutomationAction[] }) {
  return (
    <div className="flex items-start gap-1.5 overflow-x-auto pb-1">
      {actions.map((action, index) => {
        const acfg = actionConfig[action.type];
        const ActionIcon = acfg.icon;

        return (
          <div key={action.id} className="flex items-center gap-1.5 shrink-0">
            {index > 0 && (
              <div className="flex items-center">
                <div className="w-4 h-px bg-border" />
                <ChevronRight className="size-3 text-muted-foreground -mx-1" />
              </div>
            )}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${acfg.colorBg}`}
              title={
                action.type === 'send_sms' && action.config.messageTemplate
                  ? action.config.messageTemplate
                  : action.type === 'wait' && action.config.delayHours
                  ? `Wait ${action.config.delayHours} hours`
                  : acfg.label
              }
            >
              <ActionIcon className={`size-3 ${acfg.color}`} />
              <span className={acfg.color}>
                {action.type === 'send_sms'
                  ? 'SMS'
                  : action.type === 'wait' && action.config.delayHours
                  ? `${action.config.delayHours}h`
                  : acfg.label.split(' ')[0]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { ChevronRight } from 'lucide-react';

interface RuleFormData {
  name: string;
  description: string;
  triggerType: TriggerType;
  triggerConfig: Record<string, string>;
  actions: AutomationAction[];
}

const emptyAction = (): AutomationAction => ({
  id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  type: 'send_sms',
  config: {},
});

function RuleDialog({
  open,
  onOpenChange,
  rule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: AutomationRule | null;
}) {
  const isEditing = !!rule;

  const [formData, setFormData] = useState<RuleFormData>({
    name: rule?.name ?? '',
    description: rule?.description ?? '',
    triggerType: rule?.triggerType ?? 'cart_abandoned',
    triggerConfig: rule?.triggerConfig ?? {},
    actions: rule?.actions ?? [emptyAction()],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (field: keyof RuleFormData, value: string | AutomationAction[] | Record<string, string>) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const updateTriggerConfig = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      triggerConfig: { ...prev.triggerConfig, [key]: value },
    }));
  };

  const addAction = () => {
    setFormData((prev) => ({
      ...prev,
      actions: [...prev.actions, emptyAction()],
    }));
  };

  const removeAction = (actionId: string) => {
    setFormData((prev) => ({
      ...prev,
      actions: prev.actions.filter((a) => a.id !== actionId),
    }));
  };

  const updateAction = (actionId: string, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      actions: prev.actions.map((a) =>
        a.id === actionId
          ? { ...a, config: { ...a.config, [field]: value } }
          : a
      ),
    }));
  };

  const updateActionType = (actionId: string, type: ActionType) => {
    setFormData((prev) => ({
      ...prev,
      actions: prev.actions.map((a) =>
        a.id === actionId
          ? { ...a, type, config: {} }
          : a
      ),
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Rule name is required';
    if (formData.actions.length === 0) newErrors.actions = 'At least one action is required';
    const firstSms = formData.actions.find((a) => a.type === 'send_sms');
    if (firstSms && !firstSms.config.messageTemplate?.trim()) {
      newErrors[`sms-${firstSms.id}`] = 'Message template is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-5 text-emerald-500" />
            {isEditing ? 'Edit Rule' : 'Create Automation Rule'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modify the automation rule settings'
              : 'Set up a new automation rule with triggers and actions'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rule-name">
                  Rule Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="rule-name"
                  placeholder="e.g., Cart Recovery - 3 Touch"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rule-description">Description</Label>
                <Textarea
                  id="rule-description"
                  placeholder="Describe what this rule does..."
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            {/* Trigger */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Zap className="size-4 text-amber-500" />
                Trigger
              </h4>

              <div className="space-y-2">
                <Label>Trigger Type</Label>
                <Select
                  value={formData.triggerType}
                  onValueChange={(v) => updateField('triggerType', v as TriggerType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(triggerConfig) as TriggerType[]).map((key) => {
                      const cfg = triggerConfig[key];
                      return (
                        <SelectItem key={key} value={key}>
                          {cfg.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic trigger conditions */}
              {formData.triggerType === 'cart_abandoned' && (
                <div className="space-y-2">
                  <Label htmlFor="inactivity-minutes">After X minutes of inactivity</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="inactivity-minutes"
                      type="number"
                      min={5}
                      max={1440}
                      value={formData.triggerConfig.inactivityMinutes ?? '30'}
                      onChange={(e) => updateTriggerConfig('inactivityMinutes', e.target.value)}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">minutes</span>
                  </div>
                </div>
              )}

              {formData.triggerType === 'order_created' && (
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <Select
                    value={formData.triggerConfig.condition ?? 'all_orders'}
                    onValueChange={(v) => updateTriggerConfig('condition', v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_orders">All Orders</SelectItem>
                      <SelectItem value="payment_method">Specific Payment Method</SelectItem>
                      <SelectItem value="order_total">Order Total Greater Than</SelectItem>
                    </SelectContent>
                  </Select>

                  {formData.triggerConfig.condition === 'payment_method' && (
                    <div className="space-y-2 pt-1">
                      <Label>Payment Method</Label>
                      <Select
                        value={formData.triggerConfig.paymentMethod ?? ''}
                        onValueChange={(v) => updateTriggerConfig('paymentMethod', v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cod">Cash on Delivery (COD)</SelectItem>
                          <SelectItem value="card">Credit/Debit Card</SelectItem>
                          <SelectItem value="wallet">Digital Wallet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.triggerConfig.condition === 'order_total' && (
                    <div className="space-y-2 pt-1">
                      <Label htmlFor="order-total">Minimum Order Total</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">$</span>
                        <Input
                          id="order-total"
                          type="number"
                          min={0}
                          value={formData.triggerConfig.orderTotal ?? '0'}
                          onChange={(e) => updateTriggerConfig('orderTotal', e.target.value)}
                          className="w-32"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {formData.triggerType === 'rfm_segment_change' && (
                <div className="space-y-2">
                  <Label>Target Segment</Label>
                  <Select
                    value={formData.triggerConfig.targetSegment ?? ''}
                    onValueChange={(v) => updateTriggerConfig('targetSegment', v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select segment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="at_risk">At Risk</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="hibernating">Hibernating</SelectItem>
                      <SelectItem value="champion">Champion</SelectItem>
                      <SelectItem value="loyal">Loyal</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="space-y-2 pt-1">
                    <Label htmlFor="wait-days">Wait before action</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="wait-days"
                        type="number"
                        min={0}
                        value={formData.triggerConfig.waitDays ?? '7'}
                        onChange={(e) => updateTriggerConfig('waitDays', e.target.value)}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">days</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="size-4 text-emerald-500" />
                  Actions
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {formData.actions.length}
                  </Badge>
                </h4>
                <Button variant="outline" size="sm" onClick={addAction}>
                  <Plus className="size-3.5" />
                  Add Action
                </Button>
              </div>

              {errors.actions && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="size-3" />
                  {errors.actions}
                </p>
              )}

              <div className="space-y-3">
                {formData.actions.map((action, index) => {
                  const acfg = actionConfig[action.type];

                  return (
                    <div
                      key={action.id}
                      className="relative border rounded-lg p-4 space-y-3"
                    >
                      {/* Action number + grip */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium">Action {index + 1}</span>
                          {index > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <div className="w-4 h-px bg-border" />
                              <ChevronRight className="size-3" />
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-red-500"
                          onClick={() => removeAction(action.id)}
                          disabled={formData.actions.length === 1}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label>Action Type</Label>
                        <Select
                          value={action.type}
                          onValueChange={(v) => updateActionType(action.id, v as ActionType)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(actionConfig) as ActionType[]).map((key) => (
                              <SelectItem key={key} value={key}>
                                {actionConfig[key].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Action-specific config */}
                      {action.type === 'send_sms' && (
                        <div className="space-y-2">
                          <Label>Message Template</Label>
                          <Textarea
                            placeholder="Hi {{customer_name}}, ..."
                            value={action.config.messageTemplate ?? ''}
                            onChange={(e) => updateAction(action.id, 'messageTemplate', e.target.value)}
                            rows={3}
                            className={errors[`sms-${action.id}`] ? 'border-red-500' : ''}
                          />
                          {errors[`sms-${action.id}`] && (
                            <p className="text-xs text-red-500">{errors[`sms-${action.id}`]}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {['{{customer_name}}', '{{discount_code}}', '{{recovery_link}}', '{{store_name}}'].map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => {
                                  const current = action.config.messageTemplate ?? '';
                                  updateAction(action.id, 'messageTemplate', current + v);
                                }}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {action.type === 'wait' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Hours</Label>
                            <Input
                              type="number"
                              min={0}
                              max={720}
                              value={action.config.delayHours ?? '1'}
                              onChange={(e) => updateAction(action.id, 'delayHours', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Minutes</Label>
                            <Input
                              type="number"
                              min={0}
                              max={59}
                              value={action.config.delayMinutes ?? '0'}
                              onChange={(e) => updateAction(action.id, 'delayMinutes', e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      {action.type === 'check_condition' && (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label>Field</Label>
                            <Select
                              value={action.config.conditionField ?? ''}
                              onValueChange={(v) => updateAction(action.id, 'conditionField', v)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Field" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="last_order_days">Last Order (days)</SelectItem>
                                <SelectItem value="total_orders">Total Orders</SelectItem>
                                <SelectItem value="order_value">Order Value</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Operator</Label>
                            <Select
                              value={action.config.conditionOperator ?? ''}
                              onValueChange={(v) => updateAction(action.id, 'conditionOperator', v)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Op" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="greater_than">Greater Than</SelectItem>
                                <SelectItem value="less_than">Less Than</SelectItem>
                                <SelectItem value="equals">Equals</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Value</Label>
                            <Input
                              placeholder="Value"
                              value={action.config.conditionValue ?? ''}
                              onChange={(e) => updateAction(action.id, 'conditionValue', e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      {action.type === 'generate_landing_page' && (
                        <div className="space-y-2">
                          <Label>Page Type</Label>
                          <Select
                            value={action.config.landingPageType ?? ''}
                            onValueChange={(v) => updateAction(action.id, 'landingPageType', v)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cod_confirmation">COD Confirmation</SelectItem>
                              <SelectItem value="review_request">Review Request</SelectItem>
                              <SelectItem value="promo_offer">Promo Offer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle2 className="size-4" />
            {isEditing ? 'Update Rule' : 'Create Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>(sampleRules);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const toggleRuleActive = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === ruleId ? { ...r, isActive: !r.isActive } : r
      )
    );
  };

  const duplicateRule = (rule: AutomationRule) => {
    const newRule: AutomationRule = {
      ...rule,
      id: `copy-${Date.now()}`,
      name: `${rule.name} (Copy)`,
      executionCount: 0,
      lastExecuted: '',
      createdAt: new Date().toISOString(),
    };
    setRules((prev) => [...prev, newRule]);
  };

  const deleteRule = (ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    setDeletingId(null);
  };

  const openEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingRule(null);
    }
  };

  const totalExecutions = rules.reduce((sum, r) => sum + r.executionCount, 0);
  const activeRules = rules.filter((r) => r.isActive).length;

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 max-w-[1200px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Automation Rules</h1>
          <p className="text-muted-foreground mt-1">
            Set up automated SMS flows based on triggers and conditions
          </p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="size-4" />
          Create Rule
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="py-4">
          <CardContent className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Settings2 className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rules.length}</p>
              <p className="text-xs text-muted-foreground">Total Rules</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Play className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeRules}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Pause className="size-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rules.length - activeRules}</p>
              <p className="text-xs text-muted-foreground">Paused</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Activity className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatNumber(totalExecutions)}</p>
              <p className="text-xs text-muted-foreground">Executions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="size-24 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-6">
              <Settings2 className="size-10 text-emerald-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No automation rules yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Create your first automation rule to start sending triggered SMS messages automatically.
            </p>
            <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="size-4" />
              Create your first rule
            </Button>
          </div>
        ) : (
          rules.map((rule) => {
            const tcfg = triggerConfig[rule.triggerType];
            const TriggerIcon = tcfg.icon;

            return (
              <Card
                key={rule.id}
                className={`transition-all duration-200 hover:shadow-md overflow-hidden ${
                  rule.isActive
                    ? 'hover:border-emerald-200 dark:hover:border-emerald-800'
                    : 'opacity-75'
                }`}
              >
                <div className={`h-1 ${rule.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`} />
                <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-5">
                  {/* Left: Rule Info */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`size-9 rounded-lg ${tcfg.colorBg} flex items-center justify-center shrink-0 mt-0.5`}>
                          <TriggerIcon className={`size-4 ${tcfg.color}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm truncate">{rule.name}</h3>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${tcfg.colorBg} ${tcfg.color}`}
                            >
                              {tcfg.label}
                            </Badge>
                            {rule.isActive ? (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] px-1.5 py-0">
                                <Play className="size-2.5" />
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[10px] px-1.5 py-0">
                                <Pause className="size-2.5" />
                                Paused
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
                        </div>
                      </div>
                    </div>

                    {/* Trigger condition */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Zap className="size-3 text-amber-500 shrink-0" />
                      <span>{getTriggerDescription(rule)}</span>
                    </div>

                    {/* Action Flow */}
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Action Flow</p>
                      <ActionFlow actions={rule.actions} />
                    </div>
                  </div>

                  {/* Right: Stats + Controls */}
                  <div className="flex lg:flex-col items-center lg:items-end gap-3 lg:gap-2 shrink-0 lg:min-w-[140px]">
                    <div className="flex items-center gap-4 text-center">
                      <div>
                        <p className="text-lg font-bold">{formatNumber(rule.executionCount)}</p>
                        <p className="text-[10px] text-muted-foreground">Executions</p>
                      </div>
                      <Separator orientation="vertical" className="h-8" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {rule.lastExecuted ? formatRelativeTime(rule.lastExecuted) : 'Never'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Last Run</p>
                      </div>
                    </div>

                    <Separator orientation="horizontal" className="lg:hidden w-full" />

                    <div className="flex items-center gap-1">
                      <div className="flex items-center gap-2 mr-2">
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={() => toggleRuleActive(rule.id)}
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(rule)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => duplicateRule(rule)}>
                        <Copy className="size-3.5" />
                      </Button>
                      <AlertDialog open={deletingId === rule.id} onOpenChange={(open) => setDeletingId(open ? rule.id : null)}>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete &quot;{rule.name}&quot;? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700 text-white"
                              onClick={() => deleteRule(rule.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Rule Dialog */}
      <RuleDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        rule={editingRule}
      />
    </div>
  );
}
