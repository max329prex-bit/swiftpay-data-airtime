import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { toast } from "sonner";

export function usePushNotifications() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    (async () => {
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive === "prompt") perm = await PushNotifications.requestPermissions();
      if (perm.receive !== "granted") return;
      await PushNotifications.register();
    })();

    const a = PushNotifications.addListener("pushNotificationReceived", (n) => {
      toast(n.title ?? "Notification", { description: n.body });
    });
    return () => { a.then(h => h.remove()); };
  }, []);
}