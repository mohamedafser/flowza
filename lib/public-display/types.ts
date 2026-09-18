import type { DisplaySettings, DisplayTheme } from "@/lib/validations/display";
import type { QueueStatus } from "@/lib/validations/queue";

export type PublicDisplayTokenRef = {
  token: string;
};

export type PublicDisplayData = {
  unavailable: false;
  display: {
    name: string;
    mode: "QUEUE";
  };
  restaurant: {
    name: string;
    logoUrl: string | null;
  };
  branch: {
    name: string;
  };
  queue: {
    name: string;
    status: QueueStatus;
    statusLabel: string;
  };
  nowServing: PublicDisplayTokenRef | null;
  nextTokens: PublicDisplayTokenRef[];
  settings: DisplaySettings;
  realtimeChannel: string | null;
};

export type PublicDisplayUnavailable = {
  unavailable: true;
  reason: "inactive" | "queue_unavailable" | "not_found";
  message: string;
};

export type PublicDisplayResponse =
  PublicDisplayData | PublicDisplayUnavailable;

export const PUBLIC_DISPLAY_SENSITIVE_KEYS = [
  "phone",
  "email",
  "customer",
  "customer_id",
  "customerid",
  "membership",
  "role",
  "staff",
  "user_id",
  "userid",
  "public_access_token",
  "accesstoken",
  "password",
] as const;

export function displayQueueStatusLabel(status: QueueStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Queue Open";
    case "PAUSED":
      return "Queue Temporarily Paused";
    case "CLOSED":
      return "Queue Closed";
  }
}

export function resolveDisplayThemeClass(
  theme: DisplayTheme,
): "light" | "dark" | null {
  if (theme === "light") return "light";
  if (theme === "dark") return "dark";
  return null;
}
