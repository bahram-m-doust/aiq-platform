"use client";

import { useActionState } from "react";
import { SparklesIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { SubmitButton } from "@/features/auth/components/SubmitButton";
import { uploadFuturesResearchStorylineAction } from "@/features/futures-research/actions";
import { initialFuturesResearchActionState } from "@/features/futures-research/schema";

export function FuturesResearchStorylineUploadForm({
  brands,
}: {
  brands: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(
    uploadFuturesResearchStorylineAction,
    initialFuturesResearchActionState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-4" />
          Attach interactive Storyline
        </CardTitle>
        <CardDescription>
          Optionally attach the futures research Storyline (a single
          self-contained HTML file). The client views it inline alongside the
          PDF.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5">
          {state.status === "error" ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          {state.status === "success" ? (
            <Alert>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="futures-storyline-brand">Brand</Label>
            <Select name="brand_id" required>
              <SelectTrigger className="w-full" id="futures-storyline-brand">
                <SelectValue placeholder="Select a brand…" />
              </SelectTrigger>
              <SelectContent className="dark">
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="futures-storyline-file">Storyline HTML</Label>
            <Input
              accept=".html,.htm,text/html"
              id="futures-storyline-file"
              name="file"
              required
              type="file"
            />
          </div>

          <SubmitButton idleLabel="Attach storyline" pendingLabel="Uploading…" />
        </form>
      </CardContent>
    </Card>
  );
}
