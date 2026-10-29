import type { CSSProperties, ReactNode } from 'react';

type Div = { className?: string; style?: CSSProperties; children?: ReactNode };

/** Rótulo em caixa alta com tracking (SPEC 28). */
export function Rotulo({ children, className, style }: Div) {
  return (
    <span
      className={className}
      style={{
        textTransform: 'uppercase',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.18em',
        color: 'var(--label)',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

type PilulaProps = Div & { mono?: boolean };

/** Pílula (botões, chips, minutos). Minutos em mono. */
export function Pilula({ children, className, style, mono }: PilulaProps) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 10px',
        borderRadius: 'var(--radius-pill)',
        border: '1px solid var(--border)',
        fontSize: 12,
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-ui)',
        color: 'var(--text-secondary)',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Card: fundo escuro, borda opaca, raio 16 (hierarquia por escurecimento, sem sombra). */
export function Card({ children, className, style }: Div) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type Option = { value: string; label: string };
type ToggleProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

/** Toggle segmentado em pílula. */
export function ToggleSegmentado({ options, value, onChange, className }: ToggleProps) {
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        padding: 3,
        gap: 3,
        borderRadius: 'var(--radius-pill)',
        border: '1px solid var(--border)',
        background: 'var(--card)',
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              background: active ? 'var(--gradient-active)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text-secondary)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

type SearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

/** Campo de busca único (base da busca livre, SPEC 16). */
export function SearchField({ value, onChange, placeholder, className }: SearchProps) {
  return (
    <input
      className={className}
      type="search"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '12px 16px',
        borderRadius: 'var(--radius-search)',
        border: '1px solid var(--border)',
        background: 'var(--card)',
        color: 'var(--text)',
        fontSize: 14,
        outline: 'none',
      }}
    />
  );
}

type SidebarItem = { key: string; label: string; icon?: ReactNode };
type SidebarProps = {
  items: SidebarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  footer?: ReactNode;
  header?: ReactNode;
};

/** Barra lateral em painel com degradê (a luz vem de cima). */
export function Sidebar({ items, activeKey, onSelect, footer, header }: SidebarProps) {
  return (
    <nav
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: 248,
        padding: 16,
        gap: 4,
        background: 'var(--gradient-sidebar)',
        borderRight: '1px solid var(--border)',
        borderRadius: 'var(--radius-panel)',
      }}
    >
      {header}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 'var(--radius-menu)',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 14,
                background: active ? 'var(--gradient-active)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-secondary)',
              }}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>
      {footer}
    </nav>
  );
}
