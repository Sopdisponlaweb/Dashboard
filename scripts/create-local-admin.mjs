// One-off helper for local development: creates a Supabase Auth user and
// links it to a role (default: administrator) via public.user_roles.
// Usage: node scripts/create-local-admin.mjs <email> <password> [roleKey]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEnvLocal() {
  const envPath = path.join(projectRoot, ".env.local");
  const content = readFileSync(envPath, "utf8");
  const values = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    values[trimmed.slice(0, separatorIndex)] = trimmed.slice(separatorIndex + 1);
  }

  return values;
}

const [email, password, roleKey = "administrator"] = process.argv.slice(2);

if (!email || !password) {
  console.error("Uso: node scripts/create-local-admin.mjs <email> <password> [roleKey]");
  process.exit(1);
}

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SECRET_KEY;

if (!url || !serviceKey) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: userData, error: userError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { display_name: email.split("@")[0] },
});

if (userError) {
  console.error("No se pudo crear el usuario:", userError.message);
  process.exit(1);
}

const userId = userData.user.id;

const { data: role, error: roleError } = await admin
  .from("roles")
  .select("id, name")
  .eq("key", roleKey)
  .single();

if (roleError) {
  console.error(`No se encontró el rol '${roleKey}':`, roleError.message);
  process.exit(1);
}

const { error: linkError } = await admin
  .from("user_roles")
  .upsert({ user_id: userId, role_id: role.id, assigned_by: userId });

if (linkError) {
  console.error("No se pudo asignar el rol:", linkError.message);
  process.exit(1);
}

console.log(`Usuario ${email} creado (id: ${userId}) y asignado al rol '${role.name}'.`);
