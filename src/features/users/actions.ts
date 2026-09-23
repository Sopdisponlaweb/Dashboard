"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { CreateUserFormState, ResetPasswordState } from "./form-state";

const PROTECTED_ROLE_KEY = "administrator";

async function requireUsersManage() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (error || !userId) {
    return { ok: false as const, message: "Tu sesión no es válida o venció. Inicia sesión nuevamente." };
  }

  const { data: allowed, error: permError } = await supabase.rpc("has_permission", { permission_key: "users.manage" });
  if (permError || !allowed) {
    return { ok: false as const, message: "No tienes permiso para gestionar usuarios y accesos." };
  }

  return { ok: true as const, supabase, userId: userId as string };
}

function generateTemporaryPassword() {
  return randomBytes(9).toString("base64url");
}

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresa un correo válido."),
  displayName: z.string().trim().min(2, "Escribe el nombre completo.").max(120, "Máximo 120 caracteres."),
  roleKey: z.enum(["administrator", "operator", "viewer"], { message: "Selecciona un rol." }),
});

export async function createUser(
  _previousState: CreateUserFormState,
  formData: FormData,
): Promise<CreateUserFormState> {
  const parsed = createUserSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    roleKey: String(formData.get("roleKey") ?? ""),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa el formulario." };
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", message: "Activa Supabase local para crear usuarios." };
  }

  const auth = await requireUsersManage();
  if (!auth.ok) return { status: "error", message: auth.message };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { status: "error", message: "Falta configurar SUPABASE_SECRET_KEY en el servidor para crear usuarios." };
  }

  const temporaryPassword = generateTemporaryPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { display_name: parsed.data.displayName },
  });

  if (createError || !created.user) {
    const message = createError?.message.toLowerCase().includes("already been registered")
      ? "Ya existe un usuario con ese correo."
      : "No fue posible crear el usuario. Intenta de nuevo.";
    return { status: "error", message };
  }

  const { data: role } = await auth.supabase.from("roles").select("id").eq("key", parsed.data.roleKey).maybeSingle();
  if (role) {
    await auth.supabase.from("user_roles").insert({ user_id: created.user.id, role_id: role.id, assigned_by: auth.userId });
  }

  revalidatePath("/usuarios");
  return {
    status: "created",
    message: `Usuario ${parsed.data.email} creado. Contraseña temporal: ${temporaryPassword} — compártela por un canal seguro; pídele que la cambie al ingresar.`,
  };
}

export async function updateUserRole(userId: string, roleKey: string) {
  const auth = await requireUsersManage();
  if (!auth.ok) return;

  const { data: role } = await auth.supabase.from("roles").select("id").eq("key", roleKey).maybeSingle();
  if (!role) return;

  await auth.supabase.from("user_roles").delete().eq("user_id", userId);
  await auth.supabase.from("user_roles").insert({ user_id: userId, role_id: role.id, assigned_by: auth.userId });

  revalidatePath("/usuarios");
}

export async function toggleUserActive(userId: string, nextValue: boolean) {
  const auth = await requireUsersManage();
  if (!auth.ok) return;

  await auth.supabase.from("profiles").update({ is_active: nextValue }).eq("id", userId);
  revalidatePath("/usuarios");
}

export async function resetUserPassword(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _previousState: ResetPasswordState,
): Promise<ResetPasswordState> {
  const auth = await requireUsersManage();
  if (!auth.ok) return { status: "error", message: auth.message };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { status: "error", message: "Falta configurar SUPABASE_SECRET_KEY en el servidor." };
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: temporaryPassword });
  if (error) return { status: "error", message: "No fue posible restablecer la contraseña." };

  revalidatePath("/usuarios");
  return { status: "done", message: "Contraseña restablecida. Esto también cierra sus sesiones activas.", temporaryPassword };
}

export async function updateRolePermission(roleId: string, roleKey: string, permissionId: string, granted: boolean) {
  const auth = await requireUsersManage();
  if (!auth.ok) return;
  if (roleKey === PROTECTED_ROLE_KEY) return;

  if (granted) {
    await auth.supabase.from("role_permissions").insert({ role_id: roleId, permission_id: permissionId });
  } else {
    await auth.supabase.from("role_permissions").delete().eq("role_id", roleId).eq("permission_id", permissionId);
  }

  revalidatePath("/usuarios");
}
