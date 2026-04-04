import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PopupState {
  isOpen: boolean;
  hasSubscribed: boolean;
  dismissedAt: number | null;
  triggerCount: number;
  lastTriggerAt: number | null;
  showExitIntent: boolean;
  
  openPopup: () => void;
  closePopup: () => void;
  markSubscribed: () => void;
  dismissPopup: () => void;
  incrementTrigger: () => void;
  setExitIntent: (show: boolean) => void;
  reset: () => void;
}

export const usePopupStore = create<PopupState>()(
  persist(
    (set) => ({
      isOpen: false,
      hasSubscribed: false,
      dismissedAt: null,
      triggerCount: 0,
      lastTriggerAt: null,
      showExitIntent: true,

      openPopup: () => set({ isOpen: true }),
      
      closePopup: () => set({ isOpen: false }),
      
      markSubscribed: () => set({ 
        hasSubscribed: true, 
        isOpen: false 
      }),
      
      dismissPopup: () => set({ 
        dismissedAt: Date.now(),
        isOpen: false 
      }),
      
      incrementTrigger: () => set((state) => ({ 
        triggerCount: state.triggerCount + 1,
        lastTriggerAt: Date.now()
      })),
      
      setExitIntent: (show: boolean) => set({ showExitIntent: show }),
      
      reset: () => set({
        isOpen: false,
        hasSubscribed: false,
        dismissedAt: null,
        triggerCount: 0,
        lastTriggerAt: null,
        showExitIntent: true
      })
    }),
    {
      name: 'sms-shield-popup',
      partialize: (state) => ({
        hasSubscribed: state.hasSubscribed,
        dismissedAt: state.dismissedAt
      })
    }
  )
);

interface CampaignState {
  selectedSegment: string | null;
  selectedContacts: string[];
  messageTemplate: string;
  scheduledDate: Date | null;
  isSending: boolean;
  
  setSelectedSegment: (segment: string | null) => void;
  setSelectedContacts: (ids: string[]) => void;
  toggleContact: (id: string) => void;
  setMessageTemplate: (template: string) => void;
  setScheduledDate: (date: Date | null) => void;
  setIsSending: (sending: boolean) => void;
  reset: () => void;
}

export const useCampaignStore = create<CampaignState>()(
  (set) => ({
    selectedSegment: null,
    selectedContacts: [],
    messageTemplate: '',
    scheduledDate: null,
    isSending: false,

    setSelectedSegment: (segment) => set({ selectedSegment: segment }),
    
    setSelectedContacts: (ids) => set({ selectedContacts: ids }),
    
    toggleContact: (id) => set((state) => ({
      selectedContacts: state.selectedContacts.includes(id)
        ? state.selectedContacts.filter((c) => c !== id)
        : [...state.selectedContacts, id]
    })),
    
    setMessageTemplate: (template) => set({ messageTemplate: template }),
    
    setScheduledDate: (date) => set({ scheduledDate: date }),
    
    setIsSending: (sending) => set({ isSending: sending }),
    
    reset: () => set({
      selectedSegment: null,
      selectedContacts: [],
      messageTemplate: '',
      scheduledDate: null,
      isSending: false
    })
  })
);

interface DashboardState {
  sidebarCollapsed: boolean;
  activeTab: string;
  dateRange: { start: Date; end: Date };
  
  toggleSidebar: () => void;
  setActiveTab: (tab: string) => void;
  setDateRange: (range: { start: Date; end: Date }) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      activeTab: 'overview',
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      },

      toggleSidebar: () => set((state) => ({ 
        sidebarCollapsed: !state.sidebarCollapsed 
      })),
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      setDateRange: (range) => set({ dateRange: range })
    }),
    {
      name: 'sms-shield-dashboard'
    }
  )
);
