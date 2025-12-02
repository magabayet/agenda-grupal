import { Calendar, Home, LogOut, Download, BellRing, BellOff } from 'lucide-react';
import { useAuth, useGroups, useUI } from '../../contexts';
import { logOut, requestNotificationPermission, disableNotifications } from '../../services';
import { messaging } from '../../config/firebase';

export default function Header() {
  const { user } = useAuth();
  const { clearCurrentGroup } = useGroups();
  const {
    view,
    setView,
    isStandalone,
    isIOS,
    deferredPrompt,
    setDeferredPrompt,
    setShowInstallPrompt,
    setShowIOSInstallModal,
    notificationPermission,
    setNotificationPermission,
    fcmToken,
    setFcmToken,
    showNotification
  } = useUI();

  const handleGoHome = () => {
    clearCurrentGroup();
    setView('join');
  };

  const handleLogout = async () => {
    try {
      await logOut();
      clearCurrentGroup();
      setView('login');
    } catch (error) {
      console.error("Error en logout:", error);
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('PWA installed');
      }
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } else if (isIOS()) {
      setShowIOSInstallModal(true);
    } else {
      setShowInstallPrompt(true);
    }
  };

  const handleNotificationToggle = async () => {
    if (notificationPermission === 'granted') {
      await disableNotifications(user?.uid, fcmToken);
      setFcmToken(null);
      showNotification('Notificaciones desactivadas');
    } else {
      try {
        const result = await requestNotificationPermission(user?.uid);
        setNotificationPermission(result.permission);
        if (result.token) {
          setFcmToken(result.token);
          showNotification('Notificaciones activadas');
        } else {
          showNotification('Permiso de notificaciones denegado');
        }
      } catch (error) {
        console.error('Error:', error);
        showNotification('Error al activar notificaciones');
      }
    }
  };

  const handleIOSNotification = async () => {
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
  };

  return (
    <div className="bg-white shadow-sm sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
      <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
        {/* Logo */}
        <button
          onClick={handleGoHome}
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
                <button
                  onClick={handleGoHome}
                  className="p-1.5 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition"
                  title="Ir al inicio"
                >
                  <Home className="w-4 h-4" />
                </button>
                <button
                  onClick={handleGoHome}
                  className="p-1.5 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition"
                  title="Salir del grupo"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}

            {view !== 'calendar' && (
              <>
                {/* Profile photo */}
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    className="w-8 h-8 rounded-full border-2 border-indigo-200 cursor-pointer hover:border-indigo-400 transition"
                    onClick={handleGoHome}
                    title="Ir al inicio"
                  />
                ) : (
                  <button
                    onClick={handleGoHome}
                    className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm hover:bg-indigo-200 transition"
                    title="Ir al inicio"
                  >
                    {user.displayName?.charAt(0) || '?'}
                  </button>
                )}

                {/* Install app button */}
                {!isStandalone && (
                  <button
                    onClick={handleInstallClick}
                    className="p-2 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition"
                    title="Instalar app"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}

                {/* Notification button */}
                {messaging ? (
                  <button
                    onClick={handleNotificationToggle}
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
                  <button
                    onClick={handleIOSNotification}
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
                ) : null}

                {/* Logout button */}
                <button
                  onClick={handleLogout}
                  className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
