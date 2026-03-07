import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "lobobook-hide-amounts";

export function useHideAmounts() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(hidden));
    } catch { /* ignore */ }
  }, [hidden]);

  const toggle = useCallback(() => setHidden(prev => !prev), []);

  const mask = useCallback(
    (formatted: string) => (hidden ? "••••••" : formatted),
    [hidden]
  );

  return { hidden, toggle, mask };
}
