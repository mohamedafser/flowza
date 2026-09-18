import type { Metadata } from "next";
import { DisplayUnavailable } from "@/components/public-display/DisplayUnavailable";
import { PublicDisplayView } from "@/components/public-display/PublicDisplayView";
import { PUBLIC_DISPLAY_MESSAGES } from "@/lib/public-display/messages";
import { publicDisplayTokenParamSchema } from "@/lib/validations/public-display";
import { getPublicDisplay } from "@/services/displays";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ publicToken: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const raw = await params;
  const parsed = publicDisplayTokenParamSchema.safeParse(raw);
  if (!parsed.success) {
    return { title: "Display" };
  }
  const result = await getPublicDisplay(parsed.data.publicToken);
  if (!result.ok || result.data.unavailable) {
    return { title: "Display" };
  }
  return {
    title: `${result.data.restaurant.name} display`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicDisplayPage({ params }: PageProps) {
  const raw = await params;
  const parsed = publicDisplayTokenParamSchema.safeParse(raw);
  if (!parsed.success) {
    return (
      <DisplayUnavailable message={PUBLIC_DISPLAY_MESSAGES.contactStaff} />
    );
  }

  const result = await getPublicDisplay(parsed.data.publicToken);
  if (!result.ok) {
    return (
      <DisplayUnavailable
        message={result.message || PUBLIC_DISPLAY_MESSAGES.contactStaff}
      />
    );
  }

  if (result.data.unavailable) {
    return (
      <DisplayUnavailable
        message={`${result.data.message} ${PUBLIC_DISPLAY_MESSAGES.contactStaff}`}
      />
    );
  }

  return (
    <PublicDisplayView
      publicToken={parsed.data.publicToken}
      initial={result.data}
    />
  );
}
