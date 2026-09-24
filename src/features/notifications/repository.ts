import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type NotificationLevel = "info" | "success" | "warning" | "critical";

export type NotificationRecord = {
  id: string;
  recipientId: string | null;
  level: NotificationLevel;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  /** What the notification is about, for system alerts (e.g. an affiliate with a payment gap). */
  entityType: string | null;
  entityId: string | null;
};

/** Where a system notification leads, if anywhere. */
export function notificationHref(notification: Pick<NotificationRecord, "entityType" | "entityId">) {
  if (notification.entityType === "affiliate" && notification.entityId) return `/afiliados/${notification.entityId}?tab=pagos`;
  if (notification.entityType === "payment_batch" || notification.entityType === "payment_gaps") return "/pagos/continuidad";
  return null;
}

function mapNotificationRow(row: Record<string, unknown>): NotificationRecord {
  return {
    id: row.id as string,
    recipientId: (row.recipient_id as string | null) ?? null,
    level: row.level as NotificationLevel,
    title: row.title as string,
    message: row.message as string,
    readAt: (row.read_at as string | null) ?? null,
    createdAt: row.created_at as string,
    entityType: (row.entity_type as string | null) ?? null,
    entityId: (row.entity_id as string | null) ?? null,
  };
}

export async function listMyNotifications(): Promise<NotificationRecord[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, recipient_id, level, title, message, read_at, created_at, entity_type, entity_id")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(`No fue posible cargar las notificaciones: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(mapNotificationRow);
}

export async function getUnreadNotificationCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) return 0;
  return count ?? 0;
}

export async function canManageNotifications(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", { permission_key: "notifications.manage" });
  if (error) return false;
  return Boolean(data);
}

export type NotificationRecipientOption = { id: string; displayName: string };

export async function listNotificationRecipients(): Promise<NotificationRecipientOption[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) return [];
  return (data ?? []).map((row) => ({ id: row.id as string, displayName: row.display_name as string }));
}

export async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
}
