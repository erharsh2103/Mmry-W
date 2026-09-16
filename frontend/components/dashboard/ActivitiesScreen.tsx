"use client";

import Link from "next/link";
import { GAMES } from "@/lib/games/data";
import { useI18n } from "@/hooks/useI18n";
import { useCurrentPatient } from "@/hooks/usePatient";
import { resourceKey, useInsights } from "@/hooks/usePatientData";
import { useStoredValue } from "@/hooks/useResource";
import { GAME_TYPES } from "@/types/api";
import ui from "@/components/ui/ui.module.css";
import styles from "./screens.module.css";

export interface GameResult {
  emoji: string;
  headline: string;
  detail: string;
}

export function ActivitiesScreen() {
  const patient = useCurrentPatient();
  const { t } = useI18n();
  const insights = useInsights();
  const result = useStoredValue<GameResult | null>(resourceKey(patient.id, "lastResult"));

  return (
    <div className={ui.screen}>
      <h1 className={ui.pageTitle}>{t("activities")}</h1>
      <p className={ui.pageSub}>{t("activitiesSub")}</p>

      {result && (
        <div className={styles.result} role="status">
          <span style={{ fontSize: "2.2em" }} aria-hidden="true">
            {result.emoji}
          </span>
          <span>
            <span style={{ display: "block", fontSize: "1.3em", fontWeight: 800 }}>{result.headline}</span>
            <span style={{ display: "block", color: "var(--ink)", fontWeight: 600, marginTop: 2 }}>{result.detail}</span>
          </span>
        </div>
      )}

      <div className={styles.cardGrid}>
        {GAME_TYPES.map((game) => {
          const meta = GAMES[game];
          const level = insights.data?.levels[game]?.level;
          return (
            <Link key={game} href={`/dashboard/activities/${game}`} className={styles.gameCard}>
              <span className={styles.gameIcon} style={{ background: meta.tint }} aria-hidden="true">
                {meta.icon}
              </span>
              <span style={{ display: "block", marginTop: 14, fontSize: "1.25em", fontWeight: 800, letterSpacing: "-0.02em" }}>{t(meta.titleKey)}</span>
              <span style={{ display: "block", color: "var(--muted)", fontWeight: 600, marginTop: 4 }}>{t(meta.blurbKey)}</span>
              <span className={styles.pips}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={styles.pip} data-on={level !== undefined && n <= level} />
                ))}
                <span style={{ marginLeft: 4, fontSize: "0.95em", fontWeight: 700, color: "var(--muted)" }}>
                  {t("level")} {level ?? "—"}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
