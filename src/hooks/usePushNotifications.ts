import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const VAPID_PUBLIC_KEY = "BLbnR-vBUrE6ZNzmAf65X-ZchHZ_cqWsVhtlYD_AlV8GZllwQV8wkxgfZcdO8v2FXUBgGB7J7Pa5wuFRUll0ywQ";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PushPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  useEffect(() => {
    if (!isSupported) { setPermission("unsupported"); return; }
    const sync = () => {
      const perm = Notification.permission as PushPermission;
      console.log('[PUSH] Notification.permission:', perm);
      setPermission(perm);
    };
    sync();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported) return;
    console.log('[PUSH] isSupported:', isSupported);
    console.log('[PUSH] VAPID_PUBLIC_KEY exists:', !!VAPID_PUBLIC_KEY);
    console.log('[PUSH] VAPID_PUBLIC_KEY value:', VAPID_PUBLIC_KEY?.substring(0, 20) + '...');
    navigator.serviceWorker.register("/sw.js")
      .then(reg => {
        console.log('[SW] registered, scope:', reg.scope);
        console.log('[SW] active:', !!reg.active);
        console.log('[SW] installing:', !!reg.installing);
      })
      .catch(err => console.error('[SW] registration error:', err));
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported || !user) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });
  }, [isSupported, user]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !user || !VAPID_PUBLIC_KEY) return;
    console.log('[PUSH] subscribe called');
    console.log('[PUSH] user:', user?.id);
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      console.log('[PUSH] SW ready, subscribing...');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const subJson = sub.toJSON();
      console.log('[PUSH] subscription obtained:', JSON.stringify(subJson).substring(0, 100));
      await supabase
        .from("profiles")
        .update({ push_subscription: subJson as any, push_enabled: true } as any)
        .eq("id", user.id);
      setIsSubscribed(true);
      setPermission("granted");
      console.log('[PUSH] subscribe SUCCESS');
    } catch (err: any) {
      if (err.name === "NotAllowedError") setPermission("denied");
      console.error('[PUSH] subscribe ERROR name:', err.name);
      console.error('[PUSH] subscribe ERROR message:', err.message);
      console.error('[PUSH] subscribe ERROR full:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !user) return;
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await supabase
        .from("profiles")
        .update({ push_subscription: null, push_enabled: false } as any)
        .eq("id", user.id);
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user]);

  return { isSupported, isSubscribed, permission, isLoading, subscribe, unsubscribe };
}
