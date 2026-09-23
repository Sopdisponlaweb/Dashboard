import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type CurrentUserProfile = {
  displayName: string;
  roleName: string | null;
  initials: string;
};

const demoProfile: CurrentUserProfile = {
  displayName: "Andrea Suárez",
  roleName: "Administración",
  initials: "AS",
};

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toLocaleUpperCase("es-CO");
  return initials || "U";
}

type RoleEmbed = { name: string } | { name: string }[] | null;

function extractRoleName(roles: RoleEmbed) {
  if (!roles) return null;
  return Array.isArray(roles) ? (roles[0]?.name ?? null) : (roles.name ?? null);
}

export async function getCurrentUserProfile(): Promise<CurrentUserProfile> {
  if (!isSupabaseConfigured()) return demoProfile;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) return demoProfile;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  const displayName = profile?.display_name ?? demoProfile.displayName;
  const roleName = extractRoleName((roleRow?.roles as RoleEmbed) ?? null);

  return { displayName, roleName, initials: initialsFrom(displayName) };
}
