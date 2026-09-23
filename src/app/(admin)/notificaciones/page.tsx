import type { Metadata } from "next";

import { DataSourceBadge } from "@/components/data-source-badge";
import { formatDate } from "@/features/affiliates/format";
import { markNotificationRead } from "@/features/notifications/actions";
import { NotificationForm } from "@/features/notifications/notification-form";
import {
  canManageNotifications,
  getCurrentUserId,
  listMyNotifications,
  listNotificationRecipients,
  type NotificationLevel,
} from "@/features/notifications/repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Notificaciones" };

const levelLabels: Record<NotificationLevel, string> = {
  info: "Información",
  success: "Éxito",
  warning: "Advertencia",
  critical: "Crítico",
};

const levelTone: Record<NotificationLevel, string> = {
  info: "level-info",
  success: "payment-paid",
  warning: "payment-pending",
  critical: "payment-reversed",
};

export default async function NotificationsPage() {
  const persistenceEnabled = isSupabaseConfigured();

  const [notifications, canManage, currentUserId] = await Promise.all([
    listMyNotifications(),
    canManageNotifications(),
    getCurrentUserId(),
  ]);
  const recipients = canManage ? await listNotificationRecipients() : [];
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Oficina</p>
          <h1>Notificaciones</h1>
          <p>Alertas personales y comunicados internos dirigidos a usuarios del sistema.</p>
        </div>
        <DataSourceBadge connected={persistenceEnabled} connectedLabel="Conectado a Supabase local" disconnectedLabel="Requiere conexión a Supabase" />
      </header>

      {canManage ? (
        <section className="detail-panel" aria-labelledby="notification-form-title">
          <div className="panel-header">
            <div>
              <h2 id="notification-form-title">Enviar notificación</h2>
              <p>Llega al bell de la persona elegida, o de todos los usuarios activos.</p>
            </div>
          </div>
          <NotificationForm recipients={recipients} />
        </section>
      ) : null}

      <section className="detail-panel" aria-labelledby="notification-list-title">
        <div className="panel-header">
          <div>
            <h2 id="notification-list-title">Bandeja</h2>
            <p>Notificaciones dirigidas a ti y comunicados generales.</p>
          </div>
          <span className="panel-tag">{unreadCount} sin leer</span>
        </div>

        {notifications.length ? (
          <ul className="notification-list">
            {notifications.map((notification) => {
              const canMarkRead = !notification.readAt && (notification.recipientId === currentUserId || canManage);
              return (
                <li className={`notification-item${notification.readAt ? "" : " is-unread"}`} key={notification.id}>
                  <span className={`payment-badge ${levelTone[notification.level]}`}>{levelLabels[notification.level]}</span>
                  <div>
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                    <small>{formatDate(notification.createdAt.slice(0, 10))} · {notification.recipientId ? "Personal" : "Para todos"}</small>
                  </div>
                  {canMarkRead ? (
                    <form action={markNotificationRead.bind(null, notification.id)}>
                      <button className="row-action" type="submit">Marcar como leída</button>
                    </form>
                  ) : notification.readAt ? <span className="inline-empty">Leída</span> : null}
                </li>
              );
            })}
          </ul>
        ) : <p className="inline-empty">No tienes notificaciones.</p>}
      </section>
    </>
  );
}
