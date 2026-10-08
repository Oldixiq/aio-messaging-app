import { getServiceDefinition } from '@integrations/index';
import { ServiceAvatar } from '../components/ServiceAvatar';
import { PlusIcon, SearchIcon } from '../components/icons';
import { actions, selectServices, useApp } from '../stores/app-store';
import { api } from '../services/api';

function timeAgo(at: number): string {
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Built from the notifications services emitted since the app started; that
 * is the only conversation data the services share. Kept in memory only.
 */
function RecentNotifications() {
  const records = useApp((s) => s.notifications);
  const services = useApp(selectServices);
  const previews = useApp((s) => s.config?.settings.notifications.previews ?? true);
  const favicons = useApp((s) => s.runtime);
  const byId = new Map(services.map((s) => [s.id, s]));
  const rows = records.slice(0, 8);

  return (
    <section className="card card--wide">
      <div className="card__header">
        <h2>Recent notifications</h2>
        {rows.length > 0 && <button className="btn btn--small" onClick={() => void api.invoke('notifications:clear-history')}>Clear</button>}
      </div>
      {rows.length === 0 ? (
        <p className="muted">
          Messages that services notify you about while the app is running appear here. They’re kept in memory only and disappear when you quit.
        </p>
      ) : (
        <ul className="recent-list">
          {rows.map((r) => {
            const inst = byId.get(r.instanceId);
            const def = inst && getServiceDefinition(inst.type);
            if (!inst || !def) return null;
            return (
              <li key={r.key}>
                <button onClick={() => void actions.activate(inst.id)}>
                  <ServiceAvatar definition={def} favicon={favicons[inst.id]?.favicon} size={30} />
                  <span className="recent-list__text">
                    <strong>{previews ? r.title : def.name}</strong>
                    <span className="muted">{previews ? r.body || 'New notification' : 'New notification'}</span>
                  </span>
                  <span className="recent-list__meta muted">{def.name}{services.filter((s) => s.type === inst.type).length > 1 ? ` · ${inst.label}` : ''}<br />{timeAgo(r.at)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function greeting(date = new Date()): string {
  const h = date.getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function Dashboard() {
  const services = useApp(selectServices);
  const runtime = useApp((s) => s.runtime);
  const notificationsOn = useApp((s) => s.config?.settings.notifications.enabled ?? true);

  const rows = services.map((inst) => ({ inst, def: getServiceDefinition(inst.type), rt: runtime[inst.id] })).filter((r) => r.def);
  const known = rows.filter((r) => r.rt && r.rt.status !== 'idle');
  const totalUnread = known.reduce((sum, r) => sum + (r.rt?.unread ?? 0), 0);
  const notLoaded = rows.length - known.length;
  const withUnread = rows.filter((r) => (r.rt?.unread ?? 0) > 0 || r.rt?.hasActivity).sort((a, b) => (b.rt?.unread ?? 0) - (a.rt?.unread ?? 0));

  return (
    <div className="dashboard">
      <header className="dashboard__hero">
        <div>
          <p className="muted">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1>{greeting()}</h1>
          <p className="dashboard__summary">
            {rows.length === 0
              ? 'Add your first service to get started.'
              : totalUnread > 0
                ? <><strong>{totalUnread}</strong> unread across {withUnread.length} service{withUnread.length === 1 ? '' : 's'}</>
                : 'You’re all caught up.'}
            {!notificationsOn && <span className="chip chip--warn">Notifications muted</span>}
          </p>
        </div>
        <button className="dashboard__search" onClick={() => actions.openOverlay('search')}>
          <SearchIcon size={16} /> <span>Search services and settings</span> <kbd>Ctrl K</kbd>
        </button>
      </header>

      {rows.length === 0 ? (
        <div className="empty-card">
          <h2>Bring your conversations together</h2>
          <p className="muted">Add WhatsApp, Discord, Telegram, Slack and more. Every account runs in its own isolated, sandboxed session on this PC.</p>
          <button className="btn btn--primary" onClick={() => actions.openAddService()}><PlusIcon size={16} /> Add a service</button>
        </div>
      ) : (
        <div className="dashboard__grid">
          <section className="card">
            <h2>Unread</h2>
            {withUnread.length === 0 ? (
              <p className="muted">Nothing unread in the services that are running.</p>
            ) : (
              <ul className="unread-list">
                {withUnread.map(({ inst, def, rt }) => (
                  <li key={inst.id}>
                    <button onClick={() => void actions.activate(inst.id)}>
                      <ServiceAvatar definition={def!} favicon={rt?.favicon} size={28} />
                      <span>{def!.name}<small className="muted"> · {inst.label}</small></span>
                      <span className="unread-list__count">{rt?.unread ? rt.unread : '•'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {notLoaded > 0 && (
              <p className="card__note muted">
                {notLoaded} service{notLoaded === 1 ? ' hasn’t' : 's haven’t'} been opened since launch, so {notLoaded === 1 ? 'its' : 'their'} unread count is unknown.
                Services load on first use to save memory.
              </p>
            )}
          </section>

          <section className="card">
            <h2>Quick launch</h2>
            <div className="quick-grid">
              {rows.map(({ inst, def, rt }, i) => (
                <button key={inst.id} className="quick-grid__item" onClick={() => void actions.activate(inst.id)} title={i < 9 ? `Ctrl+${i + 1}` : undefined}>
                  <ServiceAvatar definition={def!} favicon={rt?.favicon} size={40} dimmed={!inst.enabled} />
                  <span>{def!.name}</span>
                  <small className="muted">{inst.label}</small>
                </button>
              ))}
              <button className="quick-grid__item quick-grid__item--add" onClick={() => actions.openAddService()}>
                <span className="quick-grid__plus"><PlusIcon /></span>
                <span>Add</span>
              </button>
            </div>
          </section>

          <RecentNotifications />
        </div>
      )}
    </div>
  );
}
