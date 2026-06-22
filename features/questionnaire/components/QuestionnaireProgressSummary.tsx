import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";

export function QuestionnaireProgressSummary({
  answeredQuestions,
  className,
  completionPercent,
  totalQuestions,
}: {
  answeredQuestions: number;
  className?: string;
  completionPercent: number;
  totalQuestions: number;
}) {
  const percent = Math.max(0, Math.min(100, completionPercent));

  return (
    <div className={cn("flex items-center gap-6 pt-[14px]", className)}>
      <div className="min-w-0 flex-1">
        <div className="relative">
          <span
            className="pointer-events-none absolute -top-[16px] font-mono text-[12px] font-medium leading-none tracking-[0.4px] text-[#009760] transition-[right] duration-500 ease-out"
            style={{
              right: `clamp(0px, calc(100% - ${percent}%), calc(100% - 24px))`,
            }}
          >
            {percent}%
          </span>
          <ProgressBar color="green" value={percent} />
        </div>
      </div>
      <span className="shrink-0 font-mono text-[12px] font-semibold tracking-[0.4px] text-[#64748b]">
        {answeredQuestions}/{totalQuestions} questions completed
      </span>
    </div>
  );
}
