import { useEffect } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Keeps Tab/Shift+Tab inside a dialog while it is open and returns focus to the opener when it closes.
export function useFocusTrap(ref) {
  useEffect(() => {
    const opener = document.activeElement;
    const node = ref.current;
    if (node && !node.contains(document.activeElement)) {
      (node.querySelector(FOCUSABLE) || node).focus();
    }
    const onKey = (e) => {
      if (e.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };
  }, [ref]);
}
