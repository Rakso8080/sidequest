import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let cachedEvent: BeforeInstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    cachedEvent = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event("sq:pwa-ready"));
  });
  window.addEventListener("appinstalled", () => {
    cachedEvent = null;
    window.dispatchEvent(new Event("sq:pwa-ready"));
  });
}

/** True when the browser offers an install prompt AND it's not installed yet. */
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const update = () => setCanInstall(!!cachedEvent);
    update();
    window.addEventListener("sq:pwa-ready", update);
    return () => window.removeEventListener("sq:pwa-ready", update);
  }, []);

  const install = async () => {
    if (!cachedEvent) return;
    await cachedEvent.prompt();
    cachedEvent = null;
    setCanInstall(false);
  };

  return { canInstall, install };
}
