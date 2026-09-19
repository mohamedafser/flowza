import type {
  DashboardDateRange,
} from "@/lib/analytics/date-range";
import type {
  DurationStats,
  PartySizeBucket,
  PeakHourRow,
  RateValue,
  VolumePoint,
} from "@/lib/analytics/metrics";
import type { TableStatistics } from "@/lib/utils/tables";

export type DashboardPermissions = {
  canViewQueue: boolean;
  canViewTables: boolean;
  canViewReservations: boolean;
  canViewCustomers: boolean;
  canViewAnalytics: boolean;
};

export type OperationalOverview = {
  waitingCustomers: number;
  currentlyServing: number;
  availableTables: number;
  servedToday: number;
  estimatedWaitMinutes: number | null;
};

export type QueueAnalyticsSummary = {
  total: number;
  waiting: number;
  called: number;
  seated: number;
  completed: number;
  skipped: number;
  cancelled: number;
  noShow: number;
  averageWaitMinutes: number | null;
  averageServiceMinutes: number | null;
  maximumWaitMinutes: number | null;
};

export type WaitTimeAnalytics = DurationStats & {
  trend: VolumePoint[];
};

export type ServiceTimeAnalytics = DurationStats & {
  trend: VolumePoint[];
};

export type ReservationAnalyticsSummary = {
  total: number;
  pending: number;
  confirmed: number;
  arrived: number;
  seated: number;
  completed: number;
  cancelled: number;
  noShow: number;
  arrivalRate: RateValue;
  noShowRate: RateValue;
  volume: VolumePoint[];
};

export type WalkInAnalyticsSummary = {
  total: number;
  addedToQueue: number;
  seatedDirectly: number;
  averageWaitMinutes: number | null;
  completionRate: RateValue;
  /** True when walk-in history comes from audit logs. */
  basedOnAuditLogs: boolean;
};

export type CustomerAnalyticsSummary = {
  totalServed: number;
  newCustomers: number;
  returningCustomers: number;
  averagePartySize: number | null;
  byDay: VolumePoint[];
  byHour: VolumePoint[];
};

export type TableAnalyticsSummary = {
  current: TableStatistics;
  /** Historical utilization is unavailable without table state history. */
  utilizationAvailable: false;
  utilizationNote: string;
};

export type BranchComparisonRow = {
  branchId: string;
  branchName: string;
  customersServed: number;
  queueVolume: number;
  averageWaitMinutes: number | null;
  reservations: number;
  noShows: number;
  averageServiceMinutes: number | null;
};

export type DashboardSectionError = {
  code: string;
  message: string;
};

export type DashboardBundle = {
  restaurantId: string;
  branchId: string;
  branchName: string;
  timezone: string;
  range: DashboardDateRange;
  permissions: DashboardPermissions;
  queueId: string | null;
  estimatedServiceMinutes: number | null;
  operational: OperationalOverview | null;
  queue: QueueAnalyticsSummary | null;
  waitTime: WaitTimeAnalytics | null;
  serviceTime: ServiceTimeAnalytics | null;
  peakHours: PeakHourRow[];
  queueVolume: VolumePoint[];
  tables: TableAnalyticsSummary | null;
  reservations: ReservationAnalyticsSummary | null;
  walkIns: WalkInAnalyticsSummary | null;
  customers: CustomerAnalyticsSummary | null;
  partySize: PartySizeBucket[];
  branchComparison: BranchComparisonRow[] | null;
  sectionErrors: Partial<
    Record<
      | "operational"
      | "queue"
      | "tables"
      | "reservations"
      | "walkIns"
      | "customers"
      | "branchComparison",
      DashboardSectionError
    >
  >;
};

export type AnalyticsExportKind =
  | "queue_summary"
  | "reservation_summary"
  | "customer_summary";
