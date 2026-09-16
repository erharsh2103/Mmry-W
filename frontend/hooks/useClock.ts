"use client";

import { useEffect, useState } from "react";

/* Re-renders every `ms` so time-dependent screens (clock, "due now") stay current. */
export function useClock(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
