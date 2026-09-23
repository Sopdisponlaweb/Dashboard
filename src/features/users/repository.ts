import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type UserRecord = {
  id: string;
  displayName: string;
  email: string | null;
  isActive: boolean;
  roleKey: string | null;
  roleName: string | null;
  lastSignInAt: string | null;
  createdAt: string;
};

type RoleEmbed = { key: string; name: string } | { key: string; name: string }[] | null;

function extractRole(roles: RoleEmbed) {
  if (!roles) return null;
  return Array.isArray(roles) ? (roles[0] ?? null) : roles;
}

export async function listUsers(): Promise<UserRecord[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name, is_active, created_at, user_roles!user_id(roles(key, name))")
    .order("display_name", { ascending: true });

  if (error) throw new Error(`No fue posible cargar los usuarios: ${error.message}`);

  const authInfoById = new Map<string, { email: string | null; lastSignInAt: string | null }>();
  try {
    const admin = createAdminClient();
    const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of authUsers?.users ?? []) {
      authInfoById.set(user.id, { email: user.email ?? null, lastSignInAt: user.last_sign_in_at ?? null });
    }
  } catch {
    // SUPABASE_SECRET_KEY not available in this environment; continue without email/last sign-in.
  }

  return (profiles ?? []).map((row) => {
    const roleEmbed = row.user_roles as unknown as { roles: RoleEmbed }[] | null;
    const role = extractRole(roleEmbed?.[0]?.roles ?? null);
    const authInfo = authInfoById.get(row.id as string);

    return {
      id: row.id as string,
      displayName: row.display_name as string,
      isActive: row.is_active as boolean,
      createdAt: row.created_at as string,
      roleKey: role?.key ?? null,
      roleName: role?.name ?? null,
      email: authInfo?.email ?? null,
      lastSignInAt: authInfo?.lastSignInAt ?? null,
    };
  });
}

export type RoleRecord = { id: string; key: string; name: string; description: string | null };

export async function listRoles(): Promise<RoleRecord[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.from("roles").select("id, key, name, description").order("name");
  if (error) throw new Error(`No fue posible cargar los roles: ${error.message}`);
  return (data ?? []) as RoleRecord[];
}

export type PermissionRecord = { id: string; key: string; name: string; description: string | null };

export async function listPermissions(): Promise<PermissionRecord[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.from("permissions").select("id, key, name, description").order("key");
  if (error) throw new Error(`No fue posible cargar los permisos: ${error.message}`);
  return (data ?? []) as PermissionRecord[];
}

export async function listRolePermissionPairs(): Promise<Set<string>> {
  if (!isSupabaseConfigured()) return new Set();

  const supabase = await createClient();
  const { data, error } = await supabase.from("role_permissions").select("role_id, permission_id");
  if (error) throw new Error(`No fue posible cargar la matriz de permisos: ${error.message}`);
  return new Set((data ?? []).map((row) => `${row.role_id}:${row.permission_id}`));
}

export async function canManageUsers(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", { permission_key: "users.manage" });
  if (error) return false;
  return Boolean(data);
}
