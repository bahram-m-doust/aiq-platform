import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ModuleArtifactRecord } from "@/features/modules/types";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

function formatFileName(artifact: ModuleArtifactRecord) {
  return artifact.file?.originalName ?? "File metadata unavailable";
}

export function ModuleArtifactList({
  artifacts,
}: {
  artifacts: ModuleArtifactRecord[];
}) {
  if (artifacts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Artifacts</CardTitle>
          <CardDescription>No internal module artifacts are uploaded yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Artifacts</CardTitle>
        <CardDescription>
          Internal drafts and client-review artifacts for this module.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {artifacts.map((artifact) => (
          <div
            className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[1fr_auto]"
            key={artifact.id}
          >
            <div>
              <h2 className="text-sm font-medium">
                {artifact.artifactType} v{artifact.version}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatFileName(artifact)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Uploaded {formatDate(artifact.createdAt)}
                {artifact.uploadedByEmail
                  ? ` by ${artifact.uploadedByEmail}`
                  : ""}
              </p>
            </div>
            <span className="self-start rounded-lg border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground">
              {artifact.status}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
