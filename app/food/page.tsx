"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useStore } from "@/lib/store";
import { todayISO, formatDate } from "@/lib/utils";
import { DAY_NAMES } from "@/lib/defaults";
import { Skeleton } from "@/components/ui/skeleton";
import { FoodTracker } from "@/components/food-tracker";
import { SaveIndicator } from "@/components/save-indicator";
import { DateNav } from "@/components/date-nav";

export default function FoodPage() {
  const { hydrated } = useStore();
  const [date, setDate] = useState<string>(() => todayISO());

  useEffect(() => {
    setDate(todayISO());
  }, []);

  const [y, m, d] = date.split("-").map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay();

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {DAY_NAMES[dayOfWeek]} · Food
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Nutrition
          </h1>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(date)}
            <SaveIndicator />
          </p>
        </div>
        <DateNav date={date} onChange={(d) => setDate(d)} />
      </header>

      <FoodTracker date={date} />
    </div>
  );
}
