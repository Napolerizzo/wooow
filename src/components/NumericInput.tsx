'use client';

import { useState, useRef, useEffect } from 'react';

interface NumericInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  disabled?: boolean;
  defaultEmpty?: boolean; // show empty string when null instead of 0
}

/**
 * Numeric input that selects-all on focus and replaces (not appends) on first keystroke.
 * Uses inputMode="numeric" to avoid native number input quirks.
 */
export default function NumericInput({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  placeholder = '',
  style,
  'aria-label': ariaLabel,
  disabled = false,
  defaultEmpty = false,
}: NumericInputProps) {
  const [raw, setRaw] = useState(value === null ? '' : String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync when value changes externally
  useEffect(() => {
    setRaw(value === null ? '' : String(value));
  }, [value]);

  function handleFocus() {
    // Select all text on focus so first keystroke replaces it
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    // Allow empty string while typing
    if (v === '' || v === '-') {
      setRaw(v);
      if (defaultEmpty) onChange(null);
      return;
    }
    // Only allow valid numeric chars
    if (!/^-?\d*\.?\d*$/.test(v)) return;
    setRaw(v);
    const n = parseFloat(v);
    if (!isNaN(n)) {
      const clamped = max !== undefined ? Math.min(max, Math.max(min, n)) : Math.max(min, n);
      onChange(clamped);
    }
  }

  function handleBlur() {
    if (raw === '' || raw === '-') {
      const fallback = defaultEmpty ? null : min;
      setRaw(fallback === null ? '' : String(fallback));
      onChange(fallback);
      return;
    }
    const n = parseFloat(raw);
    if (isNaN(n)) {
      const fallback = defaultEmpty ? null : min;
      setRaw(fallback === null ? '' : String(fallback));
      onChange(fallback);
    } else {
      const clamped = max !== undefined ? Math.min(max, Math.max(min, n)) : Math.max(min, n);
      setRaw(String(clamped));
      onChange(clamped);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const n = (value ?? min) + step;
      const clamped = max !== undefined ? Math.min(max, n) : n;
      setRaw(String(clamped));
      onChange(clamped);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const n = (value ?? min) - step;
      const clamped = Math.max(min, n);
      setRaw(String(clamped));
      onChange(clamped);
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={raw}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      style={style}
    />
  );
}
