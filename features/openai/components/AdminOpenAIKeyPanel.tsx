"use client";

import { KeyRound, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminDeleteGlobalOpenAIKeyAction,
  adminSetGlobalOpenAIKeyAction,
} from "@/features/brands/api-key-actions";
import { initialApiKeyFormState } from "@/features/brands/api-key-form-state";

function SubmitButton({
  label,
  pendingLabel,
  variant = "default",
}: {
  label: string;
  pendingLabel: string;
  variant?: "default" | "destructive" | "outline";
}) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} size="sm" type="submit" variant={variant}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function AdminOpenAIKeyPanel({
  hasStoredOpenAIKey,
  hasEnvOpenAIKey,
}: {
  hasStoredOpenAIKey: boolean;
  hasEnvOpenAIKey: boolean;
}) {
  const [setState, setAction] = useActionState(
    adminSetGlobalOpenAIKeyAction,
    initialApiKeyFormState,
  );
  const [deleteState, deleteAction] = useActionState(
    adminDeleteGlobalOpenAIKeyAction,
    initialApiKeyFormState,
  );
  const isConfigured = hasStoredOpenAIKey || hasEnvOpenAIKey;

  return (
    <Alert className="space-y-4 border border-border bg-card text-card-foreground">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">Global OpenAI API key</p>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Stored keys are encrypted server-side and used for OpenAI File
            Search, vector stores, and Brand Brain Responses API calls.
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>
            Status:{" "}
            <span className={isConfigured ? "text-emerald-500" : "text-amber-500"}>
              {isConfigured ? "Configured" : "Missing"}
            </span>
          </div>
          <div>
            Source:{" "}
            <span className="font-mono">
              {hasStoredOpenAIKey
                ? "Encrypted DB"
                : hasEnvOpenAIKey
                  ? "Env fallback"
                  : "None"}
            </span>
          </div>
        </div>
      </div>

      <form action={setAction} className="grid gap-2 md:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="global-openai-key">OpenAI secret key</Label>
          <Input
            autoComplete="off"
            id="global-openai-key"
            name="api_key"
            placeholder="sk-..."
            type="password"
          />
        </div>
        <div className="flex items-end">
          <SubmitButton label="Save key" pendingLabel="Saving..." />
        </div>
        {setState.status === "error" ? (
          <p className="text-xs text-destructive md:col-span-2">
            {setState.message}
          </p>
        ) : null}
        {setState.status === "success" ? (
          <p className="text-xs text-emerald-500 md:col-span-2">
            {setState.message}
          </p>
        ) : null}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          Removing the stored key falls back to{" "}
          <code className="font-mono">OPENAI_API_KEY</code> if it exists on the
          server.
        </p>
        <form action={deleteAction}>
          <Button
            disabled={!hasStoredOpenAIKey}
            size="sm"
            type="submit"
            variant="destructive"
          >
            <Trash2 className="size-3.5" />
            Remove stored key
          </Button>
        </form>
        {deleteState.status === "error" ? (
          <p className="basis-full text-xs text-destructive">
            {deleteState.message}
          </p>
        ) : null}
        {deleteState.status === "success" ? (
          <p className="basis-full text-xs text-emerald-500">
            {deleteState.message}
          </p>
        ) : null}
      </div>

      <AlertDescription className="sr-only">
        Configure the global OpenAI API key for server-side Brand Brain
        operations.
      </AlertDescription>
    </Alert>
  );
}
