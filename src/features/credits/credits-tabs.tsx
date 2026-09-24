import Link from "next/link";

/** Tabs of the Créditos module: the credits themselves and the abonos made to them. */
export function CreditsTabs({ active }: { active: "creditos" | "pagos" }) {
  const tabClass = (tab: "creditos" | "pagos") => `tab-link${active === tab ? " is-active" : ""}`;
  return (
    <nav className="tab-bar" aria-label="Secciones de créditos">
      <Link className={tabClass("creditos")} href="/creditos" aria-current={active === "creditos" ? "page" : undefined}>Créditos</Link>
      <Link className={tabClass("pagos")} href="/creditos/pagos" aria-current={active === "pagos" ? "page" : undefined}>Pagos de créditos</Link>
    </nav>
  );
}
