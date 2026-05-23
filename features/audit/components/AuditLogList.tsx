import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AuditLogRecord } from "@/features/audit/types";

/* ------------------------------------------------------------------ */
/*  Timestamp helpers                                                  */
/* ------------------------------------------------------------------ */

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

function formatRelativeTime(value: string | null): string {
  if (!value) return "Not recorded";

  const date = new Date(value);
  const diff = Date.now() - date.getTime();

  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) {
    const mins = Math.floor(diff / MINUTE);
    return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  }
  if (diff < DAY) {
    const hrs = Math.floor(diff / HOUR);
    return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  }
  if (diff < 7 * DAY) {
    const days = Math.floor(diff / DAY);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAbsoluteTime(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

/* ------------------------------------------------------------------ */
/*  Action badge                                                       */
/* ------------------------------------------------------------------ */

function actionBadgeClass(action: string): string {
  const lower = action.toLowerCase();

  // Destructive / dangerous actions
  if (
    lower.includes("delete") ||
    lower.includes("remove") ||
    lower.includes("revoke") ||
    lower.includes("reject")
  ) {
    return "bg-destructive/15 text-destructive";
  }

  // Success / positive actions
  if (
    lower.includes("create") ||
    lower.includes("grant") ||
    lower.includes("approve") ||
    lower.includes("redeem")
  ) {
    return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  }

  // Upload / file actions
  if (lower.includes("upload") || lower.includes("file")) {
    return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
  }

  // Update / change actions
  if (
    lower.includes("update") ||
    lower.includes("edit") ||
    lower.includes("change") ||
    lower.includes("archive")
  ) {
    return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  }

  return "bg-primary/10 text-primary";
}

function ActionBadge({ action }: { action: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        actionBadgeClass(action),
      )}
    >
      {action}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  JSON block                                                         */
/* ------------------------------------------------------------------ */

function formatJson(value: unknown) {
  if (value === null || value === undefined) {
    return "None";
  }

  return JSON.stringify(value, null, 2);
}

function AuditJsonBlock({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      <pre className="max-h-48 overflow-auto rounded-lg bg-muted/50 p-3 font-mono text-xs leading-5 text-muted-foreground whitespace-pre-wrap break-words">
        {formatJson(value)}
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main list                                                          */
/* ------------------------------------------------------------------ */

export function AuditLogList({ logs }: { logs: AuditLogRecord[] }) {
  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit logs</CardTitle>
          <CardDescription>No audit events have been recorded.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <Card key={log.id}>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <ActionBadge action={log.action} />
                  <span className="text-xs text-muted-foreground">
                    {log.actorRole ?? "No role"}
                  </span>
                </div>
                <CardDescription
                  title={formatAbsoluteTime(log.createdAt)}
                >
                  {formatRelativeTime(log.createdAt)}
                </CardDescription>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                {log.id}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Actor</dt>
                <dd className="truncate font-mono text-xs">
                  {log.actorUserId ?? "System"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Brand</dt>
                <dd className="truncate font-mono text-xs">
                  {log.brandId ?? "Global"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Entity</dt>
                <dd className="truncate font-mono text-xs">
                  {log.entityType ?? "None"} / {log.entityId ?? "None"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Request</dt>
                <dd className="truncate font-mono text-xs">
                  {log.ipAddress ?? "No IP"} / {log.userAgent ?? "No agent"}
                </dd>
              </div>
            </dl>
            <div className="grid gap-4 lg:grid-cols-2">
              <AuditJsonBlock label="Before" value={log.before} />
              <AuditJsonBlock label="After" value={log.after} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
