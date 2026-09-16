"use client";

import { useState } from "react";
import { activityLabel, insightText } from "@/lib/care/format";
import { GAMES } from "@/lib/games/data";
import { useI18n } from "@/hooks/useI18n";
import { useAnalytics, useInsights, useMindChecks } from "@/hooks/usePatientData";
import { AreaBars } from "@/components/ui/AreaBars";
import { Progress } from "@/components/ui/Progress";
import { StateMessage } from "@/components/ui/StateMessage";
import { GAME_TYPES } from "@/types/api";
import ui from "@/components/ui/ui.module.css";
import styles from "./analytics.module.css";

const PERIODS = [7, 30, 90];

export function AnalyticsView() {
  const { t, locale } = useI18n();
  const [days, setDays] = useState(30);
  const insights = useInsights();
  const analytics = useAnalytics(days);
  const checks = useMindChecks(5);
  const ins = insights.data;

  return (
    <div className={ui.screen}>
      <h1 className={ui.pageTitle}>{t("anTitle")}</h1>
      <p className={ui.pageSub}>{t("anSub")}</p>

      {!ins ? (
        <StateMessage loading={insights.loading} error={insights.error} onRetry={insights.reload} />
      ) : (
        <>
          <div className={styles.metrics}>
            {[
              { key: "mEngage", value: ins.score, suffix: "/100" },
              { key: "mVisual", value: ins.metrics.visual, suffix: "%" },
              { key: "mFocus", value: ins.metrics.focus, suffix: "%", color: "var(--navy)" },
              { key: "mRem", value: ins.metrics.routine, suffix: "%" },
            ].map((m) => (
              <div key={m.key} className={styles.metric}>
                <p className={styles.metricLabel}>{t(m.key)}</p>
                <p className={styles.metricValue}>
                  {m.value ?? "—"}
                  {m.value !== null && <span className={styles.metricSuffix}>{m.suffix}</span>}
                </p>
                <Progress value={Math.max(2, m.value ?? 0)} color={m.color} label={t(m.key)} />
              </div>
            ))}
          </div>

          <div className={styles.twoUp}>
            <section className={ui.card}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                <h2 className={ui.cardTitle}>{t("trend")}</h2>
                {ins.activityCount > 0 && ins.provisional && <span className={ui.badgeAmber}>{t("cProvisional")}</span>}
              </div>
              <p className={styles.trendValue} style={{ color: ins.trendPct === null ? "var(--muted)" : ins.trendPct > 0 ? "var(--green)" : "var(--navy)" }}>
                {ins.trendPct === null
                  ? ins.activityCount
                    ? t("cSoFar")
                    : "—"
                  : `${ins.trendPct > 0 ? "↗" : ins.trendPct < 0 ? "↘" : "→"} ${ins.trendPct > 0 ? "+" : ""}${ins.trendPct}%`}
              </p>
              <div className={styles.bars} aria-hidden="true">
                {ins.bars.map((acc, i) => (
                  <span key={i} className={styles.bar} data-low={acc < 0.45} style={{ height: `${Math.max(8, Math.round(acc * 92))}px` }} />
                ))}
              </div>
              <p className={ui.muted} style={{ margin: "10px 0 0" }}>
                {!ins.activityCount
                  ? t("cTrendEmpty")
                  : ins.trendPct === null
                    ? t("cTrendSoon", { n: activityLabel(ins.activityCount, t), m: Math.max(0, 4 - ins.activityCount) })
                    : t("cTrendNote", { n: ins.bars.length })}
              </p>
            </section>

            <section className={ui.card}>
              <h2 className={ui.cardTitle}>{t("insights")}</h2>
              <div className={ui.stack} style={{ marginTop: 14, gap: 10 }}>
                {ins.insights.map((item, i) => {
                  const { icon, text } = insightText(item, ins, t);
                  return (
                    <p key={i} className={styles.insight}>
                      <span className={ui.icon} style={{ fontSize: 26, color: "var(--navy)" }} aria-hidden="true">
                        {icon}
                      </span>
                      <span>{text}</span>
                    </p>
                  );
                })}
              </div>
              <p className={ui.muted} style={{ margin: "14px 0 0" }}>
                {t("disclaimer")}
              </p>
            </section>
          </div>

          <section className={ui.card} style={{ marginTop: 18 }}>
            <h2 className={ui.cardTitle}>{t("anLevels")}</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <tbody>
                  {GAME_TYPES.map((game) => (
                    <tr key={game}>
                      <td style={{ fontWeight: 700 }}>{t(GAMES[game].titleKey)}</td>
                      <td style={{ fontWeight: 800 }}>
                        {t("level")} {ins.levels[game].level}
                      </td>
                      <td style={{ color: "var(--muted)" }}>{t(ins.levels[game].source === "model" ? "anLevelModel" : "anLevelRule")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className={ui.card} style={{ marginTop: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <h2 className={ui.cardTitle}>{t("anDaily")}</h2>
          <div role="radiogroup" aria-label={t("anDaily")} style={{ display: "flex", gap: 8 }}>
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={days === p}
                className={ui.outline}
                style={{ width: "auto", minHeight: 48, padding: "8px 14px", ...(days === p ? { borderColor: "var(--green)", background: "var(--green-tint)" } : {}) }}
                onClick={() => setDays(p)}
              >
                {t("anDays", { n: p })}
              </button>
            ))}
          </div>
        </div>
        {!analytics.data ? (
          <StateMessage loading={analytics.loading} error={analytics.error} onRetry={analytics.reload} />
        ) : !analytics.data.daily.length ? (
          <p className={ui.muted} style={{ margin: "14px 0 0" }}>
            {t("anNoDaily")}
          </p>
        ) : (
          <>
            <DailyChart daily={analytics.data.daily} locale={locale} />
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t("dayTitle")}</th>
                    <th scope="col">{t("anSessions")}</th>
                    <th scope="col">{t("anAccuracy")}</th>
                    <th scope="col">{t("anRoutine")}</th>
                    <th scope="col">{t("anExits")}</th>
                    <th scope="col">{t("anSos")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...analytics.data.daily].reverse().slice(0, 14).map((d) => (
                    <tr key={d.day}>
                      <td>{new Date(`${d.day}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" })}</td>
                      <td>{d.sessions}</td>
                      <td>{d.meanAccuracy === null ? "—" : `${Math.round(d.meanAccuracy * 100)}%`}</td>
                      <td>
                        {d.tasksDone}/{d.tasksTotal}
                      </td>
                      <td>{d.geofenceExits}</td>
                      <td>{d.sosCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {analytics.data && (
          <p className={styles.legend}>
            {analytics.data.pipeline.lastRunAt ? t("anPipeline", { t: new Date(analytics.data.pipeline.lastRunAt).toLocaleString(locale) }) : t("anPipelineNever")}
          </p>
        )}
      </section>

      <section className={ui.card} style={{ marginTop: 18 }}>
        <h2 className={ui.cardTitle}>{t("careBaseline")}</h2>
        {!checks.data ? (
          <StateMessage loading={checks.loading} error={checks.error} onRetry={checks.reload} />
        ) : (
          <>
            <p className={ui.muted} style={{ margin: "8px 0 16px" }}>
              {checks.data[0]
                ? t("qBaseNote", { d: new Date(checks.data[0].takenAt).toLocaleDateString(locale), p: checks.data[0].overall, s: (checks.data[0].avgResponseMs / 1000).toFixed(1) })
                : t("qBaseNone")}
            </p>
            <AreaBars check={checks.data[0]} />
            <div className={ui.stack} style={{ marginTop: 16, gap: 10 }}>
              {checks.data.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 14, borderTop: "2px solid var(--line)", paddingTop: 12 }}>
                  <span style={{ width: 56, height: 56, flex: "none", borderRadius: 8, background: "var(--green-tint)", display: "grid", placeItems: "center" }}>
                    <span className={ui.icon} style={{ fontSize: 30 }} aria-hidden="true">
                      psychology
                    </span>
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 700 }}>{new Date(c.takenAt).toLocaleDateString(locale, { day: "numeric", month: "short" })}</span>
                    <span style={{ display: "block", color: "var(--muted)", fontSize: "0.95em", fontWeight: 600 }}>
                      {t("qRowMeta", { s: (c.avgResponseMs / 1000).toFixed(1), n: c.answerCount })}
                    </span>
                  </span>
                  <span style={{ fontWeight: 800, color: c.overall >= 45 ? "var(--green)" : "var(--navy)" }}>{c.overall}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function DailyChart({ daily, locale }: { daily: { day: string; sessions: number; meanAccuracy: number | null }[]; locale: string }) {
  const max = Math.max(1, ...daily.map((d) => d.sessions));
  return (
    <div className={styles.daily} role="img" aria-label={`${daily.length} days`}>
      {daily.map((d) => (
        <div key={d.day} className={styles.dayCol} title={`${new Date(`${d.day}T00:00:00`).toLocaleDateString(locale)}: ${d.sessions}`}>
          <span
            className={styles.dayBar}
            data-empty={d.sessions === 0}
            style={{ height: `${Math.round((d.sessions / max) * 100)}%`, opacity: d.meanAccuracy === null ? 0.6 : 0.5 + d.meanAccuracy / 2 }}
          />
        </div>
      ))}
    </div>
  );
}
