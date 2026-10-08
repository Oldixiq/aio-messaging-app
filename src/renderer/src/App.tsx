import { useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { ServiceHost } from './components/ServiceHost';
import { AddServiceDialog } from './components/AddServiceDialog';
import { SearchPalette } from './components/SearchPalette';
import { Dashboard } from './pages/Dashboard';
import { SettingsPage } from './pages/settings/SettingsPage';
import { useAppearance } from './hooks/useAppearance';
import { useCommands } from './hooks/useCommands';
import { useServiceViewSync } from './hooks/useServiceViewSync';
import { useApp } from './stores/app-store';

export function App() {
  useAppearance();
  useCommands();
  const contentRef = useRef<HTMLDivElement>(null);
  useServiceViewSync(contentRef);

  const ready = useApp((s) => s.config !== null);
  const settingsOpen = useApp((s) => s.settingsSection !== null);
  const view = useApp((s) => s.config?.ui.view ?? 'dashboard');
  const overlay = useApp((s) => s.overlay);

  return (
    <div className="app">
      <TitleBar />
      <Sidebar />
      {/* The native service view is positioned exactly over this element. */}
      <main ref={contentRef} className="content">
        {!ready ? null : settingsOpen ? <SettingsPage /> : view === 'dashboard' ? <Dashboard /> : <ServiceHost />}
        {overlay === 'add-service' && <AddServiceDialog />}
        {overlay === 'search' && <SearchPalette />}
      </main>
    </div>
  );
}
