import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const [month, setMonth] = React.useState<Date>(
    (props.defaultMonth as Date) ||
    (props.selected instanceof Date ? props.selected : undefined) ||
    new Date()
  );

  React.useEffect(() => {
    if (props.month instanceof Date) setMonth(props.month);
  }, [props.month]);

  const currentYear = month.getFullYear();
  const currentMonth = month.getMonth();
  const years = Array.from({ length: 31 }, (_, i) => currentYear - 10 + i);
  const monthNames = [
    "Ene","Feb","Mar","Abr","May","Jun",
    "Jul","Ago","Sep","Oct","Nov","Dic"
  ];

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const d = new Date(month);
    d.setFullYear(Number(e.target.value));
    setMonth(d);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const d = new Date(month);
    d.setMonth(Number(e.target.value));
    setMonth(d);
  };

  const handlePrevMonth = () => {
    const d = new Date(month);
    d.setMonth(d.getMonth() - 1);
    setMonth(d);
  };

  const handleNextMonth = () => {
    const d = new Date(month);
    d.setMonth(d.getMonth() + 1);
    setMonth(d);
  };

  return (
    <div className={cn("p-3 pointer-events-auto", className)}>
      {/* Custom header with month/year selectors */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={handlePrevMonth}
          className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1">
          <select
            value={currentMonth}
            onChange={handleMonthChange}
            className="text-sm font-medium bg-transparent border-none cursor-pointer focus:outline-none text-foreground"
          >
            {monthNames.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select
            value={currentYear}
            onChange={handleYearChange}
            className="text-sm font-medium bg-transparent border-none cursor-pointer focus:outline-none text-foreground"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <DayPicker
        showOutsideDays={showOutsideDays}
        month={month}
        onMonthChange={setMonth}
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4",
          caption: "hidden",
          table: "w-full border-collapse space-y-1",
          head_row: "flex",
          head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
          row: "flex w-full mt-2",
          cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
          day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
          day_range_end: "day-range-end",
          day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          day_today: "bg-accent text-accent-foreground",
          day_outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
          day_disabled: "text-muted-foreground opacity-50",
          day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
          day_hidden: "invisible",
          ...classNames,
        }}
        fixedWeeks
        {...props}
      />
    </div>
  );
}

Calendar.displayName = "Calendar";
export { Calendar };
