import type { ReactNode } from 'react';

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      className={`toggle${checked ? ' is-on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="toggle__thumb" />
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingRow({ title, description, children, disabled }: { title: ReactNode; description?: ReactNode; children: ReactNode; disabled?: boolean }) {
  return (
    <div className={`setting-row${disabled ? ' is-disabled' : ''}`}>
      <div className="setting-row__text">
        <div className="setting-row__title">{title}</div>
        {description && <div className="setting-row__desc">{description}</div>}
      </div>
      <div className="setting-row__control">{children}</div>
    </div>
  );
}

export function SettingGroup({ title, children, note }: { title?: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="setting-group">
      {title && <h3>{title}</h3>}
      <div className="setting-group__card">{children}</div>
      {note && <p className="setting-group__note">{note}</p>}
    </section>
  );
}

export function PlannedTag({ phase }: { phase: number }) {
  return <span className="tag" title="Saved now, takes effect when this feature ships">Phase {phase}</span>;
}
