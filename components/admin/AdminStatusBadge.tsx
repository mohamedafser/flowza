import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
  DISABLED: "Disabled",
  TRIALING: "Trialing",
  PAST_DUE: "Past due",
  PAUSED: "Paused",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  PENDING: "Pending",
  SUCCESS: "Success",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

export function AdminStatusBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  if (!status) {
    return <Badge variant="secondary">None</Badge>;
  }

  const tone =
    status === "ACTIVE" || status === "SUCCESS" || status === "TRIALING"
      ? "default"
      : status === "SUSPENDED" ||
          status === "DISABLED" ||
          status === "FAILED" ||
          status === "EXPIRED" ||
          status === "CANCELLED" ||
          status === "PAST_DUE"
        ? "destructive"
        : "secondary";

  return (
    <Badge variant={tone}>
      <span className="sr-only">Status:</span>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
