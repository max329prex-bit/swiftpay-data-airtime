// KoraPay has been removed. All wallet funding goes through PayVessel (payvessel-topup).
Deno.serve(async (_req) => {
  return new Response(
    JSON.stringify({ error: "KoraPay is no longer supported. Use PayVessel to fund your wallet." }),
    { status: 410, headers: { "Content-Type": "application/json" } }
  );
});
