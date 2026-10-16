import { createContext, useCallback, useContext, useState } from 'react';

// In-memory drafts so a tool keeps what you typed when you switch away and come back.
// Deliberately not localStorage: pasted tokens and secrets never touch disk and are gone on reload.
const drafts = new Map();

export const ToolIdContext = createContext(null);

export function clearToolState(toolId) {
  [...drafts.keys()].filter((k) => k.startsWith(`${toolId}:`)).forEach((k) => drafts.delete(k));
}

// Drop-in replacement for useState that survives navigation within the session.
export function useToolState(name, initial) {
  const toolId = useContext(ToolIdContext);
  const key = `${toolId}:${name}`;
  const [value, setValue] = useState(() => {
    if (toolId && drafts.has(key)) return drafts.get(key);
    return typeof initial === 'function' ? initial() : initial;
  });
  const set = useCallback(
    (next) =>
      setValue((prev) => {
        const v = typeof next === 'function' ? next(prev) : next;
        if (toolId) drafts.set(key, v);
        return v;
      }),
    [toolId, key]
  );
  return [value, set];
}
