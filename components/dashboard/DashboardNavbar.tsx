"use client";

import Image from "next/image";
import { BellIcon, ChevronDownIcon, LogOutIcon, UserIcon } from "lucide-react";

import { DashboardBreadcrumb } from "@/components/dashboard/DashboardBreadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";

type DashboardNavbarProps = {
  userName: string;
  brandName: string | null;
  brandIconUrl: string | null;
  logoutAction: (formData: FormData) => void | Promise<void>;
};

export function DashboardNavbar({
  userName,
  brandName,
  brandIconUrl,
  logoutAction,
}: DashboardNavbarProps) {
  return (
    <header className="flex h-[68px] shrink-0 items-center gap-2 border-b border-border px-6">
      <div className="flex flex-1 items-center justify-between gap-4">
        {/* Left: sidebar toggle + breadcrumb */}
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <DashboardBreadcrumb />
        </div>

        {/* Right: notifications + profile */}
        <div className="flex items-center gap-2">
          <Button
            aria-label="Notifications"
            className="size-9"
            size="icon"
            variant="ghost"
          >
            <BellIcon />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-md outline-none"
                type="button"
              >
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
              </button>
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
