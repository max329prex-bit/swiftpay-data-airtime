import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
serve((_) => new Response("OK", { status: 200 }));
