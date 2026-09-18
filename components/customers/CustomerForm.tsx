"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createCustomerAction,
  updateCustomerAction,
} from "@/app/actions/customers";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DASHBOARD_CUSTOMERS_PATH } from "@/lib/auth/paths";
import {
  customerFieldsSchema,
  toCustomerFormValues,
  toCustomerWritePayload,
  type CustomerFormValues,
} from "@/lib/validations/customer";
import type { CustomerDuplicate } from "@/lib/utils/customers";
import type { CustomerRecord } from "@/services/customers";

type CustomerFormProps = {
  mode: "create" | "edit";
  customer?: CustomerRecord | null;
  canManage: boolean;
  onSaved?: (customer: CustomerRecord) => void;
};

function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      *
    </span>
  );
}

export function CustomerForm({
  mode,
  customer,
  canManage,
  onSaved,
}: CustomerFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [duplicate, setDuplicate] = useState<CustomerDuplicate | null>(null);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFieldsSchema),
    defaultValues: toCustomerFormValues(customer ?? undefined),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!canManage || pending) return;
    setPending(true);
    setDuplicate(null);
    try {
      const payload = toCustomerWritePayload(values);
      const result =
        mode === "create"
          ? await createCustomerAction(payload)
          : await updateCustomerAction({
              customerId: customer!.id,
              ...payload,
            });

      if (!result.ok) {
        if (result.data?.existingCustomer) {
          setDuplicate(result.data.existingCustomer);
        }
        toast.error(result.message ?? "Unable to save customer.");
        return;
      }

      const saved = result.data?.customer;
      toast.success(
        mode === "create" ? "Customer added." : "Customer updated.",
      );
      if (saved) {
        form.reset(toCustomerFormValues(saved));
        onSaved?.(saved);
      }
      if (mode === "create" && saved) {
        router.push(`${DASHBOARD_CUSTOMERS_PATH}/${saved.id}`);
        router.refresh();
        return;
      }
      router.refresh();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  });

  const disabled = !canManage || pending;

  return (
    <form className="max-w-xl space-y-4" onSubmit={onSubmit} noValidate>
      {duplicate ? (
        <Alert variant="warning">
          <p className="text-foreground font-medium">
            {duplicate.match === "phone"
              ? "A customer with this phone already exists."
              : "A customer with this email already exists."}
          </p>
          <p className="mt-1">
            {duplicate.name} is already on file.{" "}
            <Link
              href={`${DASHBOARD_CUSTOMERS_PATH}/${duplicate.id}`}
              className="text-foreground font-medium underline underline-offset-4"
            >
              View existing customer
            </Link>
          </p>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="customer-name">
          Name <RequiredMark />
        </Label>
        <Input
          id="customer-name"
          autoComplete="name"
          required
          aria-required="true"
          disabled={disabled}
          aria-invalid={Boolean(form.formState.errors.name)}
          {...form.register("name")}
        />
        {form.formState.errors.name ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="customer-phone">Phone</Label>
          <Input
            id="customer-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Optional"
            disabled={disabled}
            aria-invalid={Boolean(form.formState.errors.phone)}
            {...form.register("phone")}
          />
          {form.formState.errors.phone ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.phone.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer-email">Email</Label>
          <Input
            id="customer-email"
            type="email"
            autoComplete="email"
            placeholder="Optional"
            disabled={disabled}
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>
      </div>

      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending
              ? "Saving…"
              : mode === "create"
                ? "Add customer"
                : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            render={<Link href={DASHBOARD_CUSTOMERS_PATH} />}
            nativeButton={false}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          You can view this customer. Editing requires the customers.manage
          permission.
        </p>
      )}
    </form>
  );
}
