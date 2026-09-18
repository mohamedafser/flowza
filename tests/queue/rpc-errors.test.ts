import { describe, expect, it } from "vitest";
import { mapQueueRpcError } from "@/lib/queue/rpc-errors";

describe("mapQueueRpcError", () => {
  it("maps QUEUE_* codes from message or details", () => {
    expect(
      mapQueueRpcError({
        code: "P0001",
        message: "QUEUE_CLOSED: Queue is closed.",
      }),
    ).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Queue is closed.",
    });

    expect(
      mapQueueRpcError({
        code: "P0001",
        message: "Database error saving new entity",
        details: "QUEUE_AT_CAPACITY: The queue is at capacity.",
      }),
    ).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "The queue is at capacity.",
    });

    expect(
      mapQueueRpcError({
        message: "QUEUE_NOT_FOUND: Queue not found.",
      }),
    ).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Queue not found.",
    });
  });

  it("maps permission failures instead of UNKNOWN", () => {
    expect(
      mapQueueRpcError({
        code: "42501",
        message:
          "permission denied for function broadcast_queue_realtime_signal",
      }),
    ).toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action.",
    });
  });

  it("maps QUEUE_UNKNOWN from token generation", () => {
    expect(
      mapQueueRpcError({
        message: "QUEUE_UNKNOWN: Unable to issue an access token.",
      }),
    ).toEqual({
      ok: false,
      code: "UNKNOWN",
      message: "Unable to issue an access token.",
    });
  });

  it("keeps a safe fallback when the database error is unstructured", () => {
    expect(
      mapQueueRpcError({
        message: "something exploded internally",
      }),
    ).toEqual({
      ok: false,
      code: "UNKNOWN",
      message: "Unable to update the queue. Please try again.",
    });
  });
});
