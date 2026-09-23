export type LoginActionState = {
  status: "idle" | "error";
  message?: string;
  email?: string;
};

export const initialLoginActionState: LoginActionState = { status: "idle" };
