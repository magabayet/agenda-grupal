import { useUI } from '../../contexts';

export default function NotificationToast() {
  const { notification } = useUI();

  if (!notification) return null;

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm">
      {notification}
    </div>
  );
}
