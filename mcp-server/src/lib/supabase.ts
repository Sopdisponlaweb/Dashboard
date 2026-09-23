import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;
let cachedUserId: string | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`);
  return value;
}

export async function getAuthenticatedClient(): Promise<{ supabase: SupabaseClient; userId: string }> {
  if (cachedClient && cachedUserId) return { supabase: cachedClient, userId: cachedUserId };

  const url = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const email = requiredEnv("MCP_SUPABASE_EMAIL");
  const password = requiredEnv("MCP_SUPABASE_PASSWORD");

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: true, persistSession: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    throw new Error(`No fue posible iniciar sesión en Sopdisponal: ${error?.message ?? "credenciales inválidas"}.`);
  }

  cachedClient = supabase;
  cachedUserId = data.user.id;
  return { supabase, userId: data.user.id };
}
