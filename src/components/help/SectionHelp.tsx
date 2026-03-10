import { HelpCircle, Lightbulb, ListChecks, Info, CheckCircle } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

export interface SectionHelpContent {
  title: string;
  whatIsThis: string;
  actions: string[];
  tip: string;
  doINeedIt: string;
}

interface SectionHelpProps {
  content: SectionHelpContent;
}

export function SectionHelp({ content }: SectionHelpProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="inline-flex items-center justify-center h-6 w-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Ayuda">
          <HelpCircle className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[75vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-3">
          <SheetTitle className="text-base font-heading">{content.title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* What is this */}
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Info className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground mb-0.5">¿Qué es esto?</p>
              <p className="text-xs text-muted-foreground">{content.whatIsThis}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-lg bg-income/10 flex items-center justify-center shrink-0">
              <ListChecks className="h-4 w-4 text-income" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground mb-1">¿Qué puedes hacer aquí?</p>
              <ul className="space-y-1">
                {content.actions.map((action, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <CheckCircle className="h-3 w-3 text-income shrink-0 mt-0.5" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Tip */}
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Lightbulb className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground mb-0.5">Tip</p>
              <p className="text-xs text-muted-foreground">{content.tip}</p>
            </div>
          </div>

          {/* Do I need it */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-foreground mb-0.5">¿Lo necesito?</p>
            <p className="text-xs text-muted-foreground">{content.doINeedIt}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
