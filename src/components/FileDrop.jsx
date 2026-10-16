import React, { useRef, useState } from 'react';

// Drop zone + "Choose file" button in one. Calls onFiles with an array of File objects.
export function FileDrop({ onFiles, accept, multiple = false, hint }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);

  const take = (list) => {
    let files = [...(list || [])];
    if (accept) {
      const rules = accept.split(',').map((r) => r.trim().toLowerCase());
      files = files.filter((f) =>
        rules.some((r) =>
          r.startsWith('.') ? f.name.toLowerCase().endsWith(r) : r.endsWith('/*') ? f.type.startsWith(r.slice(0, -1)) : f.type === r
        )
      );
    }
    if (!multiple) files = files.slice(0, 1);
    if (files.length) onFiles(files);
  };

  return (
    <div
      className={`file-drop ${over ? 'over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
    >
      <span>{hint || (multiple ? 'Drop files here or' : 'Drop a file here or')}</span>
      <button type="button" className="tl-btn secondary" onClick={() => inputRef.current?.click()}>
        Choose {multiple ? 'files' : 'file'}…
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          take(e.target.files);
          e.target.value = ''; // allow re-picking the same file
        }}
      />
    </div>
  );
}

export default FileDrop;
