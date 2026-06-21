import { Building2Icon, UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BrandMemberActions } from "@/features/admin/brands/components/BrandMemberActions";
import { DeleteBrandButton } from "@/features/admin/brands/components/DeleteBrandButton";
import { RenameBrandButton } from "@/features/admin/brands/components/RenameBrandButton";
import {
  type AdminBrandSummary,
  brandRoleLabel,
} from "@/features/admin/brands/types";

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Unknown";
}

function roleBadgeVariant(role: string): "default" | "secondary" | "outline" {
  if (role === "OWNER") return "default";
  if (role === "EXECUTIVE_MANAGER") return "secondary";
  return "outline";
}

export function BrandCard({ brand }: { brand: AdminBrandSummary }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Building2Icon className="size-4 text-muted-foreground" />
              {brand.name}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{brand.status}</Badge>
              {brand.industry ? <span>{brand.industry}</span> : null}
              {brand.website ? (
                <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href={brand.website}
                  rel="noreferrer"
                  target="_blank"
                >
                  Website
                </a>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <UsersIcon className="size-3" />
                {brand.memberCount} member{brand.memberCount === 1 ? "" : "s"}
              </span>
              <span>Created {formatDate(brand.createdAt)}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <RenameBrandButton brandId={brand.id} brandName={brand.name} />
            <DeleteBrandButton
              brandId={brand.id}
              brandName={brand.name}
              memberCount={brand.memberCount}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {brand.members.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
            No active members. Create a JOIN_BRAND access key or grant ownership
            to add people.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {brand.members.map((member) => (
              <li
                className="flex items-center justify-between gap-3 px-3 py-2.5"
                key={member.membershipId}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" dir="auto">
                    {member.fullName ?? member.email}
                  </p>
                  {member.fullName ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {member.email}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant={roleBadgeVariant(member.role)}>
                    {brandRoleLabel(member.role)}
                  </Badge>
                  <BrandMemberActions brandId={brand.id} member={member} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
