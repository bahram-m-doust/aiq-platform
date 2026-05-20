import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChangeRequestReviewForm } from "@/features/change-requests/components/ChangeRequestReviewForm";
import type { ChangeRequestReviewItem } from "@/features/change-requests/types";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

export function AdminChangeRequestsList({
  requests,
}: {
  requests: ChangeRequestReviewItem[];
}) {
  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Change Requests</CardTitle>
          <CardDescription>
            Submitted requests will appear here for Platform Owner and
            Supervisor review.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <Card key={request.id}>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle>{request.targetLabel}</CardTitle>
                <CardDescription>
                  {request.brandName} - {request.status}
                </CardDescription>
              </div>
              <span className="rounded-lg border border-border px-3 py-1 font-mono text-xs text-muted-foreground">
                {request.targetType}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid gap-3 text-sm md:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Requested by</dt>
                <dd>{request.requesterEmail ?? "Unknown user"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-mono">{formatDate(request.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Reviewed by</dt>
                <dd>{request.reviewerEmail ?? "Not reviewed"}</dd>
              </div>
            </dl>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <h2 className="text-sm font-medium">Reason</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {request.reason ?? "No reason recorded"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <h2 className="text-sm font-medium">Comment</h2>
                <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
                  {request.comment}
                </p>
              </div>
            </div>

            <ChangeRequestReviewForm request={request} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
