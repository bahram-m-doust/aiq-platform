"use client";

import { type ReactNode, useState } from "react";
import { FileTextIcon, SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Tab = "report" | "storyline";

// Wraps the Futures Research review when an interactive Storyline is attached:
// a slim switcher toggles between the annotatable PDF and the Storyline. Both
// panels stay mounted so the PDF annotations and the iframe don't reset on
// switch.
export function FuturesResearchWorkspaceView({
  report,
  storyline,
}: {
  report: ReactNode;
  storyline: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("report");

  return (
    <div>
      <div className="sticky top-0 z-20 flex items-center gap-1 border-b border-border bg-background/90 px-3 py-2 backdrop-blur">
        <TabButton
          active={tab === "report"}
          icon={<FileTextIcon className="size-3.5" />}
          label="Report (PDF)"
          onClick={() => setTab("report")}
        />
        <TabButton
          active={tab === "storyline"}
          icon={<SparklesIcon className="size-3.5" />}
          label="Storyline"
          onClick={() => setTab("storyline")}
        />
      </div>

      <div className={cn(tab !== "report" && "hidden")}>{report}</div>
      <div className={cn(tab !== "storyline" && "hidden")}>{storyline}</div>
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}
