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
  arrayUnion
} from 'firebase/firestore';
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
  ChevronRight
} from 'lucide-react';

// --- Configuración de Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyBp7MyOW6BL9TDnvZolQyMbWUtKH_nmFAQ",
  authDomain: "planificador-grupal.firebaseapp.com",
  projectId: "planificador-grupal",
  storageBucket: "planificador-grupal.firebasestorage.app",
  messagingSenderId: "1014010017764",
  appId: "1:1014010017764:web:221462ca5685cb63df39f1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

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
  const [createGroupModal, setCreateGroupModal] = useState({ open: false, name: '', description: '', emails: '' });
  const [editGroupModal, setEditGroupModal] = useState({ open: false, name: '', description: '' });
  const [inviteModal, setInviteModal] = useState({ open: false, emails: '' });
  const [calendarViewMode, setCalendarViewMode] = useState('list'); // list, grid, calendar
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [expandedDay, setExpandedDay] = useState(null);
  const monthRefs = useRef({});

  // 1. Escuchar estado de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        setView('join');
        loadUserGroups(currentUser.uid);
      } else {
        setView('login');
        setUserGroups([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Cargar grupos del usuario
  const loadUserGroups = async (uid) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const groupIds = userData.groups || [];

        // Cargar info de cada grupo
        const groupsInfo = await Promise.all(
          groupIds.map(async (gId) => {
            try {
              const groupRef = doc(db, 'calendar_groups', gId);
              const groupSnap = await getDoc(groupRef);
              if (groupSnap.exists()) {
                const data = groupSnap.data();
                return {
                  id: gId,
                  name: data.name || '',
                  description: data.description || '',
                  memberCount: data.members?.length || 0,
                  members: data.members || []
                };
              }
              return null;
            } catch {
              return null;
            }
          })
        );

        setUserGroups(groupsInfo.filter(g => g !== null));
      }
    } catch (error) {
      console.error("Error cargando grupos:", error);
    }
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

  const toggleDateAvailability = async (dateStr) => {
    if (!user || !groupId || !groupData) return;

    const groupRef = doc(db, 'calendar_groups', groupId);
    const currentVotes = groupData.votes || {};
    const dateVotes = currentVotes[dateStr] || [];

    let newDateVotes;
    if (dateVotes.includes(user.uid)) {
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
    } catch (e) {
      console.error("Error al guardar mensaje", e);
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
    if (!groupData) return { colorClass: 'bg-slate-100 border-slate-200 text-slate-500', statusIcon: <XCircle className="w-4 h-4" />, isUserAvailable: false, voteCount: 0, totalMembers: 1, percentage: 0, isStarred: false, starCount: 0 };

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

    // Corregido: >= 50% es amarillo, 100% es verde
    let colorClass = 'bg-red-100 border-red-200 text-red-800';
    let statusIcon = <XCircle className="w-4 h-4" />;
    let statusType = 'red';

    if (percentage === 1 && voteCount > 0) {
      colorClass = 'bg-green-100 border-green-200 text-green-800';
      statusIcon = <CheckCircle className="w-4 h-4" />;
      statusType = 'green';
    } else if (percentage >= 0.5) {
      colorClass = 'bg-yellow-100 border-yellow-200 text-yellow-800';
      statusIcon = <Users className="w-4 h-4" />;
      statusType = 'yellow';
    }

    return { colorClass, statusIcon, isUserAvailable, voteCount, totalMembers, percentage, isStarred, starCount, hasMyMessage, messageCount, statusType };
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
      <div className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            <div>
              <span className="text-indigo-600 font-bold text-lg leading-none block">AgendaGrupal</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">reconect</span>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-2">
              {view === 'calendar' && (
                <>
                  <button onClick={openInviteModal} className="p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100 transition" title="Invitar por email">
                    <Mail className="w-5 h-5" />
                  </button>
                  <button onClick={shareGroup} className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition" title="Compartir grupo">
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button onClick={leaveGroup} className="p-2 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition" title="Salir del grupo">
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              )}
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-8 h-8 rounded-full border-2 border-indigo-200 cursor-pointer"
                  onClick={handleLogout}
                  title="Cerrar sesión"
                />
              ) : (
                <button onClick={handleLogout} className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition" title="Cerrar sesión">
                  <LogOut className="w-5 h-5" />
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
            <div className="bg-slate-200/80 backdrop-blur-lg px-3 py-2 border-t border-slate-300 sm:rounded-b-2xl">
              <div className="flex items-end gap-2">
                <div className="flex-1 bg-white rounded-full border border-slate-300 flex items-center">
                  <input
                    type="text"
                    className="flex-1 px-4 py-2 bg-transparent outline-none text-sm"
                    placeholder="Mensaje..."
                    value={messageModal.message}
                    onChange={(e) => setMessageModal({ ...messageModal, message: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        saveMessage();
                      }
                    }}
                  />
                </div>
                <button
                  onClick={saveMessage}
                  disabled={!messageModal.message.trim()}
                  className={`
                    w-9 h-9 rounded-full flex items-center justify-center transition
                    ${messageModal.message.trim()
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-slate-300 text-slate-400 cursor-not-allowed'
                    }
                  `}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 text-center mt-1">
                Presiona Enter para enviar
              </p>
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

      <div className="max-w-md mx-auto px-4 mt-6 pb-32">

        {/* VIEW: LOGIN */}
        {view === 'login' && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
            <Calendar className="w-16 h-16 text-indigo-600 mx-auto mb-2" />
            <h1 className="text-2xl font-bold">AgendaGrupal</h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">reconect</p>
            <p className="text-slate-500 mb-8">Encuentra el día perfecto para reunirte con tus amigos</p>

            <button
              onClick={handleGoogleLogin}
              className="w-full py-4 bg-white border-2 border-slate-200 rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-300 transition"
            >
              <Chrome className="w-5 h-5 text-blue-500" />
              Iniciar con Google
            </button>

            <p className="text-xs text-slate-400 mt-6">
              Al iniciar sesión, podrás crear grupos y coordinar fechas con tus amigos
            </p>
          </div>
        )}

        {/* VIEW: JOIN/CREATE */}
        {view === 'join' && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">¡Hola, {user?.displayName?.split(' ')[0]}!</h2>
              <p className="text-slate-500">Crea un grupo o únete a uno existente</p>
            </div>

            {/* Grupos anteriores */}
            {userGroups.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Tus grupos
                </h3>
                <div className="space-y-3">
                  {userGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => {
                        setGroupId(group.id);
                        setView('calendar');
                      }}
                      className="w-full p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition text-left group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Nombre del grupo o código como título */}
                          <h4 className="font-semibold text-slate-800 text-lg truncate">
                            {group.name || `Grupo ${group.id}`}
                          </h4>

                          {/* Descripción si existe */}
                          {group.description && (
                            <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{group.description}</p>
                          )}

                          {/* Código y miembros */}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="bg-indigo-100 text-indigo-600 font-mono font-bold px-2 py-1 rounded text-xs">
                              {group.id}
                            </span>
                            <span className="text-xs text-slate-400">
                              {group.memberCount} miembro{group.memberCount !== 1 ? 's' : ''}
                            </span>
                          </div>

                          {/* Avatares de miembros */}
                          <div className="flex -space-x-2 mt-2">
                            {group.members.slice(0, 5).map((m, idx) => (
                              m.photoURL ? (
                                <img key={idx} src={m.photoURL} alt={m.name} className="w-6 h-6 rounded-full border-2 border-white" />
                              ) : (
                                <div key={idx} className="w-6 h-6 rounded-full bg-indigo-400 border-2 border-white flex items-center justify-center text-white text-[10px] font-medium">
                                  {m.name?.charAt(0)}
                                </div>
                              )
                            ))}
                            {group.members.length > 5 && (
                              <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-slate-500 text-[10px] font-medium">
                                +{group.members.length - 5}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Icono de acceso */}
                        <div className="text-indigo-600 opacity-0 group-hover:opacity-100 transition mt-1">
                          <Calendar className="w-5 h-5" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={openCreateGroupModal}
              className="w-full py-5 bg-white border-2 border-dashed border-indigo-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition group"
            >
              <div className="bg-indigo-100 p-3 rounded-full group-hover:bg-indigo-200 transition">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-semibold">Crear Nuevo Grupo</span>
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-slate-400 text-sm">O ingresa un código</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex gap-2">
              <input
                type="text"
                placeholder="CÓDIGO (ej. X7Y2Z)"
                className="flex-1 p-3 bg-transparent outline-none uppercase font-mono text-slate-700"
                value={groupIdInput}
                onChange={(e) => setGroupIdInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && joinGroup(groupIdInput)}
              />
              <button
                onClick={() => joinGroup(groupIdInput)}
                className="bg-indigo-600 text-white px-6 rounded-xl font-medium hover:bg-indigo-700 transition"
              >
                Unirse
              </button>
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

              {/* Botones de compartir */}
              <div className="flex gap-2">
                <button
                  onClick={copyFullInvite}
                  className="flex-1 py-2 bg-indigo-500/50 rounded-lg text-sm font-medium hover:bg-indigo-500/70 transition flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" /> Copiar invitación
                </button>
                <button
                  onClick={shareGroup}
                  className="flex-1 py-2 bg-indigo-500/50 rounded-lg text-sm font-medium hover:bg-indigo-500/70 transition flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" /> Compartir
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
                  const { colorClass, statusIcon, isUserAvailable, voteCount, totalMembers, isStarred, starCount, hasMyMessage, messageCount } = getDayStatus(day.dateStr);
                  const isNewMonth = idx === 0 || filteredDays[idx - 1]?.monthKey !== day.monthKey;

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
                        onClick={() => toggleDateAvailability(day.dateStr)}
                        className={`
                          relative overflow-hidden cursor-pointer transition-all duration-200
                          rounded-xl border-2 p-4 flex items-center justify-between
                          ${isUserAvailable ? 'border-indigo-600 bg-indigo-50' : 'border-transparent bg-white shadow-sm hover:shadow-md'}
                        `}
                      >
                        {isUserAvailable && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></div>
                        )}

                        <div className="flex items-center gap-4">
                          <div className={`
                            flex flex-col items-center justify-center w-12 h-12 rounded-lg
                            ${isUserAvailable ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}
                          `}>
                            <span className="text-[10px] uppercase font-bold">{day.monthName.substring(0, 3)}</span>
                            <span className="text-lg font-bold leading-none">{day.dayNum}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-700 capitalize">{day.dayName}</p>
                            <div className="flex items-center gap-2">
                              {isUserAvailable && (
                                <span className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Disponible
                                </span>
                              )}
                              {starCount > 0 && (
                                <span className="text-xs text-yellow-600 flex items-center gap-0.5">
                                  <Star className="w-3 h-3 fill-yellow-400" /> {starCount}
                                </span>
                              )}
                              {messageCount > 0 && (
                                <span className="text-xs text-slate-400 flex items-center gap-0.5">
                                  <MessageCircle className="w-3 h-3" /> {messageCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => toggleStar(day.dateStr, e)}
                            className={`p-2 rounded-full transition ${isStarred ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-slate-400 hover:bg-yellow-50'}`}
                            title="Marcar como favorito"
                          >
                            <Star className={`w-4 h-4 ${isStarred ? 'fill-yellow-400' : ''}`} />
                          </button>
                          <button
                            onClick={(e) => openMessageModal(day.dateStr, e)}
                            className={`p-2 rounded-full transition ${hasMyMessage ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 hover:bg-indigo-50'}`}
                            title="Agregar nota"
                          >
                            <MessageCircle className={`w-4 h-4 ${hasMyMessage ? 'fill-indigo-200' : ''}`} />
                          </button>
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${colorClass}`}>
                            {statusIcon}
                            <span>{voteCount}/{totalMembers}</span>
                          </div>
                        </div>
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
