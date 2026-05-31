"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenIcon,
  BotIcon,
  BrainCircuitIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  InfinityIcon,
  LogOutIcon,
  MessagesSquareIcon,
  PlusIcon,
  Settings2Icon,
  SquareUserIcon,
} from "lucide-react";

import { CreditCounter } from "@/components/dashboard/CreditCounter";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

type SidebarAgent = {
  key: string;
  name: string;
  slug: string;
  state: string;
};

type SidebarProps = {
  email: string;
  fullName: string | null;
  role: string | null;
  brandName: string | null;
  brandIconUrl?: string | null;
  agents: SidebarAgent[];
  logoutAction: (formData: FormData) => void | Promise<void>;
};

const primaryNav = [
  {
    href: "/dashboard/brain",
    label: "Brand Integrated Brain",
    icon: BrainCircuitIcon,
  },
];

const secondaryNav = [
  { href: "/dashboard", label: "Community", icon: MessagesSquareIcon },
  { href: "/dashboard/documents", label: "Documents", icon: BookOpenIcon },
  { href: "/dashboard/settings", label: "Settings", icon: Settings2Icon },
];

export function Sidebar({
  role,
  brandName,
  brandIconUrl,
  agents,
  logoutAction,
}: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  const agentsOpen = pathname.startsWith("/dashboard/agents");
  const adminOpen =
    pathname.startsWith("/dashboard/invitations") ||
    pathname.startsWith("/admin");

  return (
    <SidebarRoot collapsible="offcanvas">
      {/* Header */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="gap-2">
              <Link href="/dashboard">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  {brandIconUrl ? (
                    <Image
                      alt={brandName ?? "Brand"}
                      className="size-full rounded-lg object-cover"
                      height={32}
                      src={brandIconUrl}
                      unoptimized
                      width={32}
                    />
                  ) : (
                    <InfinityIcon className="size-5" />
                  )}
                </span>
                <span className="truncate text-sm font-semibold">
                  {brandName ?? "Bextudio"}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {/* Primary single links */}
            {primaryNav.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.href)}
                  tooltip={item.label}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}

            {/* Agents (collapsible) */}
            {agents.length > 0 && (
              <Collapsible
                asChild
                defaultOpen={agentsOpen}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Agents">
                      <BotIcon />
                      <span>Agents</span>
                      <ChevronDownIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {agents.map((agent) => {
                        const href = `/dashboard/agents/${agent.slug}`;
                        return (
                          <SidebarMenuSubItem key={agent.key}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={pathname === href}
                            >
                              <Link href={href}>
                                <span>{agent.name}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )}

            {/* Administration (collapsible) */}
            <Collapsible
              asChild
              defaultOpen={adminOpen}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="Administration">
                    <SquareUserIcon />
                    <span>Administration</span>
                    <ChevronDownIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={isActive("/dashboard/invitations")}
                      >
                        <Link href="/dashboard/invitations">
                          <PlusIcon />
                          <span>Invite Member</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    {role === "ADMIN" && (
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isActive("/admin")}
                        >
                          <Link href="/admin">
                            <span>Admin Panel</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    )}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            {/* Secondary single links */}
            {secondaryNav.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.href)}
                  tooltip={item.label}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <div className="overflow-hidden rounded-lg border border-border bg-background shadow-xs">
          <div className="flex items-center border-b border-border py-2.5 pl-2.5">
            <p className="flex-1 text-sm font-medium text-card-foreground">
              Basic Plan
            </p>
            <button
              className="flex h-9 items-center gap-1 rounded-md py-2 pr-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              type="button"
            >
              Manage Plan
              <ChevronRightIcon className="size-4" />
            </button>
          </div>
          <CreditCounter />
        </div>

        <form action={logoutAction}>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            type="submit"
          >
            <LogOutIcon className="size-4 shrink-0" />
            <span>Sign out</span>
          </button>
        </form>
      </SidebarFooter>
    </SidebarRoot>
  );
}
