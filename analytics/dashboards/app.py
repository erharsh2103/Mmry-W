"""Mmry institutional analytics dashboard (Streamlit).

For care-programme staff, not for patients. It shows cohort-level engagement,
safety events and AI-service health, and never shows a name, a phone number,
a position or anything a patient said: patients appear only as a short
pseudonymous code.

    streamlit run dashboards/app.py

Requires ANALYTICS_DASHBOARD_PASSWORD. Bind it to localhost or put it behind
an authenticated reverse proxy; it is not meant to face the internet.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import sys
from pathlib import Path

import pandas as pd
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data_processing import db, extract  # noqa: E402
from models.engagement import accuracy_trend  # noqa: E402

st.set_page_config(page_title="Mmry analytics", page_icon="🧠", layout="wide")

NAVY, GREEN, CREAM = "#001736", "#1B5E20", "#FBF9F5"
st.markdown(
    f"<style>.stApp {{ background: {CREAM}; color: {NAVY}; }} h1, h2, h3 {{ color: {NAVY}; }}</style>",
    unsafe_allow_html=True,
)


def authenticated() -> bool:
    expected = os.environ.get("ANALYTICS_DASHBOARD_PASSWORD", "")
    if len(expected) < 12 or expected.startswith("CHANGE_ME"):
        st.error("ANALYTICS_DASHBOARD_PASSWORD is not configured (12+ characters). The dashboard stays locked.")
        return False
    if st.session_state.get("mmry_authed"):
        return True
    st.title("Mmry analytics")
    with st.form("login"):
        password = st.text_input("Dashboard password", type="password")
        if st.form_submit_button("Open dashboard"):
            if hmac.compare_digest(password.encode(), expected.encode()):
                st.session_state["mmry_authed"] = True
                st.rerun()
            st.error("Wrong password.")
    return False


def pseudonym(patient_id: str) -> str:
    return "P-" + hashlib.sha256(patient_id.encode()).hexdigest()[:6].upper()


@st.cache_data(ttl=300, show_spinner="Loading analytics…")
def load(days: int) -> dict[str, pd.DataFrame]:
    with db.postgres() as conn:
        data = {
            "daily": extract.stored_daily_metrics(conn, days),
            "patients": extract.patients(conn),
            "checks": extract.mind_checks(conn, days),
            "runs": extract.pipeline_runs(conn),
        }
    client, mongo = db.mongo()
    try:
        data["assistant"] = extract.assistant_usage(mongo, days)
        data["inference"] = extract.inference_health(mongo, days)
    finally:
        client.close()
    return data


def main() -> None:
    if not authenticated():
        return

    st.title("Mmry analytics")
    st.caption("Engagement trends only - not a diagnosis. Patients are shown as pseudonymous codes.")
    days = st.sidebar.select_slider("Period (days)", options=[7, 14, 30, 60, 90], value=30)
    if st.sidebar.button("Refresh"):
        load.clear()

    data = load(days)
    daily, patients, checks = data["daily"], data["patients"], data["checks"]

    active = daily.loc[daily["sessions"] > 0, "patient_id"].nunique() if not daily.empty else 0
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Patients", len(patients))
    c2.metric(f"Active in {days} days", active)
    c3.metric("Activities played", int(daily["sessions"].sum()) if not daily.empty else 0)
    mean_acc = daily["mean_accuracy"].dropna().mean() if not daily.empty else float("nan")
    c4.metric("Mean accuracy", "—" if pd.isna(mean_acc) else f"{mean_acc * 100:.0f}%")

    st.subheader("Cohort activity per day")
    if daily.empty:
        st.info("No daily metrics yet. Run `python -m data_processing.pipeline` after some activity.")
    else:
        per_day = daily.groupby("day").agg(activities=("sessions", "sum"), accuracy=("mean_accuracy", "mean")).sort_index()
        left, right = st.columns(2)
        left.bar_chart(per_day["activities"], color=GREEN)
        right.line_chart((per_day["accuracy"] * 100).rename("mean accuracy %"), color=NAVY)

        st.subheader("Per-patient trend")
        rows = []
        for pid, group in daily.groupby("patient_id"):
            trend = accuracy_trend(group)
            rows.append(
                {
                    "patient": pseudonym(pid),
                    "active days": int((group["sessions"] > 0).sum()),
                    "activities": int(group["sessions"].sum()),
                    "latest engagement": group["engagement_score"].dropna().iloc[-1] if group["engagement_score"].notna().any() else None,
                    "accuracy trend (pts/week)": trend.slope_per_week if trend else None,
                    "95% interval": f"{trend.low} to {trend.high}" if trend else "needs 5+ days",
                    "reading": trend.direction if trend else "too little data",
                    "left safe zone": int(group["geofence_exits"].sum()),
                    "SOS": int(group["sos_count"].sum()),
                }
            )
        st.dataframe(pd.DataFrame(rows), hide_index=True, use_container_width=True)

    st.subheader("Mind checks by area")
    if checks.empty:
        st.info("No mind checks in this period.")
    else:
        areas = ["memory", "attention", "recognition", "recall", "reasoning", "orientation"]
        st.bar_chart(checks[areas].mean().rename("mean score"), color=GREEN)
        st.caption(f"{len(checks)} checks; {int(checks['inconsistent'].sum())} flagged as inconsistent with the previous check.")

    st.subheader("AI service")
    left, right = st.columns(2)
    inference = data["inference"]
    if inference.empty:
        left.info("No AI calls recorded in this period.")
    else:
        inference = inference.assign(fallback_rate=(inference["fallbacks"] / inference["calls"]).round(3))
        left.dataframe(inference, hide_index=True, use_container_width=True)
    assistant = data["assistant"]
    if assistant.empty:
        right.info("No talk-companion turns in this period.")
    else:
        right.bar_chart(assistant.groupby("intent")["turns"].sum(), color=NAVY)

    with st.expander("Pipeline runs"):
        st.dataframe(data["runs"], hide_index=True, use_container_width=True)


main()
