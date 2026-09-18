import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PublicQueueHeader } from "@/components/public-queue/PublicQueueHeader";
import { PublicQueueShell } from "@/components/public-queue/PublicQueueShell";
import { QueueAvailabilityCard } from "@/components/public-queue/QueueAvailabilityCard";
import { QueueClosedState } from "@/components/public-queue/QueueClosedState";
import { ResumeQueueStatus } from "@/components/public-queue/ResumeQueueStatus";
import { publicQueueJoinPath } from "@/lib/public-queue/paths";
import { publicBranchSlugParamsSchema } from "@/lib/validations/public-queue";
import { getPublicQueueInfo } from "@/services/public-queue";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ restaurantSlug: string; branchSlug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const raw = await params;
  const parsed = publicBranchSlugParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return { title: "Queue" };
  }
  const result = await getPublicQueueInfo(
    parsed.data.restaurantSlug,
    parsed.data.branchSlug,
  );
  if (!result.ok) {
    return { title: "Queue" };
  }
  return { title: `${result.data.restaurant.name} queue` };
}

export default async function PublicQueuePage({ params }: PageProps) {
  const raw = await params;
  const parsed = publicBranchSlugParamsSchema.safeParse(raw);
  if (!parsed.success) {
    notFound();
  }

  const result = await getPublicQueueInfo(
    parsed.data.restaurantSlug,
    parsed.data.branchSlug,
  );

  if (!result.ok) {
    return (
      <PublicQueueShell>
        <QueueClosedState reason="unavailable" message={result.message} />
      </PublicQueueShell>
    );
  }

  const info = result.data;
  const joinHref = publicQueueJoinPath(info.restaurant.slug, info.branch.slug);

  return (
    <PublicQueueShell>
      <PublicQueueHeader restaurant={info.restaurant} branch={info.branch} />
      <QueueAvailabilityCard info={info} />
      <div className="mt-6 flex flex-col gap-3">
        {info.availability.canJoin ? (
          <Button
            size="lg"
            className="h-12 w-full text-base"
            render={<Link href={joinHref} />}
            nativeButton={false}
          >
            Join queue
          </Button>
        ) : (
          <QueueClosedState
            reason={info.availability.reason}
            message={info.availability.message}
          />
        )}
        <ResumeQueueStatus
          restaurantSlug={info.restaurant.slug}
          branchSlug={info.branch.slug}
        />
      </div>
    </PublicQueueShell>
  );
}
