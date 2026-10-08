import { useEffect, useSyncExternalStore } from 'react';
import { useApp } from '../stores/app-store';

const query = window.matchMedia('(prefers-color-scheme: dark)');

/**
 * The main process sets nativeTheme.themeSource from the theme setting, which
 * drives prefers-color-scheme for the shell *and* every service page.
 */
export function usePrefersDark(): boolean {
  return useSyncExternalStore(
    (cb) => {
      query.addEventListener('change', cb);
      return () => query.removeEventListener('change', cb);
    },
    () => query.matches,
  );
}

export function useAppearance(): void {
  const appearance = useApp((s) => s.config?.settings.appearance);
  const dark = usePrefersDark();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset['theme'] = dark ? 'dark' : 'light';
    root.dataset['platform'] = window.aio.platform;
    if (!appearance) return;
    root.style.setProperty('--accent', appearance.accentColor);
    root.dataset['sidebar'] = appearance.sidebarMode;
    root.dataset['iconSize'] = appearance.iconSize;
    root.dataset['motion'] = appearance.animations ? 'full' : 'reduced';
  }, [appearance, dark]);
}
