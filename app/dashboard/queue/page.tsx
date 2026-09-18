import type { Metadata } from "next";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { QueueBoard } from "@/components/queue/QueueBoard";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { AuthorizationError } from "@/lib/auth/guards";
import { QUEUE_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import {
  canConfigureQueue,
  canManageQueue,
  canViewQueue,
} from "@/lib/utils/queue";
import { getQueueBundle, type QueueBundle } from "@/services/queues";

export const metadata: Metadata = {
  title: "Queue",
};

type PageProps = {
  searchParams: Promise<{ queueId?: string }>;
};

export default async function QueuePage({ searchParams }: PageProps) {
  const workspace = await requireWorkspacePage();
  const role = workspace.role;
  const { queueId } = await searchParams;

  if (!role || !canViewQueue(role)) {
    return (
      <div>
        <PageHeader
          title="Queue Management"
          description="Call, seat, and complete waiting guests for this branch."
          breadcrumbs={QUEUE_BREADCRUMBS}
        />
        <ErrorState
          title="You do not have access"
          message="Your role cannot view the queue for this restaurant."
        />
      </div>
    );
  }

  if (!workspace.branch) {
    return (
      <div>
        <PageHeader
          title="Queue Management"
          description="Call, seat, and complete waiting guests for this branch."
          breadcrumbs={QUEUE_BREADCRUMBS}
        />
        <EmptyState
          title="No active branch selected"
          description="Create or activate a branch before managing a queue. Queues are always scoped to a single branch."
        />
      </div>
    );
  }

  let bundle: QueueBundle | null = null;
  let errorMessage: string | null = null;

  try {
    bundle = await getQueueBundle(workspace.branch.id, queueId);
  } catch (error) {
    errorMessage =
      error instanceof AuthorizationError
        ? error.message
        : "Unable to load the queue. Please try again.";
  }

  if (!bundle) {
    return (
      <div>
        <PageHeader
          title="Queue Management"
          description="Call, seat, and complete waiting guests for this branch."
          breadcrumbs={QUEUE_BREADCRUMBS}
        />
        <ErrorState
          title="Unable to load queue"
          message={
            errorMessage ?? "Unable to load the queue. Please try again."
          }
        />
      </div>
    );
  }

  return (
    <QueueBoard
      key={`${bundle.branch.id}:${bundle.queue?.id ?? "none"}`}
      bundle={bundle}
      canManage={canManageQueue(role)}
      canConfigure={canConfigureQueue(role)}
    />
  );
}
