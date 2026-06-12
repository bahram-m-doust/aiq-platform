import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  ModuleReviewDecision,
  ModuleReviewType,
} from "@/features/modules/types";

// Display-only projection: the caller decides what the reviewer label is — the
// admin page shows staff emails, the client page shows a role label so staff
// PII never reaches client browsers.
export type ReviewTimelineEntry = {
  id: string;
  reviewType: ModuleReviewType;
  decision: ModuleReviewDecision;
  reviewerLabel: string;
  comment: string | null;
  createdAt: string | null;
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

function decisionLabel(decision: ModuleReviewDecision) {
  if (decision === "APPROVED_FOR_CLIENT_REVIEW") {
    return "Approved for client review";
  }

  if (decision === "CHANGE_REQUESTED") {
    return "Change requested";
  }

  return decision.charAt(0) + decision.slice(1).toLowerCase();
}

export function ModuleReviewTimeline({
  reviews,
}: {
  reviews: ReviewTimelineEntry[];
}) {
  if (reviews.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review history</CardTitle>
          <CardDescription>No module review activity is recorded yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review history</CardTitle>
        <CardDescription>
          Supervisor and client decisions for this module.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {reviews.map((review) => (
          <div className="rounded-lg border border-border p-3" key={review.id}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium">
                  {decisionLabel(review.decision)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {review.reviewType} by {review.reviewerLabel}
                </p>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {formatDate(review.createdAt)}
              </span>
            </div>
            {review.comment ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {review.comment}
              </p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
