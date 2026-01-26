"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushManager() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    ) {
      // Register service worker
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        setRegistration(reg);
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) {
            setSubscription(sub);
            setIsSubscribed(true);
          }
        });
      });
    }
  }, []);

  const subscribeToPush = async () => {
    if (!registration) return;

    try {
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });

      setSubscription(sub);
      setIsSubscribed(true);

      // Save to server
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sub),
      });

      alert("Configured notifications!");
    } catch (error) {
      console.error("Failed to subscribe", error);
    }
  };

  const unsubscribeFromPush = async () => {
    if (subscription) {
      // We could also call an API to remove it from DB, but for now we just unsubscribe locally
      // Ideally we should delete from DB
      try {
        await subscription.unsubscribe();
        setIsSubscribed(false);
        setSubscription(null);
        alert("Unsubscribed from notifications.");
      } catch (error) {
        console.error("Failed to unsubscribe", error);
      }
    }
  };

  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        type="button"
        onClick={isSubscribed ? unsubscribeFromPush : subscribeToPush}
        className="bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:opacity-90 transition-all"
        title={isSubscribed ? "Disable Notifications" : "Enable Notifications"}
      >
        {isSubscribed ? <BellOff size={24} /> : <Bell size={24} />}
      </button>
    </div>
  );
}
