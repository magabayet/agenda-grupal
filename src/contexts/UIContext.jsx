import { createContext, useContext, useState, useEffect } from 'react';

const UIContext = createContext(null);

export function UIProvider({ children }) {
  // View state: 'login', 'join', 'calendar'
  const [view, setView] = useState('login');

  // Calendar view mode
  const [calendarViewMode, setCalendarViewMode] = useState('list'); // list, grid, calendar

  // Filters
  const [filter, setFilter] = useState('all'); // all, available, starred, green, yellow, red

  // Month navigation
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [personalCalendarMonth, setPersonalCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Expanded states
  const [expandedDay, setExpandedDay] = useState(null);
  const [expandedConfirmed, setExpandedConfirmed] = useState(null);
  const [showGroupInstructions, setShowGroupInstructions] = useState(true);

  // Section expansion for main page
  const [sectionExpanded, setSectionExpanded] = useState({
    calendar: false,
    groups: false,
    newGroup: true
  });

  // Group search
  const [groupSearch, setGroupSearch] = useState('');

  // Notification toast
  const [notification, setNotification] = useState('');

  // Modals
  const [messageModal, setMessageModal] = useState({ open: false, dateStr: '', message: '' });
  const [generalChatModal, setGeneralChatModal] = useState({ open: false, message: '' });
  const [createGroupModal, setCreateGroupModal] = useState({ open: false, name: '', description: '', emails: '' });
  const [editGroupModal, setEditGroupModal] = useState({ open: false, name: '', description: '' });
  const [inviteModal, setInviteModal] = useState({ open: false, emails: '' });
  const [blockDayModal, setBlockDayModal] = useState({ open: false, dateStr: '', reason: '' });
  const [conflictModal, setConflictModal] = useState({ open: false, dateStr: '', conflicts: [], action: null });
  const [confirmPlanModal, setConfirmPlanModal] = useState({ open: false, dateStr: '' });
  const [deleteGroupModal, setDeleteGroupModal] = useState({ open: false, groupId: '', groupName: '' });

  // PWA states
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstallModal, setShowIOSInstallModal] = useState(false);
  const [installPromptDismissed, setInstallPromptDismissed] = useState(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) return false;
    return localStorage.getItem('installPromptDismissed') === 'true';
  });

  // Notification permission
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [fcmToken, setFcmToken] = useState(null);

  // Show notification helper
  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  // Navigate month in calendar
  const navigateMonth = (direction) => {
    setSelectedCalendarMonth(prev => {
      let newMonth = prev.month + direction;
      let newYear = prev.year;
      if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      } else if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      }
      return { year: newYear, month: newMonth };
    });
    setExpandedDay(null);
  };

  // Navigate personal calendar month
  const navigatePersonalMonth = (direction) => {
    setPersonalCalendarMonth(prev => {
      const newMonth = prev.month + direction;
      if (newMonth > 11) {
        return { year: prev.year + 1, month: 0 };
      } else if (newMonth < 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { ...prev, month: newMonth };
    });
  };

  // Toggle section expansion
  const toggleSection = (section) => {
    setSectionExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Dismiss install prompt
  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    setInstallPromptDismissed(true);
    localStorage.setItem('installPromptDismissed', 'true');
  };

  // Check if iOS
  const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  };

  // PWA install prompt setup
  useEffect(() => {
    const checkStandalone = () => {
      const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true
        || document.referrer.includes('android-app://');
      setIsStandalone(isInStandaloneMode);
      return isInStandaloneMode;
    };

    const standalone = checkStandalone();

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!installPromptDismissed && !standalone) {
        setTimeout(() => setShowInstallPrompt(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isiOS && !standalone && !installPromptDismissed) {
      setTimeout(() => setShowInstallPrompt(true), 3000);
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      setIsStandalone(true);
      showNotification('App instalada correctamente');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [installPromptDismissed]);

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const value = {
    // View
    view,
    setView,

    // Calendar
    calendarViewMode,
    setCalendarViewMode,
    filter,
    setFilter,
    selectedCalendarMonth,
    setSelectedCalendarMonth,
    personalCalendarMonth,
    setPersonalCalendarMonth,
    navigateMonth,
    navigatePersonalMonth,
    expandedDay,
    setExpandedDay,
    expandedConfirmed,
    setExpandedConfirmed,
    showGroupInstructions,
    setShowGroupInstructions,

    // Sections
    sectionExpanded,
    toggleSection,
    groupSearch,
    setGroupSearch,

    // Notifications
    notification,
    showNotification,
    notificationPermission,
    setNotificationPermission,
    fcmToken,
    setFcmToken,

    // Modals
    messageModal,
    setMessageModal,
    generalChatModal,
    setGeneralChatModal,
    createGroupModal,
    setCreateGroupModal,
    editGroupModal,
    setEditGroupModal,
    inviteModal,
    setInviteModal,
    blockDayModal,
    setBlockDayModal,
    conflictModal,
    setConflictModal,
    confirmPlanModal,
    setConfirmPlanModal,
    deleteGroupModal,
    setDeleteGroupModal,

    // PWA
    deferredPrompt,
    setDeferredPrompt,
    showInstallPrompt,
    setShowInstallPrompt,
    isStandalone,
    showIOSInstallModal,
    setShowIOSInstallModal,
    installPromptDismissed,
    dismissInstallPrompt,
    isIOS
  };

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}

export default UIContext;
