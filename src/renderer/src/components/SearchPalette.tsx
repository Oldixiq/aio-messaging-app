import { useMemo, useState } from 'react';
import { getServiceDefinition } from '@integrations/index';
import { actions, appStore, selectServices, useApp, type SettingsSection } from '../stores/app-store';
import { Modal } from './Modal';
import { ServiceAvatar } from './ServiceAvatar';
import { HomeIcon, PlusIcon, SearchIcon, SettingsIcon } from './icons';

interface Result {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  run: () => void;
}

const SETTINGS: [SettingsSection, string][] = [
  ['general', 'General'], ['appearance', 'Appearance'], ['notifications', 'Notifications'], ['services', 'Services & accounts'],
  ['performance', 'Performance'], ['privacy', 'Privacy & data'], ['shortcuts', 'Keyboard shortcuts'], ['about', 'About & updates'],
];

/**
 * Ctrl+K palette: jump to services, settings and commands. Message search is
 * not offered because no integrated service exposes it to the app yet.
 */
export function SearchPalette() {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const services = useApp(selectServices);
  const runtime = useApp((s) => s.runtime);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (...fields: string[]) => !q || fields.some((f) => f.toLowerCase().includes(q));
    const out: Result[] = [];
    for (const inst of services) {
      const def = getServiceDefinition(inst.type);
      if (!def || !match(def.name, inst.label)) continue;
      const unread = runtime[inst.id]?.unread ?? 0;
      out.push({
        key: inst.id,
        title: `${def.name} · ${inst.label}`,
        subtitle: unread ? `${unread} unread` : 'Open service',
        icon: <ServiceAvatar definition={def} favicon={runtime[inst.id]?.favicon} size={24} />,
        run: () => void actions.activate(inst.id),
      });
    }
    if (match('home', 'dashboard')) out.push({ key: 'home', title: 'Home', subtitle: 'Dashboard', icon: <HomeIcon />, run: () => void actions.showDashboard() });
    if (match('add service', 'new account')) out.push({ key: 'add', title: 'Add a service', subtitle: 'Command', icon: <PlusIcon />, run: () => actions.openAddService() });
    for (const [id, label] of SETTINGS) {
      if (match(label, 'settings')) out.push({ key: `s-${id}`, title: label, subtitle: 'Settings', icon: <SettingsIcon />, run: () => actions.openSettings(id) });
    }
    return out;
  }, [query, services, runtime]);

  const safeCursor = Math.min(cursor, Math.max(0, results.length - 1));
  const run = (r: Result | undefined) => {
    if (!r) return;
    appStore.set({ overlay: null });
    r.run();
  };

  return (
    <Modal label="Search" onClose={actions.closeOverlay} className="modal--palette">
      <label className="search-field search-field--large">
        <SearchIcon size={18} />
        <input
          autoFocus
          placeholder="Jump to a service, setting or command"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
            if (e.key === 'Enter') { e.preventDefault(); run(results[safeCursor]); }
          }}
        />
      </label>
      <div className="palette__results" role="listbox">
        {results.map((r, i) => (
          <button key={r.key} role="option" aria-selected={i === safeCursor} className={`palette__item${i === safeCursor ? ' is-active' : ''}`}
            onMouseEnter={() => setCursor(i)} onClick={() => run(r)}>
            <span className="palette__icon">{r.icon}</span>
            <span className="palette__title">{r.title}</span>
            <span className="palette__subtitle">{r.subtitle}</span>
          </button>
        ))}
        {results.length === 0 && <p className="palette__empty muted">Nothing matches “{query}”.</p>}
      </div>
      <div className="palette__footer muted">
        Searching messages across services isn’t available yet: the services don’t expose message search to other apps.
      </div>
    </Modal>
  );
}
