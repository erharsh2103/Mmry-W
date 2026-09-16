import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { translate } from "@/lib/i18n/translate";
import styles from "@/components/forms/forms.module.css";
import ui from "@/components/ui/ui.module.css";

const t = (key: string) => translate("en", key);

const FEATURES = [
  { icon: "record_voice_over", key: "landFeat1" },
  { icon: "extension", key: "landFeat2" },
  { icon: "home_pin", key: "landFeat3" },
  { icon: "translate", key: "landFeat4" },
];

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.topInner}>
          <img src="/icon.svg" alt="" className={styles.mark} />
          <span className={styles.brand}>{t("appName")}</span>
        </div>
      </header>
      <main className={`${styles.body} ${styles.landing}`}>
        <div className={styles.landingGrid}>
        <div>
        <p className={ui.badgeGreen}>{t("tagline")}</p>
        <h1 className={styles.hero}>{t("landTitle")}</h1>
        <p className={ui.pageSub} style={{ maxWidth: "60ch" }}>
          {t("landSub")}
        </p>
        <div className={styles.actions}>
          <Link href="/register" className={styles.linkPrimary}>
            {t("landStart")}
          </Link>
          <Link href="/login" className={styles.linkSecondary}>
            {t("authSignIn")}
          </Link>
        </div>
        </div>
        <ul className={styles.features}>
          {FEATURES.map((f) => (
            <li key={f.key} className={styles.feature}>
              <span className={styles.featureIcon}>
                <Icon name={f.icon} size={28} color="var(--green)" />
              </span>
              {t(f.key)}
            </li>
          ))}
        </ul>
        </div>
        <p className={styles.footnote}>{t("disclaimer")}</p>
      </main>
    </div>
  );
}
