import { useEffect } from 'react';
import { api } from '../services/api';
import { useApp } from '../stores/app-store';

/** Draws the taskbar overlay badge (Windows wants an image, and only the shell has a canvas). */
function drawBadge(count: number): string | null {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#e11d48';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  const text = count > 99 ? '99+' : String(count);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${text.length > 2 ? 13 : text.length > 1 ? 17 : 20}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2 + 1);
  return canvas.toDataURL('image/png');
}

/** Keeps the taskbar badge equal to the sum of known unread counts. */
export function useTaskbarBadge(): void {
  const enabled = useApp((s) => s.config?.settings.notifications.taskbarBadge ?? true);
  const total = useApp((s) => {
    let sum = 0;
    for (const inst of s.config?.services ?? []) {
      if (inst.enabled && inst.notifications.enabled) sum += s.runtime[inst.id]?.unread ?? 0;
    }
    return sum;
  });
  const count = enabled ? total : 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      void api.invoke('app:set-badge', count, count > 0 ? drawBadge(count) : null);
    }, 300);
    return () => clearTimeout(timer);
  }, [count]);
}
