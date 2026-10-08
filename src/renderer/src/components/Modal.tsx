import { useEffect, useRef, type ReactNode } from 'react';
import { useApp } from '../stores/app-store';

/** Dialog shell with a blurred snapshot of the service page behind it. */
export function Modal({ children, onClose, className = '', label }: { children: ReactNode; onClose: () => void; className?: string; label: string }) {
  const backdrop = useApp((s) => s.backdrop);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[autofocus], input, button')?.focus();
  }, []);
  return (
    <div className="modal-layer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {backdrop && <img className="modal-layer__snapshot" src={backdrop} alt="" />}
      <div ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}
