import Link from "next/link";
import { AppLogo } from "@/components/common/AppLogo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-6">
        <AppLogo size="md" />
      </Link>
      {children}
    </div>
  );
}
