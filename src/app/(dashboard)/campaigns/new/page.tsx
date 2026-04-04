'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Send,
  Save,
  Eye,
  Users,
  Sparkles,
  Info,
  Clock,
  Zap,
  CalendarClock,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Variable,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type CampaignType = 'broadcast' | 'abandoned_cart' | 'cod_confirmation' | 'rfm_segment' | 'custom';
type ScheduleType = 'immediate' | 'scheduled';
type FormStep = 'info' | 'audience' | 'message' | 'schedule' | 'review';

interface FormData {
  name: string;
  type: CampaignType;
  description: string;
  segment: string;
  senderName: string;
  messageTemplate: string;
  scheduleType: ScheduleType;
  scheduledDate: string;
  scheduledTime: string;
}

interface FormErrors {
  name?: string;
  senderName?: string;
  messageTemplate?: string;
  scheduledDate?: string;
  scheduledTime?: string;
}

const segmentOptions = [
  { value: 'all', label: 'All Subscribers', count: 42560 },
  { value: 'champions', label: 'Champions', count: 2150 },
  { value: 'loyal', label: 'Loyal Customers', count: 3420 },
  { value: 'potential_loyalists', label: 'Potential Loyalists', count: 5680 },
  { value: 'new_customers', label: 'New Customers', count: 8900 },
  { value: 'promising', label: 'Promising', count: 4200 },
  { value: 'need_attention', label: 'Need Attention', count: 3100 },
  { value: 'at_risk', label: 'At Risk', count: 2840 },
  { value: 'cant_lose', label: "Can't Lose Them", count: 890 },
  { value: 'hibernating', label: 'Hibernating', count: 5200 },
  { value: 'lost', label: 'Lost', count: 3780 },
  { value: 'price_sensitive', label: 'Price Sensitive', count: 2400 },
];

const variables = [
  { key: '{{customer_name}}', description: "Customer's first name" },
  { key: '{{discount_code}}', description: 'Generated discount code' },
  { key: '{{store_name}}', description: 'Your store name' },
  { key: '{{recovery_link}}', description: 'Cart recovery URL' },
];

const defaultTemplateMap: Record<CampaignType, string> = {
  broadcast: 'Hi {{customer_name}}! Check out our latest offers at {{store_name}}. Shop now!',
  abandoned_cart: 'Hey {{customer_name}}, you left items in your cart! Complete your purchase now. {{recovery_link}}',
  cod_confirmation: 'Hi {{customer_name}}, your order has been confirmed! Cash on delivery. Track your order.',
  rfm_segment: 'Hi {{customer_name}}, as a valued customer enjoy {{discount_code}} for your next purchase!',
  custom: '',
};

export default function CreateCampaignPage() {
  const [currentStep, setCurrentStep] = useState<FormStep>('info');
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: 'broadcast',
    description: '',
    segment: 'all',
    senderName: 'SMSHield',
    messageTemplate: defaultTemplateMap.broadcast,
    scheduleType: 'immediate',
    scheduledDate: '',
    scheduledTime: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const estimatedRecipients = useMemo(() => {
    const seg = segmentOptions.find((s) => s.value === formData.segment);
    return seg?.count ?? 0;
  }, [formData.segment]);

  const segmentLabel = useMemo(() => {
    const seg = segmentOptions.find((s) => s.value === formData.segment);
    return seg?.label ?? 'All Subscribers';
  }, [formData.segment]);

  const charCount = formData.messageTemplate.length;
  const smsCount = Math.max(1, Math.ceil(charCount / 160));
  const smsCost = (smsCount * estimatedRecipients * 0.02).toFixed(2);

  const previewMessage = useMemo(() => {
    return formData.messageTemplate
      .replace(/\{\{customer_name\}\}/g, 'Ahmed')
      .replace(/\{\{discount_code\}\}/g, 'SAVE20')
      .replace(/\{\{store_name\}\}/g, 'MyStore')
      .replace(/\{\{recovery_link\}\}/g, 'https://mystore.com/recover/abc123');
  }, [formData.messageTemplate]);

  const handleTypeChange = (value: string) => {
    const type = value as CampaignType;
    setFormData((prev) => ({
      ...prev,
      type,
      messageTemplate: defaultTemplateMap[type],
    }));
    setErrors((prev) => ({ ...prev, messageTemplate: undefined }));
  };

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const insertVariable = (variable: string) => {
    setFormData((prev) => ({
      ...prev,
      messageTemplate: prev.messageTemplate + variable,
    }));
  };

  const validateStep = (step: FormStep): boolean => {
    const newErrors: FormErrors = {};

    if (step === 'info') {
      if (!formData.name.trim()) newErrors.name = 'Campaign name is required';
      if (formData.name.trim().length > 100) newErrors.name = 'Campaign name must be under 100 characters';
    }

    if (step === 'message') {
      if (!formData.senderName.trim()) newErrors.senderName = 'Sender name is required';
      if (formData.senderName.length > 11) newErrors.senderName = 'Sender name must be 11 characters or fewer';
      if (!formData.messageTemplate.trim()) newErrors.messageTemplate = 'Message template is required';
      if (formData.messageTemplate.length > 1600) newErrors.messageTemplate = 'Message must be 1600 characters or fewer';
    }

    if (step === 'schedule' && formData.scheduleType === 'scheduled') {
      if (!formData.scheduledDate) newErrors.scheduledDate = 'Date is required';
      if (!formData.scheduledTime) newErrors.scheduledTime = 'Time is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goNext = () => {
    const stepOrder: FormStep[] = ['info', 'audience', 'message', 'schedule', 'review'];
    const currentIndex = stepOrder.indexOf(currentStep);

    if (validateStep(currentStep)) {
      if (currentIndex < stepOrder.length - 1) {
        setCurrentStep(stepOrder[currentIndex + 1]);
      }
    }
  };

  const goPrev = () => {
    const stepOrder: FormStep[] = ['info', 'audience', 'message', 'schedule', 'review'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  const handleSaveDraft = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      window.location.href = '/campaigns';
    }, 800);
  };

  const handleSend = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      window.location.href = '/campaigns';
    }, 800);
  };

  const steps: { key: FormStep; label: string; icon: React.ReactNode }[] = [
    { key: 'info', label: 'Basic Info', icon: <Info className="size-4" /> },
    { key: 'audience', label: 'Audience', icon: <Users className="size-4" /> },
    { key: 'message', label: 'Message', icon: <Smartphone className="size-4" /> },
    { key: 'schedule', label: 'Schedule', icon: <Clock className="size-4" /> },
    { key: 'review', label: 'Review', icon: <CheckCircle2 className="size-4" /> },
  ];

  const stepOrder: FormStep[] = ['info', 'audience', 'message', 'schedule', 'review'];

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 max-w-[1000px] mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon" className="size-9">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Create Campaign</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Set up a new SMS campaign in 5 easy steps
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {steps.map((step, index) => {
          const currentIndex = stepOrder.indexOf(currentStep);
          const stepIndex = stepOrder.indexOf(step.key);
          const isActive = step.key === currentStep;
          const isCompleted = stepIndex < currentIndex;
          const isPast = stepIndex <= currentIndex;

          return (
            <div key={step.key} className="flex items-center gap-1">
              {index > 0 && (
                <div className={`w-6 h-px ${isPast ? 'bg-emerald-400' : 'bg-border'}`} />
              )}
              <button
                onClick={() => {
                  if (isCompleted || stepIndex === currentIndex) {
                    setCurrentStep(step.key);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                  ${isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : ''}
                  ${isCompleted ? 'text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20' : ''}
                  ${!isActive && !isCompleted ? 'text-muted-foreground' : ''}
                `}
              >
                <span className={`size-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${isActive ? 'bg-emerald-600 text-white' : ''}
                  ${isCompleted && !isActive ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300' : ''}
                  ${!isActive && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
                `}>
                  {isCompleted && !isActive ? <CheckCircle2 className="size-3.5" /> : stepIndex + 1}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Form Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Basic Info */}
          {currentStep === 'info' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="size-5 text-emerald-500" />
                  Basic Information
                </CardTitle>
                <CardDescription>
                  Give your campaign a name and choose the type
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Campaign Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g., Weekend Flash Sale"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className={errors.name ? 'border-red-500' : ''}
                    maxLength={100}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {errors.name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formData.name.length}/100 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Campaign Type</Label>
                  <Select value={formData.type} onValueChange={handleTypeChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select campaign type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Standard Campaigns</SelectLabel>
                        <SelectItem value="broadcast">Broadcast - Send to all subscribers</SelectItem>
                        <SelectItem value="abandoned_cart">Abandoned Cart - Recover lost sales</SelectItem>
                        <SelectItem value="cod_confirmation">COD Confirmation - Order verification</SelectItem>
                        <SelectItem value="rfm_segment">RFM Segment - Target by customer value</SelectItem>
                        <SelectItem value="custom">Custom - Build your own flow</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Briefly describe this campaign's purpose..."
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Audience */}
          {currentStep === 'audience' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5 text-emerald-500" />
                  Target Audience
                </CardTitle>
                <CardDescription>
                  Choose which subscriber segment to target
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="segment">Target Segment</Label>
                  <Select value={formData.segment} onValueChange={(v) => updateField('segment', v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a segment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>All Customers</SelectLabel>
                        <SelectItem value="all">All Subscribers</SelectItem>
                        <SelectLabel>RFM Segments</SelectLabel>
                        <SelectItem value="champions">Champions</SelectItem>
                        <SelectItem value="loyal">Loyal Customers</SelectItem>
                        <SelectItem value="potential_loyalists">Potential Loyalists</SelectItem>
                        <SelectItem value="new_customers">New Customers</SelectItem>
                        <SelectItem value="promising">Promising</SelectItem>
                        <SelectItem value="need_attention">Need Attention</SelectItem>
                        <SelectItem value="at_risk">At Risk</SelectItem>
                        <SelectItem value="cant_lose">Can&apos;t Lose Them</SelectItem>
                        <SelectItem value="hibernating">Hibernating</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                        <SelectLabel>Behavioral</SelectLabel>
                        <SelectItem value="price_sensitive">Price Sensitive</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Estimated Recipients</span>
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <Users className="size-3" />
                      {estimatedRecipients.toLocaleString()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Segment</span>
                    <span className="text-sm text-muted-foreground">{segmentLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Estimated Cost</span>
                    <span className="text-sm text-muted-foreground">${smsCost}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Message Content */}
          {currentStep === 'message' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Smartphone className="size-5 text-emerald-500" />
                      Message Content
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Compose your SMS message template
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    <Eye className="size-3.5" />
                    {showPreview ? 'Edit' : 'Preview'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {!showPreview ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="senderName">
                        Sender Name <span className="text-red-500">*</span>
                        <span className="text-muted-foreground font-normal ml-1">(max 11 chars)</span>
                      </Label>
                      <Input
                        id="senderName"
                        placeholder="e.g., MyStore"
                        value={formData.senderName}
                        onChange={(e) => updateField('senderName', e.target.value.slice(0, 11))}
                        className={`w-full max-w-xs ${errors.senderName ? 'border-red-500' : ''}`}
                        maxLength={11}
                      />
                      {errors.senderName && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="size-3" />
                          {errors.senderName}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formData.senderName.length}/11 characters
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="messageTemplate">
                        Message Template <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="messageTemplate"
                        placeholder="Type your message here..."
                        value={formData.messageTemplate}
                        onChange={(e) => updateField('messageTemplate', e.target.value.slice(0, 1600))}
                        rows={6}
                        className={errors.messageTemplate ? 'border-red-500' : ''}
                      />
                      {errors.messageTemplate && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="size-3" />
                          {errors.messageTemplate}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{charCount}/1,600 characters</span>
                        <span>
                          {smsCount} SMS{smsCount > 1 ? 's' : ''} &middot; ${smsCost} est. cost
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Variable className="size-3.5" />
                        Available Variables
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {variables.map((v) => (
                          <button
                            key={v.key}
                            type="button"
                            onClick={() => insertVariable(v.key)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors border border-emerald-200 dark:border-emerald-800"
                            title={v.description}
                          >
                            {v.key}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-1">
                        {variables.map((v) => (
                          <p key={v.key} className="text-[10px] text-muted-foreground">
                            <code className="font-mono">{v.key}</code> — {v.description}
                          </p>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  /* SMS Preview */
                  <div className="space-y-4">
                    <div className="mx-auto max-w-sm">
                      {/* Phone mockup */}
                      <div className="rounded-[2rem] border-4 border-gray-800 dark:border-gray-200 bg-gray-800 dark:bg-gray-200 p-2 shadow-2xl">
                        <div className="rounded-[1.5rem] bg-white dark:bg-gray-900 overflow-hidden">
                          {/* Status bar */}
                          <div className="bg-emerald-600 px-6 py-2 flex items-center justify-between">
                            <span className="text-white text-[10px] font-medium">9:41</span>
                            <div className="flex items-center gap-1">
                              <div className="size-1.5 rounded-full bg-white/80" />
                              <div className="size-1.5 rounded-full bg-white/80" />
                              <div className="size-1.5 rounded-full bg-white/80" />
                              <div className="size-1.5 rounded-full bg-white/80" />
                            </div>
                          </div>

                          {/* SMS header */}
                          <div className="bg-emerald-600 px-4 py-3 border-t border-emerald-500">
                            <div className="flex items-center gap-3">
                              <div className="size-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                                {formData.senderName.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-white font-semibold text-sm">{formData.senderName}</p>
                                <p className="text-emerald-200 text-[10px]">SMS</p>
                              </div>
                            </div>
                          </div>

                          {/* Message bubble */}
                          <div className="p-4 space-y-2 min-h-[200px]">
                            <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl rounded-tl-md p-3 max-w-[85%]">
                              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                                {previewMessage || 'Your message preview will appear here...'}
                              </p>
                              <p className="text-[9px] text-muted-foreground mt-2 text-right">
                                9:41 AM
                              </p>
                            </div>
                          </div>

                          {/* Input bar */}
                          <div className="border-t px-4 py-3 flex items-center gap-2">
                            <div className="flex-1 h-8 rounded-full bg-gray-100 dark:bg-gray-800" />
                            <div className="size-8 rounded-full bg-emerald-600 flex items-center justify-center">
                              <Send className="size-3.5 text-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 4: Schedule */}
          {currentStep === 'schedule' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="size-5 text-emerald-500" />
                  Schedule
                </CardTitle>
                <CardDescription>
                  Choose when to send your campaign
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <RadioGroup
                  value={formData.scheduleType}
                  onValueChange={(v) => updateField('scheduleType', v as ScheduleType)}
                  className="space-y-3"
                >
                  <label
                    htmlFor="immediate"
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors
                      ${formData.scheduleType === 'immediate'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                        : 'border-transparent bg-muted/50 hover:bg-muted'
                      }`}
                  >
                    <RadioGroupItem value="immediate" id="immediate" className="mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Zap className="size-4 text-amber-500" />
                        <span className="font-medium text-sm">Send Immediately</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Campaign will start sending as soon as you click &quot;Send Now&quot;
                      </p>
                    </div>
                  </label>

                  <label
                    htmlFor="scheduled"
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors
                      ${formData.scheduleType === 'scheduled'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                        : 'border-transparent bg-muted/50 hover:bg-muted'
                      }`}
                  >
                    <RadioGroupItem value="scheduled" id="scheduled" className="mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="size-4 text-emerald-500" />
                        <span className="font-medium text-sm">Schedule for Later</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Pick a date and time to automatically start the campaign
                      </p>
                    </div>
                  </label>
                </RadioGroup>

                {formData.scheduleType === 'scheduled' && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="date">
                        Date <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.scheduledDate}
                        onChange={(e) => updateField('scheduledDate', e.target.value)}
                        className={errors.scheduledDate ? 'border-red-500' : ''}
                        min={new Date().toISOString().split('T')[0]}
                      />
                      {errors.scheduledDate && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="size-3" />
                          {errors.scheduledDate}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time">
                        Time <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="time"
                        type="time"
                        value={formData.scheduledTime}
                        onChange={(e) => updateField('scheduledTime', e.target.value)}
                        className={errors.scheduledTime ? 'border-red-500' : ''}
                      />
                      {errors.scheduledTime && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="size-3" />
                          {errors.scheduledTime}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>
                    Scheduled campaigns will be sent in batches based on your sending speed settings to maintain optimal delivery rates.
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Review */}
          {currentStep === 'review' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-emerald-500" />
                    Campaign Summary
                  </CardTitle>
                  <CardDescription>
                    Review all settings before sending
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Basic Info */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Basic Info</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Campaign Name</p>
                        <p className="font-medium">{formData.name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Type</p>
                        <p className="font-medium capitalize">{formData.type.replace('_', ' ')}</p>
                      </div>
                      {formData.description && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground text-xs">Description</p>
                          <p className="font-medium">{formData.description}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Audience */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Audience</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Target Segment</p>
                        <p className="font-medium">{segmentLabel}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Estimated Recipients</p>
                        <p className="font-medium">{estimatedRecipients.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Message */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Message</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Sender Name</p>
                        <p className="font-medium">{formData.senderName}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">SMS Count</p>
                        <p className="font-medium">{smsCount} message{smsCount > 1 ? 's' : ''}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground text-xs">Message Preview</p>
                        <div className="bg-muted/50 rounded-lg p-3 text-sm">
                          <p className="line-clamp-3">{previewMessage}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Schedule */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Schedule</h4>
                    <div className="text-sm">
                      <p className="text-muted-foreground text-xs">Delivery</p>
                      <p className="font-medium flex items-center gap-2">
                        {formData.scheduleType === 'immediate' ? (
                          <>
                            <Zap className="size-4 text-amber-500" />
                            Send Immediately
                          </>
                        ) : (
                          <>
                            <CalendarClock className="size-4 text-emerald-500" />
                            {formData.scheduledDate} at {formData.scheduledTime}
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Cost Estimate */}
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Estimated Total Cost</p>
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70">
                          {estimatedRecipients.toLocaleString()} recipients &times; {smsCount} SMS
                        </p>
                      </div>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">${smsCost}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={goPrev} disabled={currentStep === 'info'}>
              <ArrowLeft className="size-4" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleSaveDraft} disabled={isSubmitting}>
                <Save className="size-4" />
                Save as Draft
              </Button>
              {currentStep === 'review' ? (
                <Button
                  onClick={handleSend}
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      {formData.scheduleType === 'immediate' ? 'Send Now' : 'Schedule Campaign'}
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={goNext} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Next
                  <ArrowLeft className="size-4 rotate-180" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-sm">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Recipients</span>
                <Badge variant="secondary" className="font-mono">
                  {estimatedRecipients.toLocaleString()}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">SMS Count</span>
                <Badge variant="secondary" className="font-mono">
                  {smsCount}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Est. Cost</span>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-mono">
                  ${smsCost}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Segment</span>
                <span className="text-xs font-medium truncate max-w-[120px]">{segmentLabel}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-emerald-500" />
                Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-xs text-muted-foreground">
                {currentStep === 'info' && (
                  <>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      Keep campaign names descriptive for easy reporting
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      Abandoned Cart campaigns have the highest ROI
                    </li>
                  </>
                )}
                {currentStep === 'audience' && (
                  <>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      RFM segments let you target by customer lifetime value
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      Smaller, targeted segments often convert better
                    </li>
                  </>
                )}
                {currentStep === 'message' && (
                  <>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      Messages under 160 chars = 1 SMS
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      Personalized messages get 6x higher engagement
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      Include a clear CTA in every message
                    </li>
                  </>
                )}
                {currentStep === 'schedule' && (
                  <>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      Peak SMS open rates: 10-11 AM and 2-3 PM
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      Avoid sending after 8 PM local time
                    </li>
                  </>
                )}
                {currentStep === 'review' && (
                  <>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      Double check your message preview
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      You can save as draft and come back later
                    </li>
                  </>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
