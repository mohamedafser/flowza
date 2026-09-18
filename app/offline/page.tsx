import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12 text-center">
      <WifiOff className="text-muted-foreground mb-4 size-10" />
      <h1 className="text-2xl font-semibold tracking-tight">You are offline</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-sm text-pretty">
        {APP_NAME} shell content may still be available, but live queue
        positions, table availability, and other realtime data require an active
        connection. Stale queue information is never shown as current.
      </p>
      <Button className="mt-6" render={<Link href="/" />}>
        Try again
      </Button>
    </main>
  );
}
