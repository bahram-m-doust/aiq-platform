import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRightIcon,
  type LucideProps,
} from "lucide-react";

import { Eyebrow } from "@/components/ds/Eyebrow";
import { Button } from "@/components/ui/button";
import type { AgentCatalogWorkspace } from "@/features/agents/catalog/types";
import { ROUTES } from "@/lib/routes";

type HomeDeliverable = {
  title: string;
  description: string;
  href: string;
  Icon: ComponentType<LucideProps>;
};

function BrandCanvasIcon({
  className,
  ...props
}: LucideProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        d="M19 2C19.7956 2 20.5585 2.3163 21.1211 2.87891C21.6837 3.44152 22 4.20435 22 5V19C22 19.7957 21.6837 20.5585 21.1211 21.1211C20.5585 21.6837 19.7957 22 19 22H5C4.20435 22 3.44152 21.6837 2.87891 21.1211C2.3163 20.5585 2 19.7956 2 19V5C2 4.20435 2.3163 3.44152 2.87891 2.87891C3.44152 2.3163 4.20435 2 5 2H19ZM4 19C4 19.2652 4.10543 19.5195 4.29297 19.707C4.48051 19.8946 4.73478 20 5 20H8V10H4V19ZM16 20H19C19.2652 20 19.5195 19.8946 19.707 19.707C19.8946 19.5195 20 19.2652 20 19V10H16V20ZM10 20H14V10H10V20ZM5 4C4.73478 4 4.48051 4.10543 4.29297 4.29297C4.10543 4.48051 4 4.73478 4 5V8H8V4H5ZM16 8H20V5C20 4.73478 19.8946 4.48051 19.707 4.29297C19.5195 4.10543 19.2652 4 19 4H16V8ZM10 8H14V4H10V8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function NotebookPenIcon({
  className,
  strokeWidth = 2,
  ...props
}: LucideProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M13.4 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V12.6M2 6H6M2 10H6M2 14H6M2 18H6M21.378 5.6259C21.7763 5.22755 22.0001 4.68726 22.0001 4.1239C22.0001 3.56055 21.7763 3.02026 21.378 2.6219C20.9796 2.22355 20.4393 1.99976 19.876 1.99976C19.3126 1.99976 18.7723 2.22355 18.374 2.6219L13.364 7.6339C13.1262 7.87153 12.9522 8.16524 12.858 8.4879L12.021 11.3579C11.9959 11.444 11.9944 11.5352 12.0166 11.622C12.0389 11.7088 12.084 11.7881 12.1474 11.8515C12.2108 11.9148 12.2901 11.96 12.3769 11.9823C12.4637 12.0045 12.5549 12.003 12.641 11.9779L15.511 11.1409C15.8336 11.0467 16.1274 10.8727 16.365 10.6349L21.378 5.6259Z" />
    </svg>
  );
}

function BookMinusIcon({
  className,
  strokeWidth = 2,
  ...props
}: LucideProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M4 19.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2H20V22H6.5C5.83696 22 5.20107 21.7366 4.73223 21.2678C4.26339 20.7989 4 20.163 4 19.5ZM4 19.5C4 18.837 4.26339 18.2011 4.73223 17.7322C5.20107 17.2634 5.83696 17 6.5 17H20M9 10H15" />
    </svg>
  );
}

function FileSearchIcon({
  className,
  strokeWidth = 2,
  ...props
}: LucideProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M14 2V6C14 6.53043 14.2107 7.03914 14.5858 7.41421C14.9609 7.78929 15.4696 8 16 8H20M4.268 21C4.44311 21.3033 4.69479 21.5553 4.99786 21.7308C5.30094 21.9063 5.64478 21.9991 5.995 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V7L15 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V7M9 18L7.5 16.5M8 14C8 15.6569 6.65685 17 5 17C3.34315 17 2 15.6569 2 14C2 12.3431 3.34315 11 5 11C6.65685 11 8 12.3431 8 14Z" />
    </svg>
  );
}

function BrainIcon({ className, strokeWidth = 2, ...props }: LucideProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-figma-node-id="5197:4088"
      fill="none"
      viewBox="0 0 22.0018 22.0046"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M5.40191 5.50879C5.16024 5.08928 5.02358 4.61757 5.00381 4.13384C4.98596 3.73427 5.0482 3.33516 5.18686 2.95999C5.32552 2.58482 5.53779 2.24117 5.81121 1.94924C6.08462 1.65732 6.41365 1.42301 6.77895 1.26011C7.14424 1.0972 7.53842 1.00899 7.9383 1.00065C8.33819 0.992316 8.7357 1.06403 9.10746 1.21157C9.47923 1.35911 9.81773 1.5795 10.1031 1.85979C10.3884 2.14007 10.6148 2.47457 10.769 2.84364C10.9232 3.2127 11.002 3.60887 11.0008 4.00884M11.0008 4.00884V17.0088M11.0008 4.00884C10.9996 3.60887 11.0786 3.2127 11.2328 2.84364C11.387 2.47457 11.6134 2.14007 11.8987 1.85979C12.1841 1.5795 12.5226 1.35911 12.8943 1.21157C13.2661 1.06403 13.6636 0.992316 14.0635 1.00065C14.4634 1.00899 14.8576 1.0972 15.2229 1.26011C15.5881 1.42301 15.9172 1.65732 16.1906 1.94924C16.464 2.24117 16.6763 2.58482 16.8149 2.95999C16.9536 3.33516 17.0158 3.73427 16.998 4.13384C17.5858 4.28498 18.1315 4.56789 18.5938 4.96115C19.056 5.35441 19.4228 5.84771 19.6661 6.40369C19.9095 6.95966 20.0232 7.56373 19.9986 8.17015C19.974 8.77657 19.8117 9.36943 19.524 9.90384M5.00381 4.13384C4.41601 4.28498 3.87031 4.56789 3.40804 4.96115C2.94577 5.35441 2.57905 5.84771 2.33565 6.40369C2.09225 6.95966 1.97857 7.56373 2.0032 8.17015C2.02783 8.77657 2.19013 9.36943 2.47781 9.90384M3.06303 9.50879C2.85673 9.62328 2.66075 9.75485 2.47781 9.90384C1.97199 10.3148 1.57423 10.8431 1.31915 11.4428C1.06406 12.0425 0.959365 12.6954 1.01417 13.3448C1.06898 13.9942 1.28162 14.6204 1.63361 15.1689C1.9856 15.7173 2.46627 16.1715 3.03381 16.4918M3.03381 16.4918C2.96372 17.0341 3.00555 17.5849 3.15669 18.1104C3.30784 18.6358 3.5651 19.1247 3.91259 19.5468C4.26008 19.9689 4.69042 20.3153 5.17703 20.5646C5.66364 20.8139 6.19618 20.9608 6.74178 20.9962C7.28738 21.0316 7.83445 20.9548 8.34919 20.7705C8.86394 20.5861 9.33544 20.2983 9.73457 19.9246C10.1337 19.5509 10.452 19.0994 10.6698 18.5979C10.8876 18.0964 11.0002 17.5556 11.0008 17.0088M3.03381 16.4918C3.63407 16.8304 4.31201 17.009 5.00118 17.0087M11.0008 17.0088C11.0014 17.5556 11.1142 18.0964 11.332 18.5979C11.5498 19.0994 11.8681 19.5509 12.2672 19.9246C12.6664 20.2983 13.1379 20.5861 13.6526 20.7705C14.1673 20.9548 14.7144 21.0316 15.26 20.9962C15.8056 20.9608 16.3382 20.8139 16.8248 20.5646C17.3114 20.3153 17.7417 19.9689 18.0892 19.5468C18.4367 19.1247 18.694 18.6358 18.8451 18.1104C18.9962 17.5849 19.0381 17.0341 18.968 16.4918M18.939 9.50879C19.1453 9.62328 19.3411 9.75485 19.524 9.90384C20.0298 10.3148 20.4276 10.8431 20.6827 11.4428C20.9377 12.0425 21.0424 12.6954 20.9876 13.3448C20.9328 13.9942 20.7202 14.6204 20.3682 15.1689C20.0162 15.7173 19.5355 16.1715 18.968 16.4918M18.968 16.4918C18.3677 16.8304 17.6901 17.009 17.001 17.0087M14.001 12.0088C13.1614 11.7134 12.4283 11.1758 11.8943 10.4638C11.3603 9.7518 11.0494 8.89746 11.001 8.00879C10.9525 8.89746 10.6416 9.7518 10.1077 10.4638C9.57366 11.1758 8.84053 11.7134 8.00098 12.0088M16.6001 5.50879C16.8421 5.08937 16.979 4.61761 16.9991 4.13379"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

const HOME_DELIVERABLES: HomeDeliverable[] = [
  {
    title: "Interviews Report",
    description:
      "Review the interview synthesis prepared by AIQ specialists from brand research.",
    href: ROUTES.brainRoadmapStakeholderInterviews,
    Icon: NotebookPenIcon,
  },
  {
    title: "Future Research",
    description:
      "Open the foresight source prepared by AIQ strategists from market signals.",
    href: ROUTES.brainRoadmapFuturesResearch,
    Icon: FileSearchIcon,
  },
  {
    title: "Brand Canvas",
    description:
      "Review the strategic canvas shaped from research insights and expert synthesis.",
    href: ROUTES.brainRoadmapBrandCanvas,
    Icon: BrandCanvasIcon,
  },
  {
    title: "Experience Book",
    description:
      "Open the experience reference prepared by AIQ designers and strategists.",
    href: ROUTES.brainRoadmapExperienceBook,
    Icon: BookMinusIcon,
  },
];

type Pt = readonly [number, number];
type CubeSeed = readonly [number, number, number, number];

function formatPoint([x, y]: Pt) {
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}

function roundedPolygonPath(pts: Pt[], radius: number) {
  const corners = pts.map((point, i) => {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const next = pts[(i + 1) % pts.length];
    const prevLength = Math.hypot(prev[0] - point[0], prev[1] - point[1]);
    const nextLength = Math.hypot(next[0] - point[0], next[1] - point[1]);
    const cornerRadius = Math.min(radius, prevLength / 2, nextLength / 2);
    const start: Pt = [
      point[0] + ((prev[0] - point[0]) / prevLength) * cornerRadius,
      point[1] + ((prev[1] - point[1]) / prevLength) * cornerRadius,
    ];
    const end: Pt = [
      point[0] + ((next[0] - point[0]) / nextLength) * cornerRadius,
      point[1] + ((next[1] - point[1]) / nextLength) * cornerRadius,
    ];

    return { end, point, start };
  });

  return [
    `M${formatPoint(corners[0].end)}`,
    ...corners.slice(1).map(
      ({ end, point, start }) =>
        `L${formatPoint(start)} Q${formatPoint(point)} ${formatPoint(end)}`,
    ),
    `L${formatPoint(corners[0].start)} Q${formatPoint(corners[0].point)} ${formatPoint(corners[0].end)} Z`,
  ].join(" ");
}

function cubeFaces(cx: number, cy: number, r: number) {
  const wx = 0.8660254 * r; // cos(30deg)
  const hy = 0.5 * r;
  const top: Pt = [cx, cy - r];
  const ur: Pt = [cx + wx, cy - hy];
  const lr: Pt = [cx + wx, cy + hy];
  const bot: Pt = [cx, cy + r];
  const ll: Pt = [cx - wx, cy + hy];
  const ul: Pt = [cx - wx, cy - hy];
  const c: Pt = [cx, cy];
  const poly = (pts: Pt[]) =>
    pts.map((point) => formatPoint(point)).join(" ");
  const outline = [top, ur, lr, bot, ll, ul];

  return {
    top: poly([top, ur, c, ul]),
    left: poly([ul, c, bot, ll]),
    right: poly([ur, lr, bot, c]),
    outline: poly(outline),
    outlinePath: roundedPolygonPath(outline, Math.max(1.8, r * 0.1)),
  };
}

function GridCheckPattern({ className }: { className?: string }) {
  const W = 1920;
  const H = 720;
  const cell = 96;
  const verticalLines = Array.from(
    { length: Math.floor(W / cell) + 1 },
    (_, i) => i * cell,
  );
  const horizontalLines = Array.from(
    { length: Math.floor(H / cell) + 1 },
    (_, i) => i * cell,
  );
  const checks: Pt[] = [
    [5, 1],
    [14, 1],
    [7, 2],
    [11, 2],
    [3, 3],
    [8, 4],
    [13, 4],
    [6, 5],
    [15, 5],
    [4, 6],
    [10, 6],
  ];

  return (
    <svg
      aria-hidden
      className={className}
      preserveAspectRatio="xMidYMid slice"
      viewBox={`0 0 ${W} ${H}`}
    >
      <defs>
        <radialGradient id="hero-grid-fade">
          <stop offset="0%" stopColor="white" stopOpacity="0.95" />
          <stop offset="58%" stopColor="white" stopOpacity="0.65" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="hero-grid-mask">
          <rect fill="url(#hero-grid-fade)" height={H} width={W} />
        </mask>
      </defs>
      <g mask="url(#hero-grid-mask)">
        {checks.map(([col, row], i) => (
          <rect
            fill="#f2f4f7"
            fillOpacity={0.34}
            height={cell}
            key={`check-${i}`}
            width={cell}
            x={col * cell}
            y={row * cell}
          />
        ))}
        {verticalLines.map((x) => (
          <line
            key={`v-${x}`}
            stroke="#d0d5dd"
            strokeOpacity={0.24}
            strokeWidth={1}
            x1={x}
            x2={x}
            y1={0}
            y2={H}
          />
        ))}
        {horizontalLines.map((y) => (
          <line
            key={`h-${y}`}
            stroke="#d0d5dd"
            strokeOpacity={0.24}
            strokeWidth={1}
            x1={0}
            x2={W}
            y1={y}
            y2={y}
          />
        ))}
      </g>
    </svg>
  );
}

function ShadedCube({
  cx,
  cy,
  opacity = 1,
  r,
}: {
  cx: number;
  cy: number;
  opacity?: number;
  r: number;
}) {
  const f = cubeFaces(cx, cy, r);
  const clipId = `cube-clip-${Math.round(cx)}-${Math.round(cy)}-${Math.round(r)}`;

  return (
    <g opacity={opacity}>
      <defs>
        <clipPath id={clipId}>
          <path d={f.outlinePath} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <polygon fill="var(--bv-brand)" points={f.top} />
        <polygon fill="var(--bv-brand-mid)" points={f.left} />
        <polygon fill="var(--bv-brand-deep)" points={f.right} />
      </g>
      <path
        d={f.outlinePath}
        fill="none"
        stroke="var(--bv-brand-deep)"
        strokeLinejoin="round"
        strokeOpacity={0.35}
        strokeWidth={1}
      />
    </g>
  );
}

function BrainHubArt({ className }: { className?: string }) {
  const hub: Pt = [150, 142];
  const smallCubes: CubeSeed[] = [
    [150, 50, 20, 1],
    [230, 96, 20, 1],
    [230, 188, 20, 1],
    [150, 234, 20, 1],
    [70, 188, 20, 1],
    [70, 96, 20, 1],
  ];

  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      viewBox="0 0 300 290"
    >
      {smallCubes.map(([x, y, size, opacity], i) => (
        <ShadedCube
          cx={x}
          cy={y}
          key={`small-cube-${i}`}
          opacity={opacity}
          r={size}
        />
      ))}
      <ShadedCube cx={hub[0]} cy={hub[1]} r={48} />
    </svg>
  );
}

function DeliverableFeaturedIcon({ Icon }: { Icon: ComponentType<LucideProps> }) {
  return (
    <span aria-hidden="true" className="relative block size-8 shrink-0">
      <span className="absolute left-[0.4px] top-[-7.6px] flex size-[39.192px] items-center justify-center">
        <span
          className="size-8 flex-none rotate-[15deg] rounded-md bg-[var(--primary)]"
          data-frame="icon-background"
        />
      </span>
      <span
        className="absolute inset-0 grid size-8 place-items-center overflow-hidden rounded-md border-[0.75px] border-white/60 bg-white/60 text-white backdrop-blur-[8px]"
        data-frame="icon-glass"
      >
        <Icon className="relative size-4" strokeWidth={1.75} />
      </span>
    </span>
  );
}

function DeliverableCard({ deliverable }: { deliverable: HomeDeliverable }) {
  const { Icon } = deliverable;

  return (
    <Link
      className="group relative flex aspect-square flex-col justify-between overflow-hidden rounded-xl border bg-[var(--bv-card)] p-5 transition-all duration-200 hover:-translate-y-0.5"
      href={deliverable.href}
      style={{
        borderColor: "var(--bv-line)",
        boxShadow: "var(--bv-shadow-card)",
      }}
    >
      <DeliverableFeaturedIcon Icon={Icon} />
      <div className="space-y-1.5">
        <h3 className="ds-h3">{deliverable.title}</h3>
        <p className="line-clamp-3 text-[13px] leading-relaxed text-[var(--bv-ink-3)]">
          {deliverable.description}
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--bv-brand-deep)]">
        <span>Open source document</span>
        <ArrowRightIcon className="size-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export function AppLanding({
  workspace,
}: {
  workspace: AgentCatalogWorkspace;
}) {
  void workspace;
  const brandName = "your brand";

  return (
    <main
      className="min-h-svh px-4 py-6 sm:px-6 sm:py-10"
      style={{ background: "#ffffff", color: "var(--bv-ink)" }}
    >
      <div
        className="mx-auto w-full max-w-6xl space-y-24"
        style={{ animation: "ds-fade-in 600ms var(--bv-ease)" }}
      >
        <section
          className="relative overflow-hidden rounded-2xl border"
          style={{
            borderColor: "var(--bv-line)",
            background: "var(--bv-card)",
            boxShadow: "var(--bv-shadow-hub)",
          }}
        >
          <GridCheckPattern className="pointer-events-none absolute inset-0 h-full w-full" />
          <div className="relative grid gap-8 p-8 sm:p-10 md:grid-cols-[1.35fr_1fr] md:items-center">
            <div className="space-y-5">
              <Eyebrow>AIQ STUDIO - Brand OS</Eyebrow>
              <h1 className="ds-h1 max-w-xl">
                The brain behind every on-brand decision
              </h1>
              <p className="ds-body max-w-lg">
                The Integrated Brand Brain is built from approved source
                documents prepared by AIQ specialists, strategists, and
                designers, so every agent works from the same verified
                knowledge base.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild size="lg">
                  <Link href={ROUTES.brainBrand}>
                    <BrainIcon />
                    Open Brand Brain
                  </Link>
                </Button>
              </div>
            </div>
            <div className="hidden md:block">
              <BrainHubArt className="mx-auto h-auto w-full max-w-[300px]" />
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="space-y-2">
            <Eyebrow>Knowledge Base Sources</Eyebrow>
            <h2 className="ds-h2">Review the source documents for {brandName}</h2>
            <p className="ds-body max-w-xl">
              AIQ specialists, strategists, and designers prepare these
              documents from brand research. Once approved, they become source
              material for the Brand Brain knowledge base.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {HOME_DELIVERABLES.map((deliverable) => (
              <DeliverableCard
                deliverable={deliverable}
                key={deliverable.href}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
