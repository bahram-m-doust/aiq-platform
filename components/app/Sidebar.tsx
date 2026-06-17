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
  HomeIcon,
  PlusIcon,
  Settings2Icon,
  SquareUserIcon,
} from "lucide-react";

import { CreditCounter } from "@/components/app/CreditCounter";
import { ROUTES, agentPath } from "@/lib/routes";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
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
  planName: string | null;
  credits: number;
  agents: SidebarAgent[];
};

const primaryNav = [
  {
    href: ROUTES.home,
    label: "Home",
    icon: HomeIcon,
  },
];

const brainNav = [
  { href: ROUTES.brainRoadmap, label: "Build Roadmap" },
  { href: ROUTES.brainBrand, label: "Brand Brain" },
];

const secondaryNav = [
  { href: ROUTES.documents, label: "Documents", icon: BookOpenIcon },
  { href: ROUTES.settings, label: "Settings", icon: Settings2Icon },
];

export function Sidebar({ role, planName, credits, agents }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === ROUTES.home
      ? pathname === ROUTES.home
      : pathname.startsWith(href);

  const agentsOpen = pathname.startsWith(ROUTES.agents);
  const brainOpen = pathname.startsWith(ROUTES.brain);
  const adminOpen =
    pathname.startsWith(ROUTES.invitations) || pathname.startsWith("/admin");

  return (
    <SidebarRoot collapsible="offcanvas">
      {/* Header */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="gap-2">
              <Link href="/">
                <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
                  <Image
                    alt="Bextudio"
                    className="size-full object-contain p-0.5"
                    height={32}
                    src="/square-sign.png"
                    unoptimized
                    width={32}
                  />
                </span>
                <span className="truncate text-sm font-semibold">Bextudio</span>
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

            {/* Integrated Brand Brain */}
            <Collapsible
              asChild
              defaultOpen={brainOpen}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    className="cursor-pointer"
                    tooltip="Integrated Brand Brain"
                  >
                    <BrainCircuitIcon />
                    <span>Integrated Brand Brain</span>
                    <ChevronDownIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="border-l-0">
                    {brainNav.map((item) => (
                      <SidebarMenuSubItem key={item.href}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isActive(item.href)}
                        >
                          <Link href={item.href}>
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            {/* Agents (collapsible) */}
            {agents.length > 0 && (
              <Collapsible
                asChild
                defaultOpen={agentsOpen}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className="cursor-pointer"
                      tooltip="Agents"
                    >
                      <BotIcon />
                      <span>Agents</span>
                      <ChevronDownIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {agents.map((agent) => {
                        const href = agentPath(agent.slug);
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
                  <SidebarMenuButton
                    className="cursor-pointer"
                    tooltip="Administration"
                  >
                    <SquareUserIcon />
                    <span>Administration</span>
                    <ChevronDownIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="border-l-0">
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={isActive(ROUTES.invitations)}
                      >
                        <Link href={ROUTES.invitations}>
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
              {planName ?? "Free plan"}
            </p>
            <Button
              className="h-9 px-2.5 text-muted-foreground hover:text-foreground"
              type="button"
              variant="ghost"
            >
              Manage Plan
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
          <CreditCounter credits={credits} />
        </div>
      </SidebarFooter>
    </SidebarRoot>
  );
}
