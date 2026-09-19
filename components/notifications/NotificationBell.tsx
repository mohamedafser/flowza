"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { StaffNotificationItem } from "@/services/notifications";

type NotificationBellProps = {
  restaurantId: string;
};

type ListResponse = {
  items: StaffNotificationItem[];
  unreadCount: number;
  nextCursor: string | null;
};

async function fetchNotifications(
  restaurantId: string,
  cursor?: string | null,
): Promise<ListResponse | null> {
  const params = new URLSearchParams({ restaurantId });
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/notifications?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) return null;
  const json: unknown = await response.json();
  if (
    !json ||
    typeof json !== "object" ||
    !("ok" in json) ||
    !(json as { ok: unknown }).ok ||
    !("data" in json)
  ) {
    return null;
  }
  return (json as { data: ListResponse }).data;
}

function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell({ restaurantId }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<StaffNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadList = useCallback(
    async (cursor?: string | null, append = false) => {
      setLoading(true);
      setError(null);
      const data = await fetchNotifications(restaurantId, cursor);
      setLoading(false);
      if (!data) {
        setError("Unable to load notifications.");
        return;
      }
      setUnreadCount(data.unreadCount);
      setNextCursor(data.nextCursor);
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
    },
    [restaurantId],
  );

  // Badge polling — updates only unread count (no loading flicker).
  useEffect(() => {
    let cancelled = false;

    async function refreshBadge() {
      const data = await fetchNotifications(restaurantId);
      if (cancelled || !data) return;
      setUnreadCount(data.unreadCount);
    }

    const initial = window.setTimeout(() => {
      void refreshBadge();
    }, 0);
    const interval = window.setInterval(() => {
      void refreshBadge();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [restaurantId]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      void loadList();
    }
  }

  function markRead(notificationId: string) {
    startTransition(async () => {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", notificationId }),
      });
      setItems((prev) =>
        prev.map((item) =>
          item.id === notificationId
            ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
            : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    });
  }

  function markAllRead() {
    startTransition(async () => {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read", restaurantId }),
      });
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="relative"
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications"
            }
          />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={pending}
              onClick={markAllRead}
            >
              <CheckCheck />
              Mark all read
            </Button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {loading && items.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              Loading…
            </p>
          ) : error ? (
            <p className="text-destructive px-3 py-6 text-center text-sm">
              {error}
            </p>
          ) : items.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 px-3 py-8 text-center text-sm">
              <Inbox className="size-6 opacity-60" />
              No notifications yet.
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(
                      "hover:bg-muted/60 w-full px-3 py-2.5 text-left transition-colors",
                      !item.readAt && "bg-muted/30",
                    )}
                    onClick={() => {
                      if (!item.readAt) markRead(item.id);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">
                        {item.title ?? item.type}
                      </p>
                      <span className="text-muted-foreground shrink-0 text-[11px]">
                        {relativeTime(item.createdAt)}
                      </span>
                    </div>
                    {item.body ? (
                      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                        {item.body}
                      </p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {nextCursor ? (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                disabled={loading || pending}
                onClick={() => void loadList(nextCursor, true)}
              >
                Load more
              </Button>
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
