import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { MonthlyCollection } from "./format";

export { formatCompactCurrency, percentChange, type MonthlyCollection } from "./format";

export type ActivityKind =
  | "payment_receipts" | "credit_installments" | "credits" | "affiliates" | "beneficiaries"
  | "affiliate_successions" | "credit_clearances" | "payment_batches" | "member_documents";

export type ActivityEvent = {
  kind: ActivityKind;
  occurredAt: string;
  affiliateId: string | null;
  affiliateName: string | null;
  actorName: string | null;
  totalAmount: number | null;
  amount: number | null;
  monthsCount: number | null;
  receiptNumber: number | null;
  clearanceNumber: number | null;
  rowCount: number | null;
  title: string | null;
  successorName: string | null;
  personName: string | null;
};

export type DashboardInsights = {
  today: string;
  currentMonth: string;
  lastClosedMonth: string;
  /** 12 closed months + the current one, oldest first. */
  monthly: MonthlyCollection[];
  activeCount: number;
  activePaidLastMonth: number;
  atRiskCount: number;
  beneficiariesWaiting: number;
  invalidJoinDates: number;
  futurePayments: number;
  credits: {
    activeCount: number;
    outstanding: number;
    pausedCount: number;
    pausedOutstanding: number;
    collectedThisMonth: number;
    clearancesPending: number;
  };
  recentActivity: ActivityEvent[];
};

const num = (value: unknown) => (value === null || value === undefined || value === "" ? null : Number(value));

export const getDashboardInsights = cache(async (): Promise<DashboardInsights | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_dashboard_insights");
  if (error) throw new Error(`No fue posible calcular los indicadores del resumen: ${error.message}`);

  const row = data as Record<string, unknown>;
  const credits = (row.credits ?? {}) as Record<string, unknown>;
  return {
    today: row.today as string,
    currentMonth: row.currentMonth as string,
    lastClosedMonth: row.lastClosedMonth as string,
    monthly: ((row.monthly as Record<string, unknown>[] | null) ?? []).map((month) => ({
      period: month.period as string,
      amount: Number(month.amount),
      payments: Number(month.payments),
      payers: Number(month.payers),
    })),
    activeCount: Number(row.activeCount ?? 0),
    activePaidLastMonth: Number(row.activePaidLastMonth ?? 0),
    atRiskCount: Number(row.atRiskCount ?? 0),
    beneficiariesWaiting: Number(row.beneficiariesWaiting ?? 0),
    invalidJoinDates: Number(row.invalidJoinDates ?? 0),
    futurePayments: Number(row.futurePayments ?? 0),
    credits: {
      activeCount: Number(credits.activeCount ?? 0),
      outstanding: Number(credits.outstanding ?? 0),
      pausedCount: Number(credits.pausedCount ?? 0),
      pausedOutstanding: Number(credits.pausedOutstanding ?? 0),
      collectedThisMonth: Number(credits.collectedThisMonth ?? 0),
      clearancesPending: Number(credits.clearancesPending ?? 0),
    },
    recentActivity: ((row.recentActivity as Record<string, unknown>[] | null) ?? []).map((event) => ({
      kind: event.kind as ActivityKind,
      occurredAt: event.occurred_at as string,
      affiliateId: (event.affiliate_id as string | null) ?? null,
      affiliateName: (event.affiliate_name as string | null) ?? null,
      actorName: (event.actor_name as string | null) ?? null,
      totalAmount: num(event.total_amount),
      amount: num(event.amount),
      monthsCount: num(event.months_count),
      receiptNumber: num(event.receipt_number),
      clearanceNumber: num(event.clearance_number),
      rowCount: num(event.row_count),
      title: (event.title as string | null) ?? null,
      successorName: (event.successor_name as string | null) ?? null,
      personName: ((event.person_name as string | null) ?? "").trim() || null,
    })),
  };
});
