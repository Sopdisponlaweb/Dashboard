// Client-safe types and labels for successions.

export type SuccessorOrigin = "beneficiary" | "existing" | "new";
export type CreditDecision = "none" | "inherited" | "paused";

export type Succession = {
  id: string;
  deceasedId: string;
  deceasedName: string;
  deceasedDocument: string;
  deceasedOn: string | null;
  successorId: string | null;
  successorName: string;
  successorDocument: string;
  origin: SuccessorOrigin;
  successorCreated: boolean;
  successionDate: string;
  resolutionNumber: string | null;
  creditId: string | null;
  creditDecision: CreditDecision;
  transferredBeneficiaries: number;
  supportDocumentId: string | null;
  notes: string | null;
  createdAt: string;
  createdByName: string | null;
  annulledAt: string | null;
  annulledByName: string | null;
  annulReason: string | null;
};

export const successorOriginLabels: Record<SuccessorOrigin, string> = {
  beneficiary: "Beneficiario del fallecido",
  existing: "Afiliado existente",
  new: "Persona nueva",
};

export const creditDecisionLabels: Record<CreditDecision, string> = {
  none: "Sin crédito activo",
  inherited: "Heredado por el sucesor",
  paused: "En pausa",
};

export type SuccessionFormState = {
  status: "idle" | "error" | "unavailable";
  message?: string;
};

export const initialSuccessionFormState: SuccessionFormState = { status: "idle" };

export type SuccessorCandidate = { id: string; name: string; document: string; statusLabel: string };
