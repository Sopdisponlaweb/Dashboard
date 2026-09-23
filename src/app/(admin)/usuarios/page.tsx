import type { Metadata } from "next";

import { DataSourceBadge } from "@/components/data-source-badge";
import { formatDate } from "@/features/affiliates/format";
import { toggleUserActive } from "@/features/users/actions";
import { CreateUserForm } from "@/features/users/create-user-form";
import { PermissionMatrix } from "@/features/users/permission-matrix";
import { ResetPasswordButton } from "@/features/users/reset-password-button";
import {
  canManageUsers,
  listPermissions,
  listRolePermissionPairs,
  listRoles,
  listUsers,
} from "@/features/users/repository";
import { UserRoleSelect } from "@/features/users/user-role-select";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Usuarios y accesos" };

export default async function UsersPage() {
  const persistenceEnabled = isSupabaseConfigured();
  const hasAccess = persistenceEnabled ? await canManageUsers() : false;

  const [users, roles, permissions, rolePermissionPairs] = hasAccess
    ? await Promise.all([listUsers(), listRoles(), listPermissions(), listRolePermissionPairs()])
    : [[], [], [], new Set<string>()];

  return (
    <>
      <header className="page-heading directory-heading">
        <div>
          <p className="eyebrow">Seguridad</p>
          <h1>Usuarios y accesos</h1>
          <p>Crea usuarios internos, asigna roles y controla qué puede hacer cada perfil.</p>
        </div>
        <DataSourceBadge connected={persistenceEnabled} connectedLabel="Conectado a Supabase local" disconnectedLabel="Requiere conexión a Supabase" />
      </header>

      {!persistenceEnabled ? (
        <p className="empty-hint">Esta sección requiere una conexión activa a Supabase.</p>
      ) : !hasAccess ? (
        <p className="empty-hint">No tienes el permiso &quot;users.manage&quot; para administrar usuarios y accesos.</p>
      ) : (
        <>
          <section className="detail-panel" aria-labelledby="create-user-title">
            <div className="panel-header">
              <div>
                <h2 id="create-user-title">Nuevo usuario</h2>
                <p>Se crea con una contraseña temporal que debe cambiar al ingresar.</p>
              </div>
            </div>
            <CreateUserForm roles={roles} />
          </section>

          <section className="detail-panel" aria-labelledby="users-title">
            <div className="panel-header">
              <div>
                <h2 id="users-title">Usuarios ({users.length})</h2>
                <p>Rol, estado de acceso y último ingreso.</p>
              </div>
            </div>

            <div className="data-table-wrap">
              <table className="data-table compact-table">
                <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Último ingreso</th><th>Acceso</th><th><span className="sr-only">Acciones</span></th></tr></thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td><strong>{user.displayName}</strong></td>
                      <td className="mono-value">{user.email ?? "—"}</td>
                      <td><UserRoleSelect userId={user.id} currentRoleKey={user.roleKey} roles={roles} /></td>
                      <td>{user.lastSignInAt ? formatDate(user.lastSignInAt.slice(0, 10)) : "Nunca"}</td>
                      <td><span className={`payment-badge ${user.isActive ? "payment-paid" : "payment-reversed"}`}>{user.isActive ? "Activo" : "Bloqueado"}</span></td>
                      <td>
                        <div className="row-actions-cell">
                          <form action={toggleUserActive.bind(null, user.id, !user.isActive)}>
                            <button className="row-action" type="submit">{user.isActive ? "Bloquear" : "Reactivar"}</button>
                          </form>
                          <ResetPasswordButton userId={user.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="detail-panel" aria-labelledby="permissions-title">
            <div className="panel-header">
              <div>
                <h2 id="permissions-title">Permisos por rol</h2>
                <p>Administrador conserva siempre todos los permisos y no es editable, para evitar bloqueos accidentales.</p>
              </div>
            </div>
            <PermissionMatrix roles={roles} permissions={permissions} initialGranted={Array.from(rolePermissionPairs)} />
          </section>
        </>
      )}
    </>
  );
}
