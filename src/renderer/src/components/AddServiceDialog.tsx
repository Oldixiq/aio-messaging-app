import { useMemo, useState } from 'react';
import { SERVICE_DEFINITIONS } from '@integrations/index';
import type { ServiceCategory, ServiceDefinition } from '@shared/types/service';
import { api } from '../services/api';
import { actions, selectServices, useApp } from '../stores/app-store';
import { Modal } from './Modal';
import { ServiceAvatar } from './ServiceAvatar';
import { BackIcon, CloseIcon, InfoIcon, SearchIcon } from './icons';

const CATEGORY_LABEL: Record<ServiceCategory, string> = { messaging: 'Messaging', social: 'Social', work: 'Work', email: 'Email' };

export function AddServiceDialog() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ServiceDefinition | null>(null);
  const services = useApp(selectServices);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SERVICE_DEFINITIONS.filter((d) => !q || d.name.toLowerCase().includes(q) || d.id.includes(q));
  }, [query]);

  return (
    <Modal label="Add a service" onClose={actions.closeOverlay} className="modal--wide">
      <div className="modal__header">
        {selected ? (
          <button className="icon-btn" onClick={() => setSelected(null)} title="Back"><BackIcon size={16} /></button>
        ) : null}
        <h2>{selected ? `Add ${selected.name}` : 'Add a service'}</h2>
        <button className="icon-btn" onClick={actions.closeOverlay} title="Close (Esc)"><CloseIcon size={16} /></button>
      </div>
      {selected ? (
        <AddForm definition={selected} existing={services.filter((s) => s.type === selected.id).length} />
      ) : (
        <>
          <label className="search-field">
            <SearchIcon size={16} />
            <input autoFocus placeholder="Search services" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="catalog">
            {filtered.map((d) => {
              const count = services.filter((s) => s.type === d.id).length;
              return (
                <button key={d.id} className="catalog__item" onClick={() => setSelected(d)}>
                  <ServiceAvatar definition={d} size={44} />
                  <span className="catalog__name">{d.name}</span>
                  <span className="catalog__meta">{count > 0 ? `${count} added` : CATEGORY_LABEL[d.category]}</span>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="muted">No service matches “{query}”.</p>}
          </div>
        </>
      )}
    </Modal>
  );
}

function AddForm({ definition, existing }: { definition: ServiceDefinition; existing: number }) {
  const [label, setLabel] = useState(existing === 0 ? 'Personal' : existing === 1 ? 'Work' : `Account ${existing + 1}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = existing > 0 && !definition.capabilities.multipleAccounts;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const instance = await api.invoke('services:add', definition.id, label);
      await actions.activate(instance.id);
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : 'Could not add the service');
      setBusy(false);
    }
  };

  return (
    <form className="add-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="add-form__hero">
        <ServiceAvatar definition={definition} size={56} />
        <div>
          <h3>{definition.name}</h3>
          <p className="muted">{definition.description}</p>
        </div>
      </div>
      <label className="field">
        <span>Account name</span>
        <input autoFocus value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} placeholder="Personal, Work…" />
        <small className="muted">Each account gets its own isolated sign-in and storage. You sign in inside the service after adding it.</small>
      </label>
      <div className="callout">
        <InfoIcon size={16} />
        <div>
          <strong>Good to know</strong>
          <ul>{definition.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="modal__actions">
        <button type="button" className="btn" onClick={actions.closeOverlay}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={busy || blocked || !label.trim()}>
          {busy ? 'Adding…' : `Add ${definition.name}`}
        </button>
      </div>
    </form>
  );
}
