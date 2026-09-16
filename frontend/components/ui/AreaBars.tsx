"use client";

import { useI18n } from "@/hooks/useI18n";
import { CHECK_AREAS, type MindCheck } from "@/types/api";
import styles from "./ui.module.css";

const COLORS: Record<string, string> = {
  memory: "#1B5E20", attention: "#1B5E20", recognition: "#001736", recall: "#1B5E20", reasoning: "#1B5E20", orientation: "#001736",
};

/* Per-area scores of one mind check; "—" where the area was not asked. */
export function AreaBars({ check }: { check: MindCheck | null | undefined }) {
  const { t } = useI18n();
  return (
    <div className={styles.stack} style={{ gap: 10 }}>
      {CHECK_AREAS.map((area) => {
        const value = check ? check[area] : null;
        const has = typeof value === "number";
        return (
          <div key={area} className={styles.areaRow}>
            <span className={styles.areaLabel}>{t(`m_${area}`)}</span>
            <span className={styles.areaTrack}>
              <span style={{ display: "block", height: "100%", width: `${has ? Math.max(3, value) : 0}%`, background: COLORS[area], borderRadius: 999 }} />
            </span>
            <span className={styles.areaValue}>{has ? `${value}%` : "—"}</span>
          </div>
        );
      })}
    </div>
  );
}
