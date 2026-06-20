"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  UserMinusIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  changeBrandMemberRoleAction,
  removeBrandMemberAction,
} from "@/features/admin/brands/actions";
import {
  type AdminBrandMember,
  brandRoleLabel,
  demoteRole,
  initialBrandAdminActionState,
  promoteRole,
} from "@/features/admin/brands/types";

export function BrandMemberActions({
  brandId,
  member,
}: {
  brandId: string;
  member: AdminBrandMember;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const canPromote = promoteRole(member.role) !== null;
  const canDemote = demoteRole(member.role) !== null;

  function runRoleChange(direction: "promote" | "demote") {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("membership_id", member.membershipId);
      formData.append("brand_id", brandId);
      formData.append("direction", direction);
      const result = await changeBrandMemberRoleAction(
        initialBrandAdminActionState,
        formData,
      );
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function runRemove() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("membership_id", member.membershipId);
      formData.append("brand_id", brandId);
      const result = await removeBrandMemberAction(
        initialBrandAdminActionState,
        formData,
      );
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <Button
          disabled={isPending || !canPromote}
          onClick={() => runRoleChange("promote")}
          size="icon-sm"
          title={
            canPromote
              ? `Promote to ${brandRoleLabel(promoteRole(member.role) ?? "")}`
              : "Already at the highest role"
          }
          type="button"
          variant="outline"
        >
          <ChevronUpIcon className="size-4" />
        </Button>
        <Button
          disabled={isPending || !canDemote}
          onClick={() => runRoleChange("demote")}
          size="icon-sm"
          title={
            canDemote
              ? `Demote to ${brandRoleLabel(demoteRole(member.role) ?? "")}`
              : "Already at the lowest role"
          }
          type="button"
          variant="outline"
        >
          <ChevronDownIcon className="size-4" />
        </Button>
        <ConfirmDialog
          confirmLabel="Remove member"
          description={`Remove ${member.email} from this brand? They lose access immediately. This does not delete their account.`}
          errorMessage={error}
          isPending={isPending}
          onConfirm={runRemove}
          onOpenChange={(next) => {
            if (!isPending) {
              setConfirmOpen(next);
              if (!next) setError(null);
            }
          }}
          open={confirmOpen}
          pendingLabel="Removing…"
          title="Remove member"
          trigger={
            <Button
              disabled={isPending}
              size="icon-sm"
              title="Remove from brand"
              type="button"
              variant="ghost"
            >
              <UserMinusIcon className="size-4 text-destructive" />
            </Button>
          }
        />
      </div>
      {error && !confirmOpen ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
