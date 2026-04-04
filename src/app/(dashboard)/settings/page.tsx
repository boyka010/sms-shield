'use client';

import { useState, useCallback } from 'react';
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
import { Progress } from '@/components/ui/progress';
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
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface GatewayConfig {
  id: string;
  gatewayType: string;
  username: string;
  senderName: string;
  priority: number;
  isActive: boolean;
  healthStatus: 'unknown' | 'healthy' | 'degraded' | 'down';
  lastHealthCheckAt: string | null;
  balance: number;
  latencyMs: number | null;
}

interface PopupSettings {
  popupEnabled: boolean;
  delaySeconds: number;
  headline: string;
  subtext: string;
  buttonText: string;
  buttonColor: string;
  buttonTextColor: string;
  discountType: 'percentage' | 'fixed_amount' | 'free_shipping';
  discountValue: number;
  autoApplyDiscount: boolean;
  consentText: string;
}

interface GeneralSettings {
  storeName: string;
  currency: string;
  timezone: string;
  emailNotificationsCampaign: boolean;
  lowBalanceAlert: boolean;
  lowBalanceThreshold: number;
  dailySummary: boolean;
  webhookRetentionDays: number;
  smsLogRetentionDays: number;
}

type HealthCheckStatus = 'idle' | 'checking' | 'success' | 'error';

// ============================================================================
// Demo Data
// ============================================================================

const DEMO_GATEWAYS: GatewayConfig[] = [
  {
    id: 'gw-1',
    gatewayType: 'SMS_MISR',
    username: 'smsmisr_user',
    senderName: 'MyStore',
    priority: 1,
    isActive: true,
    healthStatus: 'healthy',
    lastHealthCheckAt: '2025-01-15T10:30:00Z',
    balance: 4520,
    latencyMs: 320,
  },
  {
    id: 'gw-2',
    gatewayType: 'VICTORY_LINK',
    username: 'vlink_user',
    senderName: 'MyStore2',
    priority: 2,
    isActive: true,
    healthStatus: 'healthy',
    lastHealthCheckAt: '2025-01-15T10:25:00Z',
    balance: 12400,
    latencyMs: 185,
  },
  {
    id: 'gw-3',
    gatewayType: 'WE_API',
    username: 'weapi_user',
    senderName: 'MyStore3',
    priority: 3,
    isActive: false,
    healthStatus: 'down',
    lastHealthCheckAt: '2025-01-14T22:00:00Z',
    balance: 0,
    latencyMs: null,
  },
];

const GATEWAY_LABELS: Record<string, string> = {
  SMS_MISR: 'SMS Misr',
  VICTORY_LINK: 'Victory Link',
  WE_API: 'WE API',
};

const GATEWAY_COLORS: Record<string, string> = {
  SMS_MISR: 'bg-emerald-100 text-emerald-800',
  VICTORY_LINK: 'bg-amber-100 text-amber-800',
  WE_API: 'bg-rose-100 text-rose-800',
};

const COLOR_SWATCHES = [
  '#059669', '#047857', '#065f46',
  '#d97706', '#b45309', '#92400e',
  '#dc2626', '#b91c1c', '#991b1b',
  '#000000', '#1f2937', '#374151',
  '#6d28d9', '#7c3aed', '#8b5cf6',
  '#0284c7', '#0369a1', '#075985',
];

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
  onCheck: (id: string) => void;
}) {
  const [status, setStatus] = useState<HealthCheckStatus>('idle');

  const handleClick = async () => {
    setStatus('checking');
    // Simulate health check
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setStatus('success');
    onCheck(gatewayId);
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
      ) : (
        <Activity className="size-4" />
      )}
      {status === 'checking' ? 'Checking...' : 'Health Check'}
    </Button>
  );
}

function GatewayCard({
  gateway,
  onTest,
  onEdit,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  gateway: GatewayConfig;
  onTest: (id: string) => void;
  onEdit: (id: string) => void;
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
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              Priority #{gateway.priority}
            </Badge>
          </div>
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
            <p className="font-medium truncate">{gateway.username}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Balance</p>
            <p className="font-medium text-emerald-600">
              {gateway.balance.toLocaleString()} SMS
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Latency</p>
            <p className="font-medium">
              {gateway.latencyMs !== null ? `${gateway.latencyMs}ms` : 'N/A'}
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
              <Button
                variant="ghost"
                size="icon"
                onClick={onMoveUp}
                disabled={isFirst}
              >
                <ArrowUp className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move Up</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onMoveDown}
                disabled={isLast}
              >
                <ArrowDown className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move Down</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <HealthCheckButton gatewayId={gateway.id} onCheck={onTest} />
          <Button variant="outline" size="sm" onClick={() => onEdit(gateway.id)}>
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

function AddGatewayDialog({ onSave }: { onSave: (data: Omit<GatewayConfig, 'id'>) => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [senderName, setSenderName] = useState('');
  const [priority, setPriority] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');

  const resetForm = useCallback(() => {
    setType('');
    setUsername('');
    setPassword('');
    setApiKey('');
    setSenderName('');
    setPriority(1);
    setShowPassword(false);
    setShowApiKey(false);
    setTesting(false);
    setTestResult('idle');
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult('idle');
    // Simulate test
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setTesting(false);
    setTestResult(Math.random() > 0.3 ? 'success' : 'error');
  };

  const handleSave = () => {
    if (!type || !username || !password || !senderName) return;
    onSave({
      gatewayType: type,
      username,
      senderName,
      priority,
      isActive: true,
      healthStatus: 'unknown',
      lastHealthCheckAt: null,
      balance: 0,
      latencyMs: null,
    });
    resetForm();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="size-4" />
          Add Gateway
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add SMS Gateway</DialogTitle>
          <DialogDescription>
            Configure a new SMS gateway for sending messages.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="gw-type">Gateway Type</Label>
            <Select value={type} onValueChange={setType}>
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
            <Label htmlFor="gw-password">Password</Label>
            <div className="relative">
              <Input
                id="gw-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
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
              Sender Name{' '}
              <span className="text-muted-foreground">(max 11 chars)</span>
            </Label>
            <Input
              id="gw-sender"
              value={senderName}
              onChange={(e) =>
                setSenderName(e.target.value.slice(0, 11))
              }
              placeholder="MyBrand"
              maxLength={11}
            />
            <p className="text-xs text-muted-foreground">
              {senderName.length}/11 characters
            </p>
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
            disabled={!type || !username || !password || testing}
          >
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <TestTube className="size-4" />
            )}
            Test Connection
          </Button>
          <Button
            onClick={handleSave}
            disabled={!type || !username || !password || !senderName}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Save Gateway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PopupPreview({
  settings,
}: {
  settings: PopupSettings;
}) {
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
          {/* Close button */}
          <div className="mb-3 flex justify-end">
            <button className="flex size-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Headline */}
          <h3 className="mb-1 text-center text-lg font-bold text-gray-900">
            {settings.headline || '🎉 Get 10% OFF!'}
          </h3>

          {/* Subtext */}
          {settings.subtext && (
            <p className="mb-4 text-center text-xs text-gray-500">
              {settings.subtext}
            </p>
          )}

          {/* Discount badge */}
          <div className="mb-4 flex justify-center">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              {discountLabel} OFF
            </span>
          </div>

          {/* Phone input mock */}
          <div className="mb-3">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
              <span className="text-sm">🇪🇬</span>
              <span className="text-xs text-gray-400">+20</span>
              <span className="text-xs text-gray-300">010 1234 5678</span>
            </div>
          </div>

          {/* Consent checkbox mock */}
          <div className="mb-3 flex items-start gap-2">
            <div className="mt-0.5 size-3.5 rounded border border-gray-300" />
            <p className="text-[10px] leading-tight text-gray-400">
              {settings.consentText
                ? settings.consentText.length > 80
                  ? settings.consentText.slice(0, 80) + '...'
                  : settings.consentText
                : 'I agree to receive SMS messages'}
            </p>
          </div>

          {/* Submit button */}
          <button
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{
              backgroundColor: settings.buttonColor,
              color: settings.buttonTextColor,
            }}
          >
            {settings.buttonText || 'Get Your Discount!'}
          </button>

          {!settings.autoApplyDiscount && settings.discountValue > 0 && (
            <p className="mt-2 text-center text-[10px] text-gray-400">
              Code will be sent via SMS
            </p>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Main Settings Page
// ============================================================================

export default function SettingsPage() {
  // ---- SMS Gateways State ----
  const [gateways, setGateways] = useState<GatewayConfig[]>(DEMO_GATEWAYS);

  const moveGateway = useCallback(
    (index: number, direction: 'up' | 'down') => {
      setGateways((prev) => {
        const next = [...prev];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= next.length) return prev;
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
        return next.map((gw, i) => ({ ...gw, priority: i + 1 }));
      });
    },
    []
  );

  const removeGateway = useCallback((id: string) => {
    setGateways((prev) => {
      const filtered = prev.filter((gw) => gw.id !== id);
      return filtered.map((gw, i) => ({ ...gw, priority: i + 1 }));
    });
  }, []);

  // ---- Popup Builder State ----
  const [popupSettings, setPopupSettings] = useState<PopupSettings>({
    popupEnabled: true,
    delaySeconds: 5,
    headline: '🎉 Get 10% OFF your first order!',
    subtext: 'Subscribe to our SMS list for exclusive deals & updates',
    buttonText: 'Get Your Discount!',
    buttonColor: '#059669',
    buttonTextColor: '#FFFFFF',
    discountType: 'percentage',
    discountValue: 10,
    autoApplyDiscount: true,
    consentText:
      'I agree to receive SMS marketing messages and confirm my order via SMS.',
  });

  const updatePopup = useCallback(
    <K extends keyof PopupSettings>(key: K, value: PopupSettings[K]) => {
      setPopupSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // ---- General Settings State ----
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    storeName: 'My Egyptian Store',
    currency: 'EGP',
    timezone: 'Africa/Cairo',
    emailNotificationsCampaign: true,
    lowBalanceAlert: true,
    lowBalanceThreshold: 500,
    dailySummary: false,
    webhookRetentionDays: 30,
    smsLogRetentionDays: 90,
  });

  const updateGeneral = useCallback(
    <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
      setGeneralSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // ---- API Keys State ----
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const webhookSecret = 'whsec_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    });
  }, []);

  // ---- Export/Save handlers ----
  const [exporting, setExporting] = useState(false);

  const handleExportData = async () => {
    setExporting(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setExporting(false);
  };

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
            <AddGatewayDialog
              onSave={(data) => {
                setGateways((prev) => [
                  ...prev,
                  { ...data, id: `gw-${Date.now()}` },
                ]);
              }}
            />
          </div>

          {/* Failover Notice */}
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <Zap className="size-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-800">
                Automatic Failover Enabled
              </p>
              <p className="mt-0.5 text-sm text-emerald-700">
                If the primary gateway fails, SMS-Shield automatically routes
                through the next available gateway. Messages are never lost.
              </p>
            </div>
          </div>

          {/* Gateway Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {gateways.map((gw, index) => (
              <GatewayCard
                key={gw.id}
                gateway={gw}
                onTest={(id) => console.log('Test gateway:', id)}
                onEdit={(id) => console.log('Edit gateway:', id)}
                onRemove={removeGateway}
                onMoveUp={() => moveGateway(index, 'up')}
                onMoveDown={() => moveGateway(index, 'down')}
                isFirst={index === 0}
                isLast={index === gateways.length - 1}
              />
            ))}
          </div>

          {gateways.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Radio className="mb-4 size-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  No gateways configured
                </p>
                <p className="text-xs text-muted-foreground">
                  Add an SMS gateway to start sending messages.
                </p>
              </CardContent>
            </Card>
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

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Settings Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pop-up Configuration</CardTitle>
                <CardDescription>
                  Changes update the live preview in real-time.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Pop-up Enabled */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Zap className="size-4 text-emerald-600" />
                      Pop-up Enabled
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Show the pop-up to store visitors
                    </p>
                  </div>
                  <Switch
                    checked={popupSettings.popupEnabled}
                    onCheckedChange={(v) => updatePopup('popupEnabled', v)}
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
                      {popupSettings.delaySeconds}s
                    </span>
                  </div>
                  <Slider
                    value={[popupSettings.delaySeconds]}
                    onValueChange={([v]) => updatePopup('delaySeconds', v)}
                    min={1}
                    max={30}
                    step={1}
                    disabled={!popupSettings.popupEnabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Pop-up appears after the user stays on the page for this
                    duration.
                  </p>
                </div>

                <Separator />

                {/* Headline */}
                <div className="space-y-2">
                  <Label htmlFor="popup-headline">Headline</Label>
                  <Input
                    id="popup-headline"
                    value={popupSettings.headline}
                    onChange={(e) => updatePopup('headline', e.target.value)}
                    placeholder="🎉 Get 10% OFF your first order!"
                  />
                </div>

                {/* Subtext */}
                <div className="space-y-2">
                  <Label htmlFor="popup-subtext">Subtext</Label>
                  <Textarea
                    id="popup-subtext"
                    value={popupSettings.subtext}
                    onChange={(e) => updatePopup('subtext', e.target.value)}
                    placeholder="Subscribe to our SMS list for exclusive deals"
                    rows={2}
                  />
                </div>

                {/* Button Text */}
                <div className="space-y-2">
                  <Label htmlFor="popup-btn-text">Button Text</Label>
                  <Input
                    id="popup-btn-text"
                    value={popupSettings.buttonText}
                    onChange={(e) => updatePopup('buttonText', e.target.value)}
                    placeholder="Get Your Discount!"
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
                          borderColor:
                            popupSettings.buttonColor === color
                              ? '#059669'
                              : 'transparent',
                        }}
                        onClick={() => updatePopup('buttonColor', color)}
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
                      value={popupSettings.buttonColor}
                      onChange={(e) => updatePopup('buttonColor', e.target.value)}
                      className="h-8 w-16 cursor-pointer p-1"
                    />
                    <Label htmlFor="btn-text-color" className="ml-4 text-xs">
                      Text Color
                    </Label>
                    <Input
                      id="btn-text-color"
                      type="color"
                      value={popupSettings.buttonTextColor}
                      onChange={(e) =>
                        updatePopup('buttonTextColor', e.target.value)
                      }
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
                      value={popupSettings.discountType}
                      onValueChange={(v) =>
                        updatePopup(
                          'discountType',
                          v as PopupSettings['discountType']
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed_amount">
                          Fixed Amount
                        </SelectItem>
                        <SelectItem value="free_shipping">
                          Free Shipping
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {popupSettings.discountType !== 'free_shipping' && (
                    <div className="space-y-2">
                      <Label>Discount Value</Label>
                      <Input
                        type="number"
                        min={0}
                        value={popupSettings.discountValue}
                        onChange={(e) =>
                          updatePopup(
                            'discountValue',
                            parseInt(e.target.value) || 0
                          )
                        }
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
                    checked={popupSettings.autoApplyDiscount}
                    onCheckedChange={(v) =>
                      updatePopup('autoApplyDiscount', v)
                    }
                  />
                </div>

                <Separator />

                {/* Consent Text */}
                <div className="space-y-2">
                  <Label htmlFor="popup-consent">SMS Consent Text</Label>
                  <Textarea
                    id="popup-consent"
                    value={popupSettings.consentText}
                    onChange={(e) => updatePopup('consentText', e.target.value)}
                    placeholder="I agree to receive SMS marketing messages..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Required for PDPL &amp; GDPR compliance.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Save Pop-up Settings
                </Button>
              </CardFooter>
            </Card>

            {/* Live Preview Panel */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Live Preview</CardTitle>
                  <CardDescription>
                    This is how the pop-up will appear to your customers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-[400px] items-center justify-center">
                  {popupSettings.popupEnabled ? (
                    <PopupPreview settings={popupSettings} />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <EyeOff className="size-8" />
                      <p className="text-sm font-medium">Pop-up is disabled</p>
                      <p className="text-xs">
                        Enable the pop-up to see a live preview.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
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

          {/* Store Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Store className="size-4 text-emerald-600" />
                Store Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="store-name">Store Name</Label>
                  <Input
                    id="store-name"
                    value={generalSettings.storeName}
                    onChange={(e) => updateGeneral('storeName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-currency">Currency</Label>
                  <Select
                    value={generalSettings.currency}
                    onValueChange={(v) => updateGeneral('currency', v)}
                  >
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
                <Label htmlFor="store-tz">Timezone</Label>
                <Select
                  value={generalSettings.timezone}
                  onValueChange={(v) => updateGeneral('timezone', v)}
                >
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
            <CardFooter className="border-t pt-4">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Save Store Info
              </Button>
            </CardFooter>
          </Card>

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="size-4 text-emerald-600" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose which notifications you want to receive.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Campaign Completion</Label>
                  <p className="text-xs text-muted-foreground">
                    Get notified when a campaign finishes sending
                  </p>
                </div>
                <Switch
                  checked={generalSettings.emailNotificationsCampaign}
                  onCheckedChange={(v) =>
                    updateGeneral('emailNotificationsCampaign', v)
                  }
                />
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label>Low SMS Balance Alert</Label>
                  <p className="text-xs text-muted-foreground">
                    Get notified when SMS balance falls below threshold
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {generalSettings.lowBalanceAlert && (
                    <Input
                      type="number"
                      min={0}
                      value={generalSettings.lowBalanceThreshold}
                      onChange={(e) =>
                        updateGeneral(
                          'lowBalanceThreshold',
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="w-24 text-right"
                    />
                  )}
                  <Switch
                    checked={generalSettings.lowBalanceAlert}
                    onCheckedChange={(v) =>
                      updateGeneral('lowBalanceAlert', v)
                    }
                  />
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Daily Performance Summary</Label>
                  <p className="text-xs text-muted-foreground">
                    Receive a daily email with SMS metrics overview
                  </p>
                </div>
                <Switch
                  checked={generalSettings.dailySummary}
                  onCheckedChange={(v) => updateGeneral('dailySummary', v)}
                />
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Save Notifications
              </Button>
            </CardFooter>
          </Card>

          {/* Data Retention */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="size-4 text-emerald-600" />
                Data Retention
              </CardTitle>
              <CardDescription>
                Configure how long different types of data are stored.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="webhook-retention">
                  Webhook Event Retention
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="webhook-retention"
                    type="number"
                    min={1}
                    max={365}
                    value={generalSettings.webhookRetentionDays}
                    onChange={(e) =>
                      updateGeneral(
                        'webhookRetentionDays',
                        parseInt(e.target.value) || 30
                      )
                    }
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Events older than this will be automatically deleted. Default: 30
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="sms-retention">SMS Log Retention</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="sms-retention"
                    type="number"
                    min={1}
                    max={365}
                    value={generalSettings.smsLogRetentionDays}
                    onChange={(e) =>
                      updateGeneral(
                        'smsLogRetentionDays',
                        parseInt(e.target.value) || 90
                      )
                    }
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  SMS send logs older than this will be automatically deleted.
                  Default: 90
                </p>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Save Retention Settings
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 4: Compliance                                           */}
        {/* ============================================================ */}
        <TabsContent value="compliance" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Compliance</h2>
            <p className="text-sm text-muted-foreground">
              PDPL & GDPR compliance settings and data management.
            </p>
          </div>

          {/* PDPL & GDPR Compliance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-emerald-600" />
                PDPL &amp; GDPR Compliance
              </CardTitle>
              <CardDescription>
                SMS-Shield is built with privacy-by-design principles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Consent Collection */}
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium">Consent Collection</h4>
                <p className="text-sm text-muted-foreground">
                  Explicit opt-in consent is collected via the storefront pop-up
                  before any SMS is sent. Each subscriber&apos;s consent timestamp
                  and IP are recorded. Consent text is fully customizable in the
                  Pop-up Builder tab.
                </p>
              </div>

              <Separator />

              {/* Data Encryption */}
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium">Data Encryption</h4>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3">
                    <Lock className="size-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-800">
                      AES-256-GCM Active
                    </span>
                    <Check className="ml-auto size-4 text-emerald-600" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All sensitive data (phone numbers, gateway credentials) is
                    encrypted at rest using AES-256-GCM with per-record keys.
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
                    <span className="text-sm font-medium text-emerald-800">
                      Hashed (SHA-256) + Encrypted
                    </span>
                    <Check className="ml-auto size-4 text-emerald-600" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Phone numbers are hashed with SHA-256 for deduplication and
                    lookup, while the original number is AES-256-GCM encrypted.
                    Plain phone numbers are never stored.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Data Retention Policy */}
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium">Data Retention Policy</h4>
                <p className="text-sm text-muted-foreground">
                  Subscriber data is retained for the lifetime of the app
                  installation or until the merchant requests deletion. Webhook
                  events are retained for the configured period (default 30
                  days). SMS logs are retained for the configured period (default
                  90 days). Upon uninstall, all shop data is permanently deleted
                  within 30 days.
                </p>
              </div>

              <Separator />

              {/* Right to Deletion */}
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium">Right to Deletion</h4>
                <p className="text-sm text-muted-foreground">
                  Merchants can request full data deletion at any time via the
                  button below. Subscribers can request deletion by replying
                  &quot;STOP&quot; to any SMS. Deletion requests are processed within 48
                  hours.
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
              <CardDescription>
                Export or permanently delete your shop data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={handleExportData}
                  disabled={exporting}
                >
                  {exporting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
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
                      <AlertDialogTitle>
                        Are you absolutely sure?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This action <strong>cannot be undone</strong>. This will
                        permanently delete all your shop data including
                        subscribers, campaigns, SMS logs, gateway configurations,
                        and all associated records.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <strong>Warning:</strong> All subscriber phone numbers,
                      SMS history, campaign data, and gateway credentials will be
                      irreversibly destroyed.
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          console.log('Delete all data requested')
                        }
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
            <p className="text-sm text-muted-foreground">
              Manage API keys and webhook configuration.
            </p>
          </div>

          {/* Webhook Signing Secret */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Key className="size-4 text-emerald-600" />
                Webhook Signing Secret
              </CardTitle>
              <CardDescription>
                Used to verify that webhook payloads are genuinely from
                SMS-Shield. Keep this secret safe.
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
                  {showWebhookSecret ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(webhookSecret)}
                >
                  {copiedSecret ? (
                    <Check className="size-4 text-emerald-500" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copiedSecret ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    console.log('Rotate webhook secret requested')
                  }
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
                Register this URL in your Shopify admin to receive webhook
                events.
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
                    onClick={() =>
                      copyToClipboard(
                        'https://sms-shield.app/api/webhooks/shopify'
                      )
                    }
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
                <strong>Note:</strong> Webhooks are automatically registered
                during app installation. You only need to manually configure
                these if you reinstall or change settings.
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
              <CardDescription>
                Create and manage API keys for programmatic access.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Key className="mx-auto mb-3 size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  API Key Management Coming Soon
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Generate API keys to integrate SMS-Shield with your custom
                  applications and workflows.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
