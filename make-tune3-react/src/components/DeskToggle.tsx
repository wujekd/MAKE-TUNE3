import { CSSProperties, KeyboardEvent } from 'react';

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  size?: number;
  disabled?: boolean;
  colorOn?: string;
  colorOff?: string;
  className?: string;
  text?: string; // base label text; renders as `${text} on/off`
};

export function DeskToggle({
  checked,
  onChange,
  label,
  size = 36,
  disabled = false,
  colorOn = '#22c55e',
  colorOff = '#3a4747',
  className,
  text
}: Props) {
  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    userSelect: 'none'
  };

  const plateStyle: CSSProperties = {
    padding: 6,
    borderRadius: 8,
    background: 'linear-gradient(180deg, #1e2f2f, #0f1a1a)',
    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    gap: 8
  };

  const innerSize = Math.max(12, Math.floor(size * 0.66));

  const buttonStyle: CSSProperties = {
    width: innerSize,
    height: innerSize,
    borderRadius: '50%',
    background: checked
      ? `radial-gradient(circle at 35% 35%, ${lighten(colorOn, 0.4)}, ${colorOn})`
      : `radial-gradient(circle at 35% 35%, #566868, ${colorOff})`,
    border: '2px solid #0b1414',
    boxShadow: checked
      ? '0 0 10px rgba(34,197,94,0.6), inset 0 2px 10px rgba(255,255,255,0.15)'
      : 'inset 0 2px 10px rgba(0,0,0,0.5)',
    transition: 'all 120ms ease',
    opacity: disabled ? 0.6 : 1,
    position: 'relative',
    outline: 'none'
  };

  const indicatorStyle: CSSProperties = {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: checked ? colorOn : '#2a3232',
    boxShadow: checked ? '0 0 6px rgba(34,197,94,0.9)' : 'none',
    border: '1px solid #0b1414'
  };

  const inlineTextStyle: CSSProperties = {
    fontSize: 12,
    color: 'var(--white)',
    opacity: 0.9,
  };

  const toggle = () => {
    if (disabled) return;
    onChange(!checked);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  const finalLabel = text ? `${text} ${checked ? 'on' : 'off'}` : label;

  return (
    <div style={baseStyle} className={className}>
      <div style={plateStyle}>
        <div
          role="switch"
          aria-checked={checked}
          tabIndex={disabled ? -1 : 0}
          style={buttonStyle}
          onClick={toggle}
          onKeyDown={onKey}
        >
          <div style={indicatorStyle} />
        </div>
        {finalLabel && <div style={inlineTextStyle}>{finalLabel}</div>}
      </div>
    </div>
  );
}

function lighten(hex: string, amount: number) {
  try {
    const c = hex.replace('#', '');
    const num = parseInt(c, 16);
    const r = Math.min(255, Math.floor(((num >> 16) & 0xff) + 255 * amount));
    const g = Math.min(255, Math.floor(((num >> 8) & 0xff) + 255 * amount));
    const b = Math.min(255, Math.floor((num & 0xff) + 255 * amount));
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return hex;
  }
}

