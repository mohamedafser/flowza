"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingReveal } from "@/components/landing/LandingReveal";
import {
  formatPlanPrice,
  MARKETING_PLANS,
  type MarketingPlan,
} from "@/lib/billing/plan-catalog";
import { cn } from "@/lib/utils";

type BillingCycle = "MONTHLY" | "YEARLY";

function planPrice(plan: MarketingPlan, cycle: BillingCycle): number {
  return cycle === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice;
}

function branchLabel(count: number): string {
  return count === 1 ? "1 branch" : `${count} branches`;
}

export function LandingPricing() {
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const groupId = useId();

  return (
    <section
      id="pricing"
      className="border-border/50 relative z-10 scroll-mt-24 border-t"
    >
      <div className="landing-section-wash" aria-hidden />
      <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-8 sm:py-24">
        <LandingReveal>
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase">
            Pricing
          </p>
          <h2 className="font-(family-name:--font-landing-display) mt-3 max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Plans that grow with your floor.
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl text-base leading-relaxed text-pretty">
            Start free with a 14-day trial. Upgrade when you need more branches,
            staff, and monthly capacity — managed per restaurant.
          </p>
        </LandingReveal>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-labelledby={groupId}
            className="landing-cycle-toggle"
          >
            <span id={groupId} className="sr-only">
              Billing cycle
            </span>
            {(["MONTHLY", "YEARLY"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={cn(
                  "landing-cycle-option",
                  cycle === option && "landing-cycle-option-active",
                )}
                aria-pressed={cycle === option}
                onClick={() => setCycle(option)}
              >
                {option === "MONTHLY" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
          {cycle === "YEARLY" ? (
            <p className="text-muted-foreground text-sm">
              Yearly billed as one payment for the year.
            </p>
          ) : null}
        </div>

        <div className="mt-10 grid items-stretch gap-5 md:grid-cols-3 md:gap-4 lg:gap-6">
          {MARKETING_PLANS.map((plan) => {
            const amount = planPrice(plan, cycle);
            const priceLabel =
              amount <= 0
                ? "Free"
                : formatPlanPrice(
                    amount,
                    plan.currency,
                    cycle === "YEARLY" ? "year" : "month",
                  );

            return (
              <article
                key={plan.code}
                className={cn(
                  "landing-plan",
                  plan.highlighted && "landing-plan-featured",
                )}
                aria-labelledby={`landing-plan-${plan.code}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3
                      id={`landing-plan-${plan.code}`}
                      className="font-(family-name:--font-landing-display) text-xl font-bold tracking-tight"
                    >
                      {plan.name}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed text-pretty">
                      {plan.description}
                    </p>
                  </div>
                  {plan.highlighted ? (
                    <span className="landing-plan-badge shrink-0">Popular</span>
                  ) : null}
                </div>

                <div className="mt-5">
                  <p className="font-(family-name:--font-landing-display) text-3xl font-bold tracking-tight">
                    {priceLabel}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {amount > 0
                      ? "Taxes may apply at checkout"
                      : "No credit card required"}
                  </p>
                </div>

                <ul className="text-muted-foreground mt-5 space-y-1.5 text-sm">
                  <li>{branchLabel(plan.limits.branches)}</li>
                  <li>{plan.limits.staff} staff</li>
                  <li>{plan.limits.tables} tables</li>
                  <li>
                    {plan.limits.queueEntriesPerMonth.toLocaleString("en-IN")}{" "}
                    queue entries / month
                  </li>
                </ul>

                <ul className="mt-5 space-y-2 border-t border-border/60 pt-5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Check
                        className="landing-plan-check mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-6">
                  <Button
                    className={cn(
                      "w-full",
                      plan.highlighted && "landing-cta-primary",
                    )}
                    variant={plan.highlighted ? "default" : "outline"}
                    size="lg"
                    render={<Link href="/signup" />}
                    nativeButton={false}
                  >
                    {plan.code === "FREE"
                      ? "Start free"
                      : `Choose ${plan.name}`}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
