/**
 * Dropdown — themed, animated single-select.
 * Replaces native <select>/<optgroup> (which render unreliably in the Android
 * WebView). The options panel is position:fixed so it escapes the modal's
 * overflow:auto clipping, flips up when there's no room below, and closes on
 * outside-click / scroll / Escape.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;   // right-aligned secondary text (e.g. connector type)
  badge?: string;  // small leading tag (e.g. AC / DC)
  disabled?: boolean;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
  ariaLabel?: string;
}

export default function Dropdown({
  value, onChange, options, placeholder = 'Select…', disabled, emptyText = 'No options', ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; openUp: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value) || null;

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < 260 && r.top > spaceBelow;
    setPos({ left: r.left, top: openUp ? r.top : r.bottom, width: r.width, openUp });
  };

  const toggle = () => {
    if (disabled) return;
    if (!open) place();
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const reposition = () => place();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="dd-root">
      <button
        type="button"
        ref={triggerRef}
        className={`owner-input dd-trigger${open ? ' dd-open' : ''}`}
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={`dd-value${selected ? '' : ' dd-placeholder'}`}>
          {selected ? (
            <>
              {selected.badge && <span className="dd-badge">{selected.badge}</span>}
              {selected.label}
            </>
          ) : placeholder}
        </span>
        <ChevronDown size={16} className="dd-chevron" />
      </button>

      {open && pos && createPortal(
        <>
          <div className="dd-backdrop" onClick={() => setOpen(false)} />
          <div
            className={`dd-panel${pos.openUp ? ' dd-up' : ''}`}
            role="listbox"
            style={{
              left: pos.left,
              width: pos.width,
              ...(pos.openUp
                ? { bottom: window.innerHeight - pos.top + 6 }
                : { top: pos.top + 6 }),
            }}
          >
            {options.length === 0 ? (
              <div className="dd-empty">{emptyText}</div>
            ) : (
              options.map((o) => (
                <button
                  type="button"
                  key={o.value}
                  className={`dd-option${o.value === value ? ' dd-selected' : ''}`}
                  disabled={o.disabled}
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                >
                  {o.badge && <span className="dd-badge">{o.badge}</span>}
                  <span className="dd-option-label">{o.label}</span>
                  {o.hint && <span className="dd-hint">{o.hint}</span>}
                  {o.value === value && <Check size={15} className="dd-check" />}
                </button>
              ))
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
