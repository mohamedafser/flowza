import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicQRUnavailable } from "@/components/public-qr/PublicQRUnavailable";
import { PUBLIC_QR_MESSAGES } from "@/lib/public-qr/messages";
import { publicQRTokenParamSchema } from "@/lib/validations/qr-code";
import { getPublicQRCode } from "@/services/qr-codes";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ publicToken: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Join queue",
    robots: { index: false, follow: false },
  };
}

export default async function PublicQRPage({ params }: PageProps) {
  const { publicToken } = await params;
  const parsed = publicQRTokenParamSchema.safeParse({ publicToken });

  if (!parsed.success) {
    return <PublicQRUnavailable message={PUBLIC_QR_MESSAGES.contactStaff} />;
  }

  const result = await getPublicQRCode(parsed.data.publicToken);

  if (!result.ok) {
    return (
      <PublicQRUnavailable
        message={result.message || PUBLIC_QR_MESSAGES.contactStaff}
      />
    );
  }

  if (result.data.unavailable) {
    return (
      <PublicQRUnavailable
        message={`${result.data.message} ${PUBLIC_QR_MESSAGES.contactStaff}`}
      />
    );
  }

  redirect(result.data.joinPath);
}
