import { useRef, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const NAV_ROUTES = ["/", "/transactions", "/accounts", "/budgets", "/debts"];

const SWIPE_THRESHOLD = 60;
const SWIPE_MAX_Y = 80;

export function useSwipeNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!touchStart.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = Math.abs(touch.clientY - touchStart.current.y);
      touchStart.current = null;

      // Ignore if vertical scroll or too short
      if (dy > SWIPE_MAX_Y || Math.abs(dx) < SWIPE_THRESHOLD) return;

      const currentIndex = NAV_ROUTES.indexOf(location.pathname);
      if (currentIndex === -1) return;

      if (dx < 0 && currentIndex < NAV_ROUTES.length - 1) {
        // Swipe left → next screen
        navigate(NAV_ROUTES[currentIndex + 1]);
      } else if (dx > 0 && currentIndex > 0) {
        // Swipe right → previous screen
        navigate(NAV_ROUTES[currentIndex - 1]);
      }
    },
    [location.pathname, navigate]
  );

  useEffect(() => {
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);
}
