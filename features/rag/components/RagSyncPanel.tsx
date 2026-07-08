import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RagStatusBadge } from "@/features/rag/components/RagStatusBadge";
import { RagSyncActionForm } from "@/features/rag/components/RagSyncActionForm";
import type { RagSyncBrandGroup } from "@/features/rag/types";

function shortProviderId(providerVectorStoreId: string | null) {
  if (!providerVectorStoreId) {
    return "Not created";
  }

  if (providerVectorStoreId.length <= 18) {
    return providerVectorStoreId;
  }

  return `${providerVectorStoreId.slice(0, 10)}...${providerVectorStoreId.slice(-6)}`;
}

export function RagSyncPanel({ groups }: { groups: RagSyncBrandGroup[] }) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>OpenAI File Search sync</CardTitle>
          <CardDescription>
            Brain-approved files will appear here after final approval.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-normal">
          OpenAI File Search sync
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform Owners can sync Brain-approved files into each brand&apos;s
          isolated vector store.
        </p>
      </div>

      {groups.map((group) => {
        const syncDisabled = group.retryableCount === 0 || group.syncingCount > 0;

        return (
          <Card key={group.brandId}>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle>{group.brandName}</CardTitle>
                  <CardDescription>
                    Vector store:{" "}
                    <span className="font-mono">
                      {shortProviderId(group.providerVectorStoreId)}
                    </span>
                  </CardDescription>
                </div>
                <span className="inline-flex rounded-lg border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground">
                  {group.knowledgeBaseStatus}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid gap-3 text-sm md:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Ready</dt>
                  <dd className="font-mono">{group.eligibleCount}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Syncing</dt>
                  <dd className="font-mono">{group.syncingCount}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Synced</dt>
                  <dd className="font-mono">{group.syncedCount}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Failed</dt>
                  <dd className="font-mono">{group.failedCount}</dd>
                </div>
              </dl>

              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">File</th>
                      <th className="px-3 py-2 font-medium">Artifact</th>
                      <th className="px-3 py-2 font-medium">Provider file</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.files.map((file) => (
                      <tr key={file.knowledgeFileId} className="border-b border-border last:border-0">
                        <td className="px-3 py-3">{file.originalName}</td>
                        <td className="px-3 py-3 font-mono text-xs">
                          PDF v{file.artifactVersion}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">
                          {shortProviderId(file.providerFileId)}
                        </td>
                        <td className="px-3 py-3">
                          <RagStatusBadge status={file.ragStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <RagSyncActionForm
                  brandId={group.brandId}
                  disabled={syncDisabled}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
