import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const ROW_HEIGHT = 22;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

// Monday-first 6-week grid (42 cells), including the leading/trailing days
// from adjacent months so the grid height never changes month to month.
function buildMonthGrid(monthStart: Date): Date[] {
  const firstWeekday = (monthStart.getDay() + 6) % 7; // 0 = Monday
  const gridStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
}

function TimeColumn({ values, selected, onSelect }: { values: number[]; selected: number; onSelect: (v: number) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center" });
    // Only scroll on open (mount), not on every selection change, so the
    // list doesn't yank itself around while the user is browsing it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={listRef} className="overflow-y-auto h-[154px] w-[38px] flex flex-col">
      {values.map((v) => (
        <button
          key={v}
          ref={v === selected ? activeRef : undefined}
          type="button"
          onClick={() => onSelect(v)}
          className={`shrink-0 text-[12px] font-mono rounded ${
            v === selected ? "bg-accent text-accent-contrast font-semibold" : "text-text hover:bg-accent/10"
          }`}
          style={{ height: ROW_HEIGHT }}
        >
          {String(v).padStart(2, "0")}
        </button>
      ))}
    </div>
  );
}

export function DatePicker({
  selected,
  onChange,
  minDate,
  maxDate,
  showTime = false,
  "aria-label": ariaLabel,
}: {
  selected: Date;
  onChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  showTime?: boolean;
  "aria-label"?: string;
}) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) setViewMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    setOpen((o) => !o);
  }

  function isDisabled(d: Date) {
    if (minDate && d < startOfDay(minDate)) return true;
    if (maxDate && d > startOfDay(maxDate)) return true;
    return false;
  }

  function pickDate(d: Date) {
    const next = new Date(d);
    if (showTime) next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    onChange(next);
    if (!showTime) setOpen(false);
  }

  function pickHour(h: number) {
    const next = new Date(selected);
    next.setHours(h);
    onChange(next);
  }

  function pickMinute(m: number) {
    const next = new Date(selected);
    next.setMinutes(m);
    onChange(next);
  }

  const days = buildMonthGrid(viewMonth);
  const monthLabel = viewMonth.toLocaleDateString(i18n.language, { month: "long", year: "numeric" });
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 1 + i); // a known Monday
    return new Date(d).toLocaleDateString(i18n.language, { weekday: "narrow" });
  });

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="field-input w-full text-left"
        onClick={toggle}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {showTime
          ? selected.toLocaleString(i18n.language, {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : selected.toLocaleDateString(i18n.language, { day: "2-digit", month: "2-digit", year: "numeric" })}
      </button>

      {open && (
        <div role="dialog" className="absolute z-50 mt-1.5 bg-surface border border-line-strong rounded-lg shadow-xl flex">
          <div className="p-2.5 w-[224px]">
            <div className="flex items-center justify-between mb-1.5">
              <button
                type="button"
                className="btn-ghost text-sm px-2 py-0.5"
                onClick={() => setViewMonth((m) => addMonths(m, -1))}
              >
                ‹
              </button>
              <span className="text-[13px] font-medium capitalize">{monthLabel}</span>
              <button
                type="button"
                className="btn-ghost text-sm px-2 py-0.5"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 gap-y-0.5 text-center">
              {weekdayLabels.map((w, i) => (
                <span key={i} className="text-[10px] text-muted uppercase">
                  {w}
                </span>
              ))}
              {days.map((d, i) => {
                const disabled = isDisabled(d);
                const inMonth = d.getMonth() === viewMonth.getMonth();
                const isSelected = sameDay(d, selected);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={disabled}
                    onClick={() => pickDate(d)}
                    className={`h-7 w-7 mx-auto rounded-full text-[12px] flex items-center justify-center ${
                      isSelected
                        ? "bg-accent text-accent-contrast font-semibold"
                        : disabled
                          ? "text-muted opacity-30 cursor-not-allowed"
                          : inMonth
                            ? "text-text hover:bg-accent/10"
                            : "text-muted opacity-50 hover:bg-accent/10"
                    }`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          {showTime && (
            <div className="border-l border-line p-2 flex gap-1">
              <TimeColumn values={HOURS} selected={selected.getHours()} onSelect={pickHour} />
              <TimeColumn values={MINUTES} selected={selected.getMinutes()} onSelect={pickMinute} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
