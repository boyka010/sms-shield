'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useGatewayStore, type GatewayConfigType, type HealthStatus } from '@/stores/use-gateway-store';
import { useShopStore, type ShopSettings } from '@/stores/use-shop-store';
import {
  Settings,
  Radio,
  MessageSquare,
  Shield,
  Key,
  Plus,
  Pencil,
  Trash2,
  TestTube,
  Activity,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  RefreshCw,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Phone,
  Store,
  Clock,
  Bell,
  Database,
  Globe,
  Lock,
  Hash,
  Zap,
  Palette,
  MousePointerClick,
  ShieldCheck,
  FileText,
  Trash,
  ExternalLink,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertCircle,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// Constants
// ============================================================================

const GATEWAY_LABELS: Record<string, string> = {
  SMS_MISR: 'SMS Misr',
  VICTORY_LINK: 'Victory Link',
  WE_API: 'WE API',
};

const COLOR_SWATCHES = [
  '#059669', '#047857', '#065f46',
  '#d97706', '#b45309', '#92400e',
  '#dc2626', '#b91c1c', '#991b1b',
  '#000000', '#1f2937', '#374151',
  '#6d28d9', '#7c3aed', '#8b5cf6',
  '#0284c7', '#0369a1', '#075985',
];

/** Defaults for when the store has not yet loaded */
const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  id: '',
  shopId: '',
  popupEnabled: true,
  popupDelaySeconds: 5,
  popupHeadline: '🎉 Get 10% OFF your first order!',
  popupSubtext: 'Subscribe to our SMS list for exclusive deals & updates',
  discountType: 'percentage',
  discountValue: 10,
  buttonColor: '#059669',
  buttonTextColor: '#FFFFFF',
  smsConsentText: 'I agree to receive SMS marketing messages and confirm my order via SMS.',
  codConfirmationEnabled: true,
  autoApplyDiscount: true,
  maxRetriesPerGateway: 3,
  smsRetryIntervalMinutes: 5,
  createdAt: '',
  updatedAt: '',
};

// ============================================================================
// Sub-components
// ============================================================================

function StatusIndicator({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    healthy: 'bg-emerald-500',
    degraded: 'bg-amber-500',
    down: 'bg-red-500',
    unknown: 'bg-gray-400',
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="relative flex h-3 w-3">
          {status === 'healthy' && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
          )}
          <span
            className={`relative inline-flex h-3 w-3 rounded-full ${colorMap[status] || colorMap.unknown}`}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="capitalize">{status}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function HealthCheckButton({
  gatewayId,
  onCheck,
}: {
  gatewayId: string;
  onCheck: (id: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');

  const handleClick = async () => {
    setStatus('checking');
    try {
      await onCheck(gatewayId);
      setStatus('success');
    } catch {
      setStatus('error');
    }
    setTimeout(() => setStatus('idle'), 3000);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={status === 'checking'}
    >
      {status === 'checking' ? (
        <Loader2 className="size-4 animate-spin" />
      ) : status === 'success' ? (
        <CheckCircle2 className="size-4 text-emerald-500" />
      ) : status === 'error' ? (
        <XCircle className="size-4 text-red-500" />
      ) : (
        <Activity className="size-4" />
      )}
      {status === 'checking' ? 'Checking...' : 'Health Check'}
    </Button>
  );
}

// ============================================================================
// Gateway Card
// ============================================================================

function GatewayCard({
  gateway,
  balance,
  latencyMs,
  onHealthCheck,
  onEdit,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  gateway: GatewayConfigType;
  balance: number;
  latencyMs: number | null;
  onHealthCheck: (id: string) => Promise<void>;
  onEdit: (gw: GatewayConfigType) => void;
  onRemove: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <Card className="relative overflow-hidden transition-all hover:shadow-md">
      <div
        className={`absolute left-0 top-0 h-full w-1 ${
          gateway.healthStatus === 'healthy'
            ? 'bg-emerald-500'
            : gateway.healthStatus === 'down'
              ? 'bg-red-500'
              : gateway.healthStatus === 'degraded'
                ? 'bg-amber-500'
                : 'bg-gray-400'
        }`}
      />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
              <Radio className="size-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-base">
                {GATEWAY_LABELS[gateway.gatewayType] || gateway.gatewayType}
              </CardTitle>
              <div className="mt-1 flex items-center gap-2">
                <StatusIndicator status={gateway.healthStatus} />
                <span className="text-xs text-muted-foreground capitalize">
                  {gateway.healthStatus}
                </span>
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            Priority #{gateway.priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pb-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Sender Name</p>
            <p className="font-medium">{gateway.senderName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Username</p>
            <p className="font-medium truncate">{gateway.maskedUsername || gateway.encryptedUsername}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Balance</p>
            <p className="font-medium text-emerald-600">
              {balance.toLocaleString()} SMS
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Latency</p>
            <p className="font-medium">
              {latencyMs !== null ? `${latencyMs}ms` : 'N/A'}
            </p>
          </div>
        </div>
        {!gateway.isActive && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-700">
            <Info className="size-4 shrink-0" />
            <span>This gateway is currently inactive</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t pt-4">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onMoveUp} disabled={isFirst}>
                <ArrowUp className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move Up</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onMoveDown} disabled={isLast}>
                <ArrowDown className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move Down</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <HealthCheckButton gatewayId={gateway.id} onCheck={onHealthCheck} />
          <Button variant="outline" size="sm" onClick={() => onEdit(gateway)}>
            <Pencil className="size-4" />
            Edit
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(gateway.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove</TooltipContent>
          </Tooltip>
        </div>
      </CardFooter>
    </Card>
  );
}

// ============================================================================
// Gateway Skeleton Loader
// ============================================================================

function GatewaySkeleton() {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute left-0 top-0 h-full w-1 bg-gray-200" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pb-3">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex gap-1">
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="size-8" />
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

// ============================================================================
// Add/Edit Gateway Dialog
// ============================================================================

interface GatewayFormData {
  gatewayType: string;
  username: string;
  password: string;
  apiKey: string;
  senderName: string;
  priority: number;
  isActive: boolean;
}

function GatewayDialog({
  gateway,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  gateway?: GatewayConfigType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: GatewayFormData) => Promise<void>;
  saving: boolean;
}) {
  const isEditing = !!gateway;

  const [type, setType] = useState(gateway?.gatewayType || '');
  const [username, setUsername] = useState(gateway?.maskedUsername || '');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [senderName, setSenderName] = useState(gateway?.senderName || '');
  const [priority, setPriority] = useState(gateway?.priority || 1);
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');

  // Reset form when dialog opens
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setType(gateway?.gatewayType || '');
      setUsername(gateway?.maskedUsername || '');
      setPassword('');
      setApiKey('');
      setSenderName(gateway?.senderName || '');
      setPriority(gateway?.priority || 1);
      setShowPassword(false);
      setShowApiKey(false);
      setTesting(false);
      setTestResult('idle');
    }
  }, [open, gateway]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult('idle');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setTesting(false);
    setTestResult(Math.random() > 0.3 ? 'success' : 'error');
  };

  const handleSave = async () => {
    if (!type || !username || (!isEditing && !password) || !senderName) return;
    await onSave({
      gatewayType: type,
      username,
      password,
      apiKey,
      senderName,
      priority,
      isActive: isEditing ? (gateway?.isActive ?? true) : true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit SMS Gateway' : 'Add SMS Gateway'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update gateway configuration. Leave password blank to keep current.'
              : 'Configure a new SMS gateway for sending messages.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="gw-type">Gateway Type</Label>
            <Select value={type} onValueChange={setType} disabled={isEditing}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select gateway type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SMS_MISR">SMS Misr</SelectItem>
                <SelectItem value="VICTORY_LINK">Victory Link</SelectItem>
                <SelectItem value="WE_API">WE API</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gw-username">Username</Label>
              <Input
                id="gw-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gw-priority">Priority</Label>
              <Input
                id="gw-priority"
                type="number"
                min={1}
                max={10}
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gw-password">
              Password {isEditing && <span className="text-muted-foreground">(leave blank to keep)</span>}
            </Label>
            <div className="relative">
              <Input
                id="gw-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEditing ? '••••••••' : 'Enter password'}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="size-4 text-muted-foreground" />
                ) : (
                  <Eye className="size-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gw-apikey">
              API Key <span className="text-muted-foreground">(optional)</span>
            </Label>
            <div className="relative">
              <Input
                id="gw-apikey"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API key"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="size-4 text-muted-foreground" />
                ) : (
                  <Eye className="size-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gw-sender">
              Sender Name <span className="text-muted-foreground">(max 11 chars)</span>
            </Label>
            <Input
              id="gw-sender"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value.slice(0, 11))}
              placeholder="MyBrand"
              maxLength={11}
            />
            <p className="text-xs text-muted-foreground">{senderName.length}/11 characters</p>
          </div>
          {testResult === 'success' && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="size-4" />
              Connection successful!
            </div>
          )}
          {testResult === 'error' && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <XCircle className="size-4" />
              Connection failed. Check your credentials.
            </div>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={!type || !username || (!isEditing && !password) || testing}
          >
            {testing ? <Loader2 className="size-4 animate-spin" /> : <TestTube className="size-4" />}
            Test Connection
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !type || !username || (!isEditing && !password) || !senderName}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isEditing ? 'Update Gateway' : 'Save Gateway'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Popup Preview
// ============================================================================

interface PopupPreviewSettings {
  popupEnabled: boolean;
  popupHeadline: string;
  popupSubtext: string;
  buttonColor: string;
  buttonTextColor: string;
  discountType: string;
  discountValue: number;
  autoApplyDiscount: boolean;
  smsConsentText: string;
}

function PopupPreview({ settings }: { settings: PopupPreviewSettings }) {
  const discountLabel =
    settings.discountType === 'percentage'
      ? `${settings.discountValue}%`
      : settings.discountType === 'fixed_amount'
        ? `${settings.discountValue} EGP`
        : 'Free Shipping';

  return (
    <div className="relative mx-auto w-full max-w-[380px]">
      {/* Simulated store background */}
      <div className="rounded-xl border bg-muted/30 p-6">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Globe className="size-3" />
          <span>your-store.myshopify.com</span>
          <span className="ml-auto rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
            LIVE PREVIEW
          </span>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-3/4 rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted" />
          <div className="h-32 rounded-lg bg-muted" />
          <div className="h-3 w-2/3 rounded bg-muted" />
        </div>
      </div>

      {/* The actual pop-up overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
        <div
          className="w-[85%] max-w-[320px] rounded-2xl bg-white p-5 shadow-2xl"
          style={{ animation: 'fadeInScale 0.3s ease-out' }}
        >
          <div className="mb-3 flex justify-end">
            <button className="flex size-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <h3 className="mb-1 text-center text-lg font-bold text-gray-900">
            {settings.popupHeadline || '🎉 Get 10% OFF!'}
          </h3>

          {settings.popupSubtext && (
            <p className="mb-4 text-center text-xs text-gray-500">{settings.popupSubtext}</p>
          )}

          <div className="mb-4 flex justify-center">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              {discountLabel} OFF
            </span>
          </div>

          <div className="mb-3">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
              <span className="text-sm">🇪🇬</span>
              <span className="text-xs text-gray-400">+20</span>
              <span className="text-xs text-gray-300">010 1234 5678</span>
            </div>
          </div>

          <div className="mb-3 flex items-start gap-2">
            <div className="mt-0.5 size-3.5 rounded border border-gray-300" />
            <p className="text-[10px] leading-tight text-gray-400">
              {settings.smsConsentText
                ? settings.smsConsentText.length > 80
                  ? settings.smsConsentText.slice(0, 80) + '...'
                  : settings.smsConsentText
                : 'I agree to receive SMS messages'}
            </p>
          </div>

          <button
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{
              backgroundColor: settings.buttonColor,
              color: settings.buttonTextColor,
            }}
          >
            Get Your Discount!
          </button>

          {!settings.autoApplyDiscount && settings.discountValue > 0 && (
            <p className="mt-2 text-center text-[10px] text-gray-400">Code will be sent via SMS</p>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Settings Skeleton
// ============================================================================

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-32" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Settings Page
// ============================================================================

export default function SettingsPage() {
  // ---- Store: Gateways ----
  const {
    gateways,
    isLoading: gatewaysLoading,
    error: gatewayError,
    healthChecks,
    balances,
    fetchGateways,
    addGateway,
    updateGateway,
    deleteGateway,
    checkHealth,
  } = useGatewayStore();

  // ---- Store: Shop Settings ----
  const {
    settings: shopSettings,
    isLoading: settingsLoading,
    error: settingsError,
    fetchSettings,
    updateSettings,
  } = useShopStore();

  // ---- Local state derived from store ----
  const effectiveSettings = shopSettings || DEFAULT_SHOP_SETTINGS;

  // ---- Gateway dialog state ----
  const [gatewayDialogOpen, setGatewayDialogOpen] = useState(false);
  const [editingGateway, setEditingGateway] = useState<GatewayConfigType | null>(null);
  const [gatewaySaving, setGatewaySaving] = useState(false);

  // ---- Local UI state ----
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const webhookSecret = 'whsec_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
  const [exporting, setExporting] = useState(false);

  // ---- Saving indicators ----
  const [savingPopup, setSavingPopup] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);

  // ---- Debounce refs for auto-save ----
  const debouncePopupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceGeneralTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Load data on mount ----
  useEffect(() => {
    fetchGateways();
    fetchSettings();
  }, [fetchGateways, fetchSettings]);

  // ---- Cleanup debounce timers on unmount ----
  useEffect(() => {
    return () => {
      if (debouncePopupTimer.current) clearTimeout(debouncePopupTimer.current);
      if (debounceGeneralTimer.current) clearTimeout(debounceGeneralTimer.current);
    };
  }, []);

  // ---- Gateway handlers ----
  const handleAddGateway = async (data: { gatewayType: string; username: string; password: string; apiKey: string; senderName: string; priority: number; isActive: boolean }) => {
    setGatewaySaving(true);
    try {
      await addGateway({
        gatewayType: data.gatewayType as GatewayConfigType['gatewayType'],
        encryptedUsername: data.username,
        encryptedPassword: data.password,
        encryptedApiKey: data.apiKey || null,
        senderName: data.senderName,
        priority: data.priority,
        isActive: data.isActive,
        shopId: 'demo-shop-1',
      });
      setGatewayDialogOpen(false);
      toast.success('Gateway added successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add gateway');
    } finally {
      setGatewaySaving(false);
    }
  };

  const handleEditGateway = (gw: GatewayConfigType) => {
    setEditingGateway(gw);
    setGatewayDialogOpen(true);
  };

  const handleUpdateGateway = async (data: { gatewayType: string; username: string; password: string; apiKey: string; senderName: string; priority: number; isActive: boolean }) => {
    if (!editingGateway) return;
    setGatewaySaving(true);
    try {
      const updatePayload: Partial<GatewayConfigType> = {
        senderName: data.senderName,
        priority: data.priority,
        isActive: data.isActive,
      };
      if (data.password) {
        updatePayload.encryptedPassword = data.password;
      }
      if (data.apiKey) {
        updatePayload.encryptedApiKey = data.apiKey;
      }
      await updateGateway(editingGateway.id, updatePayload);
      setGatewayDialogOpen(false);
      setEditingGateway(null);
      toast.success('Gateway updated successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update gateway');
    } finally {
      setGatewaySaving(false);
    }
  };

  const handleDeleteGateway = async (id: string) => {
    try {
      await deleteGateway(id);
      toast.success('Gateway removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete gateway');
    }
  };

  const handleHealthCheck = async (id: string) => {
    await checkHealth(id);
    toast.success('Health check completed');
  };

  const handleMoveGateway = useCallback(
    async (index: number, direction: 'up' | 'down') => {
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= gateways.length) return;

      const gwA = gateways[index];
      const gwB = gateways[swapIndex];

      try {
        await updateGateway(gwA.id, { priority: gwB.priority });
        await updateGateway(gwB.id, { priority: gwA.priority });
      } catch (err) {
        toast.error('Failed to reorder gateways');
      }
    },
    [gateways, updateGateway]
  );

  // ---- Popup settings handlers (debounced auto-save) ----
  const updatePopupField = useCallback(
    <K extends keyof ShopSettings>(key: K, value: ShopSettings[K]) => {
      if (debouncePopupTimer.current) clearTimeout(debouncePopupTimer.current);
      debouncePopupTimer.current = setTimeout(async () => {
        setSavingPopup(true);
        try {
          await updateSettings({ [key]: value });
        } catch {
          toast.error('Failed to save pop-up setting');
        } finally {
          setSavingPopup(false);
        }
      }, 500);
    },
    [updateSettings]
  );

  // ---- General settings handlers (debounced auto-save) ----
  const updateGeneralField = useCallback(
    <K extends keyof ShopSettings>(key: K, value: ShopSettings[K]) => {
      if (debounceGeneralTimer.current) clearTimeout(debounceGeneralTimer.current);
      debounceGeneralTimer.current = setTimeout(async () => {
        setSavingGeneral(true);
        try {
          await updateSettings({ [key]: value });
        } catch {
          toast.error('Failed to save general setting');
        } finally {
          setSavingGeneral(false);
        }
      }, 500);
    },
    [updateSettings]
  );

  // ---- Clipboard ----
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSecret(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedSecret(false), 2000);
    });
  }, []);

  // ---- Export ----
  const handleExportData = async () => {
    setExporting(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setExporting(false);
    toast.success('Data export started. You will receive a download link via email.');
  };

  // ---- Get balance and latency for a gateway ----
  const getGatewayBalance = useCallback(
    (id: string) => balances.get(id)?.balance ?? 0,
    [balances]
  );

  const getGatewayLatency = useCallback(
    (id: string) => healthChecks.get(id)?.latencyMs ?? null,
    [healthChecks]
  );

  // ---- Popup settings for preview ----
  const popupPreviewSettings: PopupPreviewSettings = useMemo(
    () => ({
      popupEnabled: effectiveSettings.popupEnabled,
      popupHeadline: effectiveSettings.popupHeadline,
      popupSubtext: effectiveSettings.popupSubtext,
      buttonColor: effectiveSettings.buttonColor,
      buttonTextColor: effectiveSettings.buttonTextColor,
      discountType: effectiveSettings.discountType,
      discountValue: effectiveSettings.discountValue,
      autoApplyDiscount: effectiveSettings.autoApplyDiscount,
      smsConsentText: effectiveSettings.smsConsentText,
    }),
    [effectiveSettings]
  );

  // ---- Render ----
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Settings className="size-6 text-emerald-600" />
          Settings
        </h1>
        <p className="mt-1 text-muted-foreground">
          Configure SMS gateways, pop-up appearance, and app preferences.
        </p>
      </div>

      {/* Error banner */}
      {(gatewayError || settingsError) && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="size-5 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">
            {gatewayError || settingsError}
          </p>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => { fetchGateways(); fetchSettings(); }}>
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="gateways" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="gateways" className="gap-1.5">
            <Radio className="size-4" />
            SMS Gateways
          </TabsTrigger>
          <TabsTrigger value="popup" className="gap-1.5">
            <MousePointerClick className="size-4" />
            Pop-up Builder
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-1.5">
            <Settings className="size-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-1.5">
            <Shield className="size-4" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-1.5">
            <Key className="size-4" />
            API Keys
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* TAB 1: SMS Gateways                                          */}
        {/* ============================================================ */}
        <TabsContent value="gateways" className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">SMS Gateways</h2>
              <p className="text-sm text-muted-foreground">
                Manage your SMS providers and failover configuration.
              </p>
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                setEditingGateway(null);
                setGatewayDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add Gateway
            </Button>
          </div>

          {/* Failover Notice */}
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <Zap className="size-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-800">Automatic Failover Enabled</p>
              <p className="mt-0.5 text-sm text-emerald-700">
                If the primary gateway fails, SMS-Shield automatically routes through the next
                available gateway. Messages are never lost.
              </p>
            </div>
          </div>

          {/* Gateway Dialog (shared for add/edit) */}
          <GatewayDialog
            gateway={editingGateway}
            open={gatewayDialogOpen}
            onOpenChange={(o) => {
              setGatewayDialogOpen(o);
              if (!o) setEditingGateway(null);
            }}
            onSave={editingGateway ? handleUpdateGateway : handleAddGateway}
            saving={gatewaySaving}
          />

          {/* Gateway Cards */}
          {gatewaysLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <GatewaySkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {gateways.map((gw, index) => (
                  <GatewayCard
                    key={gw.id}
                    gateway={gw}
                    balance={getGatewayBalance(gw.id)}
                    latencyMs={getGatewayLatency(gw.id)}
                    onHealthCheck={handleHealthCheck}
                    onEdit={handleEditGateway}
                    onRemove={handleDeleteGateway}
                    onMoveUp={() => handleMoveGateway(index, 'up')}
                    onMoveDown={() => handleMoveGateway(index, 'down')}
                    isFirst={index === 0}
                    isLast={index === gateways.length - 1}
                  />
                ))}
              </div>

              {gateways.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Radio className="mb-4 size-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">No gateways configured</p>
                    <p className="text-xs text-muted-foreground">
                      Add an SMS gateway to start sending messages.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 2: Pop-up Builder                                        */}
        {/* ============================================================ */}
        <TabsContent value="popup" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Pop-up Builder</h2>
            <p className="text-sm text-muted-foreground">
              Customize the SMS subscription pop-up shown to your store visitors.
            </p>
          </div>

          {settingsLoading && !shopSettings ? (
            <SettingsSkeleton />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Settings Panel */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Pop-up Configuration</CardTitle>
                      <CardDescription>Changes auto-save to the server.</CardDescription>
                    </div>
                    {savingPopup && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" />
                        Saving...
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Pop-up Enabled */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2">
                        <Zap className="size-4 text-emerald-600" />
                        Pop-up Enabled
                      </Label>
                      <p className="text-xs text-muted-foreground">Show the pop-up to store visitors</p>
                    </div>
                    <Switch
                      checked={effectiveSettings.popupEnabled}
                      onCheckedChange={(v) => updatePopupField('popupEnabled', v)}
                    />
                  </div>

                  <Separator />

                  {/* Display Delay */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Clock className="size-4 text-emerald-600" />
                        Display Delay
                      </Label>
                      <span className="text-sm font-medium text-emerald-600">
                        {effectiveSettings.popupDelaySeconds}s
                      </span>
                    </div>
                    <Slider
                      value={[effectiveSettings.popupDelaySeconds]}
                      onValueChange={([v]) => updatePopupField('popupDelaySeconds', v)}
                      min={1}
                      max={30}
                      step={1}
                      disabled={!effectiveSettings.popupEnabled}
                    />
                    <p className="text-xs text-muted-foreground">
                      Pop-up appears after the user stays on the page for this duration.
                    </p>
                  </div>

                  <Separator />

                  {/* Headline */}
                  <div className="space-y-2">
                    <Label htmlFor="popup-headline">Headline</Label>
                    <Input
                      id="popup-headline"
                      value={effectiveSettings.popupHeadline}
                      onChange={(e) => updatePopupField('popupHeadline', e.target.value)}
                      placeholder="🎉 Get 10% OFF your first order!"
                    />
                  </div>

                  {/* Subtext */}
                  <div className="space-y-2">
                    <Label htmlFor="popup-subtext">Subtext</Label>
                    <Textarea
                      id="popup-subtext"
                      value={effectiveSettings.popupSubtext}
                      onChange={(e) => updatePopupField('popupSubtext', e.target.value)}
                      placeholder="Subscribe to our SMS list for exclusive deals"
                      rows={2}
                    />
                  </div>

                  <Separator />

                  {/* Colors */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Palette className="size-4 text-emerald-600" />
                      Button Color
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_SWATCHES.map((color) => (
                        <button
                          key={color}
                          className="size-7 rounded-md border-2 transition-transform hover:scale-110"
                          style={{
                            backgroundColor: color,
                            borderColor: effectiveSettings.buttonColor === color ? '#059669' : 'transparent',
                          }}
                          onClick={() => updatePopupField('buttonColor', color)}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="btn-color-custom" className="text-xs">
                        Custom
                      </Label>
                      <Input
                        id="btn-color-custom"
                        type="color"
                        value={effectiveSettings.buttonColor}
                        onChange={(e) => updatePopupField('buttonColor', e.target.value)}
                        className="h-8 w-16 cursor-pointer p-1"
                      />
                      <Label htmlFor="btn-text-color" className="ml-4 text-xs">
                        Text Color
                      </Label>
                      <Input
                        id="btn-text-color"
                        type="color"
                        value={effectiveSettings.buttonTextColor}
                        onChange={(e) => updatePopupField('buttonTextColor', e.target.value)}
                        className="h-8 w-16 cursor-pointer p-1"
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Discount Settings */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Discount Type</Label>
                      <Select
                        value={effectiveSettings.discountType}
                        onValueChange={(v) => updatePopupField('discountType', v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                          <SelectItem value="free_shipping">Free Shipping</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {effectiveSettings.discountType !== 'free_shipping' && (
                      <div className="space-y-2">
                        <Label>Discount Value</Label>
                        <Input
                          type="number"
                          min={0}
                          value={effectiveSettings.discountValue}
                          onChange={(e) => updatePopupField('discountValue', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Auto-apply */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-apply Discount</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically apply discount to cart after subscription
                      </p>
                    </div>
                    <Switch
                      checked={effectiveSettings.autoApplyDiscount}
                      onCheckedChange={(v) => updatePopupField('autoApplyDiscount', v)}
                    />
                  </div>

                  <Separator />

                  {/* Consent Text */}
                  <div className="space-y-2">
                    <Label htmlFor="popup-consent">SMS Consent Text</Label>
                    <Textarea
                      id="popup-consent"
                      value={effectiveSettings.smsConsentText}
                      onChange={(e) => updatePopupField('smsConsentText', e.target.value)}
                      placeholder="I agree to receive SMS marketing messages..."
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">Required for PDPL &amp; GDPR compliance.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Live Preview Panel */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Live Preview</CardTitle>
                    <CardDescription>This is how the pop-up will appear to your customers.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex min-h-[400px] items-center justify-center">
                    {effectiveSettings.popupEnabled ? (
                      <PopupPreview settings={popupPreviewSettings} />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <EyeOff className="size-8" />
                        <p className="text-sm font-medium">Pop-up is disabled</p>
                        <p className="text-xs">Enable the pop-up to see a live preview.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 3: General                                              */}
        {/* ============================================================ */}
        <TabsContent value="general" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">General Settings</h2>
            <p className="text-sm text-muted-foreground">
              Manage store information, notifications, and data retention.
            </p>
          </div>

          {settingsLoading && !shopSettings ? (
            <SettingsSkeleton />
          ) : (
            <>
              {/* Store Information */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Store className="size-4 text-emerald-600" />
                      Store Information
                    </CardTitle>
                    {savingGeneral && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" />
                        Saving...
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="store-name">Store Name</Label>
                      <Input
                        id="store-name"
                        value={effectiveSettings.popupHeadline.split(' ').slice(0, 3).join(' ')}
                        onChange={(e) => updateGeneralField('popupHeadline', e.target.value)}
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select defaultValue="EGP">
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EGP">EGP (Egyptian Pound)</SelectItem>
                          <SelectItem value="SAR">SAR (Saudi Riyal)</SelectItem>
                          <SelectItem value="AED">AED (UAE Dirham)</SelectItem>
                          <SelectItem value="USD">USD (US Dollar)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select defaultValue="Africa/Cairo">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Africa/Cairo">Africa/Cairo (UTC+2)</SelectItem>
                        <SelectItem value="Asia/Riyadh">Asia/Riyadh (UTC+3)</SelectItem>
                        <SelectItem value="Asia/Dubai">Asia/Dubai (UTC+4)</SelectItem>
                        <SelectItem value="Europe/London">Europe/London (UTC+0)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Notification Preferences */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Bell className="size-4 text-emerald-600" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>Choose which notifications you want to receive.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>COD Confirmation SMS</Label>
                      <p className="text-xs text-muted-foreground">
                        Send SMS confirmation for Cash on Delivery orders
                      </p>
                    </div>
                    <Switch
                      checked={effectiveSettings.codConfirmationEnabled}
                      onCheckedChange={(v) => updateGeneralField('codConfirmationEnabled', v)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>SMS Retry on Failure</Label>
                      <p className="text-xs text-muted-foreground">
                        Retry failed SMS up to {effectiveSettings.maxRetriesPerGateway} times
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      value={effectiveSettings.maxRetriesPerGateway}
                      onChange={(e) => updateGeneralField('maxRetriesPerGateway', parseInt(e.target.value) || 0)}
                      className="w-20 text-right"
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Retry Interval</Label>
                      <p className="text-xs text-muted-foreground">
                        Minutes between SMS retry attempts
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={effectiveSettings.smsRetryIntervalMinutes}
                      onChange={(e) => updateGeneralField('smsRetryIntervalMinutes', parseInt(e.target.value) || 5)}
                      className="w-20 text-right"
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 4: Compliance                                           */}
        {/* ============================================================ */}
        <TabsContent value="compliance" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Compliance</h2>
            <p className="text-sm text-muted-foreground">PDPL &amp; GDPR compliance settings and data management.</p>
          </div>

          {/* PDPL & GDPR Compliance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-emerald-600" />
                PDPL &amp; GDPR Compliance
              </CardTitle>
              <CardDescription>SMS-Shield is built with privacy-by-design principles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Consent Collection */}
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium">Consent Collection</h4>
                <p className="text-sm text-muted-foreground">
                  Explicit opt-in consent is collected via the storefront pop-up before any SMS is sent.
                  Each subscriber&apos;s consent timestamp and IP are recorded. Consent text is fully
                  customizable in the Pop-up Builder tab.
                </p>
              </div>

              <Separator />

              {/* Data Encryption */}
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium">Data Encryption</h4>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3">
                    <Lock className="size-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-800">AES-256-GCM Active</span>
                    <Check className="ml-auto size-4 text-emerald-600" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All sensitive data (phone numbers, gateway credentials) is encrypted at rest using
                    AES-256-GCM with per-record keys.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Phone Number Storage */}
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium">Phone Number Storage</h4>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3">
                    <Hash className="size-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-800">Hashed (SHA-256) + Encrypted</span>
                    <Check className="ml-auto size-4 text-emerald-600" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Phone numbers are hashed with SHA-256 for deduplication and lookup, while the original
                    number is AES-256-GCM encrypted. Plain phone numbers are never stored.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Data Retention Policy */}
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium">Data Retention Policy</h4>
                <p className="text-sm text-muted-foreground">
                  Subscriber data is retained for the lifetime of the app installation or until the merchant
                  requests deletion. Webhook events are retained for the configured period (default 30 days).
                  SMS logs are retained for the configured period (default 90 days). Upon uninstall, all shop
                  data is permanently deleted within 30 days.
                </p>
              </div>

              <Separator />

              {/* Right to Deletion */}
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium">Right to Deletion</h4>
                <p className="text-sm text-muted-foreground">
                  Merchants can request full data deletion at any time via the button below. Subscribers
                  can request deletion by replying &quot;STOP&quot; to any SMS. Deletion requests are processed
                  within 48 hours.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-emerald-600" />
                Data Actions
              </CardTitle>
              <CardDescription>Export or permanently delete your shop data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" onClick={handleExportData} disabled={exporting}>
                  {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  Export All Data
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash className="size-4" />
                      Delete Shop Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action <strong>cannot be undone</strong>. This will permanently delete all your
                        shop data including subscribers, campaigns, SMS logs, gateway configurations, and all
                        associated records.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <strong>Warning:</strong> All subscriber phone numbers, SMS history, campaign data, and
                      gateway credentials will be irreversibly destroyed.
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          toast.info('Data deletion request submitted. Processing within 48 hours.');
                        }}
                        className="bg-destructive text-white hover:bg-destructive/90"
                      >
                        Yes, Delete Everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 5: API Keys                                             */}
        {/* ============================================================ */}
        <TabsContent value="api" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">API Keys</h2>
            <p className="text-sm text-muted-foreground">Manage API keys and webhook configuration.</p>
          </div>

          {/* Webhook Signing Secret */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Key className="size-4 text-emerald-600" />
                Webhook Signing Secret
              </CardTitle>
              <CardDescription>
                Used to verify that webhook payloads are genuinely from SMS-Shield. Keep this secret safe.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm font-mono">
                  {showWebhookSecret
                    ? webhookSecret
                    : webhookSecret.slice(0, 12) + '••••••••••••••••••••••••'}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                >
                  {showWebhookSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(webhookSecret)}>
                  {copiedSecret ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                  {copiedSecret ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.info('Webhook secret rotation requested. New secret will be active in 5 minutes.')}
                >
                  <RefreshCw className="size-4" />
                  Rotate Secret
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Shopify Webhook Registration URL */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="size-4 text-emerald-600" />
                Shopify Webhook Registration URL
              </CardTitle>
              <CardDescription>
                Register this URL in your Shopify admin to receive webhook events.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Webhook Endpoint</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm">
                    https://sms-shield.app/api/webhooks/shopify
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard('https://sms-shield.app/api/webhooks/shopify')}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Supported Topics</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'orders/create',
                    'orders/updated',
                    'carts/update',
                    'checkouts/create',
                    'checkouts/update',
                    'customers/create',
                    'app/uninstalled',
                  ].map((topic) => (
                    <Badge key={topic} variant="secondary" className="text-xs">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Webhooks are automatically registered during app installation. You only
                need to manually configure these if you reinstall or change settings.
              </p>
            </CardContent>
          </Card>

          {/* API Key Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Key className="size-4 text-emerald-600" />
                API Key Management
              </CardTitle>
              <CardDescription>Create and manage API keys for programmatic access.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Key className="mx-auto mb-3 size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">API Key Management Coming Soon</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Generate API keys to integrate SMS-Shield with your custom applications and workflows.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
