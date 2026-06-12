import { AdminBackBar } from "@/components/app/AdminBackBar";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { requireUserProfile } from "@/features/auth/queries";
import {
  getUnreadNotificationCount,
  listNotificationsForProfile,
} from "@/features/notifications/queries";

export default async function AdminSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Internal staff have no brand membership, so the client app shell (and its
  // bell) never renders for them — surface their INTERNAL_TEAM inbox here.
  const { profile } = await requireUserProfile("/admin");
  const access = await getBrandAccessSummaryForProfile(profile.id).catch(
    () => null,
  );
  const brandId =
    access?.status === "ACTIVE_ACCESS" ? (access.brandId ?? null) : null;
  const [notifications, unreadCount] = await Promise.all([
    listNotificationsForProfile({
      profileId: profile.id,
      globalRole: profile.global_role,
      brandId,
    }).catch(() => []),
    getUnreadNotificationCount({
      profileId: profile.id,
      globalRole: profile.global_role,
      brandId,
    }).catch(() => 0),
  ]);

  return (
    <div className="dark bg-background text-foreground min-h-svh">
      <AdminBackBar
        actions={
          <NotificationsBell
            notifications={notifications}
            unreadCount={unreadCount}
          />
        }
      />
      {children}
    </div>
  );
}
