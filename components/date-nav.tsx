"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addDays, todayISO } from "@/lib/utils";

export function DateNav({
  date,
  onChange,
}: {
  date: string;
  onChange: (next: string) => void;
}) {
  const today = todayISO();
  const isToday = date === today;
  const maxDate = addDays(today, 14);
  const atForwardLimit = date >= maxDate;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(addDays(date, -1))}
        aria-label="Previous day"
        className="h-9 w-9"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {!isToday && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(today)}
          className="h-9 px-3 text-xs"
        >
          Jump to today
        </Button>
      )}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(addDays(date, 1))}
        disabled={atForwardLimit}
        aria-label="Next day"
        className="h-9 w-9"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
