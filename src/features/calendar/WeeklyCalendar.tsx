import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { Expense } from "../../types/sharebill";
import { formatVnd } from "../../lib/money/format";

type WeeklyCalendarProps = {
  expenses: Expense[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

const dayLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoLocal(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfWeek(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + mondayOffset);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function WeeklyCalendar({ expenses, selectedDate, onSelectDate }: WeeklyCalendarProps) {
  const weekStart = startOfWeek(parseIsoLocal(selectedDate));
  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const iso = toIsoDate(date);
    return {
      iso,
      date,
      bills: expenses.filter((expense) => expense.paidDate === iso)
    };
  });

  return (
    <section className="px-4 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/42">
            {weekStart.getDate()}/{weekStart.getMonth() + 1} - {weekEnd.getDate()}/{weekEnd.getMonth() + 1}
          </p>
          <h2 className="text-lg font-semibold text-mist">Lịch đi chơi</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.05]"
            type="button"
            title="Tuần trước"
            onClick={() => onSelectDate(toIsoDate(addDays(weekStart, -7)))}
          >
            <ChevronLeft className="h-4 w-4 text-mist" />
          </button>
          <CalendarDays className="h-5 w-5 text-coral" />
          <button
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.05]"
            type="button"
            title="Tuần sau"
            onClick={() => onSelectDate(toIsoDate(addDays(weekStart, 7)))}
          >
            <ChevronRight className="h-4 w-4 text-mist" />
          </button>
        </div>
      </div>

      <div className="grid thumb-grid gap-2">
        {days.map((day, index) => {
          const firstBill = day.bills[0];
          const isSelected = day.iso === selectedDate;

          return (
            <button
              key={day.iso}
              className={`min-h-[84px] rounded-[8px] border p-1.5 text-left transition ${
                isSelected ? "border-coral bg-coral/10" : "border-white/10 bg-white/[0.04]"
              }`}
              onClick={() => onSelectDate(day.iso)}
              type="button"
              aria-label={`Chọn ngày ${day.iso}`}
            >
              <div className="mb-1 flex items-center justify-between text-[10px] text-white/50">
                <span>{dayLabels[index]}</span>
                <span>{day.date.getDate()}</span>
              </div>
              <div className="relative aspect-square overflow-hidden rounded-[7px] bg-panel">
                {firstBill?.imageUrl ? (
                  <img className="h-full w-full object-cover" src={firstBill.imageUrl} alt={firstBill.title} />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 px-1 text-center">
                    <span className="h-2 w-2 rounded-full bg-mint" />
                    <span className="line-clamp-2 text-[10px] font-medium text-mist/80">
                      {firstBill?.title ?? "Trống"}
                    </span>
                  </div>
                )}
                {day.bills.length > 1 && (
                  <span className="absolute right-1 top-1 rounded-full bg-ink/70 px-1.5 text-[10px] font-semibold">
                    +{day.bills.length - 1}
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-[10px] text-white/58">{firstBill ? formatVnd(firstBill.totalAmount) : ""}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
