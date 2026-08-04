import { api } from "../api/client";

export type PushState = "unavailable" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready;
}

export function isSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getPushState(): Promise<PushState> {
  if (!isSupported()) return "unavailable";
  if (Notification.permission === "denied") return "denied";
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  return sub ? "on" : "off";
}

export async function enablePush(): Promise<void> {
  if (!isSupported()) throw new Error("not-supported");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("denied");

  const { public_key } = await api.get<{ public_key: string }>("/notifications/vapid-public-key");
  const reg = await getRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key) as BufferSource,
    });
  }
  const p256dh = sub.getKey("p256dh");
  const auth = sub.getKey("auth");
  if (!p256dh || !auth) throw new Error("no-keys");

  function toBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  await api.post("/notifications/subscribe", {
    endpoint: sub.endpoint,
    p256dh: toBase64(p256dh),
    auth: toBase64(auth),
  });
}

export async function disablePush(): Promise<void> {
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await sub.unsubscribe();
    try {
      await api.post("/notifications/unsubscribe", {
        endpoint: sub.endpoint,
        p256dh: "",
        auth: "",
      });
    } catch {
      /* ignore — subscription is already gone locally */
    }
  }
}
