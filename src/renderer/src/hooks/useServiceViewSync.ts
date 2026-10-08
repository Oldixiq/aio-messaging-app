import { useEffect, type RefObject } from 'react';
import { api } from '../services/api';
import { appStore, useApp } from '../stores/app-store';

/**
 * Keeps the native service view glued to the content card: reports its bounds
 * on every resize, and hides the view while shell UI covers that area.
 */
export function useServiceViewSync(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const report = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        void api.invoke('view:set-bounds', {
          x: Math.max(0, r.left),
          y: Math.max(0, r.top),
          width: Math.max(0, r.width),
          height: Math.max(0, r.height),
        });
      });
    };
    const observer = new ResizeObserver(report);
    observer.observe(el);
    window.addEventListener('resize', report);
    report();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', report);
      cancelAnimationFrame(frame);
    };
  }, [ref]);

  const settingsOpen = useApp((s) => s.settingsSection !== null);
  const overlay = useApp((s) => s.overlay);
  const occluded = settingsOpen || overlay !== null;

  useEffect(() => {
    let cancelled = false;
    void api.invoke('view:set-occluded', occluded).then((shot) => {
      if (!cancelled) appStore.set({ backdrop: occluded && !settingsOpen ? shot ?? appStore.get().backdrop : null });
    });
    return () => {
      cancelled = true;
    };
  }, [occluded, settingsOpen]);
}
