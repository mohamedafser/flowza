import { cache } from "react";
import type { Json } from "@/types/database";
import { requirePlatformPermission } from "@/lib/auth/platform-guards";
import { writePlatformAuditLog } from "@/services/audit";
import { requireAdminClient } from "@/services/admin/admin-client";

export type PlatformGeneralSettings = {
  platform_name: string;
  support_email: string;
  default_trial_days: number;
  default_currency: string;
  default_timezone: string;
  maintenance_mode: boolean;
  maintenance_message: string;
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformGeneralSettings = {
  platform_name: "Flowza",
  support_email: "support@flowza.app",
  default_trial_days: 14,
  default_currency: "INR",
  default_timezone: "Asia/Kolkata",
  maintenance_mode: false,
  maintenance_message:
    "Flowza is undergoing scheduled maintenance. Please try again shortly.",
};

function parseSettings(value: Json | null | undefined): PlatformGeneralSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_PLATFORM_SETTINGS };
  }

  const row = value as Record<string, unknown>;
  return {
    platform_name:
      typeof row.platform_name === "string" && row.platform_name.trim()
        ? row.platform_name.trim()
        : DEFAULT_PLATFORM_SETTINGS.platform_name,
    support_email:
      typeof row.support_email === "string" && row.support_email.trim()
        ? row.support_email.trim()
        : DEFAULT_PLATFORM_SETTINGS.support_email,
    default_trial_days:
      typeof row.default_trial_days === "number" &&
      Number.isFinite(row.default_trial_days) &&
      row.default_trial_days >= 0
        ? Math.floor(row.default_trial_days)
        : DEFAULT_PLATFORM_SETTINGS.default_trial_days,
    default_currency:
      typeof row.default_currency === "string" && row.default_currency.trim()
        ? row.default_currency.trim().toUpperCase()
        : DEFAULT_PLATFORM_SETTINGS.default_currency,
    default_timezone:
      typeof row.default_timezone === "string" && row.default_timezone.trim()
        ? row.default_timezone.trim()
        : DEFAULT_PLATFORM_SETTINGS.default_timezone,
    maintenance_mode: Boolean(row.maintenance_mode),
    maintenance_message:
      typeof row.maintenance_message === "string" &&
      row.maintenance_message.trim()
        ? row.maintenance_message.trim()
        : DEFAULT_PLATFORM_SETTINGS.maintenance_message,
  };
}

/**
 * Unauthenticated read for maintenance enforcement.
 * Uses service role; safe because it only returns non-secret settings.
 */
export const getPlatformSettings = cache(
  async (): Promise<PlatformGeneralSettings> => {
    try {
      const admin = requireAdminClient();
      const { data } = await admin
        .from("platform_settings")
        .select("value")
        .eq("key", "general")
        .maybeSingle();
      return parseSettings(data?.value ?? null);
    } catch {
      return { ...DEFAULT_PLATFORM_SETTINGS };
    }
  },
);

export async function getPlatformSettingsForAdmin(): Promise<PlatformGeneralSettings> {
  await requirePlatformPermission("platform.settings.view");
  return getPlatformSettings();
}

export async function updatePlatformSettings(
  patch: Partial<PlatformGeneralSettings>,
): Promise<PlatformGeneralSettings> {
  const context = await requirePlatformPermission("platform.settings.manage");
  const current = await getPlatformSettings();
  const next: PlatformGeneralSettings = {
    ...current,
    ...patch,
    platform_name: (patch.platform_name ?? current.platform_name).trim(),
    support_email: (patch.support_email ?? current.support_email)
      .trim()
      .toLowerCase(),
    default_currency: (patch.default_currency ?? current.default_currency)
      .trim()
      .toUpperCase(),
    default_timezone: (patch.default_timezone ?? current.default_timezone).trim(),
    maintenance_message: (
      patch.maintenance_message ?? current.maintenance_message
    ).trim(),
    default_trial_days: Math.max(
      0,
      Math.floor(patch.default_trial_days ?? current.default_trial_days),
    ),
    maintenance_mode: Boolean(
      patch.maintenance_mode ?? current.maintenance_mode,
    ),
  };

  const admin = requireAdminClient();
  const { error } = await admin.from("platform_settings").upsert({
    key: "general",
    value: next as unknown as Json,
    updated_by: context.user.id,
  });

  if (error) {
    throw new Error("Unable to update platform settings.");
  }

  await writePlatformAuditLog({
    userId: context.user.id,
    action: "PLATFORM_SETTINGS_UPDATED",
    entityType: "platform_settings",
    entityId: "general",
    metadata: {
      maintenance_mode: next.maintenance_mode,
      default_trial_days: next.default_trial_days,
    },
  });

  return next;
}
