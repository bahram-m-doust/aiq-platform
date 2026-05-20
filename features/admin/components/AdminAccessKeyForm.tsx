"use client";

import { useActionState, useMemo, useState } from "react";
import { MailIcon, ShieldCheckIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  initialAdminAccessKeyFormState,
  requiresTargetRole,
} from "@/features/admin/access-key-schema";
import { createAdminAccessKeyAction } from "@/features/admin/actions";
import type {
  AdminAccessKeyFormOptions,
  AdminAccessKeyType,
  BrandRole,
} from "@/features/admin/types";
import { adminAccessKeyTypes, brandRoles } from "@/features/admin/types";
import { SubmitButton } from "@/features/auth/components/SubmitButton";

const accessKeyTypeLabels: Record<AdminAccessKeyType, string> = {
  CREATE_BRAND: "Create brand",
  CLAIM_BRAND: "Claim brand",
  JOIN_BRAND: "Join brand",
  DEMO_ACCESS: "Demo access",
};

const roleLabels: Record<BrandRole, string> = {
  OWNER: "Owner",
  EXECUTIVE_MANAGER: "Executive manager",
  BRAND_SPECIALIST: "Brand specialist",
};

function defaultRoleForType(type: AdminAccessKeyType): BrandRole {
  return type === "JOIN_BRAND" ? "BRAND_SPECIALIST" : "OWNER";
}

export function AdminAccessKeyForm({
  options,
}: {
  options: AdminAccessKeyFormOptions;
}) {
  const [state, formAction] = useActionState(
    createAdminAccessKeyAction,
    initialAdminAccessKeyFormState,
  );
  const [type, setType] = useState<AdminAccessKeyType>("CREATE_BRAND");
  const [targetRole, setTargetRole] = useState<BrandRole>("OWNER");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const needsBrand = type === "CLAIM_BRAND" || type === "JOIN_BRAND";
  const allowsBrand = needsBrand || type === "DEMO_ACCESS";
  const allowsPlan = type === "CREATE_BRAND" || type === "DEMO_ACCESS";
  const needsRole = requiresTargetRole(type);

  function handleTypeChange(value: string) {
    const nextType = value as AdminAccessKeyType;

    setType(nextType);
    setTargetRole(defaultRoleForType(nextType));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create access key</CardTitle>
          <CardDescription>
            Generate a time-limited Brand Access Key for a target recipient.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-5">
            {state.status === "error" ? (
              <Alert variant="destructive">
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">Access key type</Label>
                <Select
                  name="type"
                  onValueChange={handleTypeChange}
                  value={type}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {adminAccessKeyTypes.map((accessKeyType) => (
                      <SelectItem key={accessKeyType} value={accessKeyType}>
                        {accessKeyTypeLabels[accessKeyType]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_email">Target email</Label>
                <Input
                  autoComplete="email"
                  id="target_email"
                  name="target_email"
                  placeholder="owner@example.com"
                  required
                  type="email"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {allowsBrand ? (
                <div className="space-y-2">
                  <Label htmlFor="target_brand_id">
                    Target brand{needsBrand ? "" : " optional"}
                  </Label>
                  <Select name="target_brand_id">
                    <SelectTrigger id="target_brand_id">
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {!needsBrand ? (
                        <SelectItem value="none">No target brand</SelectItem>
                      ) : null}
                      {options.brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name} ({brand.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {needsRole ? (
                <div className="space-y-2">
                  <Label htmlFor="target_role">Target role</Label>
                  <Select
                    name="target_role"
                    onValueChange={(value) => setTargetRole(value as BrandRole)}
                    value={targetRole}
                  >
                    <SelectTrigger id="target_role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {brandRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleLabels[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {allowsPlan ? (
                <div className="space-y-2">
                  <Label htmlFor="plan_id">Plan optional</Label>
                  <Select defaultValue="none" name="plan_id">
                    <SelectTrigger id="plan_id">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No plan</SelectItem>
                      {options.plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="expires_at">Expiry date</Label>
                <Input
                  id="expires_at"
                  min={today}
                  name="expires_at"
                  required
                  type="date"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Checkbox id="send_email" name="send_email" value="true" />
              <Label className="cursor-pointer" htmlFor="send_email">
                Send access key by email
              </Label>
            </div>

            <div className="flex justify-end">
              <SubmitButton
                idleLabel="Create access key"
                pendingLabel="Creating"
              />
            </div>
          </form>
        </CardContent>
      </Card>

      {state.status === "success" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="size-4" />
              Access key created
            </CardTitle>
            <CardDescription>
              Raw key is shown once. It is not stored and cannot be recovered.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.warning ? (
              <Alert>
                <MailIcon className="size-4" />
                <AlertTitle>Email delivery warning</AlertTitle>
                <AlertDescription>{state.warning}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="raw_access_key">Raw access key</Label>
              <Input
                aria-label="Generated raw access key"
                id="raw_access_key"
                readOnly
                value={state.rawKey}
              />
            </div>
            <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
              <p>
                Prefix:{" "}
                <span className="font-mono text-foreground">
                  {state.accessKey.keyPrefix}
                </span>
              </p>
              <p>
                Type:{" "}
                <span className="font-mono text-foreground">
                  {state.accessKey.type}
                </span>
              </p>
              {state.resendEmailId ? (
                <p>
                  Resend id:{" "}
                  <span className="font-mono text-foreground">
                    {state.resendEmailId}
                  </span>
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
