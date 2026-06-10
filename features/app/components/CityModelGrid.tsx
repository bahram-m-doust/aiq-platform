import Link from "next/link";

import { Eyebrow } from "@/components/ds/Eyebrow";
import {
  CITY_MODEL_DISTRICTS,
  cityModelDistrictPath,
} from "@/features/app/city-model";

// Pointy-top hexagon outline.
const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

// Three conic sectors whose seams land on the hexagon vertices (60/180/300) —
// reads as an isometric cube (top / right / left faces).
const CUBE_FACES = `conic-gradient(from 0deg at 50% 50%,
  var(--bv-brand-glow) 0deg 60deg,
  var(--bv-brand-mid) 60deg 180deg,
  var(--bv-brand-deep) 180deg 300deg,
  var(--bv-brand-glow) 300deg 360deg)`;

// A muted, "switched-off" version for districts whose deliverable isn't ready.
const CUBE_FACES_OFF = `conic-gradient(from 0deg at 50% 50%,
  #e9eaee 0deg 60deg,
  #d7d9df 60deg 180deg,
  #c4c7cf 180deg 300deg,
  #e9eaee 300deg 360deg)`;

const SIZE = 66;
const HEX_W = Math.sqrt(3) * SIZE;
const HEX_H = 2 * SIZE;

function axialToPixel(q: number, r: number) {
  return { x: SIZE * Math.sqrt(3) * (q + r / 2), y: SIZE * 1.5 * r };
}

// Axial coords at an exact hex distance, sorted clockwise from the top so the
// districts can be laid out in the order they are listed.
function ringCoords(radius: number): [number, number][] {
  const coords: [number, number][] = [];
  for (let q = -radius; q <= radius; q += 1) {
    for (let r = -radius; r <= radius; r += 1) {
      const s = -q - r;
      if ((Math.abs(q) + Math.abs(r) + Math.abs(s)) / 2 === radius) {
        coords.push([q, r]);
      }
    }
  }
  return coords.sort((a, b) => {
    const pa = axialToPixel(a[0], a[1]);
    const pb = axialToPixel(b[0], b[1]);
    // atan2(x, -y): 0 = top, increasing clockwise.
    return Math.atan2(pa.x, -pa.y) - Math.atan2(pb.x, -pb.y);
  });
}

type PlacedHex = {
  key: string;
  left: number;
  top: number;
  brain: boolean;
  name?: string;
  href?: string;
  dim: boolean;
  index: number;
};

function buildLayout(available: ReadonlySet<string>) {
  const inner = ringCoords(1); // 6
  const outer = ringCoords(2); // 12
  // Spread 7 districts evenly across the 12 outer slots, keeping clockwise order.
  const outerPick = Array.from({ length: 7 }, (_, i) =>
    Math.round((i * outer.length) / 7),
  );

  const cells: { key: string; cx: number; cy: number; brain: boolean }[] = [
    { key: "__brain__", cx: 0, cy: 0, brain: true },
  ];

  CITY_MODEL_DISTRICTS.forEach((district, i) => {
    const [q, r] =
      i < inner.length ? inner[i] : outer[outerPick[i - inner.length]];
    const { x, y } = axialToPixel(q, r);
    cells.push({ key: district.key, cx: x, cy: y, brain: false });
  });

  const minX = Math.min(...cells.map((c) => c.cx)) - HEX_W / 2;
  const minY = Math.min(...cells.map((c) => c.cy)) - HEX_H / 2;
  const width = Math.max(...cells.map((c) => c.cx)) + HEX_W / 2 - minX;
  const height = Math.max(...cells.map((c) => c.cy)) + HEX_H / 2 - minY;

  const placed: PlacedHex[] = cells.map((c, i) => {
    const district = c.brain
      ? null
      : CITY_MODEL_DISTRICTS.find((d) => d.key === c.key) ?? null;
    const isAvailable = district ? available.has(district.key) : true;
    return {
      key: c.key,
      left: c.cx - HEX_W / 2 - minX,
      top: c.cy - HEX_H / 2 - minY,
      brain: c.brain,
      name: district?.name,
      href:
        district && isAvailable
          ? cityModelDistrictPath(district.slug)
          : undefined,
      dim: !c.brain && !isAvailable,
      index: i,
    };
  });

  return { placed, width, height };
}

function HexContent({ hex }: { hex: PlacedHex }) {
  return (
    <div
      className="group relative h-full w-full"
      style={{
        filter: hex.dim
          ? "drop-shadow(0 4px 10px rgba(15,15,20,0.06))"
          : hex.brain
            ? "drop-shadow(0 10px 26px var(--bv-brand-tint-32))"
            : "drop-shadow(0 8px 16px var(--bv-brand-tint-16))",
        opacity: hex.dim ? 0.55 : 1,
        animation: "ds-fade-in 600ms var(--bv-ease) both",
        animationDelay: `${hex.index * 40}ms`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: HEX_CLIP,
          background: hex.brain
            ? "var(--bv-brand-deep)"
            : hex.dim
              ? "var(--bv-line)"
              : "var(--bv-line-2)",
          padding: hex.brain ? "2px" : "1.5px",
        }}
      >
        <div
          className={hex.brain || hex.dim ? "" : "group-hover:brightness-110"}
          style={{
            width: "100%",
            height: "100%",
            clipPath: HEX_CLIP,
            background: hex.brain
              ? "radial-gradient(circle at 50% 38%, var(--bv-brand-glow), var(--bv-brand-mid) 55%, var(--bv-brand-deep))"
              : hex.dim
                ? CUBE_FACES_OFF
                : CUBE_FACES,
            transition: "filter 200ms var(--bv-ease)",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          inset: hex.brain ? "0" : "26% 14% 0 14%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          className={
            hex.brain
              ? "text-center text-[12px] font-semibold uppercase tracking-[0.14em]"
              : "text-center text-[12px] font-semibold leading-tight"
          }
          style={{
            color: hex.dim ? "var(--bv-ink-3)" : "var(--bv-brand-ink)",
            textShadow: hex.dim ? "none" : "0 1px 2px rgba(15,15,20,0.3)",
          }}
        >
          {hex.brain ? "Brand Core" : hex.name}
        </span>
      </div>
    </div>
  );
}

export function CityModelGrid({
  availableKeys = [],
}: {
  availableKeys?: string[];
}) {
  const { placed, width, height } = buildLayout(new Set(availableKeys));

  return (
    <main
      className="min-h-svh px-4 py-6 sm:px-6 sm:py-10"
      style={{ background: "#ffffff", color: "var(--bv-ink)" }}
    >
      <section
        className="mx-auto w-full max-w-[1057px] space-y-8"
        style={{ animation: "ds-fade-in 600ms var(--bv-ease)" }}
      >
        <header className="space-y-2">
          <Eyebrow>Brand OS · City Model</Eyebrow>
          <h1 className="ds-h1">City Model</h1>
          <p className="ds-body max-w-xl">
            The brand-as-city model — districts built around a central core. Lit
            districts are ready to review; open one to view and approve its
            deliverable.
          </p>
        </header>

        <div className="flex justify-center overflow-x-auto pb-4">
          <div
            className="relative shrink-0"
            style={{ width: `${width}px`, height: `${height}px` }}
          >
            {placed.map((hex) => {
              const style = {
                position: "absolute" as const,
                left: `${hex.left}px`,
                top: `${hex.top}px`,
                width: `${HEX_W}px`,
                height: `${HEX_H}px`,
              };
              if (hex.href) {
                return (
                  <Link
                    aria-label={hex.name}
                    className="transition-transform duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none"
                    href={hex.href}
                    key={hex.key}
                    style={style}
                  >
                    <HexContent hex={hex} />
                  </Link>
                );
              }
              return (
                <div
                  aria-disabled={hex.dim ? true : undefined}
                  key={hex.key}
                  style={style}
                  title={hex.dim ? `${hex.name} — not ready yet` : undefined}
                >
                  <HexContent hex={hex} />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
