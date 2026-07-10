import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Broadcast {
  active: boolean;
  message: string;
  type: "info" | "warning" | "error";
  title?: string;
}

export interface Notification {
  id: string;
  title: string | null;
  message: string;
  type: "info" | "warning" | "error";
  is_read: boolean;
  created_at: string;
}

export function useBroadcast(): Broadcast | null {
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);

  useEffect(() => {
    // Initial fetch
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "broadcast_message")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setBroadcast(data.value as unknown as Broadcast);
      });
  }, []);

  return broadcast;
}

/** Realtime notifications for the current user */
export function useNotifications(): {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  loading: boolean;
} {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (!user) { setNotifications([]); setLoading(false); return; }

    // Initial fetch
    supabase
      .from("notifications")
      .select("id, title, message, type, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!error && data) setNotifications(data as Notification[]);
        setLoading(false);
      });

    // Realtime subscription for new notifications
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications(prev => [newNotif, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications(prev =>
            prev.map(n => n.id === updated.id ? updated : n)
          );
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  async function markRead(id: string) {
    await supabase.rpc("mark_notification_read", { _id: id });
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
  }

  async function markAllRead() {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  return { notifications, unreadCount, markRead, markAllRead, loading };
}
