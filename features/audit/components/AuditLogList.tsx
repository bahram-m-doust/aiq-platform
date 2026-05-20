import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AuditLogRecord } from "@/features/audit/types";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

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
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{label}</h3>
      <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted p-3 text-xs leading-5 text-muted-foreground whitespace-pre-wrap break-words">
        {formatJson(value)}
      </pre>
    </div>
  );
}

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
              <div>
                <CardTitle className="text-lg">{log.action}</CardTitle>
                <CardDescription>
                  {formatDate(log.createdAt)} | {log.actorRole ?? "No role"}
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
                <dt className="text-muted-foreground">Actor</dt>
                <dd className="font-mono">{log.actorUserId ?? "System"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Brand</dt>
                <dd className="font-mono">{log.brandId ?? "Global"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Entity</dt>
                <dd className="font-mono">
                  {log.entityType ?? "None"} / {log.entityId ?? "None"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Request</dt>
                <dd className="font-mono">
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
