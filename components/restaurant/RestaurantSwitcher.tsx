"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { switchRestaurantRequest } from "@/lib/api/restaurants-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MembershipWithRestaurant } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

type RestaurantSwitcherProps = {
  memberships: MembershipWithRestaurant[];
  currentRestaurantId: string | null;
  className?: string;
};

export function RestaurantSwitcher({
  memberships,
  currentRestaurantId,
  className,
}: RestaurantSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current =
    memberships.find((m) => m.restaurant_id === currentRestaurantId) ??
    memberships[0] ??
    null;

  if (memberships.length === 0 || !current) {
    return null;
  }

  const onSelect = (restaurantId: string) => {
    if (restaurantId === current.restaurant_id) return;
    startTransition(async () => {
      const result = await switchRestaurantRequest(restaurantId);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to switch restaurant.");
        return;
      }
      router.refresh();
    });
  };

  if (memberships.length === 1) {
    return (
      <div
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
          className,
        )}
      >
        <LogoMark
          url={current.restaurant.logo_url}
          name={current.restaurant.name}
        />
        <span className="truncate font-medium">{current.restaurant.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            className={cn("max-w-[14rem] justify-between gap-2", className)}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <LogoMark
            url={current.restaurant.logo_url}
            name={current.restaurant.name}
          />
          <span className="truncate">{current.restaurant.name}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Restaurants</DropdownMenuLabel>
          {memberships.map((membership) => {
            const active = membership.restaurant_id === current.restaurant_id;
            return (
              <DropdownMenuItem
                key={membership.id}
                onClick={() => onSelect(membership.restaurant_id)}
                className="gap-2"
              >
                <LogoMark
                  url={membership.restaurant.logo_url}
                  name={membership.restaurant.name}
                />
                <span className="min-w-0 flex-1 truncate">
                  {membership.restaurant.name}
                </span>
                {active ? <Check className="size-3.5 shrink-0" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LogoMark({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={20}
        height={20}
        className="size-5 shrink-0 rounded object-cover"
        unoptimized
      />
    );
  }
  return (
    <span className="bg-muted flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold uppercase">
      {name.slice(0, 1)}
    </span>
  );
}
