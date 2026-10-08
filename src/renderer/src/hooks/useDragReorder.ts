import { useRef, useState, type DragEvent } from 'react';

const MIME = 'application/x-aio-service';

export interface DragState {
  id: string;
  overId: string | null;
  after: boolean;
}

export function moveId(ids: string[], id: string, targetId: string, after: boolean): string[] {
  if (id === targetId) return ids;
  const rest = ids.filter((x) => x !== id);
  const index = rest.indexOf(targetId);
  if (index === -1) return ids;
  rest.splice(after ? index + 1 : index, 0, id);
  return rest;
}

/**
 * Vertical drag-to-reorder with HTML5 drag and drop. Returns per-item props
 * and the current drag state (for drop indicators).
 */
export function useDragReorder(ids: string[], commit: (orderedIds: string[]) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const ref = useRef<DragState | null>(null);
  ref.current = drag;

  const itemProps = (id: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent<HTMLElement>) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(MIME, id);
      setDrag({ id, overId: null, after: false });
    },
    onDragOver: (e: DragEvent<HTMLElement>) => {
      const current = ref.current;
      if (!current || !e.dataTransfer.types.includes(MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = e.currentTarget.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      if (current.overId !== id || current.after !== after) setDrag({ ...current, overId: id, after });
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      const current = ref.current;
      if (!current) return;
      e.preventDefault();
      if (current.overId) {
        const next = moveId(ids, current.id, current.overId, current.after);
        if (next.some((x, i) => x !== ids[i])) commit(next);
      }
      setDrag(null);
    },
    onDragEnd: () => setDrag(null),
  });

  const indicator = (id: string): string => {
    if (!drag) return '';
    if (drag.id === id) return ' is-dragging';
    if (drag.overId !== id) return '';
    return drag.after ? ' is-drop-after' : ' is-drop-before';
  };

  return { itemProps, indicator, dragging: drag !== null };
}
