import { PUBLIC_QR_MESSAGES } from "@/lib/public-qr/messages";

type PublicQRUnavailableProps = {
  message?: string;
};

export function PublicQRUnavailable({ message }: PublicQRUnavailableProps) {
  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {PUBLIC_QR_MESSAGES.unavailable}
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {message ?? PUBLIC_QR_MESSAGES.contactStaff}
        </p>
      </div>
    </main>
  );
}
