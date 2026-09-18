"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createTableSectionAction,
  deleteTableSectionAction,
  reorderTableSectionsAction,
  updateTableSectionAction,
} from "@/app/actions/tables";
import { reorderSectionIds } from "@/lib/utils/tables";
import type { TableSectionRecord, TableWithSection } from "@/lib/utils/tables";

type SectionManagerProps = {
  branchId: string;
  sections: TableSectionRecord[];
  tables: TableWithSection[];
  canManage: boolean;
};

export function SectionManager({
  branchId,
  sections,
  tables,
  canManage,
}: SectionManagerProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteSection, setDeleteSection] = useState<TableSectionRecord | null>(
    null,
  );
  const [reassignTo, setReassignTo] = useState<string>("");

  const assignedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const table of tables) {
      if (!table.section_id) continue;
      counts.set(table.section_id, (counts.get(table.section_id) ?? 0) + 1);
    }
    return counts;
  }, [tables]);

  const otherSections = sections.filter(
    (section) => section.id !== deleteSection?.id,
  );
  const assignedCount = deleteSection
    ? (assignedCounts.get(deleteSection.id) ?? 0)
    : 0;

  const refresh = () => router.refresh();

  const createSection = async () => {
    if (!canManage || pending) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Section name is required");
      return;
    }

    setPending(true);
    try {
      const result = await createTableSectionAction({
        branchId,
        name: trimmed,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Unable to create section.");
        return;
      }
      setName("");
      toast.success("Section created.");
      refresh();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  const saveRename = async (sectionId: string) => {
    if (!canManage || pending) return;
    const trimmed = editingName.trim();
    if (!trimmed) {
      toast.error("Section name is required");
      return;
    }

    setPending(true);
    try {
      const result = await updateTableSectionAction({
        sectionId,
        name: trimmed,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Unable to rename section.");
        return;
      }
      setEditingId(null);
      toast.success("Section updated.");
      refresh();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    if (!canManage || pending) return;
    const next = reorderSectionIds(
      sections.map((section) => section.id),
      index,
      index + direction,
    );
    if (next.join() === sections.map((section) => section.id).join()) {
      return;
    }

    setPending(true);
    try {
      const result = await reorderTableSectionsAction({
        branchId,
        sectionIds: next,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Unable to reorder sections.");
        return;
      }
      refresh();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteSection || !canManage || pending) return;
    if (assignedCount > 0 && reassignTo === "") {
      toast.error("Choose where to move the assigned tables first.");
      return;
    }

    setPending(true);
    try {
      const result = await deleteTableSectionAction({
        sectionId: deleteSection.id,
        reassignToSectionId:
          assignedCount > 0
            ? reassignTo === "none"
              ? null
              : reassignTo
            : undefined,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Unable to delete section.");
        return;
      }
      toast.success("Section deleted.");
      setDeleteSection(null);
      setReassignTo("");
      refresh();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Add section</CardTitle>
            <CardDescription>
              Group tables by area, such as Indoor, Outdoor, VIP, or Bar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void createSection();
              }}
            >
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Section name"
                disabled={pending}
                aria-label="Section name"
                className="sm:max-w-sm"
              />
              <Button type="submit" disabled={pending || name.trim() === ""}>
                <Plus />
                Add section
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {sections.length === 0 ? (
        <EmptyState
          title="No sections yet"
          description="Create sections to organize tables by area. Tables can also exist without a section."
        />
      ) : (
        <ul className="space-y-2">
          {sections.map((section, index) => {
            const count = assignedCounts.get(section.id) ?? 0;
            const editing = editingId === section.id;
            return (
              <li
                key={section.id}
                className="border-border bg-card flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <Input
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      disabled={pending}
                      aria-label="Rename section"
                    />
                  ) : (
                    <>
                      <p className="font-medium">{section.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {count === 1 ? "1 table" : `${count} tables`}
                      </p>
                    </>
                  )}
                </div>
                {canManage ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      disabled={pending || index === 0}
                      aria-label={`Move ${section.name} up`}
                      onClick={() => void move(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      disabled={pending || index === sections.length - 1}
                      aria-label={`Move ${section.name} down`}
                      onClick={() => void move(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    {editing ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          onClick={() => void saveRename(section.id)}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          disabled={pending}
                          aria-label={`Rename ${section.name}`}
                          onClick={() => {
                            setEditingId(section.id);
                            setEditingName(section.name);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          disabled={pending}
                          aria-label={`Delete ${section.name}`}
                          onClick={() => {
                            setDeleteSection(section);
                            setReassignTo("");
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={Boolean(deleteSection)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteSection(null);
            setReassignTo("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {assignedCount > 0
                ? "Move tables and delete section?"
                : "Delete section?"}
            </DialogTitle>
            <DialogDescription>
              {assignedCount > 0
                ? `${assignedCount} table${assignedCount === 1 ? "" : "s"} still belong to this section. Choose a destination, then delete.`
                : "This section has no tables assigned and can be removed."}
            </DialogDescription>
          </DialogHeader>
          {assignedCount > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="reassignTo">Move tables to</Label>
              <Select
                id="reassignTo"
                value={reassignTo}
                disabled={pending}
                onChange={(event) => setReassignTo(event.target.value)}
              >
                <option value="">Select a destination</option>
                <option value="none">No section</option>
                {otherSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setDeleteSection(null);
                setReassignTo("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || (assignedCount > 0 && reassignTo === "")}
              onClick={() => void confirmDelete()}
            >
              {pending
                ? "Deleting…"
                : assignedCount > 0
                  ? "Move and delete"
                  : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
