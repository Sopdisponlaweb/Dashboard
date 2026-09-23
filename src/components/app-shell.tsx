"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { signOut } from "@/features/auth/actions";
import type { CurrentUserProfile } from "@/features/auth/session";
import { primaryNavigation, secondaryNavigation } from "@/lib/navigation";

function NavigationGroup({ label, items, closeNavigation }: { label: string; items: typeof primaryNavigation; closeNavigation: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="nav-section" aria-label={label}>
      <p className="nav-label">{label}</p>
      <ul className="nav-list">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link href={item.href} className="nav-link" aria-current={active ? "page" : undefined} onClick={closeNavigation}>
                <Icon name={item.icon} size={19} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type AppShellProps = {
  children: React.ReactNode;
  user: CurrentUserProfile;
  persistenceEnabled: boolean;
  unreadNotificationCount: number;
};

export function AppShell({ children, user, persistenceEnabled, unreadNotificationCount }: AppShellProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const router = useRouter();

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = String(formData.get("query") ?? "").trim();

    router.push(query ? `/consulta?q=${encodeURIComponent(query)}` : "/consulta");
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenido-principal">Saltar al contenido</a>

      <aside className={`sidebar${navigationOpen ? " is-open" : ""}`}>
        <Link href="/" className="brand" onClick={() => setNavigationOpen(false)}>
          <span className="brand-mark">SP</span>
          <span>
            <span className="brand-name">Sopdisponal</span>
            <span className="brand-caption">Gestión administrativa</span>
          </span>
        </Link>
        <NavigationGroup label="Operación" items={primaryNavigation} closeNavigation={() => setNavigationOpen(false)} />
        <NavigationGroup label="Administración" items={secondaryNavigation} closeNavigation={() => setNavigationOpen(false)} />
        <div className="sidebar-footer">
          <div className={`environment-card${persistenceEnabled ? " is-connected" : ""}`}>
            <strong>{persistenceEnabled ? "Supabase local conectado" : "Entorno local"}</strong>
            <span>{persistenceEnabled ? "Las escrituras se guardan en tu base de datos local." : "Supabase se conectará cuando esté disponible Docker."}</span>
          </div>
        </div>
      </aside>

      <button type="button" className={`backdrop${navigationOpen ? " is-open" : ""}`} aria-label="Cerrar navegación" onClick={() => setNavigationOpen(false)} />

      <div className="main-column">
        <header className="topbar">
          <button type="button" className="mobile-menu-button" aria-label="Abrir navegación" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(true)}>
            <Icon name="menu" />
          </button>
          <form className="global-search" role="search" onSubmit={handleSearch}>
            <label className="sr-only" htmlFor="global-search">Buscar en la plataforma</label>
            <Icon name="search" size={18} />
            <input id="global-search" name="query" type="search" placeholder="Buscar afiliado, cédula o pago" aria-label="Buscar afiliado, cédula o pago" />
          </form>
          <div className="topbar-actions">
            <Link href="/notificaciones" className="icon-button notification-button" aria-label={`Ver notificaciones${unreadNotificationCount ? ` (${unreadNotificationCount} sin leer)` : ""}`}>
              <Icon name="bell" size={19} />
              {unreadNotificationCount > 0 ? <span className="notification-dot" /> : null}
            </Link>
            <div className="profile-summary" aria-label="Usuario actual">
              <span className="profile-avatar">{user.initials}</span>
              <span className="profile-copy">
                <span className="profile-name">{user.displayName}</span>
                <span className="profile-role">{user.roleName ?? "Sin rol asignado"}</span>
              </span>
            </div>
            {persistenceEnabled ? (
              <form action={signOut}>
                <button type="submit" className="icon-button" aria-label="Cerrar sesión"><Icon name="lock" size={18} /></button>
              </form>
            ) : null}
          </div>
        </header>
        <main id="contenido-principal" className="page-content">{children}</main>
      </div>
    </div>
  );
}
