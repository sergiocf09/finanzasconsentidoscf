import { useState, useCallback, useEffect } from "react";

const STORAGE_PREFIX = "lobobook-hide-";

export function useHideAmounts(section: string = "amounts") {
  const key = `${STORAGE_PREFIX}${section}`;

  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, String(hidden));
    } catch { /* ignore */ }
  }, [hidden, key]);

  const toggle = useCallback(() => setHidden(prev => !prev), []);

  const mask = useCallback(
    (formatted: string) => (hidden ? "••••••" : formatted),
    [hidden]
  );

  return { hidden, toggle, mask };
}
