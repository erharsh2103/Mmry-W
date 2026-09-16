"use client";

import { useI18n } from "@/hooks/useI18n";
import { useSpeech } from "@/hooks/useSpeech";
import { SELECTOR, splitLabel } from "@/lib/i18n/languages";
import { voiceInfoFor } from "@/lib/speech/voices";
import { Icon } from "@/components/ui/Icon";
import styles from "@/components/dashboard/shell.module.css";

/* Language list that also says whether this device has a voice for each language. */
export function LanguagePicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const { t } = useI18n();
  const { voices } = useSpeech();
  return (
    <div className={styles.langList} role="radiogroup" aria-label={t("setupLang")}>
      {SELECTOR.map((code) => {
        const { native, english } = splitLabel(code);
        const info = voiceInfoFor(code, voices);
        const on = value === code;
        const who = info.status === "none" ? t("pfVoUnavail") : info.gender === "female" ? t("pfVoWoman") : t("pfVoMan");
        return (
          <button key={code} type="button" role="radio" aria-checked={on} className={styles.langCard} onClick={() => onChange(code)}>
            <Icon
              name={info.status === "none" ? "volume_off" : info.gender === "female" ? "face_3" : "face_6"}
              size={24}
              color={info.status === "none" ? "var(--amber)" : "var(--navy)"}
            />
            <span className={styles.langText}>
              <span className={styles.langNative}>{native}</span>
              <span className={styles.langEnglish} data-unavailable={info.status === "none"}>
                {english ? `${english} · ${who}` : who}
              </span>
            </span>
            {on && <Icon name="check_circle" size={24} color="var(--green)" />}
          </button>
        );
      })}
    </div>
  );
}
