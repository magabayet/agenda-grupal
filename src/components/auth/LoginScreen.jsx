import {
  Calendar,
  Users,
  CheckCircle,
  Star,
  MessageCircle,
  Chrome,
  Bell,
  Download,
  Smartphone
} from 'lucide-react';
import { useUI } from '../../contexts';
import { signInWithGoogle } from '../../services';

export default function LoginScreen() {
  const { setView, showNotification } = useUI();

  const handleGoogleLogin = async () => {
    try {
      const loggedUser = await signInWithGoogle();
      showNotification(`¡Bienvenido, ${loggedUser.displayName}!`);
      setView('join');
    } catch (error) {
      console.error("Error en login:", error);
      showNotification('Error al iniciar sesión');
    }
  };

  return (
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
  );
}
