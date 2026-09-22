import { getPlatformSettings } from "@/services/admin/admin-settings.service";
import { ErrorState } from "@/components/common/ErrorState";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const settings = await getPlatformSettings();

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-10">
      <ErrorState
        title={`${settings.platform_name} maintenance`}
        message={settings.maintenance_message}
      />
      <p className="text-muted-foreground mt-4 text-sm">
        Need help? Email{" "}
        <a
          href={`mailto:${settings.support_email}`}
          className="text-foreground underline underline-offset-2"
        >
          {settings.support_email}
        </a>
        .
      </p>
    </div>
  );
}
