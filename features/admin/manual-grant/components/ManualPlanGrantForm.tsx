"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { BadgeCheckIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createManualPlanGrantAction,
} from "@/features/admin/manual-grant/actions";
import { initialManualGrantFormState } from "@/features/admin/manual-grant/schema";
import type {
  ManualGrantFormOptions,
  ManualGrantFormState,
  ManualGrantSource,
} from "@/features/admin/manual-grant/types";
import { manualGrantSources } from "@/features/admin/manual-grant/types";

const sourceLabels: Record<ManualGrantSource, string> = {
  MANUAL_CASH: "Manual cash",
  BANK_TRANSFER: "Bank transfer",
  DEMO: "Demo",
  PROMO: "Promo",
  INTERNAL: "Internal",
};

/** Summary data shown inside the confirmation dialog. */
type GrantConfirmation = {
  brandName: string;
  planName: string;
  formData: FormData;
};

export function ManualPlanGrantForm({
  options,
}: {
  options: ManualGrantFormOptions;
}) {
  const [state, setState] = useState<ManualGrantFormState>(
    initialManualGrantFormState,
  );
  const [confirmation, setConfirmation] = useState<GrantConfirmation | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  /** Intercept the native submit to show a confirmation dialog first. */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    const brandId = fd.get("brand_id") as string;
    const planId = fd.get("plan_id") as string;

    const brand = options.brands.find((b) => b.id === brandId);
    const plan = options.plans.find((p) => p.id === planId);

    if (!brand || !plan) {
      setState({ status: "error", message: "Select both a brand and a plan." });
      return;
    }

    setConfirmation({ brandName: brand.name, planName: plan.name, formData: fd });
  }

  /** Execute the server action after the admin confirms. */
  function handleConfirm() {
    if (!confirmation) return;

    startTransition(async () => {
      const result = await createManualPlanGrantAction(state, confirmation.formData);
      setState(result);
      setConfirmation(null);
      formRef.current?.reset();
    });
  }

  function handleDialogOpenChange(next: boolean) {
    if (!isPending && !next) {
      setConfirmation(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manual plan grant</CardTitle>
          <CardDescription>
            Grant an active plan entitlement to an existing brand.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} className="grid gap-5" onSubmit={handleSubmit}>
            {state.status === "error" ? (
              <Alert variant="destructive">
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="brand_id">Brand</Label>
                <Select name="brand_id">
                  <SelectTrigger id="brand_id">
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name} ({brand.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan_id">Plan</Label>
                <Select name="plan_id">
                  <SelectTrigger id="plan_id">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Select name="source">
                  <SelectTrigger id="source">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {manualGrantSources.map((source) => (
                      <SelectItem key={source} value={source}>
                        {sourceLabels[source]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="starts_at">Start date</Label>
                <Input
                  defaultValue={today}
                  id="starts_at"
                  name="starts_at"
                  required
                  type="date"
                />
              </div>

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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manual_reference">Reference</Label>
                <Input
                  id="manual_reference"
                  name="manual_reference"
                  placeholder="Invoice, transfer, or approval reference"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="internal_note">Internal note</Label>
                <Textarea
                  id="internal_note"
                  name="internal_note"
                  placeholder="Internal context for this grant"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit">Grant plan</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <Dialog onOpenChange={handleDialogOpenChange} open={confirmation !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm plan grant</DialogTitle>
            <DialogDescription>
              <span className="block">
                You are about to grant{" "}
                <span className="font-medium text-foreground">
                  {confirmation?.planName}
                </span>{" "}
                to{" "}
                <span className="font-medium text-foreground">
                  {confirmation?.brandName}
                </span>
                .
              </span>
              <span className="mt-1 block">
                This will create an active entitlement and provision any
                associated agent entitlements. Continue?
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => handleDialogOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isPending}
              onClick={handleConfirm}
              type="button"
            >
              {isPending ? "Granting..." : "Confirm grant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {state.status === "success" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgeCheckIcon className="size-4" />
              Plan grant created
            </CardTitle>
            <CardDescription>
              Entitlement and eligible agent entitlement records were processed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.warning ? (
              <Alert>
                <AlertTitle>Grant notice</AlertTitle>
                <AlertDescription>{state.warning}</AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
              <p>
                Entitlement:{" "}
                <span className="font-mono text-foreground">
                  {state.grant.entitlement.id}
                </span>
              </p>
              <p>
                Agent entitlements:{" "}
                <span className="font-mono text-foreground">
                  {state.grant.agentEntitlementCount}
                </span>
              </p>
              <p>
                Source:{" "}
                <span className="font-mono text-foreground">
                  {state.grant.entitlement.source}
                </span>
              </p>
              <p>
                Status:{" "}
                <span className="font-mono text-foreground">
                  {state.grant.entitlement.status}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
