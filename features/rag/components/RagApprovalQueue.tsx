import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RagApprovalActionForm } from "@/features/rag/components/RagApprovalActionForm";
import { RagStatusBadge } from "@/features/rag/components/RagStatusBadge";
import {
  canPlatformOwnerApproveRag,
  canSupervisorApproveRag,
  ragApprovalStateForItem,
} from "@/features/rag/schema";
import type {
  RagApprovalQueueItem,
  RagApprovalRole,
} from "@/features/rag/types";

function formatQueueState(item: RagApprovalQueueItem) {
  const state = ragApprovalStateForItem(item);

  if (state === "APPROVED") {
    return "RAG approval complete";
  }

  if (state === "SYNCING") {
    return "Syncing to OpenAI File Search";
  }

  if (state === "SYNCED") {
    return "RAG sync complete";
  }

  if (state === "SYNC_FAILED") {
    return "RAG sync failed";
  }

  if (state === "PENDING_PLATFORM_OWNER") {
    return "Awaiting Platform Owner final approval";
  }

  return "Awaiting Supervisor approval";
}

export function RagApprovalQueue({
  items,
  actorRole,
}: {
  items: RagApprovalQueueItem[];
  actorRole: RagApprovalRole;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No RAG approval items</CardTitle>
          <CardDescription>
            Client-approved PDF module artifacts will appear here after client
            approval.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const queueState = ragApprovalStateForItem(item);
        const showSupervisorAction =
          queueState === "PENDING_SUPERVISOR" &&
          canSupervisorApproveRag(actorRole);
        const showPlatformAction =
          queueState === "PENDING_PLATFORM_OWNER" &&
          canPlatformOwnerApproveRag(actorRole);

        return (
          <Card key={item.artifactId}>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle>{item.moduleTitle}</CardTitle>
                  <CardDescription>
                    {item.brandName} | {item.moduleType} | {item.fileName}
                  </CardDescription>
                </div>
                <RagStatusBadge status={item.ragStatus} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid gap-3 text-sm md:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Queue state</dt>
                  <dd>{formatQueueState(item)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Module status</dt>
                  <dd className="font-mono">{item.moduleStatus}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Artifact</dt>
                  <dd className="font-mono">
                    PDF v{item.artifactVersion} | {item.artifactStatus}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">File status</dt>
                  <dd className="font-mono">{item.fileStatus}</dd>
                </div>
              </dl>

              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-muted-foreground">Supervisor approval</dt>
                  <dd className="mt-1 font-mono text-xs">
                    {item.approvedBySupervisor ?? "Not recorded"}
                  </dd>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-muted-foreground">
                    Platform Owner approval
                  </dt>
                  <dd className="mt-1 font-mono text-xs">
                    {item.approvedByPlatformOwner ?? "Not recorded"}
                  </dd>
                </div>
              </dl>

              {showSupervisorAction || showPlatformAction ? (
                <div className="flex justify-end">
                  {showSupervisorAction ? (
                    <RagApprovalActionForm
                      artifactId={item.artifactId}
                      stage="SUPERVISOR"
                    />
                  ) : null}
                  {showPlatformAction ? (
                    <RagApprovalActionForm
                      artifactId={item.artifactId}
                      stage="PLATFORM_OWNER"
                    />
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
