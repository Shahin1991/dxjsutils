import React, { forwardRef } from 'react';

// A textarea with a small "Clear" button in its corner, so pre-filled samples can be emptied in one click.
export const ClearableTextarea = forwardRef(function ClearableTextarea({ value, onChange, ...rest }, ref) {
  const clear = () => onChange({ target: { value: '' } });
  return (
    <div className="clearable">
      <textarea ref={ref} value={value} onChange={onChange} {...rest} />
      {value && (
        <button type="button" className="clearable-btn" onClick={clear} aria-label="Clear input" title="Clear input">
          ✕ Clear
        </button>
      )}
    </div>
  );
});

export default ClearableTextarea;
