"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellIcon, CheckCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/actions";
import type { NotificationRecord } from "@/features/notifications/types";
import { cn } from "@/lib/utils";

// Only in-app paths may be navigated to. linkPath is written by our own server
// code, but defense-in-depth: reject absolute/protocol-relative URLs so a
// tampered row can never become an open redirect.
function safeLinkPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function timeAgo(value: string | null): string {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function NotificationsBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationRecord[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const openNotification = (notification: NotificationRecord) => {
    setOpen(false);
    startTransition(async () => {
      if (!notification.readAt) {
        await markNotificationReadAction(notification.id);
      }
      const target = safeLinkPath(notification.linkPath);
      if (target) {
        router.push(target);
      } else {
        router.refresh();
      }
    });
  };

  const markAll = () => {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        size="icon-lg"
        variant="ghost"
      >
        <span className="relative">
          <BellIcon />
          {unreadCount > 0 ? (
            <span className="absolute -end-1.5 -top-1.5 flex min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </span>
      </Button>

      {open ? (
        <div className="absolute end-0 z-50 mt-2 w-[360px] overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 ? (
              <button
                className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
                disabled={pending}
                onClick={markAll}
                type="button"
              >
                <CheckCheckIcon className="size-3.5" /> Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                You&apos;re all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((notification) => {
                  const unread = !notification.readAt;
                  const linkPath = safeLinkPath(notification.linkPath);
                  const inner = (
                    <div
                      className={cn(
                        "flex gap-2.5 px-4 py-3 text-start transition-colors hover:bg-muted/60",
                        unread && "bg-amber-50/50",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          unread ? "bg-destructive" : "bg-transparent",
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium leading-snug" dir="auto">
                          {notification.title}
                        </p>
                        {notification.body ? (
                          <p
                            className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground"
                            dir="auto"
                          >
                            {notification.body}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {timeAgo(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  );

                  return (
                    <li key={notification.id}>
                      {linkPath ? (
                        <Link
                          href={linkPath}
                          onClick={(event) => {
                            event.preventDefault();
                            openNotification(notification);
                          }}
                        >
                          {inner}
                        </Link>
                      ) : (
                        <button
                          className="w-full"
                          onClick={() => openNotification(notification)}
                          type="button"
                        >
                          {inner}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
