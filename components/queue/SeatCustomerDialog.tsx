"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { tableDisplayName } from "@/lib/utils/tables";
import { suitableTablesForParty } from "@/lib/utils/queue";
import type { RestaurantTableRecord } from "@/lib/utils/tables";
import type { QueueEntryView } from "@/services/queues";

type SeatCustomerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: QueueEntryView | null;
  tables: RestaurantTableRecord[];
  pending: boolean;
  onSeat: (tableId: string) => Promise<void> | void;
};

export function SeatCustomerDialog({
  open,
  onOpenChange,
  entry,
  tables,
  pending,
  onSeat,
}: SeatCustomerDialogProps) {
  const [tableId, setTableId] = useState<string>("");
  const suitable = entry
    ? suitableTablesForParty(tables, entry.party_size)
    : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTableId("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Seat {entry?.token ?? "customer"}</DialogTitle>
          <DialogDescription>
            Choose an available table that fits a party of{" "}
            {entry?.party_size ?? "—"}. Tables are ordered by smallest
            sufficient capacity.
          </DialogDescription>
        </DialogHeader>
        {suitable.length === 0 ? (
          <EmptyState
            title="No suitable tables are currently available."
            description="Keep this guest in the queue until a large enough table is free. They will not be removed."
            className="py-8"
          />
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {suitable.map((table) => {
              const selected = tableId === table.id;
              return (
                <button
                  key={table.id}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                    selected
                      ? "border-primary bg-muted"
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => setTableId(table.id)}
                >
                  <span className="font-medium">{tableDisplayName(table)}</span>
                  <span className="text-muted-foreground">
                    Seats {table.capacity}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || !tableId || suitable.length === 0}
            onClick={() => {
              if (!tableId || pending) return;
              void onSeat(tableId);
            }}
          >
            {pending ? "Seating…" : "Seat customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
