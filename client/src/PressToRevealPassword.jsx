import React, { useEffect, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Shows the secret only while the eye is actively held down.
 * A click never toggles its visibility permanently.
 */
export default function PressToRevealPassword({
  label,
  value,
  onChange,
  required = false,
  autoComplete
}) {
  const inputId = useId();
  const [revealed, setRevealed] = useState(false);
  const hide = () => setRevealed(false);

  useEffect(() => {
    const hideOnBlur = () => setRevealed(false);
    const hideOnVisibilityChange = () => {
      if (document.hidden) setRevealed(false);
    };
    window.addEventListener('blur', hideOnBlur);
    document.addEventListener('visibilitychange', hideOnVisibilityChange);
    return () => {
      window.removeEventListener('blur', hideOnBlur);
      document.removeEventListener('visibilitychange', hideOnVisibilityChange);
    };
  }, []);

  function showOnPointerDown(event) {
    if (event.button === 0) setRevealed(true);
  }

  function showOnKeyDown(event) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      setRevealed(true);
    }
  }

  function hideOnKeyUp(event) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      hide();
    }
  }

  return (
    <div className="hold-password-field">
      <label htmlFor={inputId}>{label}</label>
      <div className="hold-password-control">
        <input
          id={inputId}
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="hold-password-eye"
          aria-label={'Mantener presionado para ver ' + label.toLowerCase()}
          aria-pressed={revealed}
          title="Mantener presionado para ver la clave"
          onPointerDown={showOnPointerDown}
          onPointerUp={hide}
          onPointerCancel={hide}
          onPointerLeave={hide}
          onLostPointerCapture={hide}
          onBlur={hide}
          onKeyDown={showOnKeyDown}
          onKeyUp={hideOnKeyUp}
          onContextMenu={(event) => event.preventDefault()}
        >
          {revealed ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
