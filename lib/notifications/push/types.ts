/**
 * Payload shape delivered to the service worker `push` event.
 * Keep fields small — many browsers cap push payload size.
 */
export type WebPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  restaurantId?: string;
  audience?: "STAFF" | "CUSTOMER";
};

export type PushMessage = {
  /** `restaurant:{uuid}` for staff fan-out, or customer uuid. */
  recipient: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  restaurantId?: string;
  audience?: "STAFF" | "CUSTOMER";
};
