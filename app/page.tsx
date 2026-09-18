import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/common/AppLogo";
import { InstallPWA } from "@/components/common/InstallPWA";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

export default function HomePage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.95_0.03_85),_transparent_55%),linear-gradient(180deg,_oklch(0.99_0.01_85),_oklch(0.97_0.01_240))] dark:bg-[radial-gradient(ellipse_at_top,_oklch(0.28_0.04_250),_transparent_55%),linear-gradient(180deg,_oklch(0.16_0.02_260),_oklch(0.14_0.01_240))]"
      />
      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-8">
        <Link href="/" className="relative z-10">
          <AppLogo size="md" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            render={<Link href="/login" />}
            nativeButton={false}
          >
            Log in
          </Button>
          <Button render={<Link href="/signup" />} nativeButton={false}>
            Get started
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-16 sm:px-8">
        <p className="text-muted-foreground mb-3 text-sm font-medium tracking-wide uppercase">
          Restaurant queue management
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
          {APP_NAME}
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl text-lg text-pretty">
          {APP_TAGLINE}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            size="lg"
            render={<Link href="/dashboard" />}
            nativeButton={false}
          >
            Open dashboard
          </Button>
          <Button
            size="lg"
            variant="outline"
            render={<Link href="/signup" />}
            nativeButton={false}
          >
            Create account
          </Button>
        </div>
        <div className="mt-8">
          <InstallPWA />
        </div>
      </main>
    </div>
  );
}
