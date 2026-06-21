"use client";

import Image from "next/image";
import { ChevronDownIcon, LogOutIcon, UserIcon } from "lucide-react";

import { AppBreadcrumb } from "@/components/app/AppBreadcrumb";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import type { NotificationRecord } from "@/features/notifications/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

type AppNavbarProps = {
  userName: string;
  brandName: string | null;
  brandIconUrl: string | null;
  notifications: NotificationRecord[];
  unreadCount: number;
  logoutAction: (formData: FormData) => void | Promise<void>;
};

export function AppNavbar({
  userName,
  brandName,
  brandIconUrl,
  notifications,
  unreadCount,
  logoutAction,
}: AppNavbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-[68px] shrink-0 items-center gap-2 border-b border-border bg-background px-6">
      <div className="flex flex-1 items-center justify-between gap-4">
        {/* Left: sidebar toggle + breadcrumb */}
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <AppBreadcrumb />
        </div>

        {/* Right: notifications + profile */}
        <div className="flex items-center gap-2">
          <NotificationsBell
            notifications={notifications}
            unreadCount={unreadCount}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2 px-2" type="button" variant="ghost">
                <span className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-secondary text-muted-foreground">
                  {brandIconUrl ? (
                    <Image
                      alt={brandName ?? "Brand"}
                      className="size-full object-cover"
                      height={32}
                      src={brandIconUrl}
                      unoptimized
                      width={32}
                    />
                  ) : (
                    <UserIcon className="size-4" />
                  )}
                </span>
                <span className="text-sm">{userName}</span>
                <ChevronDownIcon className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="truncate">
                {userName}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <form action={logoutAction}>
                <DropdownMenuItem asChild>
                  <button className="w-full" type="submit">
                    <LogOutIcon />
                    Sign out
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
