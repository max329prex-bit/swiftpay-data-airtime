---
name: Supabase Edge Functions deploy in Replit
description: Why local Docker bundling fails in Replit and how to deploy Edge Functions successfully using the API path.
---

# Supabase Edge Functions deploy in Replit

## Rule
When deploying Supabase Edge Functions from a Replit workspace, the default `supabase functions deploy` path tries to pull a Docker image (`public.ecr.aws/supabase/edge-runtime`) and bundle the function locally. In the Replit environment this fails with DNS/name-resolution errors during Deno std module fetching, so it cannot complete.

**Use the API deploy path instead:**

```bash
SUPABASE_ACCESS_TOKEN=<management-token> npx supabase functions deploy <slug> ... --project-ref <ref> --use-api
```

## Why
The `--use-api` flag bypasses the local Docker bundler and sends the source to the Supabase platform, which handles the build. This avoids the network/DNS restrictions that break local bundling inside Replit.

## How to apply
- Always include `--use-api` for Edge Function deployments in Replit.
- `SUPABASE_ACCESS_TOKEN` is the same token used for the Supabase Management API.
- The Management API (`api.supabase.com`) can be used for listing secrets, applying SQL, and other operations that do not need local bundling.
