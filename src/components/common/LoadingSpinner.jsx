import { Calendar } from 'lucide-react';

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="text-center">
        <Calendar className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-pulse" />
        <p className="text-slate-400">Cargando...</p>
      </div>
    </div>
  );
}
