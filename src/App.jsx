import { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  deleteField
} from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import {
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Share2,
  LogOut,
  Plus,
  Chrome,
  Star,
  MessageCircle,
  Filter,
  X,
  Check,
  Copy,
  Mail,
  Send,
  Edit3,
  Settings,
  List,
  Grid,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCheck,
  Ban,
  Lock,
  AlertTriangle,
  Bell,
  UserCheck,
  Home,
  CalendarX,
  Search,
  Archive,
  Trash2,
  MoreVertical,
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  BellRing,
  BellOff,
  Download,
  Smartphone
} from 'lucide-react';

// --- Configuración de Firebase ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Firebase Cloud Messaging - inicializar solo si el navegador lo soporta
let messaging = null;
if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator) {
  try {
    messaging = getMessaging(app);
  } catch (e) {
    console.log('FCM no disponible:', e);
  }
}

// VAPID Key para FCM (se obtiene de Firebase Console > Project Settings > Cloud Messaging)
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export default function App() {
  const [user, setUser] = useState(null);
  const [userGroups, setUserGroups] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [groupIdInput, setGroupIdInput] = useState('');
  const [groupData, setGroupData] = useState(null);
  const [view, setView] = useState('login');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState('');
  const [filter, setFilter] = useState('all'); // all, available, starred, green, yellow, red
  const [messageModal, setMessageModal] = useState({ open: false, dateStr: '', message: '' });
  const [generalChatModal, setGeneralChatModal] = useState({ open: false, message: '' });
  const [createGroupModal, setCreateGroupModal] = useState({ open: false, name: '', description: '', emails: '' });
  const [editGroupModal, setEditGroupModal] = useState({ open: false, name: '', description: '' });
  const [inviteModal, setInviteModal] = useState({ open: false, emails: '' });
  const [calendarViewMode, setCalendarViewMode] = useState('list'); // list, grid, calendar
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [expandedDay, setExpandedDay] = useState(null);
  const [userData, setUserData] = useState(null); // Datos completos del usuario (blockedDays, confirmedPlans, etc.)
  const [blockDayModal, setBlockDayModal] = useState({ open: false, dateStr: '', reason: '' });
  const [conflictModal, setConflictModal] = useState({ open: false, dateStr: '', conflicts: [], action: null });
  const [confirmPlanModal, setConfirmPlanModal] = useState({ open: false, dateStr: '' });
  const [expandedConfirmed, setExpandedConfirmed] = useState(null); // dateStr del día que tiene el desplegable de confirmados abierto
  const [showGroupInstructions, setShowGroupInstructions] = useState(true); // Mostrar instrucciones de uso del grupo

  // Estados para gestión de grupos en página principal
  const [groupsCollapsed, setGroupsCollapsed] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupMenuOpen, setGroupMenuOpen] = useState(null); // ID del grupo con menú abierto
  const [deleteGroupModal, setDeleteGroupModal] = useState({ open: false, groupId: '', groupName: '' });

  // Estados para secciones colapsables de la página principal
  const [sectionExpanded, setSectionExpanded] = useState({
    calendar: false,
    groups: false,
    newGroup: true
  });

  // Estado para el mes seleccionado en el calendario personal
  const [personalCalendarMonth, setPersonalCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Estados para notificaciones push
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [fcmToken, setFcmToken] = useState(null);

  // Estados para PWA install prompt
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstallModal, setShowIOSInstallModal] = useState(false);
  const [installPromptDismissed, setInstallPromptDismissed] = useState(() => {
    // Para iOS no guardamos el dismiss porque no hay forma de detectar instalación
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) return false;
    return localStorage.getItem('installPromptDismissed') === 'true';
  });

  const monthRefs = useRef({});

  // Cerrar menú de grupo al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (groupMenuOpen && !e.target.closest('[data-group-menu]')) {
        setGroupMenuOpen(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [groupMenuOpen]);

  // 1. Escuchar estado de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        setView('join');
      } else {
        setView('login');
        setUserGroups([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // 1.5 Escuchar cambios en los datos del usuario (blockedDays, confirmedPlans, lastSeenMessages)
  useEffect(() => {
    if (!user) {
      setUserData(null);
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      }
    });

    return () => unsubscribe();
  }, [user]);

  // 1.6 Escuchar cambios en los grupos del usuario en tiempo real
  const groupsMapRef = useRef(new Map());
  const groupUnsubscribesRef = useRef([]);
  const currentGroupIdsRef = useRef([]);

  useEffect(() => {
    if (!user) {
      setUserGroups([]);
      groupsMapRef.current.clear();
      return;
    }

    const userRef = doc(db, 'users', user.uid);

    // Listener principal para detectar cambios en la lista de grupos del usuario
    const unsubscribeUser = onSnapshot(userRef, (userSnap) => {
      if (!userSnap.exists()) {
        setUserGroups([]);
        groupsMapRef.current.clear();
        return;
      }

      const userData = userSnap.data();
      const newGroupIds = userData.groups || [];
      const oldGroupIds = currentGroupIdsRef.current;

      // Detectar grupos eliminados
      const removedIds = oldGroupIds.filter(id => !newGroupIds.includes(id));
      // Detectar grupos nuevos
      const addedIds = newGroupIds.filter(id => !oldGroupIds.includes(id));

      // Limpiar datos y listeners de grupos eliminados
      removedIds.forEach(id => {
        groupsMapRef.current.delete(id);
      });

      // Actualizar la referencia de IDs actuales
      currentGroupIdsRef.current = newGroupIds;

      if (newGroupIds.length === 0) {
        // Limpiar todos los listeners de grupos
        groupUnsubscribesRef.current.forEach(unsub => unsub());
        groupUnsubscribesRef.current = [];
        setUserGroups([]);
        return;
      }

      // Solo crear listeners para grupos nuevos
      addedIds.forEach((gId) => {
        const groupRef = doc(db, 'calendar_groups', gId);
        const unsubGroup = onSnapshot(groupRef, (groupSnap) => {
          if (groupSnap.exists()) {
            const data = groupSnap.data();
            groupsMapRef.current.set(gId, {
              id: gId,
              name: data.name || '',
              description: data.description || '',
              memberCount: data.members?.length || 0,
              members: data.members || [],
              generalChat: data.generalChat || [],
              messages: data.messages || {}
            });
          } else {
            groupsMapRef.current.delete(gId);
          }

          // Actualizar el estado con todos los grupos actuales
          // Mantener el orden original de groupIds
          const orderedGroups = currentGroupIdsRef.current
            .filter(id => groupsMapRef.current.has(id))
            .map(id => groupsMapRef.current.get(id));
          setUserGroups(orderedGroups);
        }, (error) => {
          console.error(`Error escuchando grupo ${gId}:`, error);
        });

        groupUnsubscribesRef.current.push(unsubGroup);
      });

      // Si no hay grupos nuevos pero sí hubo cambios (eliminaciones), actualizar el estado
      if (addedIds.length === 0 && removedIds.length > 0) {
        const orderedGroups = currentGroupIdsRef.current
          .filter(id => groupsMapRef.current.has(id))
          .map(id => groupsMapRef.current.get(id));
        setUserGroups(orderedGroups);
      }
    }, (error) => {
      console.error("Error escuchando usuario:", error);
    });

    return () => {
      unsubscribeUser();
      groupUnsubscribesRef.current.forEach(unsub => unsub());
      groupUnsubscribesRef.current = [];
      groupsMapRef.current.clear();
      currentGroupIdsRef.current = [];
    };
  }, [user]);

  // Inicializar notificaciones push
  useEffect(() => {
    // Verificar el estado actual de permisos
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    // Escuchar mensajes en primer plano
    if (messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('Mensaje recibido en primer plano:', payload);

        // Mostrar notificación en la app
        const title = payload.notification?.title || 'Nuevo mensaje';
        const body = payload.notification?.body || '';
        showNotification(`${title}: ${body}`);
      });

      return () => unsubscribe();
    }

    // Para iOS: limpiar el dismiss del prompt para que siempre pueda ver las instrucciones
    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isiOS) {
      localStorage.removeItem('installPromptDismissed');
    }
  }, []);

  // PWA Install Prompt
  useEffect(() => {
    // Detectar si ya está instalada como app
    const checkStandalone = () => {
      const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true
        || document.referrer.includes('android-app://');
      setIsStandalone(isInStandaloneMode);
      return isInStandaloneMode;
    };

    const standalone = checkStandalone();

    // Capturar el evento beforeinstallprompt (Chrome/Android)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Mostrar el prompt solo si no fue descartado y no está en modo standalone
      if (!installPromptDismissed && !standalone) {
        setTimeout(() => setShowInstallPrompt(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Para iOS: mostrar instrucciones después de un delay si no está instalado
    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isiOS && !standalone && !installPromptDismissed) {
      setTimeout(() => setShowInstallPrompt(true), 3000);
    }

    // Detectar cuando la app es instalada
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

  // Función para solicitar permiso de notificaciones
  const requestNotificationPermission = async () => {
    if (!messaging) {
      showNotification('Las notificaciones no están disponibles en este navegador');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        // Obtener el token FCM
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        setFcmToken(token);

        // Guardar el token en Firestore para este usuario
        if (user && token) {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            fcmTokens: arrayUnion(token),
            notificationsEnabled: true
          });
          showNotification('Notificaciones activadas');
        }
      } else {
        showNotification('Permiso de notificaciones denegado');
      }
    } catch (error) {
      console.error('Error al solicitar permiso:', error);
      showNotification('Error al activar notificaciones');
    }
  };

  // Función para desactivar notificaciones
  const disableNotifications = async () => {
    if (user && fcmToken) {
      try {
        const userRef = doc(db, 'users', user.uid);
        // Obtener tokens actuales y remover el actual
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentTokens = userSnap.data().fcmTokens || [];
          const newTokens = currentTokens.filter(t => t !== fcmToken);
          await updateDoc(userRef, {
            fcmTokens: newTokens,
            notificationsEnabled: false
          });
        }
        setFcmToken(null);
        showNotification('Notificaciones desactivadas');
      } catch (error) {
        console.error('Error al desactivar notificaciones:', error);
      }
    }
  };

  // Función para instalar la PWA
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('PWA instalada');
    }
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  // Función para descartar el prompt de instalación
  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    setInstallPromptDismissed(true);
    localStorage.setItem('installPromptDismissed', 'true');
  };

  // Función para detectar si es iOS
  const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  };

  // 2. Escuchar cambios en el grupo
  useEffect(() => {
    if (!user || !groupId) return;

    const groupRef = doc(db, 'calendar_groups', groupId);

    const unsubscribe = onSnapshot(groupRef, (docSnap) => {
      if (docSnap.exists()) {
        setGroupData(docSnap.data());
      } else {
        setNotification('El grupo no existe.');
        setGroupData(null);
      }
    }, (error) => {
      console.error("Error escuchando el grupo:", error);
    });

    return () => unsubscribe();
  }, [user, groupId]);

  // --- Autenticación ---
  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const loggedUser = result.user;

      const userRef = doc(db, 'users', loggedUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          displayName: loggedUser.displayName,
          email: loggedUser.email,
          photoURL: loggedUser.photoURL,
          groups: [],
          createdAt: new Date().toISOString()
        });
      }

      showNotification(`¡Bienvenido, ${loggedUser.displayName}!`);
    } catch (error) {
      console.error("Error en login:", error);
      showNotification('Error al iniciar sesión');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setGroupId('');
      setGroupData(null);
      setView('login');
    } catch (error) {
      console.error("Error en logout:", error);
    }
  };

  // --- Lógica de Grupos ---
  const openCreateGroupModal = () => {
    setCreateGroupModal({ open: true, name: '', description: '', emails: '' });
  };

  const createGroup = async () => {
    if (!user) return;
    const newGroupId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const groupRef = doc(db, 'calendar_groups', newGroupId);

    const initialData = {
      name: createGroupModal.name.trim() || '',
      description: createGroupModal.description.trim() || '',
      members: [{
        uid: user.uid,
        name: user.displayName,
        photoURL: user.photoURL || ''
      }],
      votes: {},
      messages: {},
      stars: {},
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(groupRef, initialData);

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        groups: arrayUnion(newGroupId)
      });

      // El listener en tiempo real (useEffect 1.6) detectará el cambio y actualizará userGroups automáticamente

      // Enviar invitaciones por email si hay emails
      if (createGroupModal.emails.trim()) {
        sendEmailInvites(createGroupModal.emails, newGroupId, createGroupModal.name);
      }

      setCreateGroupModal({ open: false, name: '', description: '', emails: '' });
      setGroupId(newGroupId);
      setView('calendar');
      showNotification(`¡Grupo ${newGroupId} creado!`);
    } catch (e) {
      console.error(e);
      showNotification('Error creando grupo');
    }
  };

  const updateGroupInfo = async () => {
    if (!user || !groupId) return;

    const groupRef = doc(db, 'calendar_groups', groupId);

    try {
      await updateDoc(groupRef, {
        name: editGroupModal.name.trim(),
        description: editGroupModal.description.trim()
      });
      setEditGroupModal({ open: false, name: '', description: '' });
      showNotification('Grupo actualizado');
    } catch (e) {
      console.error(e);
      showNotification('Error actualizando grupo');
    }
  };

  const sendEmailInvites = (emailsString, gId, groupName) => {
    const emails = emailsString.split(/[,\s]+/).filter(e => e.includes('@'));
    if (emails.length === 0) return;

    const subject = encodeURIComponent(`Te invito a ${groupName || 'mi grupo'} en AgendaGrupal`);
    const body = encodeURIComponent(
      `¡Hola!\n\nTe invito a unirte a mi grupo "${groupName || 'AgendaGrupal'}" para coordinar fechas.\n\n` +
      `Código del grupo: ${gId}\n\n` +
      `Entra aquí: https://planificador-grupal.web.app\n\n` +
      `1. Inicia sesión con Google\n` +
      `2. Ingresa el código: ${gId}\n` +
      `3. ¡Listo!\n\n` +
      `- Enviado desde AgendaGrupal reconect`
    );

    // Abrir Gmail con los emails
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${emails.join(',')}&su=${subject}&body=${body}`;
    window.open(gmailUrl, '_blank');
  };

  const openInviteModal = () => {
    setInviteModal({ open: true, emails: '' });
  };

  const sendInvitesFromModal = () => {
    if (inviteModal.emails.trim()) {
      sendEmailInvites(inviteModal.emails, groupId, groupData?.name);
      setInviteModal({ open: false, emails: '' });
      showNotification('Abriendo Gmail para enviar invitaciones');
    }
  };

  const joinGroup = async (idToJoin) => {
    if (!user || !idToJoin) return;
    const cleanId = idToJoin.trim().toUpperCase();
    const groupRef = doc(db, 'calendar_groups', cleanId);

    try {
      const docSnap = await getDoc(groupRef);
      if (docSnap.exists()) {
        const currentData = docSnap.data();
        const isMember = currentData.members.some(m => m.uid === user.uid);

        if (!isMember) {
          await updateDoc(groupRef, {
            members: arrayUnion({
              uid: user.uid,
              name: user.displayName,
              photoURL: user.photoURL || ''
            })
          });

          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            groups: arrayUnion(cleanId)
          });

          // El listener en tiempo real (useEffect 1.6) detectará el cambio y actualizará userGroups automáticamente
        }
        setGroupId(cleanId);
        setView('calendar');
      } else {
        showNotification('Código de grupo inválido');
      }
    } catch (e) {
      console.error(e);
      showNotification('Error uniéndose al grupo');
    }
  };

  const toggleDateAvailability = async (dateStr, skipConflictCheck = false) => {
    if (!user || !groupId || !groupData) return;

    const currentVotes = groupData.votes || {};
    const dateVotes = currentVotes[dateStr] || [];
    const isCurrentlyAvailable = dateVotes.includes(user.uid);

    // Si va a marcar como disponible, verificar conflictos
    if (!isCurrentlyAvailable && !skipConflictCheck) {
      // Verificar si el día está bloqueado
      if (userData?.blockedDays?.[dateStr]) {
        showNotification('Este día está bloqueado. Desbloquéalo primero.');
        return;
      }

      // Verificar si hay plan confirmado en otro grupo
      const confirmedPlan = userData?.confirmedPlans?.[dateStr];
      if (confirmedPlan && confirmedPlan.groupId !== groupId) {
        setConflictModal({
          open: true,
          dateStr,
          conflicts: [{
            type: 'confirmed',
            groupName: confirmedPlan.groupName,
            groupId: confirmedPlan.groupId
          }],
          action: 'availability'
        });
        return;
      }

      // Verificar si ya tienes disponibilidad en otros grupos
      const otherGroupsWithAvailability = [];
      const groupIds = userData?.groups || [];

      for (const gId of groupIds) {
        if (gId === groupId) continue; // Saltar el grupo actual
        try {
          const otherGroupRef = doc(db, 'calendar_groups', gId);
          const groupSnap = await getDoc(otherGroupRef);
          if (groupSnap.exists()) {
            const gData = groupSnap.data();
            const votes = gData.votes?.[dateStr] || [];
            if (votes.includes(user.uid)) {
              otherGroupsWithAvailability.push({
                type: 'available',
                groupName: gData.name || `Grupo ${gId}`,
                groupId: gId
              });
            }
          }
        } catch (err) {
          console.error(`Error verificando grupo ${gId}:`, err);
        }
      }

      if (otherGroupsWithAvailability.length > 0) {
        setConflictModal({
          open: true,
          dateStr,
          conflicts: otherGroupsWithAvailability,
          action: 'availability'
        });
        return;
      }
    }

    // Ejecutar el cambio
    const groupRef = doc(db, 'calendar_groups', groupId);
    let newDateVotes;
    if (isCurrentlyAvailable) {
      newDateVotes = dateVotes.filter(uid => uid !== user.uid);
    } else {
      newDateVotes = [...dateVotes, user.uid];
    }

    try {
      await updateDoc(groupRef, {
        [`votes.${dateStr}`]: newDateVotes
      });
    } catch (e) {
      console.error("Error al votar", e);
    }
  };

  // --- Bloquear día personal ---
  const openBlockDayModal = (dateStr, e) => {
    if (e) e.stopPropagation();
    const existingReason = userData?.blockedDays?.[dateStr]?.reason || '';
    setBlockDayModal({ open: true, dateStr, reason: existingReason });
  };

  const blockDay = async () => {
    if (!user || !blockDayModal.dateStr) return;

    const dateStr = blockDayModal.dateStr;
    const userRef = doc(db, 'users', user.uid);

    try {
      // Guardar día bloqueado en perfil del usuario
      await updateDoc(userRef, {
        [`blockedDays.${dateStr}`]: {
          reason: blockDayModal.reason.trim(),
          blockedAt: new Date().toISOString()
        }
      });

      // Remover disponibilidad de todos los grupos del usuario
      const groupIds = userData?.groups || [];
      for (const gId of groupIds) {
        try {
          const groupRef = doc(db, 'calendar_groups', gId);
          const groupSnap = await getDoc(groupRef);
          if (groupSnap.exists()) {
            const gData = groupSnap.data();
            const votes = gData.votes?.[dateStr] || [];
            if (votes.includes(user.uid)) {
              await updateDoc(groupRef, {
                [`votes.${dateStr}`]: votes.filter(uid => uid !== user.uid)
              });
            }
          }
        } catch (err) {
          console.error(`Error actualizando grupo ${gId}:`, err);
        }
      }

      setBlockDayModal({ open: false, dateStr: '', reason: '' });
      showNotification('Día bloqueado en todos tus grupos');
    } catch (e) {
      console.error("Error al bloquear día", e);
      showNotification('Error al bloquear día');
    }
  };

  const unblockDay = async (dateStr) => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);

    try {
      await updateDoc(userRef, {
        [`blockedDays.${dateStr}`]: deleteField()
      });
      showNotification('Día desbloqueado');
    } catch (e) {
      console.error("Error al desbloquear día", e);
    }
  };

  // --- Confirmar plan ---
  const openConfirmPlanModal = (dateStr, e) => {
    if (e) e.stopPropagation();
    setConfirmPlanModal({ open: true, dateStr });
  };

  const confirmPlan = async () => {
    if (!user || !groupId || !groupData || !confirmPlanModal.dateStr) return;

    const dateStr = confirmPlanModal.dateStr;
    const userRef = doc(db, 'users', user.uid);
    const groupRef = doc(db, 'calendar_groups', groupId);

    try {
      // Guardar plan confirmado en perfil del usuario
      await updateDoc(userRef, {
        [`confirmedPlans.${dateStr}`]: {
          groupId: groupId,
          groupName: groupData.name || `Grupo ${groupId}`,
          confirmedAt: new Date().toISOString()
        }
      });

      // Marcar en el grupo que hay un plan confirmado (múltiples usuarios pueden confirmar)
      await updateDoc(groupRef, {
        [`confirmedDays.${dateStr}`]: arrayUnion({
          uid: user.uid,
          name: user.displayName || 'Usuario',
          photoURL: user.photoURL || null,
          confirmedAt: new Date().toISOString()
        })
      });

      // Remover disponibilidad de otros grupos para ese día
      const groupIds = userData?.groups || [];
      for (const gId of groupIds) {
        if (gId === groupId) continue; // No modificar el grupo actual
        try {
          const otherGroupRef = doc(db, 'calendar_groups', gId);
          const groupSnap = await getDoc(otherGroupRef);
          if (groupSnap.exists()) {
            const gData = groupSnap.data();
            const votes = gData.votes?.[dateStr] || [];
            if (votes.includes(user.uid)) {
              await updateDoc(otherGroupRef, {
                [`votes.${dateStr}`]: votes.filter(uid => uid !== user.uid)
              });
            }
          }
        } catch (err) {
          console.error(`Error actualizando grupo ${gId}:`, err);
        }
      }

      setConfirmPlanModal({ open: false, dateStr: '' });
      showNotification('¡Plan confirmado! Tu disponibilidad fue removida de otros grupos.');
    } catch (e) {
      console.error("Error al confirmar plan", e);
      showNotification('Error al confirmar plan');
    }
  };

  const cancelConfirmedPlan = async (dateStr) => {
    if (!user || !groupId || !groupData) return;

    const userRef = doc(db, 'users', user.uid);
    const groupRef = doc(db, 'calendar_groups', groupId);

    try {
      await updateDoc(userRef, {
        [`confirmedPlans.${dateStr}`]: deleteField()
      });

      // Remover al usuario de la lista de confirmaciones del día
      const currentConfirmed = groupData.confirmedDays?.[dateStr] || [];
      const updatedConfirmed = currentConfirmed.filter(c => c.uid !== user.uid);

      if (updatedConfirmed.length === 0) {
        // Si no queda nadie, eliminar el campo completo
        await updateDoc(groupRef, {
          [`confirmedDays.${dateStr}`]: deleteField()
        });
      } else {
        await updateDoc(groupRef, {
          [`confirmedDays.${dateStr}`]: updatedConfirmed
        });
      }

      showNotification('Plan cancelado');
    } catch (e) {
      console.error("Error al cancelar plan", e);
    }
  };

  // --- Marcar mensajes como leídos ---
  const markMessagesAsRead = async (dateStr, messageCount) => {
    if (!user || !groupId || messageCount === 0) return;

    const userRef = doc(db, 'users', user.uid);

    try {
      await updateDoc(userRef, {
        [`lastSeenMessages.${groupId}.${dateStr}`]: messageCount
      });
    } catch (e) {
      console.error("Error al marcar mensajes como leídos", e);
    }
  };

  // Función helper para contar mensajes sin leer
  const getUnreadMessageCount = (dateStr) => {
    const rawMessages = groupData?.messages?.[dateStr];
    let totalMessages = 0;

    if (Array.isArray(rawMessages)) {
      totalMessages = rawMessages.length;
    } else if (rawMessages && typeof rawMessages === 'object') {
      totalMessages = Object.keys(rawMessages).length;
    }

    const seenCount = userData?.lastSeenMessages?.[groupId]?.[dateStr] || 0;
    return Math.max(0, totalMessages - seenCount);
  };

  // --- Marcar mensajes del chat general como leídos ---
  const markGeneralChatAsRead = async (messageCount) => {
    if (!user || !groupId || messageCount === 0) return;

    const userRef = doc(db, 'users', user.uid);

    try {
      await updateDoc(userRef, {
        [`lastSeenMessages.${groupId}._general`]: messageCount
      });
    } catch (e) {
      console.error("Error al marcar chat general como leído", e);
    }
  };

  // Función helper para contar mensajes sin leer del chat general
  const getUnreadGeneralChatCount = () => {
    const totalMessages = groupData?.generalChat?.length || 0;
    const seenCount = userData?.lastSeenMessages?.[groupId]?.['_general'] || 0;
    return Math.max(0, totalMessages - seenCount);
  };

  // Función para contar TODOS los mensajes sin leer de un grupo (chat general + chats de días)
  const getTotalUnreadForGroup = (group) => {
    if (!userData?.lastSeenMessages) return 0;

    const groupSeenData = userData.lastSeenMessages[group.id] || {};
    let totalUnread = 0;

    // Mensajes sin leer del chat general
    const generalChatTotal = group.generalChat?.length || 0;
    const generalChatSeen = groupSeenData['_general'] || 0;
    totalUnread += Math.max(0, generalChatTotal - generalChatSeen);

    // Mensajes sin leer de los chats de días
    const messages = group.messages || {};
    Object.entries(messages).forEach(([dateStr, dateMessages]) => {
      let msgCount = 0;
      if (Array.isArray(dateMessages)) {
        msgCount = dateMessages.length;
      } else if (dateMessages && typeof dateMessages === 'object') {
        msgCount = Object.keys(dateMessages).length;
      }
      const seenCount = groupSeenData[dateStr] || 0;
      totalUnread += Math.max(0, msgCount - seenCount);
    });

    return totalUnread;
  };

  const toggleStar = async (dateStr, e) => {
    e.stopPropagation();
    if (!user || !groupId || !groupData) return;

    const groupRef = doc(db, 'calendar_groups', groupId);
    const currentStars = groupData.stars || {};
    const dateStars = currentStars[dateStr] || [];

    let newDateStars;
    if (dateStars.includes(user.uid)) {
      newDateStars = dateStars.filter(uid => uid !== user.uid);
    } else {
      newDateStars = [...dateStars, user.uid];
    }

    try {
      await updateDoc(groupRef, {
        [`stars.${dateStr}`]: newDateStars
      });
    } catch (e) {
      console.error("Error al marcar estrella", e);
    }
  };

  const openMessageModal = (dateStr, e) => {
    e.stopPropagation();
    setMessageModal({ open: true, dateStr, message: '' });

    // Marcar mensajes como leídos
    const rawMessages = groupData?.messages?.[dateStr];
    let messageCount = 0;
    if (Array.isArray(rawMessages)) {
      messageCount = rawMessages.length;
    } else if (rawMessages && typeof rawMessages === 'object') {
      messageCount = Object.keys(rawMessages).length;
    }
    if (messageCount > 0) {
      markMessagesAsRead(dateStr, messageCount);
    }
  };

  const saveMessage = async () => {
    if (!user || !groupId || !groupData || !messageModal.message.trim()) return;

    const groupRef = doc(db, 'calendar_groups', groupId);

    // Crear nuevo mensaje con timestamp
    const newMessage = {
      uid: user.uid,
      name: user.displayName,
      photoURL: user.photoURL || '',
      text: messageModal.message.trim(),
      timestamp: new Date().toISOString()
    };

    // Obtener mensajes existentes del día (puede ser array nuevo o formato antiguo)
    const existingMessages = groupData.messages?.[messageModal.dateStr];
    let updatedMessages;

    if (Array.isArray(existingMessages)) {
      // Ya es un array, agregar el nuevo mensaje
      updatedMessages = [...existingMessages, newMessage];
    } else if (existingMessages && typeof existingMessages === 'object') {
      // Formato antiguo { uid: "mensaje" }, migrar a array
      const migratedMessages = Object.entries(existingMessages).map(([uid, text]) => {
        const member = groupData.members?.find(m => m.uid === uid);
        return {
          uid,
          name: member?.name || 'Usuario',
          photoURL: member?.photoURL || '',
          text,
          timestamp: new Date(0).toISOString() // Fecha antigua para ordenar primero
        };
      });
      updatedMessages = [...migratedMessages, newMessage];
    } else {
      // No hay mensajes previos
      updatedMessages = [newMessage];
    }

    try {
      await updateDoc(groupRef, {
        [`messages.${messageModal.dateStr}`]: updatedMessages
      });
      // Limpiar el campo de mensaje, mantener el modal abierto
      setMessageModal(prev => ({ ...prev, message: '' }));

      // Actualizar el contador de mensajes leídos para incluir el mensaje enviado
      // Esto evita que el propio mensaje aparezca como "no leído"
      markMessagesAsRead(messageModal.dateStr, updatedMessages.length);
    } catch (e) {
      console.error("Error al guardar mensaje", e);
      showNotification('Error al enviar mensaje');
    }
  };

  // Función para guardar mensaje en el chat general del grupo
  const saveGeneralMessage = async () => {
    if (!user || !groupId || !groupData || !generalChatModal.message.trim()) return;

    const groupRef = doc(db, 'calendar_groups', groupId);

    // Crear nuevo mensaje con timestamp
    const newMessage = {
      uid: user.uid,
      name: user.displayName,
      photoURL: user.photoURL || '',
      text: generalChatModal.message.trim(),
      timestamp: new Date().toISOString()
    };

    // Obtener mensajes existentes del chat general
    const existingMessages = groupData.generalChat || [];
    const updatedMessages = [...existingMessages, newMessage];

    try {
      await updateDoc(groupRef, {
        generalChat: updatedMessages
      });
      // Limpiar el campo de mensaje, mantener el modal abierto
      setGeneralChatModal(prev => ({ ...prev, message: '' }));

      // Actualizar el contador de mensajes leídos para incluir el mensaje enviado
      // Esto evita que el propio mensaje aparezca como "no leído"
      markGeneralChatAsRead(updatedMessages.length);
    } catch (e) {
      console.error("Error al guardar mensaje general", e);
      showNotification('Error al enviar mensaje');
    }
  };

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(groupId).then(() => {
      showNotification("¡Código copiado!");
    }).catch(() => {
      const textArea = document.createElement("textarea");
      textArea.value = groupId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showNotification("¡Código copiado!");
    });
  };

  const copyFullInvite = () => {
    const groupName = groupData?.name ? `"${groupData.name}"` : 'mi calendario grupal';
    const text = `¡Únete a ${groupName}!\n\nCódigo: ${groupId}\nEntra aquí: https://planificador-grupal.web.app`;
    navigator.clipboard.writeText(text).then(() => {
      showNotification("¡Invitación copiada!");
    }).catch(() => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showNotification("¡Invitación copiada!");
    });
  };

  const shareGroup = async () => {
    const groupName = groupData?.name || 'AgendaGrupal';
    const shareData = {
      title: groupName,
      text: `¡Únete a "${groupName}"!\nCódigo: ${groupId}`,
      url: 'https://planificador-grupal.web.app'
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') {
          copyFullInvite();
        }
      }
    } else {
      copyFullInvite();
    }
  };

  const leaveGroup = () => {
    setGroupId('');
    setGroupData(null);
    setGroupIdInput('');
    setView('join');
  };

  // Archivar/Eliminar grupo (remover usuario del grupo)
  const archiveGroup = async (gId, gName) => {
    if (!user) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      const groupRef = doc(db, 'calendar_groups', gId);

      // Obtener datos actuales del grupo
      const groupSnap = await getDoc(groupRef);
      if (groupSnap.exists()) {
        const gData = groupSnap.data();

        // Remover usuario de la lista de miembros del grupo
        const updatedMembers = (gData.members || []).filter(m => m.uid !== user.uid);

        // Remover votos del usuario en todas las fechas
        const updatedVotes = { ...gData.votes };
        for (const dateStr in updatedVotes) {
          if (Array.isArray(updatedVotes[dateStr])) {
            updatedVotes[dateStr] = updatedVotes[dateStr].filter(uid => uid !== user.uid);
          }
        }

        await updateDoc(groupRef, {
          members: updatedMembers,
          votes: updatedVotes
        });
      }

      // Remover grupo de la lista del usuario
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const uData = userSnap.data();
        const updatedGroups = (uData.groups || []).filter(g => g !== gId);
        await updateDoc(userRef, { groups: updatedGroups });
      }

      // Actualizar estado local
      setUserGroups(prev => prev.filter(g => g.id !== gId));
      setDeleteGroupModal({ open: false, groupId: '', groupName: '' });
      setGroupMenuOpen(null);
      showNotification(`Saliste del grupo "${gName}"`);
    } catch (e) {
      console.error("Error al salir del grupo:", e);
      showNotification('Error al salir del grupo');
    }
  };

  // --- Generación de Calendario (solo fechas futuras) ---
  const calendarDays = useMemo(() => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push({
        dateObj: d,
        dateStr: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString('es-ES', { weekday: 'long' }),
        dayNum: d.getDate(),
        monthName: d.toLocaleDateString('es-ES', { month: 'long' }),
        monthKey: `${d.getFullYear()}-${d.getMonth()}`,
        year: d.getFullYear(),
        month: d.getMonth()
      });
    }
    return days;
  }, []);

  // Agrupar por meses para navegación
  const monthsNav = useMemo(() => {
    const months = [];
    const seen = new Set();
    calendarDays.forEach(day => {
      if (!seen.has(day.monthKey)) {
        seen.add(day.monthKey);
        months.push({
          key: day.monthKey,
          name: day.monthName,
          year: day.year
        });
      }
    });
    return months;
  }, [calendarDays]);

  const scrollToMonth = (monthKey) => {
    const element = monthRefs.current[monthKey];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // --- Cálculo de Estado (Semáforo) ---
  const getDayStatus = (dateStr) => {
    if (!groupData) return { colorClass: 'bg-slate-100 border-slate-200 text-slate-500', statusIcon: <XCircle className="w-4 h-4" />, isUserAvailable: false, voteCount: 0, totalMembers: 1, percentage: 0, isStarred: false, starCount: 0, isBlocked: false, isConfirmed: false, confirmedInOtherGroup: null, unreadCount: 0, confirmedUsers: [], confirmedCount: 0 };

    const totalMembers = groupData.members?.length || 1;
    const votes = groupData.votes?.[dateStr] || [];
    const voteCount = votes.length;
    const percentage = totalMembers > 0 ? voteCount / totalMembers : 0;

    const isUserAvailable = votes.includes(user?.uid);

    const stars = groupData.stars?.[dateStr] || [];
    const isStarred = stars.includes(user?.uid);
    const starCount = stars.length;

    const rawMessages = groupData.messages?.[dateStr];
    let messageCount = 0;
    let hasMyMessage = false;

    if (Array.isArray(rawMessages)) {
      messageCount = rawMessages.length;
      hasMyMessage = rawMessages.some(m => m.uid === user?.uid);
    } else if (rawMessages && typeof rawMessages === 'object') {
      // Formato antiguo
      messageCount = Object.keys(rawMessages).length;
      hasMyMessage = !!rawMessages[user?.uid];
    }

    // Estados de bloqueo y confirmación
    const isBlocked = !!userData?.blockedDays?.[dateStr];
    const blockReason = userData?.blockedDays?.[dateStr]?.reason || '';

    const confirmedPlan = userData?.confirmedPlans?.[dateStr];
    const isConfirmed = confirmedPlan?.groupId === groupId;
    const confirmedInOtherGroup = confirmedPlan && confirmedPlan.groupId !== groupId ? confirmedPlan : null;

    // Lista de usuarios que confirmaron en este grupo para este día
    const confirmedUsers = groupData.confirmedDays?.[dateStr] || [];
    const confirmedCount = confirmedUsers.length;

    // Mensajes sin leer
    const seenCount = userData?.lastSeenMessages?.[groupId]?.[dateStr] || 0;
    const unreadCount = Math.max(0, messageCount - seenCount);

    // Corregido: >= 50% es amarillo, 100% es verde
    let colorClass = 'bg-red-100 border-red-200 text-red-800';
    let statusIcon = <XCircle className="w-4 h-4" />;
    let statusType = 'red';

    if (isBlocked) {
      colorClass = 'bg-slate-200 border-slate-300 text-slate-600';
      statusIcon = <Lock className="w-4 h-4" />;
      statusType = 'blocked';
    } else if (percentage === 1 && voteCount > 0) {
      colorClass = 'bg-green-100 border-green-200 text-green-800';
      statusIcon = <CheckCircle className="w-4 h-4" />;
      statusType = 'green';
    } else if (percentage >= 0.5) {
      colorClass = 'bg-yellow-100 border-yellow-200 text-yellow-800';
      statusIcon = <Users className="w-4 h-4" />;
      statusType = 'yellow';
    }

    return { colorClass, statusIcon, isUserAvailable, voteCount, totalMembers, percentage, isStarred, starCount, hasMyMessage, messageCount, statusType, isBlocked, blockReason, isConfirmed, confirmedInOtherGroup, unreadCount, confirmedUsers, confirmedCount };
  };

  // Filtrar días según el filtro seleccionado
  const filteredDays = useMemo(() => {
    if (filter === 'all') return calendarDays;

    return calendarDays.filter(day => {
      const status = getDayStatus(day.dateStr);
      switch (filter) {
        case 'available':
          return status.isUserAvailable;
        case 'starred':
          return status.isStarred;
        case 'green':
          return status.statusType === 'green';
        case 'yellow':
          return status.statusType === 'yellow';
        case 'red':
          return status.statusType === 'red';
        default:
          return true;
      }
    });
  }, [calendarDays, filter, groupData, user]);

  // --- Calendario tradicional ---
  const getCalendarGridDays = useMemo(() => {
    const { year, month } = selectedCalendarMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = domingo

    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Días vacíos al inicio
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Días del mes
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = dateObj.toISOString().split('T')[0];
      const isPast = dateObj < today;
      days.push({
        dateObj,
        dateStr,
        dayNum: d,
        isPast,
        dayName: dateObj.toLocaleDateString('es-ES', { weekday: 'long' }),
        monthName: dateObj.toLocaleDateString('es-ES', { month: 'long' })
      });
    }

    return days;
  }, [selectedCalendarMonth]);

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

  const currentMonthName = new Date(selectedCalendarMonth.year, selectedCalendarMonth.month).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  // --- Renderizado ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <Calendar className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">

      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
        <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
          {/* Logo - clickeable para ir a página principal */}
          <button
            onClick={() => { setGroupId(''); setGroupData(null); setView('join'); }}
            className="flex items-center gap-2 hover:opacity-80 transition"
          >
            <Calendar className="w-6 h-6 text-indigo-600" />
            <div>
              <span className="text-indigo-600 font-bold text-lg leading-none block">AgendaGrupal</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">reconect</span>
            </div>
          </button>

          {user && (
            <div className="flex items-center gap-1">
              {view === 'calendar' && (
                <>
                  {/* Botón Home - volver a página principal */}
                  <button
                    onClick={() => { setGroupId(''); setGroupData(null); setView('join'); }}
                    className="p-1.5 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition"
                    title="Ir al inicio"
                  >
                    <Home className="w-4 h-4" />
                  </button>
                  {/* Botón salir del grupo */}
                  <button
                    onClick={leaveGroup}
                    className="p-1.5 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition"
                    title="Salir del grupo"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              )}
              {/* Foto de perfil - solo en vista principal */}
              {view !== 'calendar' && (
                user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    className="w-8 h-8 rounded-full border-2 border-indigo-200 cursor-pointer hover:border-indigo-400 transition"
                    onClick={() => { setGroupId(''); setGroupData(null); setView('join'); }}
                    title="Ir al inicio"
                  />
                ) : (
                  <button
                    onClick={() => { setGroupId(''); setGroupData(null); setView('join'); }}
                    className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm hover:bg-indigo-200 transition"
                    title="Ir al inicio"
                  >
                    {user.displayName?.charAt(0) || '?'}
                  </button>
                )
              )}
              {/* Botón de instalar app (si no está instalada) - solo en vista principal */}
              {!isStandalone && view !== 'calendar' && (
                <button
                  onClick={() => {
                    if (deferredPrompt) {
                      handleInstallClick();
                    } else if (isIOS()) {
                      setShowIOSInstallModal(true);
                    } else {
                      setShowInstallPrompt(true);
                    }
                  }}
                  className="p-2 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition"
                  title="Instalar app"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
              {/* Botón de notificaciones - solo en vista principal */}
              {view !== 'calendar' && (
                messaging ? (
                  <button
                    onClick={notificationPermission === 'granted' ? disableNotifications : requestNotificationPermission}
                    className={`p-2 rounded-full transition ${
                      notificationPermission === 'granted'
                        ? 'bg-green-50 text-green-600 hover:bg-green-100'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                    title={notificationPermission === 'granted' ? 'Notificaciones activadas' : 'Activar notificaciones'}
                  >
                    {notificationPermission === 'granted' ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  </button>
                ) : isIOS() && isStandalone ? (
                  /* En iOS PWA instalada, mostrar botón para activar notificaciones nativas */
                  <button
                    onClick={async () => {
                      if ('Notification' in window) {
                        const permission = await Notification.requestPermission();
                        if (permission === 'granted') {
                          showNotification('Notificaciones activadas');
                          setNotificationPermission('granted');
                        } else {
                          showNotification('Habilita notificaciones en Ajustes > Agenda Grupal');
                        }
                      } else {
                        showNotification('Actualiza iOS a la versión 16.4 o superior para notificaciones');
                      }
                    }}
                    className={`p-2 rounded-full transition ${
                      notificationPermission === 'granted'
                        ? 'bg-green-50 text-green-600 hover:bg-green-100'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                    title="Activar notificaciones"
                  >
                    {notificationPermission === 'granted' ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  </button>
                ) : isIOS() && !isStandalone ? (
                  /* En iOS Safari, indicar que debe instalar primero */
                  <button
                    onClick={() => {
                      showNotification('Instala la app primero para recibir notificaciones');
                      setShowIOSInstallModal(true);
                    }}
                    className="p-2 rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 transition"
                    title="Instala la app para notificaciones"
                  >
                    <BellOff className="w-4 h-4" />
                  </button>
                ) : null
              )}
              {/* Botón cerrar sesión - solo en vista principal */}
              {view !== 'calendar' && (
                <button
                  onClick={handleLogout}
                  className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm">
          {notification}
        </div>
      )}

      {/* PWA Install Modal - Universal para todos los dispositivos */}
      {(showInstallPrompt || showIOSInstallModal) && !isStandalone && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 pb-8 safe-area-bottom sm:m-4">
            {/* Header con icono */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-3 rounded-2xl">
                  <Download className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Instalar App</h3>
                  <p className="text-xs text-slate-500">Acceso rápido desde tu pantalla</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowIOSInstallModal(false);
                  dismissInstallPrompt();
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Contenido según dispositivo */}
            {deferredPrompt ? (
              /* Android / Chrome Desktop - Instalación directa */
              <div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <p className="text-green-800 text-sm font-medium flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Tu dispositivo soporta instalación directa
                  </p>
                </div>
                <p className="text-slate-600 text-sm mb-4">
                  Al instalar, Agenda Grupal aparecerá como una app en tu dispositivo con acceso directo desde la pantalla de inicio.
                </p>
                <button
                  onClick={handleInstallClick}
                  className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Instalar ahora
                </button>
              </div>
            ) : isIOS() ? (
              /* iOS - Instrucciones manuales */
              <div>
                {/* Advertencia si no está en Safari */}
                {!/Safari/i.test(navigator.userAgent) || /CriOS|FxiOS|OPiOS/i.test(navigator.userAgent) ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                    <p className="text-amber-800 text-sm font-medium">Abre en Safari</p>
                    <p className="text-amber-600 text-xs mt-1">Solo Safari permite instalar apps en iPhone/iPad. Copia este enlace y ábrelo en Safari.</p>
                  </div>
                ) : null}

                <p className="text-slate-600 text-sm mb-4">Sigue estos pasos para instalar:</p>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl">
                    <div className="bg-blue-500 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0">1</div>
                    <div>
                      <p className="text-slate-700 text-sm font-medium">Toca el menú <span className="inline-block bg-slate-200 px-2 py-0.5 rounded font-bold">•••</span></p>
                      <p className="text-slate-500 text-xs">En la esquina inferior derecha de Safari</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl">
                    <div className="bg-blue-500 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0">2</div>
                    <div>
                      <p className="text-slate-700 text-sm font-medium">Toca "Compartir" <span className="inline-block bg-slate-200 px-1.5 py-0.5 rounded text-base">⬆️</span></p>
                      <p className="text-slate-500 text-xs">Se abrirá el menú de compartir</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl">
                    <div className="bg-blue-500 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0">3</div>
                    <div>
                      <p className="text-slate-700 text-sm font-medium">Añadir a pantalla de inicio</p>
                      <p className="text-slate-500 text-xs">Desplázate hacia abajo y busca esta opción</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl">
                    <div className="bg-blue-500 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0">4</div>
                    <div>
                      <p className="text-slate-700 text-sm font-medium">Confirma "Añadir"</p>
                      <p className="text-slate-500 text-xs">En la esquina superior derecha</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-indigo-50 rounded-xl">
                  <p className="text-xs text-indigo-700">
                    <strong>Notificaciones:</strong> Una vez instalada podrás activar notificaciones (iOS 16.4+)
                  </p>
                </div>
              </div>
            ) : (
              /* Otros navegadores desktop sin soporte */
              <div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                  <p className="text-slate-700 text-sm font-medium">Instrucciones para tu navegador:</p>
                </div>

                <div className="space-y-3 text-sm text-slate-600">
                  <p><strong>Chrome:</strong> Haz clic en el icono de instalar en la barra de direcciones (⊕) o en el menú ⋮ → "Instalar Agenda Grupal"</p>
                  <p><strong>Edge:</strong> Haz clic en el icono de apps en la barra de direcciones o en el menú → "Instalar este sitio como aplicación"</p>
                  <p><strong>Firefox:</strong> Firefox no soporta instalación de PWAs. Usa Chrome o Edge.</p>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setShowIOSInstallModal(false);
                dismissInstallPrompt();
              }}
              className="w-full mt-4 bg-slate-100 text-slate-700 py-3 rounded-xl font-medium"
            >
              {deferredPrompt ? 'Ahora no' : 'Entendido'}
            </button>
          </div>
        </div>
      )}

      {/* Message Modal - iMessage Style Chat */}
      {messageModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-slate-100 w-full sm:max-w-md sm:rounded-2xl sm:m-4 flex flex-col max-h-[85vh] sm:max-h-[600px]">
            {/* Header - iOS style */}
            <div className="bg-slate-200/80 backdrop-blur-lg px-4 py-3 flex items-center justify-between border-b border-slate-300 sm:rounded-t-2xl">
              <button
                onClick={() => setMessageModal({ open: false, dateStr: '', message: '' })}
                className="text-indigo-600 font-medium text-sm"
              >
                Cerrar
              </button>
              <div className="text-center">
                <h3 className="font-semibold text-slate-800">Chat del día</h3>
                <p className="text-xs text-slate-500">
                  {new Date(messageModal.dateStr).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
                </p>
              </div>
              <div className="w-12"></div>
            </div>

            {/* Messages Area - Chat bubbles */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100">
              {(() => {
                const rawMessages = groupData?.messages?.[messageModal.dateStr];

                // Normalizar mensajes (soportar formato antiguo y nuevo)
                let allMessages = [];
                if (Array.isArray(rawMessages)) {
                  allMessages = rawMessages;
                } else if (rawMessages && typeof rawMessages === 'object') {
                  // Formato antiguo { uid: "mensaje" }
                  allMessages = Object.entries(rawMessages).map(([uid, text]) => {
                    const member = groupData?.members?.find(m => m.uid === uid);
                    return {
                      uid,
                      name: member?.name || 'Usuario',
                      photoURL: member?.photoURL || '',
                      text,
                      timestamp: new Date(0).toISOString()
                    };
                  });
                }

                if (allMessages.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 py-8">
                      <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
                      <p className="text-sm">No hay mensajes aún</p>
                      <p className="text-xs">Sé el primero en comentar</p>
                    </div>
                  );
                }

                // Ordenar por timestamp
                const sortedMessages = [...allMessages].sort((a, b) =>
                  new Date(a.timestamp) - new Date(b.timestamp)
                );

                return sortedMessages.map((msg, idx) => {
                  const isMe = msg.uid === user?.uid;
                  const time = new Date(msg.timestamp);
                  const timeStr = time.getFullYear() > 1970
                    ? time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div key={`${msg.uid}-${idx}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex items-end gap-2 max-w-[80%] ${isMe ? 'flex-row-reverse' : ''}`}>
                        {/* Avatar */}
                        {!isMe && (
                          <div className="flex-shrink-0 mb-1">
                            {msg.photoURL ? (
                              <img src={msg.photoURL} alt={msg.name} className="w-7 h-7 rounded-full" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-slate-400 flex items-center justify-center text-white text-xs font-medium">
                                {msg.name?.charAt(0) || '?'}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Message bubble */}
                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          {!isMe && (
                            <span className="text-[10px] text-slate-500 ml-1 mb-0.5">
                              {msg.name?.split(' ')[0] || 'Usuario'}
                            </span>
                          )}
                          <div
                            className={`
                              px-4 py-2 rounded-2xl text-sm leading-relaxed
                              ${isMe
                                ? 'bg-indigo-600 text-white rounded-br-md'
                                : 'bg-white text-slate-800 rounded-bl-md shadow-sm'
                              }
                            `}
                          >
                            {msg.text}
                          </div>
                          <span className="text-[10px] text-slate-400 mx-1 mt-0.5">
                            {isMe ? 'Tú' : ''} {timeStr && `· ${timeStr}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Input Area - iOS style */}
            <div className="bg-slate-200/80 backdrop-blur-lg px-3 py-2 border-t border-slate-300 sm:rounded-b-2xl safe-area-bottom">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white rounded-full border border-slate-300 flex items-center min-h-[44px]">
                  <input
                    type="text"
                    className="flex-1 px-4 py-2.5 bg-transparent outline-none text-base"
                    placeholder="Mensaje..."
                    value={messageModal.message}
                    onChange={(e) => setMessageModal({ ...messageModal, message: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        saveMessage();
                      }
                    }}
                    autoComplete="off"
                    autoCorrect="off"
                  />
                </div>
                <button
                  onClick={saveMessage}
                  disabled={!messageModal.message.trim()}
                  className={`
                    w-11 h-11 rounded-full flex items-center justify-center transition flex-shrink-0
                    ${messageModal.message.trim()
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800'
                      : 'bg-slate-300 text-slate-400 cursor-not-allowed'
                    }
                  `}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* General Chat Modal - iMessage Style */}
      {generalChatModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-slate-100 w-full sm:max-w-md sm:rounded-2xl sm:m-4 flex flex-col max-h-[85vh] sm:max-h-[600px]">
            {/* Header - iOS style */}
            <div className="bg-indigo-600 px-4 py-3 flex items-center justify-between sm:rounded-t-2xl">
              <button
                onClick={() => setGeneralChatModal({ open: false, message: '' })}
                className="text-indigo-200 font-medium text-sm hover:text-white"
              >
                Cerrar
              </button>
              <div className="text-center">
                <h3 className="font-semibold text-white">Chat del grupo</h3>
                <p className="text-xs text-indigo-200">
                  {groupData?.name || 'Chat general'}
                </p>
              </div>
              <div className="w-12"></div>
            </div>

            {/* Messages Area - Chat bubbles */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100">
              {(() => {
                const allMessages = groupData?.generalChat || [];

                if (allMessages.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 py-8">
                      <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
                      <p className="text-sm">No hay mensajes aún</p>
                      <p className="text-xs">Inicia la conversación del grupo</p>
                    </div>
                  );
                }

                // Ordenar por timestamp
                const sortedMessages = [...allMessages].sort((a, b) =>
                  new Date(a.timestamp) - new Date(b.timestamp)
                );

                return sortedMessages.map((msg, idx) => {
                  const isMe = msg.uid === user?.uid;
                  const time = new Date(msg.timestamp);
                  const timeStr = time.getFullYear() > 1970
                    ? time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                    : '';
                  const dateStr = time.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

                  // Mostrar separador de fecha si es un día diferente
                  const prevMsg = sortedMessages[idx - 1];
                  const prevDate = prevMsg ? new Date(prevMsg.timestamp).toDateString() : null;
                  const showDateSeparator = !prevMsg || prevDate !== time.toDateString();

                  return (
                    <div key={`${msg.uid}-${idx}`}>
                      {showDateSeparator && (
                        <div className="flex justify-center my-2">
                          <span className="text-[10px] text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                            {dateStr}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex items-end gap-2 max-w-[80%] ${isMe ? 'flex-row-reverse' : ''}`}>
                          {/* Avatar */}
                          {!isMe && (
                            <div className="flex-shrink-0 mb-1">
                              {msg.photoURL ? (
                                <img src={msg.photoURL} alt={msg.name} className="w-7 h-7 rounded-full" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-slate-400 flex items-center justify-center text-white text-xs font-medium">
                                  {msg.name?.charAt(0) || '?'}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Message bubble */}
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            {!isMe && (
                              <span className="text-[10px] text-slate-500 ml-1 mb-0.5">
                                {msg.name?.split(' ')[0] || 'Usuario'}
                              </span>
                            )}
                            <div
                              className={`
                                px-4 py-2 rounded-2xl text-sm leading-relaxed
                                ${isMe
                                  ? 'bg-indigo-600 text-white rounded-br-md'
                                  : 'bg-white text-slate-800 rounded-bl-md shadow-sm'
                                }
                              `}
                            >
                              {msg.text}
                            </div>
                            <span className="text-[10px] text-slate-400 mx-1 mt-0.5">
                              {isMe ? 'Tú' : ''} {timeStr && `· ${timeStr}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Input Area - iOS style */}
            <div className="bg-slate-200/80 backdrop-blur-lg px-3 py-2 border-t border-slate-300 sm:rounded-b-2xl safe-area-bottom">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white rounded-full border border-slate-300 flex items-center min-h-[44px]">
                  <input
                    type="text"
                    className="flex-1 px-4 py-2.5 bg-transparent outline-none text-base"
                    placeholder="Escribe un mensaje..."
                    value={generalChatModal.message}
                    onChange={(e) => setGeneralChatModal({ ...generalChatModal, message: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        saveGeneralMessage();
                      }
                    }}
                    autoComplete="off"
                    autoCorrect="off"
                  />
                </div>
                <button
                  onClick={saveGeneralMessage}
                  disabled={!generalChatModal.message.trim()}
                  className={`
                    w-11 h-11 rounded-full flex items-center justify-center transition flex-shrink-0
                    ${generalChatModal.message.trim()
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800'
                      : 'bg-slate-300 text-slate-400 cursor-not-allowed'
                    }
                  `}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {createGroupModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Crear nuevo grupo</h3>
              <button onClick={() => setCreateGroupModal({ open: false, name: '', description: '', emails: '' })} className="p-1 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Nombre del grupo (opcional)</label>
                <input
                  type="text"
                  className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ej: Reunión de amigos"
                  value={createGroupModal.name}
                  onChange={(e) => setCreateGroupModal({ ...createGroupModal, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Descripción (opcional)</label>
                <textarea
                  className="w-full p-3 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Ej: Para planificar nuestra salida de fin de semana"
                  value={createGroupModal.description}
                  onChange={(e) => setCreateGroupModal({ ...createGroupModal, description: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Invitar por email (opcional)
                </label>
                <textarea
                  className="w-full p-3 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="email1@gmail.com, email2@gmail.com"
                  value={createGroupModal.emails}
                  onChange={(e) => setCreateGroupModal({ ...createGroupModal, emails: e.target.value })}
                />
                <p className="text-xs text-slate-400 mt-1">Se abrirá Gmail para enviar las invitaciones</p>
              </div>
            </div>

            <button
              onClick={createGroup}
              className="w-full mt-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" /> Crear grupo
            </button>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {editGroupModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Editar grupo</h3>
              <button onClick={() => setEditGroupModal({ open: false, name: '', description: '' })} className="p-1 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Nombre del grupo</label>
                <input
                  type="text"
                  className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ej: Reunión de amigos"
                  value={editGroupModal.name}
                  onChange={(e) => setEditGroupModal({ ...editGroupModal, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Descripción</label>
                <textarea
                  className="w-full p-3 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Ej: Para planificar nuestra salida"
                  value={editGroupModal.description}
                  onChange={(e) => setEditGroupModal({ ...editGroupModal, description: e.target.value })}
                />
              </div>
            </div>

            <button
              onClick={updateGroupInfo}
              className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {inviteModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Invitar por email</h3>
              <button onClick={() => setInviteModal({ open: false, emails: '' })} className="p-1 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-indigo-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-indigo-600 font-medium mb-1">Código del grupo</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-mono font-bold text-indigo-700">{groupId}</span>
                <button onClick={copyCode} className="p-2 bg-indigo-100 rounded-lg hover:bg-indigo-200 transition">
                  <Copy className="w-4 h-4 text-indigo-600" />
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Emails de tus amigos</label>
              <textarea
                className="w-full p-3 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={3}
                placeholder="email1@gmail.com, email2@gmail.com"
                value={inviteModal.emails}
                onChange={(e) => setInviteModal({ ...inviteModal, emails: e.target.value })}
              />
              <p className="text-xs text-slate-400 mt-1">Separa los emails con comas</p>
            </div>

            <button
              onClick={sendInvitesFromModal}
              disabled={!inviteModal.emails.trim()}
              className={`w-full mt-4 py-3 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
                inviteModal.emails.trim()
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" /> Abrir Gmail para enviar
            </button>
          </div>
        </div>
      )}

      {/* Block Day Modal */}
      {blockDayModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-slate-100 p-2 rounded-full">
                  <Ban className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Bloquear día</h3>
                  <p className="text-xs text-slate-500">
                    {new Date(blockDayModal.dateStr).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
              </div>
              <button onClick={() => setBlockDayModal({ open: false, dateStr: '', reason: '' })} className="p-1 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <p className="text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Esto bloqueará el día en <strong>todos tus grupos</strong> y removerá tu disponibilidad.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Razón (solo visible para ti)</label>
              <input
                type="text"
                className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="Ej: Cita médica, viaje, etc."
                value={blockDayModal.reason}
                onChange={(e) => setBlockDayModal({ ...blockDayModal, reason: e.target.value })}
              />
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setBlockDayModal({ open: false, dateStr: '', reason: '' })}
                className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={blockDay}
                className="flex-1 py-3 bg-slate-700 text-white rounded-xl font-medium hover:bg-slate-800 transition flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" /> Bloquear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Plan Modal */}
      {confirmPlanModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-green-100 p-2 rounded-full">
                  <CheckCheck className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Confirmar plan</h3>
                  <p className="text-xs text-slate-500">
                    {new Date(confirmPlanModal.dateStr).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
              </div>
              <button onClick={() => setConfirmPlanModal({ open: false, dateStr: '' })} className="p-1 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-green-800 mb-2">
                <CheckCircle className="w-4 h-4 inline mr-1" />
                ¡Todos están disponibles este día!
              </p>
              <p className="text-xs text-green-700">
                Al confirmar, tu disponibilidad será <strong>removida de otros grupos</strong> para este día.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmPlanModal({ open: false, dateStr: '' })}
                className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmPlan}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition flex items-center justify-center gap-2"
              >
                <CheckCheck className="w-4 h-4" /> Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Modal */}
      {conflictModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-amber-100 p-2 rounded-full">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="font-bold text-lg">Conflicto de fecha</h3>
              </div>
              <button onClick={() => setConflictModal({ open: false, dateStr: '', conflicts: [], action: null })} className="p-1 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              {conflictModal.conflicts.map((conflict, idx) => (
                <div key={idx} className="text-sm text-amber-800 mb-2 last:mb-0">
                  {conflict.type === 'confirmed' && (
                    <p>
                      <CheckCheck className="w-4 h-4 inline mr-1" />
                      Ya tienes un <strong>plan confirmado</strong> en "{conflict.groupName}" para este día.
                    </p>
                  )}
                  {conflict.type === 'available' && (
                    <p>
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Ya tienes <strong>disponibilidad marcada</strong> en "{conflict.groupName}" para este día.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <p className="text-sm text-slate-600 mb-4">
              ¿Deseas continuar de todos modos?
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setConflictModal({ open: false, dateStr: '', conflicts: [], action: null })}
                className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const dateStr = conflictModal.dateStr;
                  setConflictModal({ open: false, dateStr: '', conflicts: [], action: null });
                  toggleDateAvailability(dateStr, true); // Skip conflict check
                }}
                className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete/Leave Group Modal */}
      {deleteGroupModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-red-100 p-2 rounded-full">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="font-bold text-lg">Salir del grupo</h3>
              </div>
              <button onClick={() => setDeleteGroupModal({ open: false, groupId: '', groupName: '' })} className="p-1 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-2">
              ¿Estás seguro que deseas salir del grupo <strong>"{deleteGroupModal.groupName}"</strong>?
            </p>
            <p className="text-xs text-slate-400 mb-4">
              Tu disponibilidad y votos serán eliminados del grupo. Puedes volver a unirte con el código.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setDeleteGroupModal({ open: false, groupId: '', groupName: '' })}
                className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => archiveGroup(deleteGroupModal.groupId, deleteGroupModal.groupName)}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Salir
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 mt-6 pb-32">

        {/* VIEW: LOGIN */}
        {view === 'login' && (
          <div className="space-y-4">
            {/* Hero Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center">
              <div className="bg-gradient-to-br from-indigo-500 to-blue-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Calendar className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">AgendaGrupal</h1>
              <p className="text-xs text-indigo-500 uppercase tracking-widest font-semibold mb-3">reconect</p>
              <p className="text-slate-600 text-sm leading-relaxed">
                La forma más fácil de encontrar el día perfecto para reunirte con tus amigos, familia o equipo de trabajo.
              </p>
            </div>

            {/* Features Section */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="font-bold text-slate-800 mb-4 text-center">¿Qué puedes hacer?</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-green-100 p-2 rounded-xl shrink-0">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">Crea grupos</p>
                    <p className="text-xs text-slate-500">Invita a amigos, familia o colegas con un simple código</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 p-2 rounded-xl shrink-0">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">Marca tu disponibilidad</p>
                    <p className="text-xs text-slate-500">Indica qué días puedes y cuáles no en un calendario visual</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-amber-100 p-2 rounded-xl shrink-0">
                    <Star className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">Encuentra el día ideal</p>
                    <p className="text-xs text-slate-500">Visualiza cuándo todos pueden reunirse con colores intuitivos</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 p-2 rounded-xl shrink-0">
                    <MessageCircle className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">Chat integrado</p>
                    <p className="text-xs text-slate-500">Conversa con tu grupo y recibe notificaciones de nuevos mensajes</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips Section */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-2xl border border-indigo-100">
              <h2 className="font-bold text-indigo-800 mb-3 text-sm flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Mejor experiencia en tu celular
              </h2>
              <div className="space-y-2 text-xs text-indigo-700">
                <p className="flex items-start gap-2">
                  <Download className="w-4 h-4 shrink-0 mt-0.5" />
                  <span><strong>Instala la app</strong> en tu pantalla de inicio para acceso rápido como cualquier aplicación</span>
                </p>
                <p className="flex items-start gap-2">
                  <Bell className="w-4 h-4 shrink-0 mt-0.5" />
                  <span><strong>Activa notificaciones</strong> para enterarte cuando alguien escriba en el chat del grupo</span>
                </p>
              </div>
            </div>

            {/* Login Button */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <button
                onClick={handleGoogleLogin}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-semibold flex items-center justify-center gap-3 hover:from-indigo-700 hover:to-blue-700 transition shadow-lg shadow-indigo-200"
              >
                <Chrome className="w-5 h-5" />
                Comenzar con Google
              </button>
              <p className="text-xs text-slate-400 mt-3 text-center">
                Usamos tu cuenta de Google para identificarte de forma segura
              </p>
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-slate-400 pb-4">
              Gratis y sin anuncios
            </p>
          </div>
        )}

        {/* VIEW: JOIN/CREATE */}
        {view === 'join' && (
          <div className="space-y-3">
            {/* Bienvenida y guía inicial */}
            <div className="text-center mb-2">
              <h2 className="text-xl font-bold text-slate-800">¡Hola, {user?.displayName?.split(' ')[0]}!</h2>
              <p className="text-sm text-slate-500">Coordina fechas con tus amigos fácilmente</p>
            </div>

            {/* Guía rápida - siempre visible */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-2">
              <h3 className="font-semibold text-indigo-800 text-sm mb-2">¿Cómo funciona?</h3>
              <ol className="text-xs text-indigo-700 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="bg-indigo-200 text-indigo-800 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">1</span>
                  <span><strong>Crea un grupo</strong> o únete con un código que te compartan</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-indigo-200 text-indigo-800 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">2</span>
                  <span><strong>Marca los días</strong> en que estás disponible</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-indigo-200 text-indigo-800 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">3</span>
                  <span><strong>Encuentra el día perfecto</strong> cuando todos coincidan</span>
                </li>
              </ol>
            </div>

            {/* ========== SECCIÓN 1: CREAR O UNIRSE A GRUPO ========== */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <button
                onClick={() => setSectionExpanded(prev => ({ ...prev, newGroup: !prev.newGroup }))}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-xl">
                    <Plus className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-slate-800">Crear o unirse a un grupo</h3>
                    <p className="text-xs text-slate-500">Empieza aquí para coordinar fechas</p>
                  </div>
                </div>
                {sectionExpanded.newGroup ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>

              {sectionExpanded.newGroup && (
                <div className="border-t border-slate-100 p-4 space-y-4">
                  {/* Crear nuevo grupo */}
                  <div>
                    <button
                      onClick={openCreateGroupModal}
                      className="w-full p-4 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl flex items-center justify-center gap-3 hover:from-indigo-600 hover:to-indigo-700 transition shadow-md"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="font-semibold">Crear nuevo grupo</span>
                    </button>
                    <p className="text-[11px] text-slate-400 text-center mt-2">
                      Crea un grupo y comparte el código con tus amigos
                    </p>
                  </div>

                  {/* Separador */}
                  <div className="relative flex items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-3 text-xs text-slate-400">o</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>

                  {/* Unirse con código */}
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1.5 block">Unirse con código</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ej: X7Y2Z"
                        className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none uppercase font-mono text-slate-700 focus:border-indigo-300 transition"
                        value={groupIdInput}
                        onChange={(e) => setGroupIdInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && joinGroup(groupIdInput)}
                      />
                      <button
                        onClick={() => joinGroup(groupIdInput)}
                        disabled={!groupIdInput.trim()}
                        className={`px-5 rounded-xl font-medium transition ${groupIdInput.trim() ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                      >
                        Unirse
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Pide el código a quien creó el grupo
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ========== SECCIÓN 2: MIS GRUPOS ========== */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <button
                onClick={() => setSectionExpanded(prev => ({ ...prev, groups: !prev.groups }))}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded-xl">
                    <Users className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-slate-800">Mis grupos</h3>
                    <p className="text-xs text-slate-500">
                      {userGroups.length === 0 ? 'Aún no tienes grupos' : `${userGroups.length} grupo${userGroups.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
                {sectionExpanded.groups ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>

              {sectionExpanded.groups && (
                <div className="border-t border-slate-100">
                  {/* Barra de búsqueda si hay grupos */}
                  {userGroups.length > 0 && (
                    <div className="p-3 bg-slate-50">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar grupo..."
                          value={groupSearch}
                          onChange={(e) => setGroupSearch(e.target.value)}
                          className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-300 transition"
                        />
                        {groupSearch && (
                          <button onClick={() => setGroupSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Lista de grupos */}
                  <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {userGroups.length === 0 ? (
                      <div className="p-6 text-center">
                        <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 mb-1">No tienes grupos todavía</p>
                        <p className="text-xs text-slate-400">Crea uno nuevo o únete con un código</p>
                      </div>
                    ) : (
                      (() => {
                        const filteredGroups = userGroups.filter(group => {
                          if (!groupSearch) return true;
                          const search = groupSearch.toLowerCase();
                          return (group.name || '').toLowerCase().includes(search) || group.id.toLowerCase().includes(search);
                        });

                        if (filteredGroups.length === 0) {
                          return (
                            <div className="p-4 text-center text-slate-400">
                              <p className="text-sm">No se encontraron grupos</p>
                            </div>
                          );
                        }

                        return filteredGroups.map((group) => {
                          const unreadCount = getTotalUnreadForGroup(group);
                          return (
                            <div key={group.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 transition">
                              <button
                                onClick={() => { setGroupId(group.id); setView('calendar'); }}
                                className="flex-1 flex items-center gap-3 text-left min-w-0"
                              >
                                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white font-bold text-sm">{(group.name || group.id).charAt(0).toUpperCase()}</span>
                                  {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-bold">
                                      {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-slate-800 truncate text-sm">{group.name || `Grupo ${group.id}`}</h4>
                                  <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <span className="font-mono">{group.id}</span>
                                    <span>•</span>
                                    <span>{group.memberCount} miembro{group.memberCount !== 1 ? 's' : ''}</span>
                                    {unreadCount > 0 && (
                                      <>
                                        <span>•</span>
                                        <span className="text-red-500 font-medium flex items-center gap-1">
                                          <MessageCircle className="w-3 h-3" />
                                          {unreadCount} nuevo{unreadCount !== 1 ? 's' : ''}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteGroupModal({ open: true, groupId: group.id, groupName: group.name || `Grupo ${group.id}` }); }}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                title="Salir del grupo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ========== SECCIÓN 3: MI CALENDARIO PERSONAL ========== */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <button
                onClick={() => setSectionExpanded(prev => ({ ...prev, calendar: !prev.calendar }))}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 p-2 rounded-xl">
                    <CalendarX className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-slate-800">Mi calendario personal</h3>
                    <p className="text-xs text-slate-500">Bloquea días en todos tus grupos</p>
                  </div>
                </div>
                {sectionExpanded.calendar ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>

              {sectionExpanded.calendar && (
                <div className="border-t border-slate-100 p-4">
                  {/* Instrucciones del calendario personal */}
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4">
                    <h4 className="text-xs font-semibold text-amber-800 mb-2">¿Para qué sirve?</h4>
                    <ul className="text-[11px] text-amber-700 space-y-1">
                      <li className="flex items-start gap-2">
                        <Ban className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span><strong>Bloquea días</strong> que no estás disponible (vacaciones, compromisos, etc.)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCheck className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span><strong>Días verdes</strong> = tienes un plan confirmado en algún grupo</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Users className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>Los cambios se reflejan <strong>automáticamente</strong> en todos tus grupos</span>
                      </li>
                    </ul>
                    <p className="text-[10px] text-amber-600 mt-2 italic">
                      Toca cualquier día disponible para bloquearlo
                    </p>
                  </div>

              {/* Navegación de meses */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => {
                    setPersonalCalendarMonth(prev => {
                      const newMonth = prev.month - 1;
                      if (newMonth < 0) {
                        return { year: prev.year - 1, month: 11 };
                      }
                      return { ...prev, month: newMonth };
                    });
                  }}
                  className="p-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <span className="text-sm font-semibold text-slate-700 capitalize">
                  {new Date(personalCalendarMonth.year, personalCalendarMonth.month).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => {
                    setPersonalCalendarMonth(prev => {
                      const newMonth = prev.month + 1;
                      if (newMonth > 11) {
                        return { year: prev.year + 1, month: 0 };
                      }
                      return { ...prev, month: newMonth };
                    });
                  }}
                  className="p-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              {/* Mini calendario del mes */}
              <div className="grid grid-cols-7 gap-1 mb-3">
                {/* Headers de días */}
                {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>
                ))}

                {/* Días del calendario */}
                {(() => {
                  const days = [];
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  // Primer día del mes seleccionado
                  const firstDayOfMonth = new Date(personalCalendarMonth.year, personalCalendarMonth.month, 1);
                  // Último día del mes
                  const lastDayOfMonth = new Date(personalCalendarMonth.year, personalCalendarMonth.month + 1, 0);

                  // Encontrar el lunes de la primera semana del mes
                  const startOfCalendar = new Date(firstDayOfMonth);
                  const dayOfWeek = firstDayOfMonth.getDay();
                  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                  startOfCalendar.setDate(firstDayOfMonth.getDate() + diff);

                  // Generar 42 días (6 semanas) para cubrir cualquier mes
                  for (let i = 0; i < 42; i++) {
                    const date = new Date(startOfCalendar);
                    date.setDate(startOfCalendar.getDate() + i);
                    const dateStr = date.toISOString().split('T')[0];

                    const isBlocked = userData?.blockedDays?.[dateStr];
                    const confirmedPlan = userData?.confirmedPlans?.[dateStr];
                    const isPast = date < today;
                    const isToday = date.getTime() === today.getTime();
                    const isCurrentMonth = date.getMonth() === personalCalendarMonth.month && date.getFullYear() === personalCalendarMonth.year;

                    // Si ya pasamos el último día del mes y estamos en una nueva semana, no mostrar más filas
                    if (i >= 35 && date > lastDayOfMonth && date.getDay() === 1) {
                      break;
                    }

                    let bgColor = 'bg-slate-50 hover:bg-slate-100';
                    let textColor = 'text-slate-600';
                    let icon = null;

                    // Días fuera del mes actual
                    if (!isCurrentMonth) {
                      bgColor = 'bg-transparent';
                      textColor = 'text-slate-300';
                    } else if (isPast) {
                      bgColor = 'bg-slate-100';
                      textColor = 'text-slate-300';
                    } else if (isBlocked) {
                      bgColor = 'bg-red-100';
                      textColor = 'text-red-600';
                      icon = <Ban className="w-2.5 h-2.5" />;
                    } else if (confirmedPlan) {
                      bgColor = 'bg-green-100';
                      textColor = 'text-green-600';
                      icon = <CheckCheck className="w-2.5 h-2.5" />;
                    }

                    if (isToday && isCurrentMonth) {
                      bgColor = isBlocked ? 'bg-red-200' : confirmedPlan ? 'bg-green-200' : 'bg-indigo-100';
                    }

                    days.push(
                      <button
                        key={dateStr}
                        onClick={() => isCurrentMonth && !isPast && openBlockDayModal(dateStr)}
                        disabled={!isCurrentMonth || isPast}
                        className={`
                          relative aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition
                          ${bgColor} ${textColor}
                          ${!isCurrentMonth || isPast ? 'cursor-not-allowed' : 'cursor-pointer'}
                          ${isToday && isCurrentMonth ? 'ring-2 ring-indigo-400' : ''}
                        `}
                        title={
                          !isCurrentMonth ? '' :
                          isBlocked ? `Bloqueado: ${userData?.blockedDays?.[dateStr]?.reason || 'Sin razón'}` :
                          confirmedPlan ? `Plan: ${confirmedPlan.groupName}` :
                          'Clic para bloquear'
                        }
                      >
                        <span className="text-[11px] font-bold">{date.getDate()}</span>
                        {icon && isCurrentMonth && <span className="absolute bottom-0.5">{icon}</span>}
                      </button>
                    );
                  }
                  return days;
                })()}
              </div>

              {/* Leyenda */}
              <div className="flex flex-wrap gap-3 text-[10px] text-slate-500 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>
                  <span>Bloqueado</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div>
                  <span>Plan confirmado</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-slate-50 border border-slate-200"></div>
                  <span>Disponible</span>
                </div>
              </div>

              {/* Resumen de días bloqueados y confirmados */}
              {(Object.keys(userData?.blockedDays || {}).length > 0 || Object.keys(userData?.confirmedPlans || {}).length > 0) && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  {/* Planes confirmados */}
                  {Object.entries(userData?.confirmedPlans || {}).map(([dateStr, plan]) => {
                    // Parsear fecha correctamente para evitar problemas de timezone
                    const [year, month, day] = dateStr.split('-').map(Number);
                    const date = new Date(year, month - 1, day);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (date < today) return null;
                    return (
                      <div key={dateStr} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <CheckCheck className="w-4 h-4 text-green-600" />
                          <div>
                            <span className="text-xs font-medium text-green-800">
                              {date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>
                            <span className="text-[10px] text-green-600 block">{plan.groupName}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setGroupId(plan.groupId);
                            setView('calendar');
                          }}
                          className="text-[10px] text-green-600 hover:text-green-800 font-medium"
                        >
                          Ver grupo →
                        </button>
                      </div>
                    );
                  })}

                  {/* Días bloqueados */}
                  {Object.entries(userData?.blockedDays || {}).map(([dateStr, blockInfo]) => {
                    // Parsear fecha correctamente para evitar problemas de timezone
                    const [year, month, day] = dateStr.split('-').map(Number);
                    const date = new Date(year, month - 1, day);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (date < today) return null;
                    return (
                      <div key={dateStr} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Ban className="w-4 h-4 text-red-500" />
                          <div>
                            <span className="text-xs font-medium text-red-800">
                              {date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>
                            {blockInfo.reason && (
                              <span className="text-[10px] text-red-600 block">{blockInfo.reason}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => unblockDay(dateStr)}
                          className="text-[10px] text-red-500 hover:text-red-700 font-medium"
                        >
                          Desbloquear
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW: CALENDAR */}
        {view === 'calendar' && groupData && (
          <>
            {/* Info Panel */}
            <div className="bg-indigo-600 rounded-2xl p-4 text-white shadow-lg shadow-indigo-200 mb-4">
              {/* Nombre y descripción del grupo */}
              {(groupData.name || groupData.description) && (
                <div className="mb-3 pb-3 border-b border-indigo-500/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {groupData.name && (
                        <h2 className="text-xl font-bold text-white">{groupData.name}</h2>
                      )}
                      {groupData.description && (
                        <p className="text-sm text-indigo-200 mt-1">{groupData.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setEditGroupModal({ open: true, name: groupData.name || '', description: groupData.description || '' })}
                      className="p-2 bg-indigo-500/50 rounded-lg hover:bg-indigo-500/70 transition"
                      title="Editar grupo"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Código del grupo */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">CÓDIGO DE GRUPO</h3>
                  <p className="text-3xl font-mono font-bold tracking-widest">{groupId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyCode}
                    className="p-2 bg-indigo-500/50 rounded-lg hover:bg-indigo-500/70 transition"
                    title="Copiar código"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                  <div className="bg-indigo-500/50 p-2 rounded-lg text-center">
                    <span className="block text-xs text-indigo-200">Miembros</span>
                    <span className="font-bold text-lg">{groupData.members.length}</span>
                  </div>
                </div>
              </div>

              {/* Botones de compartir y chat */}
              <div className="flex gap-2">
                <button
                  onClick={copyFullInvite}
                  className="flex-1 py-2 bg-indigo-500/50 rounded-lg text-sm font-medium hover:bg-indigo-500/70 transition flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" /> Invitar
                </button>
                <button
                  onClick={shareGroup}
                  className="flex-1 py-2 bg-indigo-500/50 rounded-lg text-sm font-medium hover:bg-indigo-500/70 transition flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" /> Compartir
                </button>
                <button
                  onClick={() => {
                    setGeneralChatModal({ open: true, message: '' });
                    // Marcar mensajes del chat general como leídos
                    const messageCount = groupData?.generalChat?.length || 0;
                    if (messageCount > 0) {
                      markGeneralChatAsRead(messageCount);
                    }
                  }}
                  className="flex-1 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition flex items-center justify-center gap-2 relative"
                >
                  <MessageCircle className="w-4 h-4" /> Chat
                  {getUnreadGeneralChatCount() > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                      {getUnreadGeneralChatCount() > 9 ? '9+' : getUnreadGeneralChatCount()}
                    </span>
                  )}
                </button>
              </div>

              {/* Si no tiene nombre, mostrar opción de agregar */}
              {!groupData.name && (
                <button
                  onClick={() => setEditGroupModal({ open: true, name: '', description: '' })}
                  className="w-full mt-3 py-2 border border-dashed border-indigo-400/50 rounded-lg text-sm text-indigo-200 hover:bg-indigo-500/30 transition flex items-center justify-center gap-2"
                >
                  <Edit3 className="w-4 h-4" /> Agregar nombre y descripción
                </button>
              )}
            </div>

            {/* Members */}
            <div className="mb-4 overflow-x-auto pb-2">
              <div className="flex gap-2">
                {groupData.members.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm text-sm whitespace-nowrap">
                    {m.photoURL ? (
                      <img src={m.photoURL} alt={m.name} className="w-5 h-5 rounded-full" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-indigo-400 flex items-center justify-center text-white text-xs">
                        {m.name?.charAt(0)}
                      </div>
                    )}
                    {m.name?.split(' ')[0]} {m.uid === user.uid && '(Tú)'}
                  </div>
                ))}
              </div>
            </div>

            {/* Mis planes confirmados en este grupo */}
            {(() => {
              // Filtrar planes confirmados que pertenecen a este grupo
              const myPlansInThisGroup = Object.entries(userData?.confirmedPlans || {})
                .filter(([dateStr, plan]) => plan.groupId === groupId)
                .map(([dateStr, plan]) => {
                  const [year, month, day] = dateStr.split('-').map(Number);
                  const date = new Date(year, month - 1, day);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return { dateStr, plan, date, isPast: date < today };
                })
                .filter(item => !item.isPast)
                .sort((a, b) => a.date - b.date);

              if (myPlansInThisGroup.length === 0) return null;

              return (
                <div className="mb-4 bg-green-50 border border-green-100 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCheck className="w-4 h-4 text-green-600" />
                    <h4 className="text-sm font-semibold text-green-800">Mis planes confirmados</h4>
                    <span className="bg-green-200 text-green-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {myPlansInThisGroup.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {myPlansInThisGroup.map(({ dateStr, date }) => (
                      <div
                        key={dateStr}
                        className="flex items-center gap-1.5 bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-medium"
                      >
                        <Calendar className="w-3 h-3" />
                        {date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Panel de Instrucciones Colapsable */}
            <div className="mb-4">
              <button
                onClick={() => setShowGroupInstructions(!showGroupInstructions)}
                className="w-full flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-blue-700 hover:bg-blue-100 transition"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">¿Cómo usar este calendario?</span>
                </div>
                {showGroupInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showGroupInstructions && (
                <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <div className="space-y-3">
                    {/* Paso 1: Marcar disponibilidad */}
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                      <div>
                        <p className="text-sm font-medium text-blue-800">Marca tus días disponibles</p>
                        <p className="text-xs text-blue-600">Toca cualquier día para indicar que puedes ese día. El color cambiará según cuántos miembros estén disponibles.</p>
                      </div>
                    </div>

                    {/* Paso 2: Colores */}
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                      <div>
                        <p className="text-sm font-medium text-blue-800">Identifica los mejores días</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span> 100% disponible
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-yellow-400"></span> ≥50% disponible
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-red-400"></span> &lt;50% disponible
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Paso 3: Botones */}
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                      <div>
                        <p className="text-sm font-medium text-blue-800">Usa las herramientas de cada día</p>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div className="flex items-center gap-1.5 text-[11px] text-blue-700">
                            <Star className="w-3 h-3 text-yellow-500" /> Marcar favorito
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-blue-700">
                            <MessageCircle className="w-3 h-3 text-indigo-500" /> Agregar nota
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-blue-700">
                            <Ban className="w-3 h-3 text-red-500" /> Bloquear día
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-blue-700">
                            <CheckCheck className="w-3 h-3 text-green-500" /> Confirmar plan
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Nota adicional */}
                    <div className="pt-2 border-t border-blue-200">
                      <p className="text-[11px] text-blue-600 flex items-start gap-1.5">
                        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span><strong>Tip:</strong> Cuando todos estén disponibles (verde), usa "Confirmar plan" para bloquear ese día automáticamente en tus otros grupos.</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* View Mode Selector */}
            <div className="mb-4 flex items-center justify-between sticky top-16 bg-slate-50 z-10 -mx-4 px-4 py-2">
              <div className="flex gap-1 bg-white rounded-lg p-1 border border-slate-200">
                <button
                  onClick={() => setCalendarViewMode('list')}
                  className={`p-2 rounded-md transition ${calendarViewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                  title="Vista lista"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCalendarViewMode('grid')}
                  className={`p-2 rounded-md transition ${calendarViewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                  title="Vista grid"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCalendarViewMode('calendar')}
                  className={`p-2 rounded-md transition ${calendarViewMode === 'calendar' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                  title="Vista calendario"
                >
                  <CalendarDays className="w-4 h-4" />
                </button>
              </div>

              {/* Month Navigation for list/grid views */}
              {calendarViewMode !== 'calendar' && (
                <div className="flex gap-1 overflow-x-auto">
                  {monthsNav.slice(0, 6).map((month) => (
                    <button
                      key={month.key}
                      onClick={() => scrollToMonth(month.key)}
                      className="px-2 py-1 bg-white border border-slate-200 rounded-full text-xs whitespace-nowrap hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition capitalize"
                    >
                      {month.name.substring(0, 3)}
                    </button>
                  ))}
                </div>
              )}

              {/* Month Navigation for calendar view */}
              {calendarViewMode === 'calendar' && (
                <div className="flex items-center gap-2">
                  <button onClick={() => navigateMonth(-1)} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-medium capitalize min-w-[120px] text-center">{currentMonthName}</span>
                  <button onClick={() => navigateMonth(1)} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="mb-4 flex gap-2 flex-wrap">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1 ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <Filter className="w-3 h-3" /> Todos
              </button>
              <button
                onClick={() => setFilter('available')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1 ${filter === 'available' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <Check className="w-3 h-3" /> Mis días
              </button>
              <button
                onClick={() => setFilter('starred')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1 ${filter === 'starred' ? 'bg-yellow-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <Star className="w-3 h-3" /> Favoritos
              </button>
              <button
                onClick={() => setFilter('green')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === 'green' ? 'bg-green-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                100%
              </button>
              <button
                onClick={() => setFilter('yellow')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === 'yellow' ? 'bg-yellow-400 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                ≥50%
              </button>
              <button
                onClick={() => setFilter('red')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === 'red' ? 'bg-red-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                &lt;50%
              </button>
            </div>

            <h3 className="font-bold text-lg mb-4 text-slate-700">Selecciona tus días disponibles</h3>

            {/* ========== LIST VIEW ========== */}
            {calendarViewMode === 'list' && (
              <div className="grid grid-cols-1 gap-3">
                {filteredDays.map((day, idx) => {
                  const status = getDayStatus(day.dateStr);
                  const { colorClass, statusIcon, isUserAvailable, voteCount, totalMembers, isStarred, starCount, hasMyMessage, messageCount, isBlocked, blockReason, isConfirmed, statusType, unreadCount, confirmedUsers, confirmedCount } = status;
                  const isNewMonth = idx === 0 || filteredDays[idx - 1]?.monthKey !== day.monthKey;
                  const isConfirmedExpanded = expandedConfirmed === day.dateStr;

                  return (
                    <div key={day.dateStr}>
                      {isNewMonth && (
                        <div
                          ref={el => monthRefs.current[day.monthKey] = el}
                          className="text-lg font-bold text-slate-700 capitalize mb-3 mt-4 first:mt-0 flex items-center gap-2"
                        >
                          <Calendar className="w-5 h-5 text-indigo-500" />
                          {day.monthName} {day.year !== new Date().getFullYear() && day.year}
                        </div>
                      )}

                      <div
                        onClick={() => !isBlocked && toggleDateAvailability(day.dateStr)}
                        className={`
                          relative overflow-hidden transition-all duration-200
                          rounded-xl border-2 p-4
                          ${isBlocked ? 'border-slate-300 bg-slate-100 cursor-not-allowed' :
                            isConfirmed ? 'border-green-500 bg-green-50 cursor-pointer' :
                            isUserAvailable ? 'border-indigo-600 bg-indigo-50 cursor-pointer' :
                            'border-transparent bg-white shadow-sm hover:shadow-md cursor-pointer'}
                        `}
                      >
                        {/* Left indicator bar */}
                        {isBlocked && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-400"></div>
                        )}
                        {isConfirmed && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500"></div>
                        )}
                        {isUserAvailable && !isConfirmed && !isBlocked && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></div>
                        )}

                        {/* Header row: fecha y estado */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`
                              flex flex-col items-center justify-center w-11 h-11 rounded-lg relative flex-shrink-0
                              ${isBlocked ? 'bg-slate-300 text-slate-600' :
                                isConfirmed ? 'bg-green-500 text-white' :
                                isUserAvailable ? 'bg-indigo-600 text-white' :
                                'bg-slate-100 text-slate-500'}
                            `}>
                              {isBlocked && <Lock className="w-3 h-3 absolute -top-1 -right-1 text-slate-600" />}
                              {isConfirmed && <CheckCheck className="w-3 h-3 absolute -top-1 -right-1 text-green-600" />}
                              <span className="text-[9px] uppercase font-bold">{day.monthName.substring(0, 3)}</span>
                              <span className="text-base font-bold leading-none">{day.dayNum}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-700 capitalize text-sm">{day.dayName}</p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isBlocked && (
                                  <span className="text-[10px] text-slate-500 font-medium flex items-center gap-0.5">
                                    <Lock className="w-2.5 h-2.5" /> Bloqueado
                                  </span>
                                )}
                                {isConfirmed && (
                                  <span className="text-[10px] text-green-600 font-medium flex items-center gap-0.5">
                                    <CheckCheck className="w-2.5 h-2.5" /> Confirmado
                                  </span>
                                )}
                                {!isBlocked && !isConfirmed && isUserAvailable && (
                                  <span className="text-[10px] text-indigo-600 font-medium flex items-center gap-0.5">
                                    <Check className="w-2.5 h-2.5" /> Disponible
                                  </span>
                                )}
                                {starCount > 0 && (
                                  <span className="text-[10px] text-yellow-600 flex items-center gap-0.5">
                                    <Star className="w-2.5 h-2.5 fill-yellow-400" /> {starCount}
                                  </span>
                                )}
                                {messageCount > 0 && (
                                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                    <MessageCircle className="w-2.5 h-2.5" /> {messageCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Status badge */}
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold flex-shrink-0 ${colorClass}`}>
                            {statusIcon}
                            <span>{voteCount}/{totalMembers}</span>
                          </div>
                        </div>

                        {/* Action buttons row */}
                        <div className="flex items-center gap-1 flex-wrap">
                            {/* Block/Unblock button */}
                            {isBlocked ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); unblockDay(day.dateStr); }}
                                className="p-1.5 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition"
                                title="Desbloquear día"
                              >
                                <Lock className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={(e) => openBlockDayModal(day.dateStr, e)}
                                className="p-1.5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 transition"
                                title="Bloquear día"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}

                            {/* Confirm plan button - PROMINENT, only show on green days */}
                            {!isBlocked && statusType === 'green' && !isConfirmed && (
                              <button
                                onClick={(e) => openConfirmPlanModal(day.dateStr, e)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500 text-white hover:bg-green-600 transition shadow-sm font-medium text-[11px]"
                                title="Confirmar plan"
                              >
                                <CheckCheck className="w-3.5 h-3.5" />
                                <span>Confirmar</span>
                              </button>
                            )}

                            {/* Cancel confirmed plan */}
                            {isConfirmed && (
                              <button
                                onClick={(e) => { e.stopPropagation(); cancelConfirmedPlan(day.dateStr); }}
                                className="p-1.5 rounded-full bg-green-200 text-green-700 hover:bg-green-300 transition"
                                title="Cancelar mi confirmación"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}

                            {/* Confirmed users indicator */}
                            {confirmedCount > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setExpandedConfirmed(isConfirmedExpanded ? null : day.dateStr); }}
                                className="flex items-center gap-0.5 px-2 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition text-[11px] font-medium"
                                title="Ver quiénes confirmaron"
                              >
                                <UserCheck className="w-3 h-3" />
                                <span>{confirmedCount}</span>
                                {isConfirmedExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                              </button>
                            )}

                            <button
                              onClick={(e) => toggleStar(day.dateStr, e)}
                              className={`p-1.5 rounded-full transition ${isStarred ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-slate-400 hover:bg-yellow-50'}`}
                              title="Marcar como favorito"
                            >
                              <Star className={`w-4 h-4 ${isStarred ? 'fill-yellow-400' : ''}`} />
                            </button>

                            {/* Message button with unread badge */}
                            <button
                              onClick={(e) => openMessageModal(day.dateStr, e)}
                              className={`p-1.5 rounded-full transition relative ${hasMyMessage ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 hover:bg-indigo-50'}`}
                              title="Ver/Agregar nota"
                            >
                              <MessageCircle className={`w-4 h-4 ${hasMyMessage ? 'fill-indigo-200' : ''}`} />
                              {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                                  {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                              )}
                            </button>
                        </div>

                        {/* Expandable confirmed users panel */}
                        {isConfirmedExpanded && confirmedCount > 0 && (
                          <div className="mt-3 pt-3 border-t border-green-200">
                            <div className="flex items-center gap-2 mb-2 text-xs text-green-700 font-semibold">
                              <UserCheck className="w-4 h-4" />
                              <span>Confirmaron asistencia ({confirmedCount})</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {confirmedUsers.map((cu, i) => (
                                <div key={i} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
                                  {cu.photoURL ? (
                                    <img src={cu.photoURL} alt={cu.name} className="w-5 h-5 rounded-full" />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-green-300 flex items-center justify-center text-[10px] font-bold text-green-800">
                                      {cu.name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                  )}
                                  <span className="text-xs font-medium text-green-800">{cu.name}</span>
                                  {cu.uid === user?.uid && (
                                    <span className="text-[10px] text-green-600">(tú)</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ========== GRID VIEW (2 columns) ========== */}
            {calendarViewMode === 'grid' && (
              <div>
                {(() => {
                  let currentMonth = '';
                  return filteredDays.map((day, idx) => {
                    const { colorClass, isUserAvailable, voteCount, totalMembers, isStarred, starCount, hasMyMessage, messageCount, statusType } = getDayStatus(day.dateStr);
                    const isNewMonth = day.monthKey !== currentMonth;
                    if (isNewMonth) currentMonth = day.monthKey;

                    const statusBg = statusType === 'green' ? 'bg-green-500' : statusType === 'yellow' ? 'bg-yellow-400' : 'bg-red-400';

                    return (
                      <div key={day.dateStr}>
                        {isNewMonth && (
                          <div
                            ref={el => monthRefs.current[day.monthKey] = el}
                            className="text-lg font-bold text-slate-700 capitalize mb-3 mt-4 first:mt-0 flex items-center gap-2 col-span-2"
                          >
                            <Calendar className="w-5 h-5 text-indigo-500" />
                            {day.monthName} {day.year !== new Date().getFullYear() && day.year}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div
                            onClick={() => toggleDateAvailability(day.dateStr)}
                            className={`
                              cursor-pointer transition-all rounded-xl p-3
                              ${isUserAvailable ? 'bg-indigo-100 border-2 border-indigo-500' : 'bg-white border border-slate-100 shadow-sm hover:shadow-md'}
                            `}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${isUserAvailable ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                  {day.dayNum}
                                </span>
                                <div>
                                  <p className="text-xs font-medium text-slate-600 capitalize">{day.dayName.substring(0, 3)}</p>
                                </div>
                              </div>
                              <div className={`w-3 h-3 rounded-full ${statusBg}`}></div>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">{voteCount}/{totalMembers}</span>
                              <div className="flex items-center gap-1">
                                {isStarred && <Star className="w-3 h-3 text-yellow-500 fill-yellow-400" />}
                                {messageCount > 0 && <MessageCircle className="w-3 h-3 text-slate-400" />}
                              </div>
                            </div>

                            <div className="flex gap-1 mt-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleStar(day.dateStr, e); }}
                                className={`flex-1 py-1 rounded text-xs ${isStarred ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-50 text-slate-400'}`}
                              >
                                <Star className={`w-3 h-3 mx-auto ${isStarred ? 'fill-yellow-400' : ''}`} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); openMessageModal(day.dateStr, e); }}
                                className={`flex-1 py-1 rounded text-xs ${hasMyMessage ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}
                              >
                                <MessageCircle className="w-3 h-3 mx-auto" />
                              </button>
                            </div>
                          </div>

                          {/* Second column - next day if exists */}
                          {filteredDays[idx + 1] && (() => {
                            const nextDay = filteredDays[idx + 1];
                            if (nextDay.monthKey !== day.monthKey) return null;
                            const nextStatus = getDayStatus(nextDay.dateStr);
                            const nextStatusBg = nextStatus.statusType === 'green' ? 'bg-green-500' : nextStatus.statusType === 'yellow' ? 'bg-yellow-400' : 'bg-red-400';

                            return (
                              <div
                                onClick={() => toggleDateAvailability(nextDay.dateStr)}
                                className={`
                                  cursor-pointer transition-all rounded-xl p-3
                                  ${nextStatus.isUserAvailable ? 'bg-indigo-100 border-2 border-indigo-500' : 'bg-white border border-slate-100 shadow-sm hover:shadow-md'}
                                `}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${nextStatus.isUserAvailable ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                      {nextDay.dayNum}
                                    </span>
                                    <div>
                                      <p className="text-xs font-medium text-slate-600 capitalize">{nextDay.dayName.substring(0, 3)}</p>
                                    </div>
                                  </div>
                                  <div className={`w-3 h-3 rounded-full ${nextStatusBg}`}></div>
                                </div>

                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-slate-500">{nextStatus.voteCount}/{nextStatus.totalMembers}</span>
                                  <div className="flex items-center gap-1">
                                    {nextStatus.isStarred && <Star className="w-3 h-3 text-yellow-500 fill-yellow-400" />}
                                    {nextStatus.messageCount > 0 && <MessageCircle className="w-3 h-3 text-slate-400" />}
                                  </div>
                                </div>

                                <div className="flex gap-1 mt-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleStar(nextDay.dateStr, e); }}
                                    className={`flex-1 py-1 rounded text-xs ${nextStatus.isStarred ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-50 text-slate-400'}`}
                                  >
                                    <Star className={`w-3 h-3 mx-auto ${nextStatus.isStarred ? 'fill-yellow-400' : ''}`} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openMessageModal(nextDay.dateStr, e); }}
                                    className={`flex-1 py-1 rounded text-xs ${nextStatus.hasMyMessage ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}
                                  >
                                    <MessageCircle className="w-3 h-3 mx-auto" />
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  }).filter((_, idx) => idx % 2 === 0);
                })()}
              </div>
            )}

            {/* ========== CALENDAR VIEW (Traditional) ========== */}
            {calendarViewMode === 'calendar' && (
              <div>
                {/* Days of week header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                    <div key={d} className="text-center text-xs font-medium text-slate-400 py-2">{d}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {getCalendarGridDays.map((day, idx) => {
                    if (!day) {
                      return <div key={`empty-${idx}`} className="aspect-square"></div>;
                    }

                    const status = getDayStatus(day.dateStr);
                    const { isUserAvailable, voteCount, totalMembers, isStarred, statusType } = status;
                    const statusBg = statusType === 'green' ? 'bg-green-500' : statusType === 'yellow' ? 'bg-yellow-400' : 'bg-red-400';
                    const isExpanded = expandedDay === day.dateStr;

                    // Filter check
                    const passesFilter = filter === 'all' ||
                      (filter === 'available' && isUserAvailable) ||
                      (filter === 'starred' && isStarred) ||
                      (filter === 'green' && statusType === 'green') ||
                      (filter === 'yellow' && statusType === 'yellow') ||
                      (filter === 'red' && statusType === 'red');

                    if (!passesFilter && filter !== 'all') {
                      return (
                        <div
                          key={day.dateStr}
                          className="aspect-square bg-slate-50 rounded-lg flex items-center justify-center opacity-30"
                        >
                          <span className="text-xs text-slate-400">{day.dayNum}</span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={day.dateStr}
                        onClick={() => !day.isPast && setExpandedDay(isExpanded ? null : day.dateStr)}
                        className={`
                          aspect-square rounded-lg cursor-pointer transition-all relative
                          ${day.isPast ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105'}
                          ${isUserAvailable ? 'bg-indigo-100 border-2 border-indigo-500' : 'bg-white border border-slate-200'}
                          ${isExpanded ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}
                        `}
                      >
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
                          <span className={`text-sm font-bold ${isUserAvailable ? 'text-indigo-700' : 'text-slate-700'}`}>
                            {day.dayNum}
                          </span>
                          <div className={`w-2 h-2 rounded-full ${statusBg} mt-0.5`}></div>
                          {isStarred && (
                            <Star className="w-2.5 h-2.5 text-yellow-500 fill-yellow-400 absolute top-1 right-1" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Expanded day detail */}
                {expandedDay && (() => {
                  const day = getCalendarGridDays.find(d => d?.dateStr === expandedDay);
                  if (!day) return null;
                  const status = getDayStatus(day.dateStr);

                  return (
                    <div className="mt-4 bg-white rounded-xl border border-slate-200 p-4 shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-bold text-lg text-slate-800 capitalize">{day.dayName}</h4>
                          <p className="text-sm text-slate-500">{day.dayNum} de {day.monthName}</p>
                        </div>
                        <button onClick={() => setExpandedDay(null)} className="p-1 hover:bg-slate-100 rounded-full">
                          <X className="w-5 h-5 text-slate-400" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3 mb-4">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${status.colorClass}`}>
                          {status.statusIcon}
                          <span>{status.voteCount}/{status.totalMembers} disponibles</span>
                        </div>
                        {status.starCount > 0 && (
                          <span className="text-xs text-yellow-600 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-yellow-400" /> {status.starCount} favoritos
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleDateAvailability(day.dateStr)}
                          className={`flex-1 py-3 rounded-xl font-medium transition ${
                            status.isUserAvailable
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {status.isUserAvailable ? '✓ Disponible' : 'Marcar disponible'}
                        </button>
                        <button
                          onClick={(e) => toggleStar(day.dateStr, e)}
                          className={`p-3 rounded-xl transition ${status.isStarred ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-slate-400 hover:bg-yellow-50'}`}
                        >
                          <Star className={`w-5 h-5 ${status.isStarred ? 'fill-yellow-400' : ''}`} />
                        </button>
                        <button
                          onClick={(e) => openMessageModal(day.dateStr, e)}
                          className={`p-3 rounded-xl transition ${status.hasMyMessage ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 hover:bg-indigo-50'}`}
                        >
                          <MessageCircle className={`w-5 h-5 ${status.hasMyMessage ? 'fill-indigo-200' : ''}`} />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {filteredDays.length === 0 && calendarViewMode !== 'calendar' && (
              <div className="text-center py-12 text-slate-400">
                <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay días que coincidan con el filtro</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Legend */}
      {view === 'calendar' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-lg z-10">
          <div className="max-w-md mx-auto flex justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500"></div>100%</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-400"></div>≥50%</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-400"></div>&lt;50%</div>
            <div className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />Favorito</div>
          </div>
        </div>
      )}
    </div>
  );
}
