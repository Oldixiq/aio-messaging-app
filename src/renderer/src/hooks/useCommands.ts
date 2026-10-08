import { useEffect } from 'react';
import type { CommandId } from '@shared/constants/commands';
import { api } from '../services/api';
import { actions, appStore } from '../stores/app-store';

function activeId(): string | null {
  const ui = appStore.get().config?.ui;
  return ui?.view === 'service' ? ui.activeInstanceId : null;
}

/** Executes app commands. Key handling itself lives in the main process. */
export function runCommand(command: CommandId): void {
  const id = activeId();
  switch (command) {
    case 'search.open':
      actions.openOverlay('search');
      return;
    case 'service.next':
      void actions.cycle(1);
      return;
    case 'service.previous':
      void actions.cycle(-1);
      return;
    case 'service.reload':
      if (id) void api.invoke('view:reload', id);
      return;
    case 'service.back':
      if (id) void api.invoke('view:navigate', id, 'back');
      return;
    case 'service.forward':
      if (id) void api.invoke('view:navigate', id, 'forward');
      return;
    case 'settings.open':
      if (appStore.get().settingsSection) actions.closeSettings();
      else actions.openSettings();
      return;
    case 'dashboard.open':
      void actions.showDashboard();
      return;
    case 'sidebar.toggle':
      void actions.toggleSidebar();
      return;
    case 'notifications.toggleMute':
      // Toggled in the main process; the config change event updates the UI.
      return;
    default: {
      const match = /^service\.goto\.(\d)$/.exec(command);
      if (match) void actions.gotoIndex(Number(match[1]) - 1);
    }
  }
}

export function useCommands(): void {
  useEffect(() => api.on('command', runCommand), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const { overlay, settingsSection } = appStore.get();
        if (overlay) actions.closeOverlay();
        else if (settingsSection) actions.closeSettings();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
