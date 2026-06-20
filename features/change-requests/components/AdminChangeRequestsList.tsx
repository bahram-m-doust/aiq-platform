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
        // The id + scroll margin let the notification deep-link
        // (/admin/change-requests#cr-<id>) jump straight to this card without
        // it hiding under the sticky admin bar.
        <Card key={request.id} id={`cr-${request.id}`} className="scroll-mt-24">
          <CardHeader>
            {/* Lead with the brand so reviewers always see exactly which brand a
                request belongs to. The specific target section/question is
                intentionally not shown here — reviewers have full access. */}
            <CardTitle>{request.brandName}</CardTitle>
            <CardDescription>{request.status}</CardDescription>
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

            <div className="rounded-lg border border-border p-3">
              <h2 className="text-sm font-medium">Comment</h2>
              <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
                {request.comment}
              </p>
              {/* Legacy rows captured a separate Reason. Surface it only when it
                  adds something the merged Comment doesn't already say. */}
              {request.reason && request.reason !== request.comment ? (
                <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                  <span className="font-medium">Reason:</span> {request.reason}
                </p>
              ) : null}
            </div>

            <ChangeRequestReviewForm request={request} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
