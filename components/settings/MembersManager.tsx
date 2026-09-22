"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, MailPlus, Minus, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  inviteMemberRequest,
  listMembersRequest,
  removeMemberRequest,
  revokeInvitationRequest,
  updateMemberRoleRequest,
} from "@/lib/api/members-client";
import { MEMBER_ROLES, type MemberRole } from "@/lib/auth/roles";
import {
  MEMBER_ROLE_CAPABILITIES,
  MEMBER_ROLE_DESCRIPTIONS,
  MEMBER_ROLE_LABELS,
  MEMBER_ROLE_MATRIX,
  MEMBER_STATUS_LABELS,
  ROLE_ACCESS_LABELS,
  assignableRolesForMember,
  assignableRolesForNewMember,
  canManageMembers,
  canRemoveMember,
  countActiveOwners,
  isInvitationExpired,
  memberDisplayName,
  memberStatusTone,
  type OrganizationInvitation,
  type OrganizationMember,
  type RoleAccess,
} from "@/lib/utils/members";
import { cn } from "@/lib/utils";

type MembersManagerProps = {
  members: OrganizationMember[];
  invitations: OrganizationInvitation[];
  actorRole: MemberRole;
  actorUserId: string;
};

const NETWORK_ERROR = "Network error. Check your connection and try again.";

function RoleAccessCell({ access }: { access: RoleAccess }) {
  if (access === "full") {
    return (
      <span
        className="inline-flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-300"
        title={ROLE_ACCESS_LABELS.full}
      >
        <Check className="size-3.5" aria-hidden />
        <span className="sr-only sm:not-sr-only sm:text-xs">
          {ROLE_ACCESS_LABELS.full}
        </span>
      </span>
    );
  }

  if (access === "view") {
    return (
      <span
        className={cn(
          "text-muted-foreground inline-flex items-center justify-center text-xs font-medium",
        )}
        title={ROLE_ACCESS_LABELS.view}
      >
        {ROLE_ACCESS_LABELS.view}
      </span>
    );
  }

  return (
    <span
      className="text-muted-foreground/60 inline-flex items-center justify-center"
      title="No access"
    >
      <Minus className="size-3.5" aria-hidden />
      <span className="sr-only">No access</span>
    </span>
  );
}

export function MembersManager({
  members: initialMembers,
  invitations: initialInvitations,
  actorRole,
  actorUserId,
}: MembersManagerProps) {
  const canManage = canManageMembers(actorRole);
  const invitableRoles = assignableRolesForNewMember(actorRole);

  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>(
    invitableRoles.includes("STAFF") ? "STAFF" : (invitableRoles[0] ?? "STAFF"),
  );
  const [pending, setPending] = useState(false);
  const [memberToRemove, setMemberToRemove] =
    useState<OrganizationMember | null>(null);

  const ownerCount = useMemo(() => countActiveOwners(members), [members]);

  const reload = useCallback(async () => {
    const result = await listMembersRequest();
    if (!result.ok || !result.data) {
      toast.error(result.message ?? "Unable to refresh staff.");
      return;
    }
    setMembers(result.data.members);
    setInvitations(result.data.invitations);
  }, []);

  const addStaff = async () => {
    if (!canManage || pending) return;
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter an email address.");
      return;
    }

    setPending(true);
    try {
      const result = await inviteMemberRequest(trimmed, role);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to add staff member.");
        return;
      }
      setEmail("");
      toast.success(
        result.data?.outcome === "ADDED"
          ? "Staff member added."
          : `Invitation saved for ${trimmed}. They join automatically when they sign up with this email.`,
      );
      await reload();
    } catch {
      toast.error(NETWORK_ERROR);
    } finally {
      setPending(false);
    }
  };

  const changeRole = async (member: OrganizationMember, next: MemberRole) => {
    if (!canManage || pending || next === member.role) return;

    setPending(true);
    try {
      const result = await updateMemberRoleRequest(member.id, next);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to update role.");
        return;
      }
      toast.success(
        `${memberDisplayName(member)} is now ${MEMBER_ROLE_LABELS[next]}.`,
      );
      await reload();
    } catch {
      toast.error(NETWORK_ERROR);
    } finally {
      setPending(false);
    }
  };

  const confirmRemove = async () => {
    if (!memberToRemove || !canManage || pending) return;

    setPending(true);
    try {
      const result = await removeMemberRequest(memberToRemove.id);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to remove staff member.");
        return;
      }
      toast.success("Staff member removed.");
      setMemberToRemove(null);
      await reload();
    } catch {
      toast.error(NETWORK_ERROR);
    } finally {
      setPending(false);
    }
  };

  const revoke = async (invitation: OrganizationInvitation) => {
    if (!canManage || pending) return;

    setPending(true);
    try {
      const result = await revokeInvitationRequest(invitation.id);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to revoke invitation.");
        return;
      }
      toast.success("Invitation revoked.");
      await reload();
    } catch {
      toast.error(NETWORK_ERROR);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Add staff</CardTitle>
            <CardDescription>
              People who already have a Flowza account join straight away.
              Anyone else is invited, and joins with this role the moment they
              sign up using the same email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                void addStaff();
              }}
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="member-email">Email</Label>
                <Input
                  id="member-email"
                  type="email"
                  autoComplete="off"
                  placeholder="teammate@example.com"
                  value={email}
                  disabled={pending}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2 sm:w-48">
                <Label htmlFor="member-role">Role</Label>
                <Select
                  id="member-role"
                  value={role}
                  disabled={pending}
                  onChange={(event) =>
                    setRole(event.target.value as MemberRole)
                  }
                >
                  {invitableRoles.map((option) => (
                    <option key={option} value={option}>
                      {MEMBER_ROLE_LABELS[option]}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="submit"
                disabled={pending || email.trim() === ""}
                className="sm:shrink-0"
              >
                <Plus />
                Add staff
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {members.length === 0 ? (
        <EmptyState
          title="No staff yet"
          description="Add teammates so they can run queues and serve customers with you."
        />
      ) : (
        <ul className="divide-border border-border bg-card divide-y rounded-xl border">
          {members.map((member) => {
            const isSelf = member.user_id === actorUserId;
            const roleOptions = assignableRolesForMember({
              actorRole,
              actorUserId,
              member,
              ownerCount,
            });
            const editable = roleOptions.length > 1;
            const removable = canRemoveMember({
              actorRole,
              actorUserId,
              member,
              ownerCount,
            });

            return (
              <li
                key={member.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">
                      {memberDisplayName(member)}
                    </span>
                    {isSelf ? <StatusBadge label="You" tone="info" /> : null}
                    {member.status === "ACTIVE" ? null : (
                      <StatusBadge
                        label={MEMBER_STATUS_LABELS[member.status]}
                        tone={memberStatusTone(member.status)}
                      />
                    )}
                  </div>
                  <p className="text-muted-foreground truncate text-sm">
                    {member.email ?? "No email on file"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {editable ? (
                    <>
                      <Label
                        htmlFor={`member-role-${member.id}`}
                        className="sr-only"
                      >
                        Role for {memberDisplayName(member)}
                      </Label>
                      <Select
                        id={`member-role-${member.id}`}
                        value={member.role}
                        disabled={pending}
                        className="w-36 sm:w-40"
                        onChange={(event) =>
                          void changeRole(
                            member,
                            event.target.value as MemberRole,
                          )
                        }
                      >
                        {roleOptions.map((option) => (
                          <option key={option} value={option}>
                            {MEMBER_ROLE_LABELS[option]}
                          </option>
                        ))}
                      </Select>
                    </>
                  ) : (
                    <StatusBadge label={MEMBER_ROLE_LABELS[member.role]} />
                  )}
                  {removable ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      disabled={pending}
                      aria-label={`Remove ${memberDisplayName(member)}`}
                      onClick={() => setMemberToRemove(member)}
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {invitations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>
              These people do not have a Flowza account yet. Ask them to sign up
              at your app URL with the exact email below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-border border-border divide-y rounded-xl border">
              {invitations.map((invitation) => {
                const expired = isInvitationExpired(invitation);
                return (
                  <li
                    key={invitation.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <MailPlus className="text-muted-foreground size-4 shrink-0" />
                        <span className="truncate font-medium">
                          {invitation.email}
                        </span>
                        <StatusBadge
                          label={expired ? "Expired" : "Invited"}
                          tone={expired ? "warning" : "info"}
                        />
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {MEMBER_ROLE_LABELS[invitation.role]} ·{" "}
                        {expired ? "expired" : "expires"}{" "}
                        {new Date(invitation.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    {canManage ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => void revoke(invitation)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>What each role can do</CardTitle>
          <CardDescription>
            Roles apply across every branch in this organization. Permissions
            are enforced on the server — use the table and notes below when
            assigning access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="border-border overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <caption className="sr-only">
                Permission comparison across Owner, Admin, Manager, and Staff
              </caption>
              <thead>
                <tr className="bg-muted/40 border-border border-b text-left">
                  <th
                    scope="col"
                    className="text-muted-foreground px-3 py-2.5 font-medium"
                  >
                    Area
                  </th>
                  {MEMBER_ROLES.map((role) => (
                    <th
                      key={role}
                      scope="col"
                      className="px-3 py-2.5 text-center font-medium"
                    >
                      {MEMBER_ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEMBER_ROLE_MATRIX.map((row) => (
                  <tr
                    key={row.area}
                    className="border-border border-b last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="px-3 py-2.5 text-left font-normal"
                    >
                      {row.area}
                    </th>
                    {MEMBER_ROLES.map((role) => (
                      <td key={role} className="px-3 py-2.5 text-center">
                        <RoleAccessCell access={row.access[role]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-muted-foreground text-xs">
            <span className="text-foreground font-medium">Full</span> can change
            data · <span className="text-foreground font-medium">View</span> is
            read-only · <span className="text-foreground font-medium">—</span>{" "}
            means no access
          </p>

          <ul className="space-y-5">
            {MEMBER_ROLES.map((item) => (
              <li
                key={item}
                className="border-border space-y-2 border-b pb-5 last:border-b-0 last:pb-0"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="text-sm font-medium">
                    {MEMBER_ROLE_LABELS[item]}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {MEMBER_ROLE_DESCRIPTIONS[item]}
                  </p>
                </div>
                <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
                  {MEMBER_ROLE_CAPABILITIES[item].map((capability) => (
                    <li key={capability}>{capability}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(memberToRemove)}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null);
        }}
        title="Remove staff member?"
        description={
          memberToRemove
            ? `${memberDisplayName(memberToRemove)} will immediately lose access to this organization. You can add them again later.`
            : undefined
        }
        confirmLabel="Remove"
        destructive
        loading={pending}
        onConfirm={() => void confirmRemove()}
      />
    </div>
  );
}
