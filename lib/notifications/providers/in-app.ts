import type {
  InAppMessage,
  NotificationResult,
} from "@/lib/notifications/types";
import type { InAppProvider } from "@/lib/notifications/providers/types";

export type { InAppProvider } from "@/lib/notifications/providers/types";

/**
 * In-app delivery is record persistence + UI poll/realtime.
 * Creating the notification row is the delivery; this provider confirms that.
 */
export function createInAppProvider(): InAppProvider {
  return {
    name: "in_app",
    isConfigured() {
      return true;
    },
    async send(input: InAppMessage): Promise<NotificationResult> {
      if (!input.recipient.trim() || !input.title.trim()) {
        return {
          ok: false,
          provider: "in_app",
          retryable: false,
          errorCode: "VALIDATION",
          errorMessage: "Invalid in-app notification payload.",
        };
      }

      return {
        ok: true,
        provider: "in_app",
        retryable: false,
      };
    },
  };
}
