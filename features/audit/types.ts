export type AuditLogRecord = {
  id: string;
  actorUserId: string | null;
  actorRole: string | null;
  brandId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string | null;
};
