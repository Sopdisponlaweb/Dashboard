import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type Announcement = {
  id: string;
  title: string;
  message: string;
  startsAt: string;
  endsAt: string;
  isPublished: boolean;
  createdAt: string;
};

function mapAnnouncementRow(row: Record<string, unknown>): Announcement {
  return {
    id: row.id as string,
    title: row.title as string,
    message: row.message as string,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    isPublished: row.is_published as boolean,
    createdAt: row.created_at as string,
  };
}

export async function listAnnouncements(): Promise<Announcement[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, message, starts_at, ends_at, is_published, created_at")
    .order("starts_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(`No fue posible cargar los avisos: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(mapAnnouncementRow);
}

export async function listActiveAnnouncements(): Promise<Announcement[]> {
  if (!isSupabaseConfigured()) return [];

  const nowIso = new Date().toISOString();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, message, starts_at, ends_at, is_published, created_at")
    .eq("is_published", true)
    .lte("starts_at", nowIso)
    .gte("ends_at", nowIso)
    .order("starts_at", { ascending: false })
    .limit(3);

  if (error) throw new Error(`No fue posible cargar los avisos vigentes: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(mapAnnouncementRow);
}
