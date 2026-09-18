export type NavItem = {
  title: string;
  href: string;
  icon: string;
};

export type StatusTone = "default" | "success" | "warning" | "danger" | "info";

export type ConnectionStatus = "online" | "offline" | "reconnecting";

export type {
  RealtimeChange,
  RealtimeConnectionStatus,
} from "@/lib/realtime/types";

export type {
  Database,
  DatabaseTableName,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./database";

export { DATABASE_TABLES } from "./database";
