import Link from "next/link";
import { Syne, Manrope } from "next/font/google";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CreditCard,
  LayoutGrid,
  ListOrdered,
  Monitor,
  QrCode,
  Sparkles,
  UtensilsCrossed,
  Users,
  Zap,
} from "lucide-react";
import { AppLogo } from "@/components/common/AppLogo";
import { InstallPWA } from "@/components/common/InstallPWA";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { LandingHeroVisual } from "@/components/landing/LandingHeroVisual";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingReveal } from "@/components/landing/LandingReveal";
import { LandingScrollFix } from "@/components/landing/LandingScrollFix";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-landing-display",
  weight: ["500", "600", "700", "800"],
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-landing-body",
  weight: ["400", "500", "600", "700"],
});

const STEPS = [
  {
    title: "Guests join in seconds",
    copy: "QR codes and walk-ins feed one live waitlist — no clipboard chaos at the door.",
    icon: QrCode,
  },
  {
    title: "Your floor stays in sync",
    copy: "Queues, tables, and reservations update together so hosts always know who’s next.",
    icon: Zap,
  },
  {
    title: "Guests stay informed",
    copy: "Lobby displays and notifications keep parties ready without constant check-ins.",
    icon: Bell,
  },
] as const;

const PILLARS = [
  {
    title: "Live queue",
    copy: "Call, seat, and recover no-shows with a board built for busy service.",
    icon: ListOrdered,
  },
  {
    title: "Tables & sections",
    copy: "See what’s ready, clearing, or seated across every branch you run.",
    icon: LayoutGrid,
  },
  {
    title: "Reservations",
    copy: "Walk-ins and bookings share the same guest record — no double books.",
    icon: CalendarDays,
  },
  {
    title: "Displays & QR",
    copy: "Printable join codes and TV boards that show tokens, never private details.",
    icon: Monitor,
  },
] as const;

const MARQUEE = [
  { label: "A041 seated", icon: UtensilsCrossed },
  { label: "Table 12 ready", icon: LayoutGrid },
  { label: "Walk-in · 4", icon: Users },
  { label: "Reservation 7:30", icon: CalendarDays },
  { label: "A042 calling", icon: ListOrdered },
  { label: "Display synced", icon: Monitor },
  { label: "QR scanned", icon: QrCode },
  { label: "Guest notified", icon: Bell },
] as const;

const FLOAT_ICONS = [
  ListOrdered,
  LayoutGrid,
  QrCode,
  CalendarDays,
  Monitor,
  Users,
  Bell,
  UtensilsCrossed,
] as const;

export function LandingPage() {
  return (
    <div
      className={cn(
        display.variable,
        body.variable,
        "landing-root relative min-h-dvh font-(family-name:--font-landing-body)",
      )}
    >
      <LandingScrollFix />

      <div className="landing-backdrop" aria-hidden>
        <div className="landing-atmosphere" />
        <div className="landing-grid-mask" />
        <div className="landing-noise" />
      </div>

      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <Link href="/" className="relative z-10">
          <AppLogo size="md" />
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/#pricing"
            className="text-muted-foreground hover:text-foreground hidden px-2.5 py-1.5 text-sm font-medium transition-colors sm:inline-flex"
          >
            Pricing
          </Link>
          <ThemeToggle />
          <Button
            variant="ghost"
            render={<Link href="/login" />}
            nativeButton={false}
            className="hidden sm:inline-flex"
          >
            Log in
          </Button>
          <Button render={<Link href="/signup" />} nativeButton={false}>
            Get started
          </Button>
        </div>
      </header>

      <main className="relative z-10">
        <section className="relative mx-auto grid min-h-[calc(100dvh-4.5rem)] w-full max-w-6xl items-center gap-12 px-4 pb-10 pt-4 sm:px-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-10 lg:pb-16">
          <div className="landing-hero-copy max-w-xl">
            <p className="landing-hero-line landing-hero-line-0 landing-eyebrow mb-4 inline-flex items-center gap-2 text-sm font-medium">
              <Sparkles className="landing-icon-spin size-4" aria-hidden />
              Queue software with restaurant billing built in
            </p>
            <p className="landing-brand-line font-(family-name:--font-landing-display) text-[clamp(3.4rem,12vw,6rem)] leading-[0.9] font-extrabold tracking-tight text-balance">
              <span className="landing-brand-word">{APP_NAME}</span>
            </p>
            <h1 className="landing-hero-line landing-hero-line-1 mt-6 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Restaurant ops that move as fast as your floor.
            </h1>
            <p className="landing-hero-line landing-hero-line-2 text-muted-foreground mt-4 max-w-md text-base leading-relaxed text-pretty sm:text-lg">
              Queue, tables, reservations, and guest updates — plus clear plans
              and usage limits for every restaurant you run.
            </p>
            <div className="landing-hero-line landing-hero-line-3 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                size="lg"
                render={<Link href="/signup" />}
                nativeButton={false}
                className="landing-cta-primary min-w-42"
              >
                Start free trial
                <ArrowRight className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                render={<Link href="/#pricing" />}
                nativeButton={false}
                className="min-w-42"
              >
                View pricing
              </Button>
            </div>

            <ul
              className="landing-hero-line landing-hero-line-4 mt-8 flex flex-wrap gap-2"
              aria-label="Product highlights"
            >
              {[
                { icon: ListOrdered, label: "Queues" },
                { icon: LayoutGrid, label: "Tables" },
                { icon: CalendarDays, label: "Bookings" },
                { icon: CreditCard, label: "Billing" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.label} className="landing-chip">
                    <Icon className="size-3.5" aria-hidden />
                    {item.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <LandingHeroVisual className="landing-hero-visual-enter w-full justify-self-center lg:justify-self-end" />
        </section>

        <div
          className="landing-marquee-wrap border-border/40 relative z-10 border-y py-3.5"
          aria-hidden
        >
          <div className="landing-marquee">
            {[...MARQUEE, ...MARQUEE].map((item, index) => {
              const Icon = item.icon;
              return (
                <span key={`${item.label}-${index}`} className="landing-marquee-item">
                  <Icon className="landing-marquee-icon size-3.5" />
                  {item.label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="landing-float-icons relative z-10 py-6" aria-hidden>
          <div className="landing-float-track">
            {[...FLOAT_ICONS, ...FLOAT_ICONS].map((Icon, index) => (
              <span
                key={index}
                className="landing-float-icon"
                style={{ animationDelay: `${(index % 8) * 0.18}s` }}
              >
                <Icon className="size-5" />
              </span>
            ))}
          </div>
        </div>

        <section className="border-border/50 relative z-10">
          <div className="landing-section-wash" aria-hidden />
          <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-8 sm:py-24">
            <LandingReveal>
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase">
                How it works
              </p>
              <h2 className="font-(family-name:--font-landing-display) mt-3 max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                From door to seat without the scramble.
              </h2>
            </LandingReveal>
            <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <LandingReveal key={step.title} delayMs={index * 90}>
                    <li className="landing-step-card min-w-0">
                      <span className="landing-icon-badge">
                        <Icon className="landing-icon-bob size-5" aria-hidden />
                      </span>
                      <span className="font-(family-name:--font-landing-display) landing-step-index mt-4 block text-sm font-semibold tracking-[0.16em]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3 className="mt-2 text-lg font-semibold tracking-tight">
                        {step.title}
                      </h3>
                      <p className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty">
                        {step.copy}
                      </p>
                    </li>
                  </LandingReveal>
                );
              })}
            </ol>
          </div>
        </section>

        <section className="border-border/50 relative z-10 border-t">
          <div className="landing-mesh-band" aria-hidden />
          <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-8 sm:py-24">
            <LandingReveal>
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase">
                Built for service
              </p>
              <h2 className="font-(family-name:--font-landing-display) mt-3 max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Everything your front of house needs in one flow.
              </h2>
            </LandingReveal>
            <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2">
              {PILLARS.map((pillar, index) => {
                const Icon = pillar.icon;
                return (
                  <LandingReveal key={pillar.title} delayMs={index * 70}>
                    <li className="landing-pillar min-w-0">
                      <span className="landing-icon-badge landing-icon-badge-sm">
                        <Icon className="landing-icon-bob size-4" aria-hidden />
                      </span>
                      <h3 className="mt-4 text-lg font-semibold tracking-tight">
                        {pillar.title}
                      </h3>
                      <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed text-pretty">
                        {pillar.copy}
                      </p>
                    </li>
                  </LandingReveal>
                );
              })}
            </ul>
          </div>
        </section>

        <LandingPricing />

        <section className="border-border/50 relative z-10 overflow-hidden border-t">
          <div className="landing-cta-glow" aria-hidden />
          <LandingReveal className="relative mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:px-8 sm:py-24 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <h2 className="font-(family-name:--font-landing-display) text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Ready to smooth out your service?
              </h2>
              <p className="text-muted-foreground mt-3 text-base leading-relaxed text-pretty">
                Start on Free with a 14-day trial. Invite your team and upgrade
                from Settings → Billing whenever you need more capacity.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                render={<Link href="/signup" />}
                nativeButton={false}
                className="landing-cta-primary"
              >
                Create account
                <ArrowRight className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                render={<Link href="/#pricing" />}
                nativeButton={false}
              >
                Compare plans
              </Button>
            </div>
          </LandingReveal>
        </section>
      </main>

      <footer className="border-border/50 relative z-10 border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} {APP_NAME}. Guest flow, simplified.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/#pricing"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Pricing
            </Link>
            <InstallPWA />
          </div>
        </div>
      </footer>
    </div>
  );
}
