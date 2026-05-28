"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenIcon,
  BrainIcon,
  ChevronLeftIcon,
  FileIcon,
  GitBranchIcon,
  HomeIcon,
  LayersIcon,
  LogOutIcon,
  MenuIcon,
  MailIcon,
  SparklesIcon,
  UserIcon,
  XIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

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
  agents: SidebarAgent[];
  logoutAction: (formData: FormData) => void | Promise<void>;
};

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/dashboard/modules", label: "Strategies", icon: LayersIcon },
  { href: "/dashboard/brain", label: "Brand Brain", icon: BrainIcon },
  { href: "/dashboard/files", label: "Files", icon: FileIcon },
  { href: "/dashboard/change-requests", label: "Changes", icon: GitBranchIcon },
  { href: "/dashboard/invitations", label: "Invitations", icon: MailIcon },
];

const agentStateColors: Record<string, string> = {
  ACTIVE: "bg-emerald-500",
  AVAILABLE: "bg-blue-500",
  LOCKED_BY_BRAIN: "bg-amber-500",
  LOCKED_BY_PLAN: "bg-[var(--bv-ink-4)]",
  SUSPENDED: "bg-red-500",
};

function AgentDot({ state }: { state: string }) {
  return (
    <span
      className={cn(
        "inline-block size-1.5 rounded-full",
        agentStateColors[state] ?? "bg-[var(--bv-ink-4)]",
      )}
    />
  );
}

export function Sidebar({
  email,
  fullName,
  role,
  brandName,
  agents,
  logoutAction,
}: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const closeOnNavigate = () => setOpen(false);

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  const sidebarWidth = collapsed ? "w-[60px]" : "w-[240px]";

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed left-4 top-4 z-50 flex size-9 items-center justify-center rounded-lg border bg-white shadow-sm md:hidden"
        onClick={() => setOpen(!open)}
        style={{ borderColor: "var(--bv-line)" }}
        type="button"
      >
        {open ? <XIcon className="size-4" /> : <MenuIcon className="size-4" />}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-svh flex-col border-r transition-all duration-300 md:sticky md:top-0 md:translate-x-0",
          sidebarWidth,
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
        style={{
          background: "var(--bv-card)",
          borderColor: "var(--bv-line)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-3 py-4" style={{ borderColor: "var(--bv-line)" }}>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div
                className="relative size-7 shrink-0 rounded-lg"
                style={{
                  background: "linear-gradient(135deg, #0e0e14, #2a2a36)",
                  boxShadow: "0 2px 6px rgba(15,15,20,0.18)",
                }}
              >
                <div
                  className="absolute inset-[6px] rounded"
                  style={{
                    background: "linear-gradient(135deg, #ff8a5b, #2a7cff 60%, #2bc78a)",
                    opacity: 0.92,
                  }}
                />
              </div>
              <span className="text-sm font-semibold tracking-[-0.01em] text-[var(--bv-ink)]">
                Bextudio
              </span>
            </div>
          )}
          <button
            className="hidden size-6 items-center justify-center rounded text-[var(--bv-ink-3)] hover:text-[var(--bv-ink)] md:flex"
            onClick={() => setCollapsed(!collapsed)}
            type="button"
          >
            <ChevronLeftIcon
              className={cn("size-4 transition-transform", collapsed && "rotate-180")}
            />
          </button>
        </div>

        {/* User info */}
        {!collapsed && (
          <div className="border-b px-3 py-3" style={{ borderColor: "var(--bv-line)" }}>
            <div className="flex items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--bv-panel)] text-[var(--bv-ink-3)]">
                <UserIcon className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[var(--bv-ink)]">
                  {fullName ?? email}
                </p>
                {brandName && (
                  <p className="truncate text-[10px] text-[var(--bv-ink-3)]">
                    {brandName}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
                    active
                      ? "bg-[var(--bv-accent-tint)] font-medium text-[var(--bv-accent)]"
                      : "text-[var(--bv-ink-2)] hover:bg-[var(--bv-panel)] hover:text-[var(--bv-ink)]",
                    collapsed && "justify-center px-0",
                  )}
                  href={item.href}
                  key={item.href}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>

          {/* Agents section */}
          {agents.length > 0 && (
            <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--bv-line)" }}>
              {!collapsed && (
                <p className="mb-2 px-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--bv-ink-4)]">
                  Agents
                </p>
              )}
              <div className="space-y-0.5">
                {agents.map((agent) => {
                  const agentHref = `/dashboard/agents/${agent.slug}`;
                  const active = pathname === agentHref;
                  return (
                    <Link
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors",
                        active
                          ? "bg-[var(--bv-accent-tint)] font-medium text-[var(--bv-accent)]"
                          : "text-[var(--bv-ink-3)] hover:bg-[var(--bv-panel)] hover:text-[var(--bv-ink-2)]",
                        collapsed && "justify-center px-0",
                      )}
                      href={agentHref}
                      key={agent.key}
                      title={collapsed ? agent.name : undefined}
                    >
                      {collapsed ? (
                        <AgentDot state={agent.state} />
                      ) : (
                        <>
                          <AgentDot state={agent.state} />
                          <span className="truncate">{agent.name}</span>
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div
          className="border-t px-2 py-3 pb-[max(env(safe-area-inset-bottom,0px),12px)]"
          style={{ borderColor: "var(--bv-line)" }}
        >
          <form action={logoutAction}>
            <button
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[var(--bv-ink-3)] transition-colors hover:bg-[var(--bv-panel)] hover:text-[var(--bv-ink)]",
                collapsed && "justify-center px-0",
              )}
              title={collapsed ? "Sign out" : undefined}
              type="submit"
            >
              <svg
                className="size-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" x2="9" y1="12" y2="12" />
              </svg>
              {!collapsed && <span>Sign out</span>}
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
