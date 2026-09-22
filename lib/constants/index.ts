export const APP_NAME = "Flowza";
export const APP_INITIALS = "Fl";
export const APP_TAGLINE = "Simplify the flow of your business.";
export const APP_DESCRIPTION =
  "Restaurant queue management SaaS — organize waitlists, tables, and guest flow.";

export const DASHBOARD_NAV = [
  { title: "Overview", href: "/dashboard/overview", icon: "LayoutDashboard" },
  { title: "Queue", href: "/dashboard/queue", icon: "ListOrdered" },
  { title: "Tables", href: "/dashboard/tables", icon: "UtensilsCrossed" },
  { title: "Customers", href: "/dashboard/customers", icon: "Users" },
  { title: "Reservations", href: "/dashboard/reservations", icon: "Calendar" },
  { title: "Displays", href: "/dashboard/displays", icon: "Monitor" },
  { title: "QR Codes", href: "/dashboard/qr-codes", icon: "QrCode" },
  { title: "Analytics", href: "/dashboard/analytics", icon: "BarChart3" },
  { title: "Settings", href: "/settings", icon: "Settings" },
] as const;

export const ADMIN_NAV = [
  { title: "Overview", href: "/admin", icon: "LayoutDashboard" },
  { title: "Restaurants", href: "/admin/restaurants", icon: "Store" },
  { title: "Users", href: "/admin/users", icon: "Users" },
  { title: "Subscriptions", href: "/admin/subscriptions", icon: "CreditCard" },
  { title: "Plans", href: "/admin/plans", icon: "Layers" },
  { title: "Payments", href: "/admin/payments", icon: "Wallet" },
  { title: "Audit Logs", href: "/admin/audit-logs", icon: "ScrollText" },
  { title: "Settings", href: "/admin/settings", icon: "Settings" },
] as const;

export const PWA_INSTALL_DISMISS_KEY = "flowza-pwa-install-dismissed";
export const PWA_INSTALL_DISMISS_DAYS = 14;

export const THEME_COLOR = "#0f172a";
export const BACKGROUND_COLOR = "#ffffff";
