export type AffiliateStatus = "active" | "inactive" | "suspended" | "deceased";
export type AffiliationSource = "particular" | "activo" | "casur" | "tegen" | "inpec" | "ordisponal";
export type PaymentStatus = "paid" | "pending" | "reversed";

export type Payment = {
  id: string;
  period: string;
  paidOn: string | null;
  amount: number;
  source: AffiliationSource;
  status: PaymentStatus;
  observation: string | null;
  supportDocumentId?: string | null;
  paymentMethod?: string | null;
  receiptId?: string | null;
  receiptNumber?: number | null;
};

export type CreditStatus = "active" | "paid" | "refinanced" | "cancelled" | "paused" | "forgiven";

export type CreditInstallment = {
  id: string;
  paidOn: string;
  amount: number;
  capitalPortion: number;
  interestPortion: number;
  observation: string | null;
  paymentMethod?: string | null;
  receiptNumber?: number | null;
  supportDocumentId?: string | null;
};

export type Credit = {
  id: string;
  previousCreditId: string | null;
  disbursedAmount: number;
  rolledOverCapital: number;
  rolledOverInterest: number;
  principalBase: number;
  interestRate: number;
  termMonths: number;
  interestAmount: number;
  totalAmount: number;
  installmentAmount: number;
  status: CreditStatus;
  requestedOn: string;
  observations: string | null;
  installments: CreditInstallment[];
  /** Paz y salvo issued for this credit, if any. */
  clearance?: { id: string; number: number; issuedOn: string } | null;
  inheritedFromAffiliateId?: string | null;
  inheritedFromName?: string | null;
};

export type MemberDocument = {
  id: string;
  title: string;
  kind: "resume" | "identity" | "support" | "other";
  uploadedOn: string;
  sizeLabel: string;
  storagePath: string;
  mimeType?: string;
};

export type Beneficiary = {
  id: string;
  documentType?: "CC" | "CE" | "TI" | null;
  documentNumber: string | null;
  documentIssuedOn?: string | null;
  firstNames: string;
  lastNames: string;
  relationship: string;
  birthDate: string;
  phone?: string | null;
  email?: string | null;
  joinedOn: string;
  fullCoverageOn: string;
  status: AffiliateStatus;
  deceasedOn: string | null;
  internalNotes?: string | null;
  deathMunicipalityId?: string | null;
  deathMunicipality?: string | null;
  deathRegistryNumber?: string | null;
  deathNotary?: string | null;
  deathServiceProvided?: string | null;
  deathServiceAmount?: number | null;
  successorBank?: string | null;
  successorAccountNumber?: string | null;
  successorAccountType?: "ahorros" | "corriente" | null;
  /** Set when the beneficiary came from a deceased titular through a succession. */
  inheritedFromAffiliateId?: string | null;
  inheritedFromName?: string | null;
  /** Set on the deceased's record when this beneficiary became the successor titular. */
  promotedToAffiliateId?: string | null;
  /** The beneficiary's own files (identity, death certificate…). */
  documents?: MemberDocument[];
};

export type Affiliate = {
  id: string;
  documentType: "CC" | "CE" | "TI";
  documentNumber: string;
  documentIssuedOn: string;
  firstNames: string;
  lastNames: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
  municipality: string;
  organization: string | null;
  source: AffiliationSource;
  status: AffiliateStatus;
  joinedOn: string;
  fullCoverageOn: string;
  lastPaymentOn: string | null;
  deceasedOn: string | null;
  internalNotes: string | null;
  successorResolutionNumber: string | null;
  successorDocumentNumber: string | null;
  successorFirstNames: string | null;
  successorLastNames: string | null;
  successorPhone: string | null;
  deathMunicipalityId: string | null;
  deathMunicipality: string | null;
  deathRegistryNumber: string | null;
  deathNotary: string | null;
  deathServiceProvided: string | null;
  deathServiceAmount: number | null;
  successorBank: string | null;
  successorAccountNumber: string | null;
  successorAccountType: "ahorros" | "corriente" | null;
  beneficiaries: Beneficiary[];
  payments: Payment[];
  documents: MemberDocument[];
  credits?: Credit[];
  policeRankId?: string | null;
  policeRank?: string | null;
  /** pending: deceased without a current succession; succeeded: deceased with one; successor: titular by succession. */
  successionRole?: "pending" | "succeeded" | "successor" | null;
};

export type AffiliateFilters = {
  query?: string;
  status?: AffiliateStatus | "all";
  source?: AffiliationSource | "all";
  excludeDeceased?: boolean;
  /** pending: deceased without succession · succeeded: deceased with one · successor: titular by succession. */
  succession?: "all" | "pending" | "succeeded" | "successor";
  /** waiting: active and still in the waiting period · full: active with full coverage. */
  coverage?: "all" | "waiting" | "full";
  /** risk: active titulars with two months without paying (the next one suspends them). */
  arrears?: "all" | "risk";
  /** Affiliation date range [from, to), YYYY-MM-DD. */
  joinedFrom?: string;
  joinedTo?: string;
  page?: number;
  pageSize?: number;
};

export type AffiliateListResult = {
  affiliates: Affiliate[];
  totalCount: number;
};
