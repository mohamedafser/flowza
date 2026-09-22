import type { Metadata } from "next";
import { AccessDenied } from "@/components/common/AccessDenied";
import { PageHeader } from "@/components/common/PageHeader";
import { OperatingHoursEditor } from "@/components/settings/OperatingHoursEditor";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { canAccessHref } from "@/lib/auth/navigation";
import { SETTINGS_HOURS_PATH } from "@/lib/auth/paths";
import { SETTINGS_HOURS_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import { isTimeFormat, type TimeFormat } from "@/lib/utils/datetime";
import {
  getOperatingHoursBundle,
  getSpecialHoursBundle,
} from "@/services/hours";
import { getRestaurantSettings } from "@/services/settings";
import { listBranchesByRestaurantId } from "@/services/branches";

export const metadata: Metadata = {
  title: "Operating hours",
};

type PageProps = {
  searchParams: Promise<{ branch?: string }>;
};

export default async function OperatingHoursPage({ searchParams }: PageProps) {
  const workspace = await requireWorkspacePage();

  if (!canAccessHref(workspace.role, SETTINGS_HOURS_PATH)) {
    return (
      <AccessDenied
        title="Operating hours"
        description="Set weekly hours, lunch and dinner periods, and special dates. Branches can override restaurant defaults."
        breadcrumbs={SETTINGS_HOURS_BREADCRUMBS}
      />
    );
  }

  const restaurant = workspace.restaurant!;
  const { branch: branchParam } = await searchParams;

  const [hours, special, settings, branches] = await Promise.all([
    getOperatingHoursBundle(restaurant.id),
    getSpecialHoursBundle(restaurant.id),
    getRestaurantSettings(restaurant.id),
    listBranchesByRestaurantId(restaurant.id),
  ]);

  const timeFormat: TimeFormat = isTimeFormat(settings?.time_format ?? "")
    ? (settings!.time_format as TimeFormat)
    : "12h";

  return (
    <div>
      <PageHeader
        title="Operating hours"
        description="Set weekly hours, lunch and dinner periods, and special dates. Branches can override restaurant defaults."
        breadcrumbs={SETTINGS_HOURS_BREADCRUMBS}
      />
      <OperatingHoursEditor
        restaurantId={restaurant.id}
        branches={branches}
        restaurantHours={hours.restaurantHours}
        restaurantConfigured={hours.restaurantConfigured}
        branchHours={hours.branchHours}
        restaurantSpecialHours={special.restaurant}
        branchSpecialHours={special.byBranch}
        timeFormat={timeFormat}
        dateFormat={settings?.date_format ?? "DD/MM/YYYY"}
        canManage={workspace.canManageRestaurant}
        initialBranchId={branchParam ?? workspace.branch?.id ?? null}
      />
    </div>
  );
}
