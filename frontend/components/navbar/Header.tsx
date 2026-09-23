"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/hooks/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { usePatient } from "@/hooks/usePatient";
import { clearResources } from "@/hooks/useResource";
import { Icon } from "@/components/ui/Icon";
import { signOut } from "@/lib/auth";
import styles from "./navbar.module.css";

export function Header({ initial }: { initial: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const { patient, unlocked, lock } = usePatient();
  const { user } = useAuth();
  const caregiverSection = pathname === "/analytics" || pathname === "/profile" || pathname === "/settings" || pathname === "/dashboard/care" || pathname === "/dashboard/people";

  const logout = async () => {
    await signOut();
    clearResources();
    router.replace("/login");
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/dashboard" className={styles.brand}>
          {t("appName")}
        </Link>
        {caregiverSection && unlocked && user ? (
          <>
            <button type="button" className={styles.modeButton} onClick={() => { lock(); router.replace("/dashboard"); }}>
              <Icon name="lock" size={20} />
              {t("pfLock")}
            </button>
            <button type="button" className={styles.modeButton} onClick={() => void logout()}>
              <Icon name="logout" size={20} />
              {t("authSignOut")}
            </button>
          </>
        ) : !caregiverSection && patient ? (
          <Link href="/dashboard/care" className={styles.modeButton}>
            <Icon name="assignment" size={20} />
            {t("caregiver")}
          </Link>
        ) : null}
        <Link href={caregiverSection ? "/dashboard" : "/profile"} className={styles.avatar} aria-label={t("navProfile")}>
          {initial}
        </Link>
      </div>
    </header>
  );
}
