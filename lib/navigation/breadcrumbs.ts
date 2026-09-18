import {
  DASHBOARD_CUSTOMERS_PATH,
  DASHBOARD_DISPLAYS_PATH,
  DASHBOARD_OVERVIEW_PATH,
  DASHBOARD_QR_CODES_PATH,
  DASHBOARD_QUEUE_PATH,
  SETTINGS_BRANCHES_PATH,
  SETTINGS_CUSTOMER_PATH,
  SETTINGS_GENERAL_PATH,
  SETTINGS_HOURS_PATH,
  SETTINGS_PATH,
  SETTINGS_QUEUE_PATH,
  SETTINGS_RESTAURANT_PATH,
  SETTINGS_TABLES_PATH,
} from "@/lib/auth/paths";
import type { BreadcrumbItem } from "@/components/common/Breadcrumbs";

export function dashboardBreadcrumbs(
  ...trail: BreadcrumbItem[]
): BreadcrumbItem[] {
  return [{ label: "Dashboard", href: DASHBOARD_OVERVIEW_PATH }, ...trail];
}

export function settingsBreadcrumbs(
  ...trail: BreadcrumbItem[]
): BreadcrumbItem[] {
  return [
    { label: "Dashboard", href: DASHBOARD_OVERVIEW_PATH },
    { label: "Settings", href: SETTINGS_PATH },
    ...trail,
  ];
}

export const SETTINGS_HOME_BREADCRUMBS = settingsBreadcrumbs();

export const SETTINGS_RESTAURANT_BREADCRUMBS = settingsBreadcrumbs({
  label: "Restaurant",
  href: SETTINGS_RESTAURANT_PATH,
});

export const SETTINGS_GENERAL_BREADCRUMBS = settingsBreadcrumbs({
  label: "General",
  href: SETTINGS_GENERAL_PATH,
});

export const SETTINGS_HOURS_BREADCRUMBS = settingsBreadcrumbs({
  label: "Operating hours",
  href: SETTINGS_HOURS_PATH,
});

export const SETTINGS_QUEUE_BREADCRUMBS = settingsBreadcrumbs({
  label: "Queue settings",
  href: SETTINGS_QUEUE_PATH,
});

export const SETTINGS_CUSTOMER_BREADCRUMBS = settingsBreadcrumbs({
  label: "Customer experience",
  href: SETTINGS_CUSTOMER_PATH,
});

export const SETTINGS_TABLES_BREADCRUMBS = settingsBreadcrumbs({
  label: "Table sections",
  href: SETTINGS_TABLES_PATH,
});

export const SETTINGS_BRANCHES_BREADCRUMBS = settingsBreadcrumbs({
  label: "Branches",
  href: SETTINGS_BRANCHES_PATH,
});

export function settingsBranchDetailBreadcrumbs(
  branchName: string,
): BreadcrumbItem[] {
  return settingsBreadcrumbs(
    { label: "Branches", href: SETTINGS_BRANCHES_PATH },
    { label: branchName },
  );
}

export function settingsNewBranchBreadcrumbs(): BreadcrumbItem[] {
  return settingsBreadcrumbs(
    { label: "Branches", href: SETTINGS_BRANCHES_PATH },
    { label: "New branch" },
  );
}

export const QUEUE_BREADCRUMBS = dashboardBreadcrumbs({
  label: "Queue",
  href: DASHBOARD_QUEUE_PATH,
});

export const DISPLAYS_BREADCRUMBS = dashboardBreadcrumbs({
  label: "Displays",
  href: DASHBOARD_DISPLAYS_PATH,
});

export const QR_CODES_BREADCRUMBS = dashboardBreadcrumbs({
  label: "QR Codes",
  href: DASHBOARD_QR_CODES_PATH,
});

export const CUSTOMERS_BREADCRUMBS = dashboardBreadcrumbs({
  label: "Customers",
  href: DASHBOARD_CUSTOMERS_PATH,
});

export function customerDetailBreadcrumbs(name: string): BreadcrumbItem[] {
  return dashboardBreadcrumbs(
    { label: "Customers", href: DASHBOARD_CUSTOMERS_PATH },
    { label: name },
  );
}

export function newCustomerBreadcrumbs(): BreadcrumbItem[] {
  return dashboardBreadcrumbs(
    { label: "Customers", href: DASHBOARD_CUSTOMERS_PATH },
    { label: "New customer" },
  );
}
