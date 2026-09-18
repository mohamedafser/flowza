import type { Metadata } from "next";
import { QRBoard } from "@/components/qr-codes/QRBoard";
import { PageHeader } from "@/components/common/PageHeader";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { QR_CODES_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import { hasPermission } from "@/lib/auth/permissions";
import { listBranchesByRestaurantId } from "@/services/branches";
import { getQRCodes, listQueuesForQRForm } from "@/services/qr-codes";

export const metadata: Metadata = {
  title: "QR Codes",
};

export const dynamic = "force-dynamic";

export default async function QRCodesPage() {
  const workspace = await requireWorkspacePage();
  const restaurantId = workspace.restaurant!.id;
  const role = workspace.role!;
  const canView = hasPermission(role, "qr_codes.view");
  const canManage = hasPermission(role, "qr_codes.manage");

  if (!canView) {
    return (
      <div>
        <PageHeader
          title="QR Codes"
          description="You do not have permission to view QR codes."
          breadcrumbs={QR_CODES_BREADCRUMBS}
        />
      </div>
    );
  }

  const [qrCodes, branches, queues] = await Promise.all([
    getQRCodes(restaurantId),
    listBranchesByRestaurantId(restaurantId),
    listQueuesForQRForm(restaurantId),
  ]);

  return (
    <div>
      <PageHeader
        title="QR Codes"
        description="Create printable QR codes that send customers to your public queue join screen. Download SVG for print-quality signs, or PNG for image files."
        breadcrumbs={QR_CODES_BREADCRUMBS}
      />
      <QRBoard
        key={workspace.branch?.id ?? "all"}
        restaurantId={restaurantId}
        qrCodes={qrCodes}
        branches={branches}
        queues={queues}
        currentBranchId={workspace.branch?.id ?? null}
        canManage={canManage}
      />
    </div>
  );
}
