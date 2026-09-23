import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "./env";

// Service-role client: bypasses RLS entirely. Never import this from client code,
// and never call it without first checking the caller's own permission via a
// session-bound client (see requirePermission in features/users/actions.ts).
export function createAdminClient() {
  const { url } = getSupabasePublicEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Falta la variable de entorno SUPABASE_SECRET_KEY.");
  }

  return createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
