"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Download,
  MoreHorizontal,
  Pencil,
  Power,
  Printer,
  QrCode,
  RefreshCw,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import {
  regenerateQRCodeTokenAction,
  setQRCodeStatusAction,
} from "@/app/actions/qr-code";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { SearchInput } from "@/components/common/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { QRFormDialog } from "@/components/qr-codes/QRFormDialog";
import { QRPreviewDialog } from "@/components/qr-codes/QRPreviewDialog";
import { QRPrintView } from "@/components/qr-codes/QRPrintView";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select } from "@/components/ui/select";
import type { Branch } from "@/lib/context/restaurant";
import { downloadQRCodePng, downloadQRCodeSvg } from "@/lib/qr/generate";
import { getPublicQRCodeUrl } from "@/lib/utils/public-urls";
import type { QRCodeListItem, QRCodeQueueOption } from "@/services/qr-codes";

type QRBoardProps = {
  restaurantId: string;
  qrCodes: QRCodeListItem[];
  branches: Branch[];
  queues: QRCodeQueueOption[];
  currentBranchId: string | null;
  canManage: boolean;
};

type StatusFilter = "all" | "active" | "inactive";

function formatCreated(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function QRBoard({
  restaurantId,
  qrCodes,
  branches,
  queues,
  currentBranchId,
  canManage,
}: QRBoardProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<QRCodeListItem | null>(null);
  const [preview, setPreview] = useState<QRCodeListItem | null>(null);
  const [printing, setPrinting] = useState<QRCodeListItem | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = useState<QRCodeListItem | null>(null);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>(
    currentBranchId ?? "all",
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const refresh = () => router.refresh();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return qrCodes.filter((item) => {
      if (branchFilter !== "all" && item.branch_id !== branchFilter) {
        return false;
      }
      if (statusFilter === "active" && !item.is_active) return false;
      if (statusFilter === "inactive" && item.is_active) return false;
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.branch_name.toLowerCase().includes(query) ||
        item.queue_name.toLowerCase().includes(query)
      );
    });
  }, [branchFilter, qrCodes, search, statusFilter]);

  const copyUrl = async (qrCode: QRCodeListItem) => {
    try {
      await navigator.clipboard.writeText(
        getPublicQRCodeUrl({ publicToken: qrCode.public_token }),
      );
      toast.success("Copied");
    } catch {
      toast.error("Unable to copy URL.");
    }
  };

  const download = async (qrCode: QRCodeListItem, format: "svg" | "png") => {
    const url = getPublicQRCodeUrl({ publicToken: qrCode.public_token });
    try {
      if (format === "svg") {
        await downloadQRCodeSvg(url, qrCode.name);
      } else {
        await downloadQRCodePng(url, qrCode.name);
      }
      toast.success(`${format.toUpperCase()} downloaded.`);
    } catch {
      toast.error(`Unable to download ${format.toUpperCase()}.`);
    }
  };

  const toggleActive = async (qrCode: QRCodeListItem) => {
    setPendingId(qrCode.id);
    try {
      const result = await setQRCodeStatusAction({
        qrCodeId: qrCode.id,
        isActive: !qrCode.is_active,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Unable to update QR code.");
        return;
      }
      toast.success(
        qrCode.is_active ? "QR code deactivated." : "QR code activated.",
      );
      refresh();
    } finally {
      setPendingId(null);
    }
  };

  const onRegenerate = async () => {
    if (!confirmRegen) return;
    setPendingId(confirmRegen.id);
    try {
      const result = await regenerateQRCodeTokenAction({
        qrCodeId: confirmRegen.id,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Unable to regenerate QR token.");
        return;
      }
      toast.success("QR token regenerated. Reprint this QR code.");
      setConfirmRegen(null);
      refresh();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search QR codes…"
            className="max-w-none sm:max-w-xs"
          />
          <Select
            aria-label="Filter by branch"
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            className="sm:w-48"
          >
            <option value="all">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
            className="sm:w-40"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>Create QR code</Button>
        ) : null}
      </div>

      {qrCodes.length === 0 ? (
        <EmptyState
          title="No QR codes yet"
          description="Create a QR code so customers can scan and join your queue."
          icon={<QrCode className="size-8" />}
          action={
            canManage ? (
              <Button onClick={() => setCreateOpen(true)}>
                Create QR Code
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matching QR codes"
          description="Try a different search or filter."
          icon={<QrCode className="size-8" />}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="border-border hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-border bg-muted/40 text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Branch</th>
                  <th className="px-4 py-3 font-medium">Queue</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((qrCode) => {
                  const busy = pendingId === qrCode.id;
                  return (
                    <tr
                      key={qrCode.id}
                      className="border-border border-b last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{qrCode.name}</td>
                      <td className="text-muted-foreground px-4 py-3">
                        {qrCode.branch_name}
                      </td>
                      <td className="text-muted-foreground px-4 py-3">
                        {qrCode.queue_name}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={qrCode.is_active ? "Active" : "Inactive"}
                          tone={qrCode.is_active ? "success" : "default"}
                        />
                      </td>
                      <td className="text-muted-foreground px-4 py-3">
                        {formatCreated(qrCode.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreview(qrCode)}
                            aria-label={`Preview ${qrCode.name}`}
                          >
                            <Eye className="size-4" />
                            Preview
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void download(qrCode, "svg")}
                            aria-label={`Download ${qrCode.name}`}
                          >
                            <Download className="size-4" />
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPrinting(qrCode)}
                            aria-label={`Print ${qrCode.name}`}
                          >
                            <Printer className="size-4" />
                            Print
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="outline"
                                  size="sm"
                                  aria-label={`More actions for ${qrCode.name}`}
                                  disabled={busy}
                                />
                              }
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => void copyUrl(qrCode)}
                              >
                                <Copy className="size-4" />
                                Copy URL
                              </DropdownMenuItem>
                              {canManage ? (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => setEditing(qrCode)}
                                  >
                                    <Pencil className="size-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => void toggleActive(qrCode)}
                                  >
                                    <Power className="size-4" />
                                    {qrCode.is_active
                                      ? "Deactivate"
                                      : "Activate"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setConfirmRegen(qrCode)}
                                  >
                                    <RefreshCw className="size-4" />
                                    Regenerate QR
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="grid gap-3 md:hidden">
            {filtered.map((qrCode) => {
              const busy = pendingId === qrCode.id;
              return (
                <li
                  key={qrCode.id}
                  className="border-border bg-card rounded-xl border p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-medium">{qrCode.name}</h2>
                    <StatusBadge
                      label={qrCode.is_active ? "Active" : "Inactive"}
                      tone={qrCode.is_active ? "success" : "default"}
                    />
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {qrCode.branch_name} · {qrCode.queue_name}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreview(qrCode)}
                    >
                      Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void download(qrCode, "svg")}
                    >
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPrinting(qrCode)}
                    >
                      Print
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`More actions for ${qrCode.name}`}
                            disabled={busy}
                          />
                        }
                      >
                        More
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => void copyUrl(qrCode)}>
                          <Copy className="size-4" />
                          Copy URL
                        </DropdownMenuItem>
                        {canManage ? (
                          <>
                            <DropdownMenuItem
                              onClick={() => setEditing(qrCode)}
                            >
                              <Pencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void toggleActive(qrCode)}
                            >
                              <Power className="size-4" />
                              {qrCode.is_active ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setConfirmRegen(qrCode)}
                            >
                              <RefreshCw className="size-4" />
                              Regenerate QR
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <QRFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        restaurantId={restaurantId}
        branches={branches}
        queues={queues}
        defaultBranchId={currentBranchId}
        canManage={canManage}
        onSaved={refresh}
      />

      <QRFormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        mode="edit"
        restaurantId={restaurantId}
        branches={branches}
        queues={queues}
        qrCode={editing}
        defaultBranchId={currentBranchId}
        canManage={canManage}
        onSaved={refresh}
      />

      <QRPreviewDialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        qrCode={preview}
        onPrint={setPrinting}
      />

      {printing ? (
        <QRPrintView qrCode={printing} onClose={() => setPrinting(null)} />
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmRegen)}
        onOpenChange={(open) => {
          if (!open) setConfirmRegen(null);
        }}
        title="Regenerate QR token?"
        description="Previously printed QR codes will stop working. Customers who scan old copies will see an unavailable screen until you reprint."
        confirmLabel="Regenerate QR"
        loading={pendingId === confirmRegen?.id}
        onConfirm={() => void onRegenerate()}
      />
    </div>
  );
}
