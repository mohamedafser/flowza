import { z } from "zod";
import { PUBLIC_QR_MESSAGES } from "@/lib/public-qr/messages";
import type { PublicQRResponse } from "@/lib/public-qr/types";
import { publicQueueJoinPath } from "@/lib/public-queue/paths";

const publicQRRpcSchema = z.union([
  z.object({
    unavailable: z.literal(true),
    reason: z.enum(["inactive", "unsupported"]),
  }),
  z.object({
    unavailable: z.literal(false),
    type: z.literal("QUEUE_JOIN"),
    qr: z.object({ name: z.string().min(1) }),
    restaurant: z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
    }),
    branch: z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
    }),
    queue: z.object({ name: z.string().min(1) }),
    join_path: z.string().min(1),
  }),
]);

export type PublicQRRpcPayload = z.infer<typeof publicQRRpcSchema>;

export function parsePublicQRRpc(data: unknown): PublicQRRpcPayload | null {
  const parsed = publicQRRpcSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function toPublicQRData(payload: PublicQRRpcPayload): PublicQRResponse {
  if (payload.unavailable) {
    return {
      unavailable: true,
      reason: payload.reason,
      message:
        payload.reason === "inactive"
          ? PUBLIC_QR_MESSAGES.inactive
          : PUBLIC_QR_MESSAGES.unavailable,
    };
  }

  const expectedJoinPath = publicQueueJoinPath(
    payload.restaurant.slug,
    payload.branch.slug,
  );
  const joinPath =
    payload.join_path === expectedJoinPath
      ? payload.join_path
      : expectedJoinPath;

  return {
    unavailable: false,
    type: "QUEUE_JOIN",
    qr: { name: payload.qr.name },
    restaurant: {
      name: payload.restaurant.name,
      slug: payload.restaurant.slug,
    },
    branch: {
      name: payload.branch.name,
      slug: payload.branch.slug,
    },
    queue: { name: payload.queue.name },
    joinPath,
  };
}
