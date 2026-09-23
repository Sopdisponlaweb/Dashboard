export type CreateUserFormState = {
  status: "idle" | "error" | "unavailable" | "created";
  message?: string;
};

export const initialCreateUserFormState: CreateUserFormState = { status: "idle" };

export type ResetPasswordState = {
  status: "idle" | "error" | "done";
  message?: string;
  temporaryPassword?: string;
};

export const initialResetPasswordState: ResetPasswordState = { status: "idle" };
