"use client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushStatus =
  | "unsupported"
  | "not-pwa"
  | "denied"
  | "default"
  | "subscribed";

export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS legacy
  return Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone
  );
}

export async function getPushStatus(): Promise<PushStatus> {
  if (typeof window === "undefined") return "unsupported";
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  // iOS only allows push from a home-screen PWA
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS && !isStandalonePWA()) return "not-pwa";

  const perm = Notification.permission;
  if (perm === "denied") return "denied";
  if (perm === "default") return "default";

  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return "default";
  const sub = await reg.pushManager.getSubscription();
  return sub ? "subscribed" : "default";
}

export async function subscribePush(
  publicKey: string
): Promise<PushSubscription | null> {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return null;
  }
  let reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) {
    reg = await navigator.serviceWorker.register("/sw.js");
  }
  await navigator.serviceWorker.ready;

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return null;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = urlBase64ToUint8Array(publicKey);
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key.buffer.slice(
        key.byteOffset,
        key.byteOffset + key.byteLength
      ) as ArrayBuffer,
    });
  }
  return sub;
}

export async function unsubscribePush(): Promise<string | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return null;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}
