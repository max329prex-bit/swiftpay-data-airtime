import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  // GSubz electricity serviceIDs (verified from official Postman docs)
  const GSUBZ_ELECTRICITY_PROVIDERS = [
    { name: "Ikeja Electric (IKEDC)", code: "ikeja-electric" },
    { name: "Eko Electricity (EKEDC)", code: "eko-electric" },
    { name: "Abuja Electricity (AEDC)", code: "abuja-electric" },
    { name: "Port Harcourt Electric (PHEDC)", code: "portharcourt-electric" },
    { name: "Enugu Electricity (EEDC)", code: "enugu-electric" },
    { name: "Benin Electricity (BEDC)", code: "benin-electric" },
    { name: "Ibadan Electricity (IBEDC)", code: "ibadan-electric" },
    { name: "Kaduna Electricity (KAEDCO)", code: "kaduna-electric" },
    { name: "Kano Electricity (KEDCO)", code: "kano-electric" },
    { name: "Jos Electricity (JEDC)", code: "jos-electic" },
    { name: "Yola Electricity (YEDC)", code: "yola-electric" },
    { name: "Aba Electricity (ABA)", code: "aba-electric" },
  ];

  serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    return new Response(JSON.stringify({ success: true, providers: GSUBZ_ELECTRICITY_PROVIDERS }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  });
  