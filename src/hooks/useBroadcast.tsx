import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Broadcast {
  active: boolean;
  message: string;
  type: "info" | "warning" | "error";
  title?: string;
}

export function useBroadcast(): Broadcast | null {
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);

  useEffect(() => {
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
