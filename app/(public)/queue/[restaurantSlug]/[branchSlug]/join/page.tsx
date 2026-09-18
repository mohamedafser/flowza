import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicQueueHeader } from "@/components/public-queue/PublicQueueHeader";
import { PublicQueueShell } from "@/components/public-queue/PublicQueueShell";
import { QueueAvailabilityCard } from "@/components/public-queue/QueueAvailabilityCard";
import { QueueClosedState } from "@/components/public-queue/QueueClosedState";
import { QueueJoinForm } from "@/components/public-queue/QueueJoinForm";
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
    return { title: "Join queue" };
  }
  const result = await getPublicQueueInfo(
    parsed.data.restaurantSlug,
    parsed.data.branchSlug,
  );
  if (!result.ok) {
    return { title: "Join queue" };
  }
  return { title: `Join ${result.data.restaurant.name}` };
}

export default async function PublicQueueJoinPage({ params }: PageProps) {
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

  return (
    <PublicQueueShell>
      <PublicQueueHeader restaurant={info.restaurant} branch={info.branch} />
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Join queue</h1>
      <QueueAvailabilityCard info={info} className="mb-6" />
      {info.availability.canJoin ? (
        <QueueJoinForm info={info} />
      ) : (
        <QueueClosedState
          reason={info.availability.reason}
          message={info.availability.message}
        />
      )}
    </PublicQueueShell>
  );
}
