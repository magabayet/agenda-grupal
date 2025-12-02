import { AuthProvider, GroupsProvider, UIProvider } from './contexts';
import AppContent from './AppContent';

/**
 * App wrapper with providers
 *
 * This is the entry point that wraps the main application content
 * with the necessary context providers:
 * - AuthProvider: User authentication and user data
 * - GroupsProvider: Groups list and current group
 * - UIProvider: UI state (modals, view, filters, etc.)
 *
 * The actual application logic remains in AppContent.jsx for now.
 * Components can be gradually migrated to use the contexts.
 */
export default function App() {
  return (
    <AuthProvider>
      <GroupsProvider>
        <UIProvider>
          <AppContent />
        </UIProvider>
      </GroupsProvider>
    </AuthProvider>
  );
}
