import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AgentRunHistoryItem } from "@/features/agents/runs/types";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

export function AgentRunHistory({
  history,
}: {
  history: AgentRunHistoryItem[];
}) {
  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Run history</CardTitle>
          <CardDescription>
            Successful runs for this agent will appear here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run history</CardTitle>
        <CardDescription>
          Recent successful runs for this brand and agent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.map((run) => (
          <article
            className="space-y-3 rounded-lg border border-border p-4"
            key={run.id}
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <h3 className="text-sm font-semibold">{run.promptExcerpt}</h3>
              <p className="font-mono text-xs text-muted-foreground">
                {formatDate(run.createdAt)}
              </p>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {run.answerExcerpt}
            </p>
            <dl className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
              <div>
                <dt>Model</dt>
                <dd className="font-mono">{run.model ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Sources</dt>
                <dd>
                  {run.sources.length > 0
                    ? run.sources.map((source) => source.fileName).join(", ")
                    : "No source metadata"}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}

