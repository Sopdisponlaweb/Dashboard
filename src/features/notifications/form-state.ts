export type NotificationFormState = {
  status: "idle" | "error" | "unavailable" | "sent";
  message?: string;
};

export const initialNotificationFormState: NotificationFormState = { status: "idle" };
