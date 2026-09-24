import type { AffiliateStatus, AffiliationSource } from "@/features/affiliates/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type PaymentGapSummary = {
  affiliates: number;
  gaps: number;
  missingMonths: number;
  /** Gaps of exactly one month: the typical typo. */
  singleMonthGaps: number;
  activeAffiliates: number;
  allTimeAffiliates: number;
};

export type PaymentGapAffiliate = {
  affiliateId: string;
  name: string;
  document: string;
  status: AffiliateStatus;
  source: AffiliationSource;
  gapCount: number;
  missingMonths: number;
  latestMissing: string;
  /** Newest first, up to 12 (YYYY-MM). */
  missingList: string[];
};

export type PaymentGapFilters = {
  /** First month of the window (YYYY-MM-01); null = whole history. */
  since: string | null;
  query?: string;
  kind?: "all" | "single" | "multi";
  status?: AffiliateStatus | "all";
  page?: number;
  pageSize?: number;
};

const emptySummary: PaymentGapSummary = { affiliates: 0, gaps: 0, missingMonths: 0, singleMonthGaps: 0, activeAffiliates: 0, allTimeAffiliates: 0 };

export async function getPaymentGapSummary(since: string | null): Promise<PaymentGapSummary> {
  if (!isSupabaseConfigured()) return emptySummary;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_payment_gap_summary", { p_since: since });
  if (error) throw new Error(`No fue posible calcular la continuidad de pagos: ${error.message}`);
  const row = data as Record<string, unknown>;
  return {
    affiliates: Number(row.affiliates ?? 0),
    gaps: Number(row.gaps ?? 0),
    missingMonths: Number(row.missingMonths ?? 0),
    singleMonthGaps: Number(row.singleMonthGaps ?? 0),
    activeAffiliates: Number(row.activeAffiliates ?? 0),
    allTimeAffiliates: Number(row.allTimeAffiliates ?? 0),
  };
}

export async function listPaymentGapAffiliates(filters: PaymentGapFilters) {
  if (!isSupabaseConfigured()) return { records: [] as PaymentGapAffiliate[], totalCount: 0 };

  const { since, query = "", kind = "all", status = "all", page = 1, pageSize = 50 } = filters;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_payment_gap_affiliates", {
    p_since: since,
    p_query: query.trim() || null,
    p_kind: kind,
    p_status: status === "all" ? null : status,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw new Error(`No fue posible cargar los pagos sin continuidad: ${error.message}`);

  const rows = (data ?? []) as Record<string, unknown>[];
  return {
    totalCount: rows.length ? Number(rows[0].total_count) : 0,
    records: rows.map((row) => ({
      affiliateId: row.affiliate_id as string,
      name: `${row.first_names as string} ${row.last_names as string}`.trim(),
      document: `${row.document_type as string} ${row.document_number as string}`,
      status: row.status as AffiliateStatus,
      source: row.source as AffiliationSource,
      gapCount: Number(row.gap_count),
      missingMonths: Number(row.missing_months),
      latestMissing: (row.latest_missing as string).slice(0, 7),
      missingList: ((row.missing_list as string[] | null) ?? []).map((month) => month.slice(0, 7)),
    })),
  };
}
