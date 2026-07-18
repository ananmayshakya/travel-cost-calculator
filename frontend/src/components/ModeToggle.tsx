import type { CSSProperties } from 'react';

export type Mode = 'manual' | 'map';

interface ModeToggleProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

// switches between manual distance entry and map-based route search
function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Entry mode"
      style={{ display: 'flex', gap: 'var(--space-sm)' }}
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'manual'}
        onClick={() => onChange('manual')}
        style={buttonStyle(mode === 'manual')}
      >
        Manual
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'map'}
        onClick={() => onChange('map')}
        style={buttonStyle(mode === 'map')}
      >
        Map
      </button>
    </div>
  );
}

// shared style for the two toggle buttons, varied only by active state
function buttonStyle(active: boolean): CSSProperties {
  return {
    padding: 'var(--space-sm) var(--space-md)',
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
    background: active ? 'var(--color-accent)' : 'var(--color-surface)',
    color: active ? '#fff' : 'var(--color-text)',
    cursor: 'pointer',
  };
}

export default ModeToggle;
