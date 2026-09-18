"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Monitor, Pencil, Power } from "lucide-react";
import { toast } from "sonner";
import {
  deleteDisplayAction,
  setDisplayStatusAction,
} from "@/app/actions/display";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DisplayFormDialog } from "@/components/displays/DisplayFormDialog";
import { Button } from "@/components/ui/button";
import { publicDisplayAbsoluteUrl } from "@/lib/public-display/paths";
import type { Branch } from "@/lib/context/restaurant";
import type { DisplayListItem, DisplayQueueOption } from "@/services/displays";

type DisplayBoardProps = {
  restaurantId: string;
  displays: DisplayListItem[];
  branches: Branch[];
  queues: DisplayQueueOption[];
  canManage: boolean;
};

export function DisplayBoard({
  restaurantId,
  displays,
  branches,
  queues,
  canManage,
}: DisplayBoardProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DisplayListItem | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DisplayListItem | null>(
    null,
  );

  const refresh = () => router.refresh();

  const copyUrl = async (token: string) => {
    try {
      await navigator.clipboard.writeText(publicDisplayAbsoluteUrl(token));
      toast.success("Display URL copied.");
    } catch {
      toast.error("Unable to copy URL.");
    }
  };

  const toggleActive = async (display: DisplayListItem) => {
    setPendingId(display.id);
    try {
      const result = await setDisplayStatusAction({
        displayId: display.id,
        isActive: !display.is_active,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Unable to update display.");
        return;
      }
      toast.success(
        display.is_active ? "Display deactivated." : "Display activated.",
      );
      refresh();
    } finally {
      setPendingId(null);
    }
  };

  const onDelete = async () => {
    if (!confirmDelete) return;
    setPendingId(confirmDelete.id);
    try {
      const result = await deleteDisplayAction({
        displayId: confirmDelete.id,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Unable to delete display.");
        return;
      }
      toast.success("Display deleted.");
      setConfirmDelete(null);
      refresh();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>Create display</Button>
        ) : null}
      </div>

      {displays.length === 0 ? (
        <EmptyState
          title="No displays yet"
          description="Create a TV or lobby display to show now-serving and next tokens."
          icon={<Monitor className="size-8" />}
          action={
            canManage ? (
              <Button onClick={() => setCreateOpen(true)}>
                Create display
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3">
          {displays.map((display) => {
            const url = publicDisplayAbsoluteUrl(display.public_token);
            const busy = pendingId === display.id;
            return (
              <li
                key={display.id}
                className="border-border bg-card rounded-xl border p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-medium">{display.name}</h2>
                      <StatusBadge
                        label={display.is_active ? "Active" : "Inactive"}
                        tone={display.is_active ? "success" : "default"}
                      />
                    </div>
                    <p className="text-muted-foreground text-sm">
                      Branch: {display.branch_name}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Queue: {display.queue_name}
                    </p>
                    <p className="text-muted-foreground truncate font-mono text-xs">
                      {url}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      render={<a href={url} target="_blank" rel="noreferrer" />}
                      nativeButton={false}
                    >
                      <ExternalLink className="size-3.5" />
                      Open display
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void copyUrl(display.public_token)}
                    >
                      <Copy className="size-3.5" />
                      Copy URL
                    </Button>
                    {canManage ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing(display)}
                          disabled={busy}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void toggleActive(display)}
                          disabled={busy}
                        >
                          <Power className="size-3.5" />
                          {display.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        {!display.is_active ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setConfirmDelete(display)}
                            disabled={busy}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <DisplayFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        restaurantId={restaurantId}
        branches={branches}
        queues={queues}
        canManage={canManage}
        onSaved={refresh}
      />

      <DisplayFormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        mode="edit"
        restaurantId={restaurantId}
        branches={branches}
        queues={queues}
        display={editing}
        canManage={canManage}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title="Delete display permanently?"
        description="This permanently removes the display configuration. Open TVs using this URL will stop working."
        confirmLabel="Delete"
        destructive
        loading={pendingId === confirmDelete?.id}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
