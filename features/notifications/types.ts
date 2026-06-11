export type NotificationRecord = {
  id: string;
  brandId: string | null;
  audience: string;
  type: string;
  title: string;
  body: string | null;
  linkPath: string | null;
  subjectType: string | null;
  subjectId: string | null;
  commentId: string | null;
  actorId: string | null;
  readAt: string | null;
  createdAt: string | null;
};

export type NotificationMutationResult = { ok: boolean; message?: string };
