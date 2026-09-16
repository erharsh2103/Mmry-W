"use client";

import type { ApiError } from "@/lib/api";
import { useI18n } from "@/hooks/useI18n";
import styles from "./ui.module.css";

interface Props {
  loading?: boolean;
  error?: ApiError | null;
  onRetry?: () => void;
  empty?: string;
}

/* Loading, failure and empty states, worded for a patient rather than a developer. */
export function StateMessage({ loading, error, onRetry, empty }: Props) {
  const { t } = useI18n();
  if (error) {
    return (
      <div className={styles.errorBox} role="alert">
        <p style={{ margin: 0 }}>{error.isNetwork ? t("errNetwork") : t("errGeneric")}</p>
        {onRetry && (
          <button type="button" className={styles.outline} style={{ marginTop: 12 }} onClick={onRetry}>
            {t("errRetry")}
          </button>
        )}
      </div>
    );
  }
  if (loading) {
    return (
      <p className={styles.stateBox} role="status" aria-live="polite">
        {t("loading")}
      </p>
    );
  }
  return empty ? <p className={styles.stateBox}>{empty}</p> : null;
}
