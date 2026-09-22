import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
};

export function AuthCard({
  title,
  description,
  children,
  footer,
  icon: Icon,
  className,
}: AuthCardProps) {
  return (
    <div className={cn("auth-card w-full", className)}>
      <div className="auth-card-inner space-y-5 p-6 sm:p-7">
        <div className="space-y-3">
          {Icon ? (
            <span className="auth-card-icon" aria-hidden>
              <Icon className="auth-icon-bob size-5" />
            </span>
          ) : null}
          <div className="space-y-1.5">
            <h1 className="font-(family-name:--font-landing-display) text-2xl font-bold tracking-tight text-balance">
              {title}
            </h1>
            {description ? (
              <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">{children}</div>

        {footer ? (
          <p className="text-muted-foreground border-border/60 border-t pt-4 text-center text-sm">
            {footer}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function AuthLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="auth-link">
      {children}
    </Link>
  );
}
