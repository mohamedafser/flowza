import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { BranchForm } from "@/components/restaurant/BranchForm";
import { BranchStatusControls } from "@/components/restaurant/BranchStatusControls";
import { Button } from "@/components/ui/button";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { SETTINGS_BRANCHES_PATH } from "@/lib/auth/paths";
import { settingsBranchDetailBreadcrumbs } from "@/lib/navigation/breadcrumbs";
import { getBranch } from "@/services/branches";

type PageProps = {
  params: Promise<{ branchId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { branchId } = await params;
  try {
    const branch = await getBranch(branchId);
    return { title: branch?.name ?? "Branch" };
  } catch {
    return { title: "Branch" };
  }
}

export default async function BranchDetailPage({ params }: PageProps) {
  const { branchId } = await params;
  const workspace = await requireWorkspacePage();

  const branch = await getBranch(branchId);
  if (!branch || branch.restaurant_id !== workspace.restaurant!.id) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        title={branch.name}
        description="Branch details and configuration."
        breadcrumbs={settingsBranchDetailBreadcrumbs(branch.name)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={branch.is_active ? "Active" : "Inactive"}
              tone={branch.is_active ? "success" : "warning"}
            />
            <Button
              variant="outline"
              size="sm"
              render={<Link href={SETTINGS_BRANCHES_PATH} />}
              nativeButton={false}
            >
              All branches
            </Button>
          </div>
        }
      />

      <dl className="mb-6 grid max-w-2xl gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Created</dt>
          <dd className="font-medium">
            {new Date(branch.created_at).toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Updated</dt>
          <dd className="font-medium">
            {new Date(branch.updated_at).toLocaleString()}
          </dd>
        </div>
      </dl>

      {workspace.canManageRestaurant ? (
        <div className="mb-8">
          <BranchStatusControls branch={branch} />
        </div>
      ) : null}

      <BranchForm
        mode="edit"
        restaurantId={workspace.restaurant!.id}
        branch={branch}
        canManage={workspace.canManageRestaurant}
        defaultTimezone={workspace.restaurant!.timezone}
      />
      <p className="text-muted-foreground mt-6 text-sm">
        <Link
          href={`/settings/hours?branch=${branch.id}`}
          className="underline"
        >
          Configure operating hours for this branch
        </Link>
      </p>
    </div>
  );
}
