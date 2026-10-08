import { memo } from 'react';
import type { ServiceDefinition } from '@shared/types/service';

interface Props {
  definition: ServiceDefinition;
  favicon?: string | null;
  size?: number;
  dimmed?: boolean;
}

/** Service icon: the page's own favicon once known, otherwise a brand-coloured monogram. */
export const ServiceAvatar = memo(function ServiceAvatar({ definition, favicon, size = 36, dimmed }: Props) {
  const style = { width: size, height: size, '--brand': definition.brandColor } as React.CSSProperties;
  if (favicon) {
    return (
      <span className={`avatar avatar--image${dimmed ? ' is-dimmed' : ''}`} style={style}>
        <img src={favicon} alt="" draggable={false} />
      </span>
    );
  }
  const text = definition.icon.kind === 'monogram' ? definition.icon.text : definition.name.slice(0, 2);
  return (
    <span className={`avatar avatar--mono${dimmed ? ' is-dimmed' : ''}`} style={{ ...style, fontSize: size * (text.length > 1 ? 0.36 : 0.46) }}>
      {text}
    </span>
  );
});
