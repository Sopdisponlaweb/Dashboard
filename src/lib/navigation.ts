import type { IconName } from "@/components/icons";

export type NavigationItem = {
  href: string;
  label: string;
  icon: IconName;
};

export const primaryNavigation: NavigationItem[] = [
  { href: "/", label: "Resumen", icon: "dashboard" },
  { href: "/consulta", label: "Consulta integral", icon: "search" },
  { href: "/afiliados", label: "Afiliados", icon: "users" },
  { href: "/beneficiarios", label: "Beneficiarios", icon: "heart" },
  { href: "/pagos", label: "Pagos", icon: "wallet" },
  { href: "/creditos", label: "Créditos", icon: "creditCard" },
  { href: "/importaciones", label: "Importaciones", icon: "upload" },
  { href: "/documentos", label: "Documentos", icon: "file" },
  { href: "/reportes", label: "Reportes", icon: "chart" },
];

export const secondaryNavigation: NavigationItem[] = [
  { href: "/avisos", label: "Avisos", icon: "calendar" },
  { href: "/notificaciones", label: "Notificaciones", icon: "bell" },
  { href: "/catalogos", label: "Catálogos", icon: "layers" },
  { href: "/usuarios", label: "Usuarios y accesos", icon: "lock" },
  { href: "/auditoria", label: "Auditoría", icon: "history" },
  { href: "/asistente", label: "Asistente IA", icon: "message" },
];
