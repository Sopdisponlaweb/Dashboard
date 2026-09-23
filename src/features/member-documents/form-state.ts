export type DocumentUploadState = {
  status: "idle" | "error" | "unavailable" | "uploaded";
  message?: string;
  fileName?: string;
  fileSizeLabel?: string;
  kind?: string;
  title?: string;
};

export const initialDocumentUploadState: DocumentUploadState = { status: "idle" };
