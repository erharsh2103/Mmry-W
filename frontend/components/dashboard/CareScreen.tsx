"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { alertText, thinNote } from "@/lib/care/format";
import { GAMES } from "@/lib/games/data";
import { useI18n } from "@/hooks/useI18n";
import { useCurrentPatient } from "@/hooks/usePatient";
import { useInsights, useSessions } from "@/hooks/usePatientData";
import { useSessionQueue } from "@/hooks/useSessionQueue";
import { Icon } from "@/components/ui/Icon";
import { StateMessage } from "@/components/ui/StateMessage";
import { SafetyPanel } from "./SafetyPanel";
import ui from "@/components/ui/ui.module.css";
import styles from "./screens.module.css";

const PILLARS = [
  { icon: "psychology", label: "pilRemember", sub: "pilRememberSub" },
  { icon: "extension", label: "pilTrain", sub: "pilTrainSub" },
  { icon: "schedule", label: "pilAssist", sub: "pilAssistSub" },
  { icon: "groups", label: "pilConnect", sub: "pilConnectSub" },
];

export function CareScreen() {
  const router = useRouter();
  const patient = useCurrentPatient();
  const { t } = useI18n();
  const insights = useInsights();
  const sessions = useSessions(8);
  const queue = useSessionQueue(patient.id);
  const ins = insights.data;

  const statusTone = !ins || !ins.activityCount ? "neutral" : ins.trendPct === null || ins.trendPct > -12 ? "ok" : "warn";
  const sub = ins
    ? `${t("cPatient", { name: patient.displayName })} · ${t(ins.levelKey)}${ins.activityCount && ins.provisional ? ` · ${t("cProvisional")}` : ""}`
    : t("cPatient", { name: patient.displayName });

  return (
    <div className={ui.screen}>
      <h1 className={ui.pageTitle}>{t("caregiver")}</h1>
      <p className={ui.pageSub}>{sub}</p>

      {!ins ? (
        <StateMessage loading={insights.loading} error={insights.error} onRetry={insights.reload} />
      ) : (
        <>
          <div className={styles.status} data-tone={statusTone}>
            <span className={styles.statusDot} aria-hidden="true">
              {statusTone === "neutral" ? "?" : statusTone === "ok" ? "✓" : "!"}
            </span>
            <span>
              <span style={{ display: "block", fontSize: "1.2em", fontWeight: 800 }}>
                {t(statusTone === "neutral" ? "cThinTitle" : statusTone === "ok" ? "cSteady" : "cCheck")}
              </span>
              <span style={{ display: "block", color: "var(--ink)", fontWeight: 600, marginTop: 2 }}>
                {statusTone === "neutral"
                  ? thinNote(ins.needs, t)
                  : statusTone === "ok"
                    ? t("cSteadyDetail", { d: ins.routine.done, t: ins.routine.total, s: ins.activityCount }) +
                      (ins.provisional && thinNote(ins.needs, t) ? ` · ${thinNote(ins.needs, t)}` : "")
                    : t("cCheckDetail", { n: Math.abs(ins.trendPct ?? 0) })}
              </span>
            </span>
          </div>

          <section className={ui.card} style={{ marginTop: 18 }}>
            <h2 className={ui.cardTitle} style={{ marginBottom: 14 }}>
              {t("careePillars")}
            </h2>
            <div className={styles.pillars}>
              {PILLARS.map((p) => (
                <div key={p.label} className={styles.pillar}>
                  <Icon name={p.icon} size={34} />
                  <span style={{ display: "block", marginTop: 8, fontWeight: 800 }}>{t(p.label)}</span>
                  <span style={{ display: "block", marginTop: 2, color: "var(--muted)", fontWeight: 600, fontSize: "0.95em" }}>{t(p.sub)}</span>
                </div>
              ))}
            </div>
          </section>

          <section style={{ marginTop: 18 }} aria-labelledby="alerts-title">
            <h2 id="alerts-title" className={ui.cardTitle} style={{ marginBottom: 12 }}>
              {t("careAlerts")}
            </h2>
            <div className={ui.stack} style={{ gap: 10 }}>
              {ins.alerts.map((alert) => {
                const text = alertText(alert, t);
                return (
                  <div key={alert.id} className={styles.alert} data-tone={alert.tone}>
                    <Icon name={text.icon} size={32} />
                    <span>
                      <span style={{ display: "block", fontWeight: 800 }}>{text.title}</span>
                      <span style={{ display: "block", color: "var(--ink)", fontWeight: 500, marginTop: 2 }}>{text.text}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <SafetyPanel />

      <Link href="/analytics" className={ui.outline} style={{ marginTop: 18, borderRadius: 24, minHeight: 64, fontWeight: 800 }}>
        <Icon name="monitoring" size={28} />
        {t("anTitle")} · {t("trend")} · {t("insights")}
      </Link>

      <section className={ui.card} style={{ marginTop: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 className={ui.cardTitle}>{t("log")}</h2>
          <span className={styles.pendingPill}>{t(queue.pending === 1 ? "cPending1" : "cPendingN", { n: queue.pending })}</span>
        </div>
        {sessions.data && !sessions.data.length && <p className={ui.muted} style={{ margin: "16px 0 0" }}>{t("noSessions")}</p>}
        {!sessions.data && <StateMessage loading={sessions.loading} error={sessions.error} onRetry={sessions.reload} />}
        <div className={ui.stack} style={{ marginTop: 14, gap: 10 }}>
          {[...(sessions.data ?? [])].reverse().slice(0, 8).map((s) => (
            <div key={s.id} className={styles.row}>
              <span className={styles.rowIcon} style={{ background: GAMES[s.gameType].tint }}>
                <Icon name={GAMES[s.gameType].glyph} size={30} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 700 }}>{t(GAMES[s.gameType].titleKey)}</span>
                <span style={{ display: "block", color: "var(--muted)", fontSize: "0.95em", fontWeight: 600 }}>
                  {t("cRowMeta", { l: s.level, s: (s.responseMs / 1000).toFixed(1), sync: t("cSynced") })}
                </span>
              </span>
              <span style={{ flex: "none", fontWeight: 800, color: s.accuracy >= 0.45 ? "var(--green)" : "var(--navy)" }}>{Math.round(s.accuracy * 100)}%</span>
            </div>
          ))}
        </div>
        {queue.failed && <p className={ui.muted} style={{ margin: "12px 0 0", color: "var(--rust)" }}>{t("syncFailed")}</p>}
        <button type="button" className={ui.primary} style={{ marginTop: 18, borderRadius: 8, fontSize: "1.05em", padding: 18 }} onClick={() => router.push("/dashboard/check")}>
          <Icon name="psychology" size={28} />
          {t("checkStart")}
        </button>
        <button
          type="button"
          className={ui.pillButton}
          style={{ marginTop: 18, fontSize: "1.05em", ...(queue.pending ? {} : { background: "var(--stone-3)", color: "var(--muted)" }) }}
          disabled={!queue.pending}
          onClick={() => void queue.flush()}
        >
          {t("sync")}
        </button>
      </section>
    </div>
  );
}
