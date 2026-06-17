// KoraPay has been removed. This stub returns 200 so legacy retries don't loop forever.
// All deposits now go through PayVessel (payvessel-webhook).
Deno.serve(async (_req) => {
  return new Response(JSON.stringify({ status: "success" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
