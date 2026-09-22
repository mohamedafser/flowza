import Link from "next/link";
import { Syne, Manrope } from "next/font/google";
import {
  ListOrdered,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { AppLogo } from "@/components/common/AppLogo";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { LandingScrollFix } from "@/components/landing/LandingScrollFix";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
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

const HIGHLIGHTS = [
  {
    icon: ListOrdered,
    title: "Live guest queue",
    copy: "Seat parties the moment a table turns.",
  },
  {
    icon: UtensilsCrossed,
    title: "Floor in sync",
    copy: "Tables, bookings, and hosts stay aligned.",
  },
  {
    icon: ShieldCheck,
    title: "Team access",
    copy: "Invite staff with roles that match the floor.",
  },
] as const;

const USER_ORBIT = [UserRound, UserPlus, Users, UserCheck] as const;

type AuthShellProps = {
  children: React.ReactNode;
};

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div
      className={cn(
        display.variable,
        body.variable,
        "auth-root relative min-h-dvh font-(family-name:--font-landing-body)",
      )}
    >
      <LandingScrollFix />

      <div className="auth-backdrop" aria-hidden>
        <div className="auth-atmosphere" />
        <div className="auth-grid" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-6 sm:px-8 lg:justify-center lg:py-10">
        <header className="mb-6 flex items-center justify-between lg:mb-10">
          <Link href="/" className="relative z-10">
            <AppLogo size="md" />
          </Link>
          <ThemeToggle />
        </header>

        <div className="grid flex-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <aside className="auth-brand-panel hidden lg:block" aria-hidden={false}>
            <p className="auth-brand-kicker inline-flex items-center gap-2 text-sm font-medium">
              <Users className="auth-icon-bob size-4" aria-hidden />
              Built for restaurant teams
            </p>
            <h1 className="font-(family-name:--font-landing-display) mt-4 text-4xl font-extrabold tracking-tight text-balance xl:text-5xl">
              <span className="auth-brand-word">{APP_NAME}</span>
            </h1>
            <p className="text-muted-foreground mt-4 max-w-md text-base leading-relaxed text-pretty">
              {APP_TAGLINE} Sign in to run queues, tables, and guest flow in one
              place.
            </p>

            <div className="auth-user-orbit mt-10" aria-hidden>
              {USER_ORBIT.map((Icon, index) => (
                <span
                  key={index}
                  className="auth-user-bubble"
                  style={{ animationDelay: `${index * 0.35}s` }}
                >
                  <Icon className="size-5" />
                </span>
              ))}
            </div>

            <ul className="mt-10 space-y-5">
              {HIGHLIGHTS.map((item, index) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.title}
                    className="auth-highlight"
                    style={{ animationDelay: `${0.15 + index * 0.08}s` }}
                  >
                    <span className="auth-highlight-icon">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tracking-tight">
                        {item.title}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                        {item.copy}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="auth-form-column mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
            <div
              className="auth-mobile-users mb-5 flex justify-center gap-2 lg:hidden"
              aria-hidden
            >
              {USER_ORBIT.map((Icon, index) => (
                <span
                  key={index}
                  className="auth-user-bubble auth-user-bubble-sm"
                  style={{ animationDelay: `${index * 0.28}s` }}
                >
                  <Icon className="size-4" />
                </span>
              ))}
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
