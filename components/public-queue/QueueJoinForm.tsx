"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PartySizeSelector } from "@/components/public-queue/PartySizeSelector";
import { QueueTokenCard } from "@/components/public-queue/QueueTokenCard";
import { joinPublicQueueRequest } from "@/lib/api/public-queue-client";
import { writePublicQueueSession } from "@/lib/public-queue/session";
import { formatWaitMinutes } from "@/lib/utils/queue";
import {
  joinPublicQueueFormSchema,
  toJoinPublicQueueFormValues,
  type JoinPublicQueueFormValues,
} from "@/lib/validations/public-queue";
import type {
  PublicQueueInfo,
  PublicQueueJoinResponse,
} from "@/lib/public-queue/types";

type QueueJoinFormProps = {
  info: PublicQueueInfo;
};

export function QueueJoinForm({ info }: QueueJoinFormProps) {
  const [pending, setPending] = useState(false);
  const [joined, setJoined] = useState<PublicQueueJoinResponse | null>(null);
  const schema = useMemo(
    () =>
      joinPublicQueueFormSchema({
        requirePhone: info.settings.requireCustomerPhone,
        maxPartySize: info.settings.maxPartySize,
      }),
    [info.settings.requireCustomerPhone, info.settings.maxPartySize],
  );

  const form = useForm<JoinPublicQueueFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toJoinPublicQueueFormValues(),
  });
  const partySize = useWatch({ control: form.control, name: "partySize" });

  const onSubmit = form.handleSubmit(async (values) => {
    if (pending || !info.availability.canJoin) return;
    setPending(true);
    try {
      const result = await joinPublicQueueRequest({
        restaurantSlug: info.restaurant.slug,
        branchSlug: info.branch.slug,
        name: values.name,
        phone: values.phone,
        partySize: values.partySize,
      });
      if (!result.ok || !result.data) {
        toast.error(result.message ?? "Unable to join the queue.");
        if (result.message) {
          form.setError("root", { message: result.message });
        }
        return;
      }
      writePublicQueueSession({
        restaurantSlug: info.restaurant.slug,
        branchSlug: info.branch.slug,
        accessToken: result.data.accessToken,
      });
      setJoined(result.data);
    } finally {
      setPending(false);
    }
  });

  if (joined) {
    return (
      <div className="space-y-5">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            {joined.reused
              ? "You're already in the queue"
              : "You're in the queue!"}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Keep this page or bookmark your status link. We saved it on this
            device only.
          </p>
        </div>
        <QueueTokenCard token={joined.status.entry.token} />
        <dl className="border-border bg-card grid grid-cols-2 gap-3 rounded-2xl border p-4">
          {info.settings.showPartySize ? (
            <div>
              <dt className="text-muted-foreground text-sm">Party size</dt>
              <dd className="text-lg font-semibold">
                {joined.status.entry.partySize}
              </dd>
            </div>
          ) : null}
          {info.settings.showEstimatedWait ? (
            <div>
              <dt className="text-muted-foreground text-sm">Estimated wait</dt>
              <dd className="text-lg font-semibold">
                {joined.status.entry.estimatedWaitMinutes == null
                  ? "Unavailable"
                  : formatWaitMinutes(joined.status.entry.estimatedWaitMinutes)}
              </dd>
            </div>
          ) : null}
        </dl>
        <Button
          size="lg"
          className="h-12 w-full text-base"
          render={<Link href={joined.statusPath} />}
          nativeButton={false}
        >
          View queue status
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {form.formState.errors.root?.message ? (
        <Alert variant="destructive" title="Unable to join">
          {form.formState.errors.root.message}
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="queue-join-name">
          Name
          {info.settings.requireCustomerName ? (
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
        </Label>
        <Input
          id="queue-join-name"
          autoComplete="name"
          autoCapitalize="words"
          className="h-12 text-base"
          disabled={pending}
          aria-invalid={Boolean(form.formState.errors.name)}
          aria-describedby={
            form.formState.errors.name ? "queue-join-name-error" : undefined
          }
          {...form.register("name")}
        />
        {form.formState.errors.name ? (
          <p
            id="queue-join-name-error"
            className="text-destructive text-sm"
            role="alert"
          >
            {form.formState.errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="queue-join-phone">
          Phone
          {info.settings.requireCustomerPhone ? (
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
        </Label>
        <Input
          id="queue-join-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className="h-12 text-base"
          disabled={pending}
          aria-invalid={Boolean(form.formState.errors.phone)}
          aria-describedby={
            form.formState.errors.phone ? "queue-join-phone-error" : undefined
          }
          {...form.register("phone")}
        />
        {form.formState.errors.phone ? (
          <p
            id="queue-join-phone-error"
            className="text-destructive text-sm"
            role="alert"
          >
            {form.formState.errors.phone.message}
          </p>
        ) : null}
      </div>

      <PartySizeSelector
        id="queue-join-party-size"
        value={partySize ?? 2}
        max={info.settings.maxPartySize}
        disabled={pending}
        error={form.formState.errors.partySize?.message}
        onChange={(value) =>
          form.setValue("partySize", value, { shouldValidate: true })
        }
      />

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full text-base"
        disabled={pending || !info.availability.canJoin}
      >
        {pending ? "Joining…" : "Join queue"}
      </Button>
    </form>
  );
}
