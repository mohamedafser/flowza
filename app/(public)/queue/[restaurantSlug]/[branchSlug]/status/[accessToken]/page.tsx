import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicQueueHeader } from "@/components/public-queue/PublicQueueHeader";
import { PublicQueueShell } from "@/components/public-queue/PublicQueueShell";
import { QueueClosedState } from "@/components/public-queue/QueueClosedState";
import { QueueStatusView } from "@/components/public-queue/QueueStatusView";
import { publicAccessTokenSchema } from "@/lib/validations/public-queue";
import { publicBranchSlugParamsSchema } from "@/lib/validations/public-queue";
import { getPublicQueueStatus } from "@/services/public-queue";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    restaurantSlug: string;
    branchSlug: string;
    accessToken: string;
  }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const raw = await params;
  const parsedToken = publicAccessTokenSchema.safeParse(raw.accessToken);
  if (!parsedToken.success) {
    return { title: "Queue status" };
  }
  const result = await getPublicQueueStatus(parsedToken.data);
  if (!result.ok) {
    return { title: "Queue status" };
  }
  return { title: `${result.data.entry.token} · Queue status` };
}

export default async function PublicQueueStatusPage({ params }: PageProps) {
  const raw = await params;
  const parsedBranch = publicBranchSlugParamsSchema.safeParse({
    restaurantSlug: raw.restaurantSlug,
    branchSlug: raw.branchSlug,
  });
  const parsedToken = publicAccessTokenSchema.safeParse(raw.accessToken);

  if (!parsedBranch.success || !parsedToken.success) {
    notFound();
  }

  const result = await getPublicQueueStatus(parsedToken.data);
  if (!result.ok) {
    return (
      <PublicQueueShell>
        <QueueClosedState reason="unavailable" message={result.message} />
      </PublicQueueShell>
    );
  }

  if (
    result.data.restaurant.slug !== parsedBranch.data.restaurantSlug ||
    result.data.branch.slug !== parsedBranch.data.branchSlug
  ) {
    notFound();
  }

  return (
    <PublicQueueShell>
      <PublicQueueHeader
        restaurant={result.data.restaurant}
        branch={result.data.branch}
      />
      <QueueStatusView accessToken={parsedToken.data} initial={result.data} />
    </PublicQueueShell>
  );
}
