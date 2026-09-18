"use client";

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TABLE_STATUSES,
  TABLE_STATUS_LABELS,
  type TableStatus,
} from "@/lib/validations/table";
import type { TableWithSection } from "@/lib/utils/tables";

type TableActionsMenuProps = {
  table: TableWithSection;
  canManage: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  disabled?: boolean;
  onStatusChange: (status: TableStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function TableActionsMenu({
  table,
  canManage,
  canDelete,
  canChangeStatus,
  disabled = false,
  onStatusChange,
  onEdit,
  onDelete,
}: TableActionsMenuProps) {
  if (!canManage && !canChangeStatus && !canDelete) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={`Actions for ${table.table_number}`}
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {canChangeStatus ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            {TABLE_STATUSES.map((status) => (
              <DropdownMenuItem
                key={status}
                disabled={table.status === status || disabled}
                onClick={() => onStatusChange(status)}
              >
                {TABLE_STATUS_LABELS[status]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ) : null}
        {canManage || canDelete ? (
          <>
            {canChangeStatus ? <DropdownMenuSeparator /> : null}
            {canManage ? (
              <DropdownMenuItem disabled={disabled} onClick={onEdit}>
                Edit table
              </DropdownMenuItem>
            ) : null}
            {canDelete ? (
              <DropdownMenuItem
                variant="destructive"
                disabled={disabled}
                onClick={onDelete}
              >
                Delete table
              </DropdownMenuItem>
            ) : null}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
