import { X, Download, CheckCircle } from 'lucide-react';
import { useUI } from '../../contexts';

export default function PWAInstallModal() {
  const {
    showInstallPrompt,
    showIOSInstallModal,
    isStandalone,
    deferredPrompt,
    setDeferredPrompt,
    setShowInstallPrompt,
    setShowIOSInstallModal,
    dismissInstallPrompt,
    isIOS,
    showNotification
  } = useUI();

  if ((!showInstallPrompt && !showIOSInstallModal) || isStandalone) return null;

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('PWA installed');
    }
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleClose = () => {
    setShowIOSInstallModal(false);
    dismissInstallPrompt();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 pb-8 safe-area-bottom sm:m-4">
        {/* Header */}
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
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        {deferredPrompt ? (
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
          <div>
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
          onClick={handleClose}
          className="w-full mt-4 bg-slate-100 text-slate-700 py-3 rounded-xl font-medium"
        >
          {deferredPrompt ? 'Ahora no' : 'Entendido'}
        </button>
      </div>
    </div>
  );
}
