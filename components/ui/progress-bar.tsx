import { cn } from "@/lib/utils";

const colorClasses = {
  orange: "bg-orange-500",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  "green-soft": "bg-[#2bc78a]/45",
  muted: "bg-muted-foreground/30",
};

export function ProgressBar({
  value,
  color = "blue",
  className,
}: {
  value: number;
  color?: keyof typeof colorClasses;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500 ease-out",
          colorClasses[color],
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
