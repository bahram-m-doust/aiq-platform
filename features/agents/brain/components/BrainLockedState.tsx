import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  BrandBrainAccess,
  BrandBrainReadiness,
} from "@/features/agents/brain/types";

export function BrainLockedState({
  access,
  readiness,
}: {
  access: BrandBrainAccess | null;
  readiness: BrandBrainReadiness;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand Integrator Brain locked</CardTitle>
        <CardDescription>
          Brand Brain becomes available after the current brand knowledge base
          has completed RAG sync.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTitle>Readiness status</AlertTitle>
          <AlertDescription>{readiness.message}</AlertDescription>
        </Alert>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Brand</dt>
            <dd className="font-medium">{access?.brandName ?? "Not active"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Knowledge base</dt>
            <dd className="font-medium">{readiness.status}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Synced files</dt>
            <dd className="font-medium">{readiness.syncedFileCount}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
