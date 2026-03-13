import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const LAST_ROUTE_KEY = "fcs_last_route";
const EXCLUDED_ROUTES = ["/", "/auth", "/reset-password"];

export function useSaveLastRoute() {
  const location = useLocation();
  useEffect(() => {
    if (!EXCLUDED_ROUTES.includes(location.pathname)) {
      localStorage.setItem(LAST_ROUTE_KEY, location.pathname);
    }
  }, [location.pathname]);
}

export function getLastRoute(): string {
  return localStorage.getItem(LAST_ROUTE_KEY) || "/";
}

export function clearLastRoute() {
  localStorage.removeItem(LAST_ROUTE_KEY);
}
