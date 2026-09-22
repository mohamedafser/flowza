import type {
  NotificationChannel,
  NotificationType,
  QueueNotificationTemplateData,
  RenderedTemplate,
  ReservationNotificationTemplateData,
} from "@/lib/notifications/types";
import { renderNotificationEmail } from "@/emails/templates/notifications";

type TemplateData = QueueNotificationTemplateData &
  Partial<ReservationNotificationTemplateData> &
  Record<string, string | number | null | undefined>;

function replaceTokens(template: string, data: TemplateData): string {
  return template
    .replaceAll("{{customerName}}", String(data.customerName ?? "Guest"))
    .replaceAll("{{restaurantName}}", String(data.restaurantName ?? "Restaurant"))
    .replaceAll("{{branchName}}", String(data.branchName ?? ""))
    .replaceAll("{{token}}", String(data.token ?? ""))
    .replaceAll("{{partySize}}", String(data.partySize ?? ""))
    .replaceAll(
      "{{estimatedWait}}",
      data.estimatedWait == null ? "unavailable" : String(data.estimatedWait),
    )
    .replaceAll(
      "{{position}}",
      data.position != null ? String(data.position) : "unavailable",
    )
    .replaceAll("{{queueName}}", String(data.queueName ?? "Queue"))
    .replaceAll(
      "{{reservationCode}}",
      String(data.reservationCode ?? data.token ?? ""),
    )
    .replaceAll("{{reservationDate}}", String(data.reservationDate ?? ""))
    .replaceAll("{{reservationTime}}", String(data.reservationTime ?? ""))
    .replaceAll("{{tableName}}", String(data.tableName ?? "TBD"));
}

type TemplateDefinition = {
  title: string;
  body: string;
  subject?: string;
  channels?: Partial<
    Record<
      NotificationChannel,
      { title?: string; body?: string; subject?: string }
    >
  >;
};

const TEMPLATES: Partial<Record<NotificationType, TemplateDefinition>> = {
  QUEUE_JOINED: {
    title: "You're in the queue",
    subject: "Queue confirmation — {{restaurantName}}",
    body: [
      "Hi {{customerName}},",
      "",
      "You have joined the queue at {{restaurantName}} ({{branchName}}).",
      "",
      "Your token: {{token}}",
      "Party size: {{partySize}}",
      "Estimated wait: {{estimatedWait}}",
      "Position: {{position}}",
    ].join("\n"),
    channels: {
      SMS: {
        body: "{{restaurantName}}: You're in line. Token {{token}}. Party {{partySize}}. ETA {{estimatedWait}}.",
      },
      WHATSAPP: {
        body: "Hi {{customerName}}, you're in the queue at {{restaurantName}}. Token: {{token}}. Party size: {{partySize}}. Estimated wait: {{estimatedWait}}.",
      },
    },
  },
  QUEUE_CALLED: {
    title: "Your table is ready",
    subject: "Your table is ready — {{restaurantName}}",
    body: [
      "Your table is ready at {{restaurantName}}.",
      "",
      "Token: {{token}}",
      "",
      "Please proceed to the restaurant staff.",
    ].join("\n"),
    channels: {
      SMS: {
        body: "{{restaurantName}}: Your table is ready. Token {{token}}. Please approach staff now.",
      },
      WHATSAPP: {
        body: "Your table is ready at {{restaurantName}}. Token: {{token}}. Please proceed to the restaurant staff.",
      },
    },
  },
  QUEUE_READY: {
    title: "Your table is ready",
    subject: "Your table is ready — {{restaurantName}}",
    body: [
      "Your table is ready at {{restaurantName}}.",
      "",
      "Token: {{token}}",
      "",
      "Please proceed to the restaurant staff.",
    ].join("\n"),
  },
  QUEUE_REMINDER: {
    title: "You're almost up",
    subject: "Queue update — {{restaurantName}}",
    body: [
      "Hi {{customerName}},",
      "",
      "Your turn at {{restaurantName}} is coming up soon.",
      "",
      "Token: {{token}}",
      "Position: {{position}}",
      "Estimated wait: {{estimatedWait}}",
    ].join("\n"),
    channels: {
      SMS: {
        body: "{{restaurantName}}: You're almost up. Token {{token}}. Position {{position}}.",
      },
    },
  },
  QUEUE_SEATED: {
    title: "Enjoy your visit",
    subject: "You're seated — {{restaurantName}}",
    body: "Hi {{customerName}}, you've been seated at {{restaurantName}}. Token: {{token}}. Enjoy!",
  },
  QUEUE_CANCELLED: {
    title: "Queue cancelled",
    subject: "Queue cancelled — {{restaurantName}}",
    body: "Hi {{customerName}}, your queue entry (token {{token}}) at {{restaurantName}} has been cancelled.",
  },
  QUEUE_NO_SHOW: {
    title: "Marked as no-show",
    subject: "Missed call — {{restaurantName}}",
    body: "Hi {{customerName}}, your queue entry (token {{token}}) at {{restaurantName}} was marked as no-show.",
  },
  STAFF_QUEUE_JOINED: {
    title: "New guest in queue",
    body: "{{customerName}} joined {{queueName}} at {{branchName}}. Token {{token}} · party of {{partySize}}.",
  },
  STAFF_QUEUE_CALLED: {
    title: "Guest called",
    body: "{{customerName}} called (token {{token}}) on {{queueName}} at {{branchName}}.",
  },
  STAFF_QUEUE_SEATED: {
    title: "Guest seated",
    body: "{{customerName}} seated (token {{token}}) on {{queueName}} at {{branchName}}.",
  },
  STAFF_QUEUE_CANCELLED: {
    title: "Guest cancelled",
    body: "{{customerName}} cancelled (token {{token}}) on {{queueName}} at {{branchName}}.",
  },
  STAFF_QUEUE_NO_SHOW: {
    title: "Guest no-show",
    body: "{{customerName}} marked no-show (token {{token}}) on {{queueName}} at {{branchName}}.",
  },
  STAFF_QUEUE_BUSY: {
    title: "Queue is getting busy",
    body: "{{queueName}} at {{branchName}} has {{position}} parties waiting.",
  },
  RESERVATION_CREATED: {
    title: "Reservation received",
    subject: "Reservation {{reservationCode}} — {{restaurantName}}",
    body: [
      "Hi {{customerName}},",
      "",
      "Your reservation at {{restaurantName}} ({{branchName}}) is recorded.",
      "",
      "Code: {{reservationCode}}",
      "Date: {{reservationDate}}",
      "Time: {{reservationTime}}",
      "Party size: {{partySize}}",
    ].join("\n"),
    channels: {
      SMS: {
        body: "{{restaurantName}}: Reservation {{reservationCode}} on {{reservationDate}} at {{reservationTime}}. Party {{partySize}}.",
      },
    },
  },
  RESERVATION_CONFIRMED: {
    title: "Reservation confirmed",
    subject: "Confirmed {{reservationCode}} — {{restaurantName}}",
    body: [
      "Hi {{customerName}},",
      "",
      "Your reservation is confirmed at {{restaurantName}}.",
      "",
      "Code: {{reservationCode}}",
      "Date: {{reservationDate}}",
      "Time: {{reservationTime}}",
      "Party size: {{partySize}}",
      "Table: {{tableName}}",
    ].join("\n"),
    channels: {
      SMS: {
        body: "{{restaurantName}}: Reservation {{reservationCode}} confirmed for {{reservationDate}} {{reservationTime}}.",
      },
    },
  },
  RESERVATION_REMINDER: {
    title: "Reservation reminder",
    subject: "Reminder {{reservationCode}} — {{restaurantName}}",
    body: "Hi {{customerName}}, reminder: reservation {{reservationCode}} at {{restaurantName}} on {{reservationDate}} at {{reservationTime}}.",
  },
  RESERVATION_CANCELLED: {
    title: "Reservation cancelled",
    subject: "Cancelled {{reservationCode}} — {{restaurantName}}",
    body: "Hi {{customerName}}, your reservation {{reservationCode}} at {{restaurantName}} has been cancelled.",
  },
  RESERVATION_ARRIVED: {
    title: "Checked in",
    subject: "Checked in — {{restaurantName}}",
    body: "Hi {{customerName}}, you've been checked in for reservation {{reservationCode}} at {{restaurantName}}.",
  },
  RESERVATION_SEATED: {
    title: "You're seated",
    subject: "Seated — {{restaurantName}}",
    body: "Hi {{customerName}}, you've been seated at {{restaurantName}} ({{tableName}}). Enjoy!",
  },
  RESERVATION_NO_SHOW: {
    title: "Reservation marked no-show",
    subject: "No-show — {{restaurantName}}",
    body: "Hi {{customerName}}, reservation {{reservationCode}} at {{restaurantName}} was marked as no-show.",
  },
  STAFF_RESERVATION_CREATED: {
    title: "New reservation",
    body: "{{customerName}} booked {{reservationCode}} at {{branchName}} · {{reservationDate}} {{reservationTime}} · party {{partySize}}.",
  },
  STAFF_RESERVATION_CANCELLED: {
    title: "Reservation cancelled",
    body: "{{customerName}} cancelled {{reservationCode}} at {{branchName}}.",
  },
  STAFF_RESERVATION_NO_SHOW: {
    title: "Reservation no-show",
    body: "{{customerName}} no-show for {{reservationCode}} at {{branchName}}.",
  },
};

export function renderNotificationTemplate(
  type: NotificationType,
  channel: NotificationChannel,
  data: TemplateData,
): RenderedTemplate {
  if (channel === "EMAIL") {
    const email = renderNotificationEmail(type, data);
    return {
      title: email.subject,
      subject: email.subject,
      body: email.text,
      html: email.html,
    };
  }

  // Push uses the compact in-app / default title+body copy.
  const definition = TEMPLATES[type];
  if (!definition) {
    return {
      title: type,
      body: replaceTokens(
        "{{restaurantName}} — {{reservationCode}}{{token}}",
        data,
      ),
    };
  }

  const channelForOverride =
    channel === "PUSH" ? "IN_APP" : channel;
  const override = definition.channels?.[channelForOverride];
  const title = replaceTokens(override?.title ?? definition.title, data);
  const body = replaceTokens(override?.body ?? definition.body, data);
  const subjectSource = override?.subject ?? definition.subject;
  const subject = subjectSource
    ? replaceTokens(subjectSource, data)
    : undefined;

  return { title, body, subject };
}

export function isKnownNotificationType(
  value: string,
): value is NotificationType {
  return value in TEMPLATES || Object.keys(TEMPLATES).includes(value);
}
