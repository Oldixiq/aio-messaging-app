import { getServiceDefinition } from '@integrations/index';
import { ServiceAvatar } from '../components/ServiceAvatar';
import { PlusIcon, SearchIcon } from '../components/icons';
import { actions, selectServices, useApp } from '../stores/app-store';

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
          <button className="btn btn--primary" onClick={() => actions.openOverlay('add-service')}><PlusIcon size={16} /> Add a service</button>
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
              <button className="quick-grid__item quick-grid__item--add" onClick={() => actions.openOverlay('add-service')}>
                <span className="quick-grid__plus"><PlusIcon /></span>
                <span>Add</span>
              </button>
            </div>
          </section>

          <section className="card card--wide">
            <h2>Recent conversations</h2>
            <p className="muted">
              Not available yet. The services don’t share conversation lists with other apps. Phase 3 will collect sender and preview from the
              notifications each service already shows, which is the only reliable source, and list them here.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
