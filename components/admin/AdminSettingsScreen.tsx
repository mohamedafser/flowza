"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { adminFetch } from "@/lib/api/admin-client";
import { ADMIN_SETTINGS_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import type { PlatformGeneralSettings } from "@/services/admin/admin-settings.service";
import { toast } from "sonner";

export function AdminSettingsScreen() {
  const [settings, setSettings] = useState<PlatformGeneralSettings | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void adminFetch<PlatformGeneralSettings>("/api/admin/settings").then(
      (response) => {
        setLoading(false);
        if (!response.ok || !response.data) {
          setError(response.message ?? "Unable to load settings.");
          return;
        }
        setSettings(response.data);
      },
    );
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    const response = await adminFetch<PlatformGeneralSettings>(
      "/api/admin/settings",
      {
        method: "PATCH",
        body: JSON.stringify(settings),
      },
    );
    setSaving(false);
    if (!response.ok || !response.data) {
      toast.error(response.message ?? "Unable to save settings.");
      return;
    }
    setSettings(response.data);
    toast.success("Platform settings saved.");
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="Global platform configuration."
          breadcrumbs={ADMIN_SETTINGS_BREADCRUMBS}
        />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="Global platform configuration."
          breadcrumbs={ADMIN_SETTINGS_BREADCRUMBS}
        />
        <ErrorState
          title="Unable to load settings"
          message={error ?? "Settings unavailable."}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Global platform configuration."
        breadcrumbs={ADMIN_SETTINGS_BREADCRUMBS}
        actions={
          <Button disabled={saving} onClick={() => void save()}>
            Save changes
          </Button>
        }
      />

      <form
        className="border-border max-w-xl space-y-4 rounded-xl border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="platform-name">Platform name</Label>
          <Input
            id="platform-name"
            value={settings.platform_name}
            onChange={(event) =>
              setSettings((prev) =>
                prev ? { ...prev, platform_name: event.target.value } : prev,
              )
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="support-email">Support email</Label>
          <Input
            id="support-email"
            type="email"
            value={settings.support_email}
            onChange={(event) =>
              setSettings((prev) =>
                prev ? { ...prev, support_email: event.target.value } : prev,
              )
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="default-trial">Default trial days</Label>
            <Input
              id="default-trial"
              type="number"
              min={0}
              max={365}
              value={settings.default_trial_days}
              onChange={(event) =>
                setSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        default_trial_days: Number(event.target.value) || 0,
                      }
                    : prev,
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="default-currency">Default currency</Label>
            <Input
              id="default-currency"
              maxLength={3}
              value={settings.default_currency}
              onChange={(event) =>
                setSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        default_currency: event.target.value.toUpperCase(),
                      }
                    : prev,
                )
              }
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="default-timezone">Default timezone</Label>
          <Input
            id="default-timezone"
            value={settings.default_timezone}
            onChange={(event) =>
              setSettings((prev) =>
                prev ? { ...prev, default_timezone: event.target.value } : prev,
              )
            }
          />
        </div>

        <div className="border-border space-y-3 border-t pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="maintenance-mode">Maintenance mode</Label>
              <p className="text-muted-foreground text-xs">
                Blocks restaurant dashboard access while platform admins can still
                use /admin.
              </p>
            </div>
            <Switch
              id="maintenance-mode"
              checked={settings.maintenance_mode}
              onCheckedChange={(checked) =>
                setSettings((prev) =>
                  prev ? { ...prev, maintenance_mode: checked } : prev,
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maintenance-message">Maintenance message</Label>
            <Input
              id="maintenance-message"
              value={settings.maintenance_message}
              onChange={(event) =>
                setSettings((prev) =>
                  prev
                    ? { ...prev, maintenance_message: event.target.value }
                    : prev,
                )
              }
            />
          </div>
        </div>

        <Button type="submit" disabled={saving}>
          Save changes
        </Button>
      </form>
    </div>
  );
}
