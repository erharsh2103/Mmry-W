"use client";

import Link from "next/link";
import { useI18n } from "@/hooks/useI18n";
import styles from "./navbar.module.css";

export function Header({ initial }: { initial: string }) {
  const { t } = useI18n();
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/dashboard" className={styles.brand}>
          {t("appName")}
        </Link>
        <Link href="/profile" className={styles.avatar} aria-label={t("navProfile")}>
          {initial}
        </Link>
      </div>
    </header>
  );
}
