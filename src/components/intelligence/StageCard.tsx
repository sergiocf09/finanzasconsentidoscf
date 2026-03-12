import { cn } from "@/lib/utils";
import type { FinancialStage } from "@/hooks/useFinancialIntelligence";

const stageConfig: Record<FinancialStage, { emoji: string; color: string; bg: string }> = {
  stabilize: { emoji: "🔵", color: "text-[hsl(var(--block-stability))]", bg: "bg-[hsl(var(--block-stability)/0.1)]" },
  balance: { emoji: "🟡", color: "text-[hsl(var(--block-lifestyle))]", bg: "bg-[hsl(var(--block-lifestyle)/0.1)]" },
  build: { emoji: "🟢", color: "text-[hsl(var(--block-build))]", bg: "bg-[hsl(var(--block-build)/0.1)]" },
};

interface StageCardProps {
  stage: FinancialStage;
  stageName: string;
  stageMessage: string;
}

export function StageCard({ stage, stageName, stageMessage }: StageCardProps) {
  const config = stageConfig[stage];
  return (
    <div className={cn("rounded-2xl border border-border p-5", config.bg)}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{config.emoji}</span>
        <div>
          <p className="text-sm text-muted-foreground">Tu momento financiero actual</p>
          <p className={cn("text-xl font-heading font-bold", config.color)}>{stageName}</p>
        </div>
      </div>
      <p className="text-base text-muted-foreground leading-relaxed">{stageMessage}</p>
    </div>
  );
}
