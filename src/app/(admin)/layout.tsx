import { AppShell } from "@/components/app-shell";
import { getCurrentUserProfile } from "@/features/auth/session";
import { getUnreadNotificationCount } from "@/features/notifications/repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const persistenceEnabled = isSupabaseConfigured();
  const [user, unreadNotificationCount] = await Promise.all([
    getCurrentUserProfile(),
    persistenceEnabled ? getUnreadNotificationCount() : Promise.resolve(0),
  ]);

  return (
    <AppShell user={user} persistenceEnabled={persistenceEnabled} unreadNotificationCount={unreadNotificationCount}>
      {children}
    </AppShell>
  );
}
