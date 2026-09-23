type DataSourceBadgeProps = {
  connected: boolean;
  connectedLabel?: string;
  disconnectedLabel?: string;
};

export function DataSourceBadge({
  connected,
  connectedLabel = "Conectado a Supabase local",
  disconnectedLabel = "Datos locales de demostración",
}: DataSourceBadgeProps) {
  return (
    <span className={`demo-badge${connected ? " is-connected" : ""}`}>
      {connected ? connectedLabel : disconnectedLabel}
    </span>
  );
}
