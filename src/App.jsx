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
  Settings
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
    const currentMessages = groupData?.messages || {};
    const dateMessages = currentMessages[dateStr] || {};
    const myMessage = dateMessages[user.uid] || '';
    setMessageModal({ open: true, dateStr, message: myMessage });
  };

  const saveMessage = async () => {
    if (!user || !groupId || !groupData) return;

    const groupRef = doc(db, 'calendar_groups', groupId);

    try {
      await updateDoc(groupRef, {
        [`messages.${messageModal.dateStr}.${user.uid}`]: messageModal.message
      });
      setMessageModal({ open: false, dateStr: '', message: '' });
      showNotification('Mensaje guardado');
    } catch (e) {
      console.error("Error al guardar mensaje", e);
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

    const messages = groupData.messages?.[dateStr] || {};
    const hasMyMessage = !!messages[user?.uid];
    const messageCount = Object.keys(messages).length;

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

      {/* Message Modal */}
      {messageModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-lg">Notas del día</h3>
                <p className="text-sm text-slate-500">{messageModal.dateStr}</p>
              </div>
              <button onClick={() => setMessageModal({ open: false, dateStr: '', message: '' })} className="p-1 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mensajes de otros usuarios */}
            {(() => {
              const dateMessages = groupData?.messages?.[messageModal.dateStr] || {};
              const otherMessages = Object.entries(dateMessages).filter(([uid]) => uid !== user?.uid);

              if (otherMessages.length > 0) {
                return (
                  <div className="mb-4 space-y-2 max-h-40 overflow-y-auto">
                    <p className="text-xs font-semibold text-slate-400 uppercase">Mensajes del grupo</p>
                    {otherMessages.map(([uid, msg]) => {
                      const member = groupData?.members?.find(m => m.uid === uid);
                      return (
                        <div key={uid} className="bg-slate-50 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            {member?.photoURL ? (
                              <img src={member.photoURL} alt={member.name} className="w-5 h-5 rounded-full" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-indigo-400 flex items-center justify-center text-white text-[10px]">
                                {member?.name?.charAt(0) || '?'}
                              </div>
                            )}
                            <span className="text-xs font-medium text-slate-600">{member?.name?.split(' ')[0] || 'Usuario'}</span>
                          </div>
                          <p className="text-sm text-slate-700">{msg}</p>
                        </div>
                      );
                    })}
                  </div>
                );
              }
              return null;
            })()}

            {/* Mi mensaje */}
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Tu nota</p>
              <textarea
                className="w-full p-3 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={3}
                placeholder="Ej: Puedo pero llegaría tarde..."
                value={messageModal.message}
                onChange={(e) => setMessageModal({ ...messageModal, message: e.target.value })}
              />
            </div>
            <button
              onClick={saveMessage}
              className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition"
            >
              Guardar
            </button>
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
                <div className="space-y-2">
                  {userGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => {
                        setGroupId(group.id);
                        setView('calendar');
                      }}
                      className="w-full p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 text-indigo-600 font-mono font-bold px-3 py-2 rounded-lg text-sm">
                          {group.id}
                        </div>
                        <div className="text-left">
                          {group.name && <p className="font-medium text-slate-700">{group.name}</p>}
                          <p className={`text-slate-500 ${group.name ? 'text-xs' : 'font-medium text-slate-700'}`}>{group.memberCount} miembro{group.memberCount !== 1 ? 's' : ''}</p>
                          <div className="flex -space-x-2 mt-1">
                            {group.members.slice(0, 4).map((m, idx) => (
                              m.photoURL ? (
                                <img key={idx} src={m.photoURL} alt={m.name} className="w-5 h-5 rounded-full border-2 border-white" />
                              ) : (
                                <div key={idx} className="w-5 h-5 rounded-full bg-indigo-400 border-2 border-white flex items-center justify-center text-white text-[10px]">
                                  {m.name?.charAt(0)}
                                </div>
                              )
                            ))}
                            {group.members.length > 4 && (
                              <div className="w-5 h-5 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-slate-500 text-[10px]">
                                +{group.members.length - 4}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-indigo-600 opacity-0 group-hover:opacity-100 transition">
                        <Calendar className="w-5 h-5" />
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

            {/* Month Navigation */}
            <div className="mb-4 overflow-x-auto pb-2 sticky top-16 bg-slate-50 z-10 -mx-4 px-4 py-2">
              <div className="flex gap-2">
                {monthsNav.map((month) => (
                  <button
                    key={month.key}
                    onClick={() => scrollToMonth(month.key)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm whitespace-nowrap hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition capitalize"
                  >
                    {month.name.substring(0, 3)} {month.year !== new Date().getFullYear() && month.year}
                  </button>
                ))}
              </div>
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

            {/* Calendar Grid */}
            <div className="grid grid-cols-1 gap-3">
              {filteredDays.map((day, idx) => {
                const { colorClass, statusIcon, isUserAvailable, voteCount, totalMembers, isStarred, starCount, hasMyMessage, messageCount } = getDayStatus(day.dateStr);

                // Check if this is the first day of a new month
                const isNewMonth = idx === 0 || filteredDays[idx - 1]?.monthKey !== day.monthKey;

                return (
                  <div key={day.dateStr}>
                    {/* Month Header */}
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
                      {/* User indicator */}
                      {isUserAvailable && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></div>
                      )}

                      {/* Date Info */}
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

                      {/* Actions */}
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

            {filteredDays.length === 0 && (
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
