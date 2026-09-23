import type { ApplyImportResult } from "@/features/affiliates/repository";

import type { ImportPreview } from "./parse";

export type ImportBatchState = {
  status: "idle" | "error" | "preview";
  message?: string;
  preview?: ImportPreview;
  source?: string;
  period?: string;
  fileName?: string;
};

export const initialImportBatchState: ImportBatchState = { status: "idle" };

export type ApplyBatchState = {
  status: "idle" | "error" | "applied";
  message?: string;
  result?: ApplyImportResult;
};

export const initialApplyBatchState: ApplyBatchState = { status: "idle" };
