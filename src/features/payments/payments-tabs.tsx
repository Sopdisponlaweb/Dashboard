import Link from "next/link";

type PaymentsTab = "pagos" | "continuidad";

/** Tabs of the Pagos module: the payment history and the continuity check. */
export function PaymentsTabs({ active }: { active: PaymentsTab }) {
  const tabClass = (tab: PaymentsTab) => `tab-link${active === tab ? " is-active" : ""}`;
  return (
    <nav className="tab-bar" aria-label="Secciones de pagos">
      <Link className={tabClass("pagos")} href="/pagos" aria-current={active === "pagos" ? "page" : undefined}>Pagos</Link>
      <Link className={tabClass("continuidad")} href="/pagos/continuidad" aria-current={active === "continuidad" ? "page" : undefined}>Continuidad de pagos</Link>
    </nav>
  );
}
