import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

type SearchParams = Promise<{ redirectTo?: string | string[] }>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const redirectTo = firstValue(params.redirectTo) ?? "/";

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand">
          <span className="brand-mark">SP</span>
          <span>
            <span className="brand-name">Sopdisponal</span>
            <span className="brand-caption">Gestión administrativa</span>
          </span>
        </div>
        <h1>Iniciar sesión</h1>
        <p>Ingresa con tu cuenta para acceder al panel administrativo.</p>
        <LoginForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}
