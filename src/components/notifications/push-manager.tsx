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
      console.log("Registering service worker...");
      navigator.serviceWorker.register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => {
          console.log("Service Worker ready:", reg);
          setRegistration(reg);
          reg.pushManager.getSubscription().then((sub) => {
            console.log("Current subscription:", sub);
            if (sub) {
              setSubscription(sub);
              setIsSubscribed(true);
            }
          });
        }).catch(err => {
          console.error("Service Worker registration failed:", err);
          // Only alert if we're not in a silent failure state
          if (typeof window !== "undefined" && !window.location.hostname.includes("localhost")) {
            alert("SW Registration failed: " + err.message);
          }
        });
    } else {
      console.warn("Service Worker or PushManager not supported");
    }
  }, []);

  const subscribeToPush = async () => {
    console.log("subscribeToPush called, registration:", !!registration);
    if (!registration) {
      alert("No service worker registration found. Please wait a moment and try again.");
      return;
    }

    try {
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      console.log("VAPID Key present:", !!publicVapidKey);
      if (!publicVapidKey) {
        alert("Configuration Error: Missing VAPID Public Key. Please contact support.");
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
    } catch (error: any) {
      console.error("Failed to subscribe", error);
      alert("Failed to subscribe: " + (error.message || "Unknown error"));
    }
  };

  const unsubscribeFromPush = async () => {
    console.log("unsubscribeFromPush called");
    if (subscription) {
      try {
        await subscription.unsubscribe();
        setIsSubscribed(false);
        setSubscription(null);
        alert("Unsubscribed from notifications.");
      } catch (error: any) {
        console.error("Failed to unsubscribe", error);
        alert("Failed to unsubscribe: " + (error.message || "Unknown error"));
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
