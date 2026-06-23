"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenIcon,
  BotIcon,
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

type AiBudget = {
  monthlyBudgetCents: number | null;
  spentCents: number;
  remainingCents: number | null;
};

type SidebarProps = {
  email: string;
  fullName: string | null;
  role: string | null;
  planName: string | null;
  credits: number;
  aiBudget?: AiBudget | null;
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

const collapsibleTriggerClassName =
  "cursor-pointer data-[active=true]:bg-transparent data-[active=true]:hover:bg-[#F0F0F0]";

function BrainIcon() {
  return (
    <svg
      aria-hidden="true"
      data-figma-node-id="5197:4088"
      fill="none"
      viewBox="0 0 22.0018 22.0046"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.40191 5.50879C5.16024 5.08928 5.02358 4.61757 5.00381 4.13384C4.98596 3.73427 5.0482 3.33516 5.18686 2.95999C5.32552 2.58482 5.53779 2.24117 5.81121 1.94924C6.08462 1.65732 6.41365 1.42301 6.77895 1.26011C7.14424 1.0972 7.53842 1.00899 7.9383 1.00065C8.33819 0.992316 8.7357 1.06403 9.10746 1.21157C9.47923 1.35911 9.81773 1.5795 10.1031 1.85979C10.3884 2.14007 10.6148 2.47457 10.769 2.84364C10.9232 3.2127 11.002 3.60887 11.0008 4.00884M11.0008 4.00884V17.0088M11.0008 4.00884C10.9996 3.60887 11.0786 3.2127 11.2328 2.84364C11.387 2.47457 11.6134 2.14007 11.8987 1.85979C12.1841 1.5795 12.5226 1.35911 12.8943 1.21157C13.2661 1.06403 13.6636 0.992316 14.0635 1.00065C14.4634 1.00899 14.8576 1.0972 15.2229 1.26011C15.5881 1.42301 15.9172 1.65732 16.1906 1.94924C16.464 2.24117 16.6763 2.58482 16.8149 2.95999C16.9536 3.33516 17.0158 3.73427 16.998 4.13384C17.5858 4.28498 18.1315 4.56789 18.5938 4.96115C19.056 5.35441 19.4228 5.84771 19.6661 6.40369C19.9095 6.95966 20.0232 7.56373 19.9986 8.17015C19.974 8.77657 19.8117 9.36943 19.524 9.90384M5.00381 4.13384C4.41601 4.28498 3.87031 4.56789 3.40804 4.96115C2.94577 5.35441 2.57905 5.84771 2.33565 6.40369C2.09225 6.95966 1.97857 7.56373 2.0032 8.17015C2.02783 8.77657 2.19013 9.36943 2.47781 9.90384M3.06303 9.50879C2.85673 9.62328 2.66075 9.75485 2.47781 9.90384C1.97199 10.3148 1.57423 10.8431 1.31915 11.4428C1.06406 12.0425 0.959365 12.6954 1.01417 13.3448C1.06898 13.9942 1.28162 14.6204 1.63361 15.1689C1.9856 15.7173 2.46627 16.1715 3.03381 16.4918M3.03381 16.4918C2.96372 17.0341 3.00555 17.5849 3.15669 18.1104C3.30784 18.6358 3.5651 19.1247 3.91259 19.5468C4.26008 19.9689 4.69042 20.3153 5.17703 20.5646C5.66364 20.8139 6.19618 20.9608 6.74178 20.9962C7.28738 21.0316 7.83445 20.9548 8.34919 20.7705C8.86394 20.5861 9.33544 20.2983 9.73457 19.9246C10.1337 19.5509 10.452 19.0994 10.6698 18.5979C10.8876 18.0964 11.0002 17.5556 11.0008 17.0088M3.03381 16.4918C3.63407 16.8304 4.31201 17.009 5.00118 17.0087M11.0008 17.0088C11.0014 17.5556 11.1142 18.0964 11.332 18.5979C11.5498 19.0994 11.8681 19.5509 12.2672 19.9246C12.6664 20.2983 13.1379 20.5861 13.6526 20.7705C14.1673 20.9548 14.7144 21.0316 15.26 20.9962C15.8056 20.9608 16.3382 20.8139 16.8248 20.5646C17.3114 20.3153 17.7417 19.9689 18.0892 19.5468C18.4367 19.1247 18.694 18.6358 18.8451 18.1104C18.9962 17.5849 19.0381 17.0341 18.968 16.4918M18.939 9.50879C19.1453 9.62328 19.3411 9.75485 19.524 9.90384C20.0298 10.3148 20.4276 10.8431 20.6827 11.4428C20.9377 12.0425 21.0424 12.6954 20.9876 13.3448C20.9328 13.9942 20.7202 14.6204 20.3682 15.1689C20.0162 15.7173 19.5355 16.1715 18.968 16.4918M18.968 16.4918C18.3677 16.8304 17.6901 17.009 17.001 17.0087M14.001 12.0088C13.1614 11.7134 12.4283 11.1758 11.8943 10.4638C11.3603 9.7518 11.0494 8.89746 11.001 8.00879C10.9525 8.89746 10.6416 9.7518 10.1077 10.4638C9.57366 11.1758 8.84053 11.7134 8.00098 12.0088M16.6001 5.50879C16.8421 5.08937 16.979 4.61761 16.9991 4.13379"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function Sidebar({ role, planName, credits, aiBudget, agents }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === ROUTES.home
      ? pathname === ROUTES.home
      : pathname.startsWith(href);

  const agentsOpen = pathname.startsWith(ROUTES.agents);
  const brainOpen = pathname.startsWith(ROUTES.brain);
  const adminOpen =
    pathname.startsWith(ROUTES.invitations) || pathname.startsWith("/admin");
  const agentsActive = agents.some(
    (agent) => pathname === agentPath(agent.slug),
  );
  const brainActive = brainNav.some((item) => isActive(item.href));
  const adminActive =
    isActive(ROUTES.invitations) || (role === "ADMIN" && isActive("/admin"));

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
                    className={collapsibleTriggerClassName}
                    isActive={brainActive}
                    tooltip="Integrated Brand Brain"
                  >
                    <BrainIcon />
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
                      className={collapsibleTriggerClassName}
                      isActive={agentsActive}
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
                    className={collapsibleTriggerClassName}
                    isActive={adminActive}
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
          <CreditCounter credits={credits} aiBudget={aiBudget} />
        </div>
      </SidebarFooter>
    </SidebarRoot>
  );
}
