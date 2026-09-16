"use client";

import { useClock } from "@/hooks/useClock";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  updatedAt: number;
  loading: boolean;
}

/* "Updated 10:42" under live panels, so a caregiver can trust what they see is current. */
export function LiveStamp({ updatedAt, loading }: Props) {
  const { t, locale } = useI18n();
  useClock(30_000);
  if (!updatedAt) return null;
  return (
    <p aria-live="polite" style={{ margin: "6px 0 0", color: "var(--muted-2)", fontSize: "0.82em", fontWeight: 600 }}>
      {loading ? t("liveRefreshing") : t("liveUpdated", { t: new Date(updatedAt).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }) })}
    </p>
  );
}
