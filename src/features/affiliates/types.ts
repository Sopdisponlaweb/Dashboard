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
};

export type CreditStatus = "active" | "paid" | "refinanced" | "cancelled";

export type CreditInstallment = {
  id: string;
  paidOn: string;
  amount: number;
  capitalPortion: number;
  interestPortion: number;
  observation: string | null;
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
};

export type MemberDocument = {
  id: string;
  title: string;
  kind: "resume" | "identity" | "support" | "other";
  uploadedOn: string;
  sizeLabel: string;
  storagePath: string;
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
};

export type AffiliateFilters = {
  query?: string;
  status?: AffiliateStatus | "all";
  source?: AffiliationSource | "all";
  excludeDeceased?: boolean;
  page?: number;
  pageSize?: number;
};

export type AffiliateListResult = {
  affiliates: Affiliate[];
  totalCount: number;
};
