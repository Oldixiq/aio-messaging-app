import type { AppConfig, AppSettings, DeepPartial } from '@shared/types/config';
import type { AppInfo } from '@shared/types/app';
import type { ServiceInstance, ServiceRuntimeState } from '@shared/types/service';
import { api } from '../services/api';
import { createStore, useStoreSelector } from './create-store';

export type SettingsSection = 'general' | 'appearance' | 'notifications' | 'services' | 'performance' | 'privacy' | 'shortcuts' | 'about';
export type Overlay = 'search' | 'add-service' | null;

interface AppState {
  config: AppConfig | null;
  info: AppInfo | null;
  runtime: Record<string, ServiceRuntimeState>;
  settingsSection: SettingsSection | null;
  overlay: Overlay;
  /** Screenshot of the hidden service page, shown behind dialogs. */
  backdrop: string | null;
}

export const appStore = createStore<AppState>({
  config: null,
  info: null,
  runtime: {},
  settingsSection: null,
  overlay: null,
  backdrop: null,
});

export function useApp<S>(selector: (state: AppState) => S): S {
  return useStoreSelector(appStore, selector);
}

const EMPTY: ServiceInstance[] = [];
export const selectServices = (s: AppState) => s.config?.services ?? EMPTY;
export const selectSettings = (s: AppState) => s.config?.settings ?? null;

export async function initAppStore(): Promise<void> {
  api.on('config:changed', (config) => appStore.set({ config }));
  api.on('service:state', (state) => appStore.set((s) => ({ runtime: { ...s.runtime, [state.instanceId]: state } })));
  api.on('service:removed', (id) =>
    appStore.set((s) => {
      const runtime = { ...s.runtime };
      delete runtime[id];
      return { runtime };
    }),
  );
  const [config, info, states] = await Promise.all([api.invoke('config:get'), api.invoke('app:get-info'), api.invoke('services:states')]);
  appStore.set({ config, info, runtime: Object.fromEntries(states.map((st) => [st.instanceId, st])) });

  // Launch behaviour: dashboard, or reopen the last service.
  const { launchBehavior } = config.settings.general;
  const last = config.ui.activeInstanceId;
  if (launchBehavior === 'last-service' && last && config.services.some((s) => s.id === last && s.enabled)) {
    await actions.activate(last);
  } else {
    await actions.showDashboard();
  }
}

export const actions = {
  async activate(id: string) {
    appStore.set({ settingsSection: null, overlay: null });
    await api.invoke('view:activate', id);
  },
  async showDashboard() {
    appStore.set({ settingsSection: null, overlay: null });
    await api.invoke('view:show-dashboard');
  },
  openSettings(section: SettingsSection = 'general') {
    appStore.set({ settingsSection: section, overlay: null });
  },
  closeSettings() {
    appStore.set({ settingsSection: null });
  },
  openOverlay(overlay: Exclude<Overlay, null>) {
    appStore.set({ overlay });
  },
  closeOverlay() {
    appStore.set({ overlay: null });
  },
  async updateSettings(patch: DeepPartial<AppSettings>) {
    const config = await api.invoke('settings:update', patch);
    appStore.set({ config });
  },
  /** Cycles through enabled services; from the dashboard it starts at the first/last. */
  async cycle(direction: 1 | -1) {
    const { config } = appStore.get();
    if (!config) return;
    const list = config.services.filter((s) => s.enabled);
    if (list.length === 0) return;
    const current = config.ui.view === 'service' ? list.findIndex((s) => s.id === config.ui.activeInstanceId) : -1;
    const next = current === -1 ? (direction === 1 ? 0 : list.length - 1) : (current + direction + list.length) % list.length;
    await actions.activate(list[next]!.id);
  },
  async gotoIndex(index: number) {
    const target = appStore.get().config?.services.filter((s) => s.enabled)[index];
    if (target) await actions.activate(target.id);
  },
  async toggleSidebar() {
    const mode = appStore.get().config?.settings.appearance.sidebarMode;
    await actions.updateSettings({ appearance: { sidebarMode: mode === 'expanded' ? 'compact' : 'expanded' } });
  },
};
