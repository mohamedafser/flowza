import type { Metadata } from "next";
import { AccessDenied } from "@/components/common/AccessDenied";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { MembersManager } from "@/components/settings/MembersManager";
import { AuthorizationError } from "@/lib/auth/guards";
import { canAccessHref } from "@/lib/auth/navigation";
import { SETTINGS_MEMBERS_PATH } from "@/lib/auth/paths";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { SETTINGS_MEMBERS_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import { getMembersBundle, type MembersBundle } from "@/services/members";

export const metadata: Metadata = {
  title: "Staff & roles",
};

const DESCRIPTION =
  "Give people access to this organization and control what each role can do.";

export default async function MembersSettingsPage() {
  const workspace = await requireWorkspacePage();
  const role = workspace.role;

  if (!role || !canAccessHref(role, SETTINGS_MEMBERS_PATH)) {
    return (
      <AccessDenied
        title="Staff & roles"
        description={DESCRIPTION}
        message="Your role cannot view staff for this organization."
        breadcrumbs={SETTINGS_MEMBERS_BREADCRUMBS}
      />
    );
  }

  let bundle: MembersBundle | null = null;
  let errorMessage: string | null = null;

  try {
    bundle = await getMembersBundle();
  } catch (error) {
    errorMessage =
      error instanceof AuthorizationError
        ? error.message
        : "Unable to load staff. Please try again.";
  }

  if (!bundle) {
    return (
      <div>
        <PageHeader
          title="Staff & roles"
          description={DESCRIPTION}
          breadcrumbs={SETTINGS_MEMBERS_BREADCRUMBS}
        />
        <ErrorState
          title="Unable to load staff"
          message={errorMessage ?? "Unable to load staff. Please try again."}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Staff & roles"
        description={DESCRIPTION}
        breadcrumbs={SETTINGS_MEMBERS_BREADCRUMBS}
      />
      <MembersManager
        members={bundle.members}
        invitations={bundle.invitations}
        actorRole={role}
        actorUserId={bundle.currentUserId}
      />
    </div>
  );
}
