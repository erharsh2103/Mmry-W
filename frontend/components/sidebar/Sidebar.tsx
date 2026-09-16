"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { usePatient } from "@/hooks/usePatient";
import { useI18n } from "@/hooks/useI18n";
import { clearResources } from "@/hooks/useResource";
import { Icon } from "@/components/ui/Icon";
import styles from "./sidebar.module.css";

const PATIENT = [
  { href: "/dashboard", icon: "home", key: "home", exact: true },
  { href: "/dashboard/day", icon: "event_note", key: "navDay" },
  { href: "/dashboard/activities", icon: "extension", key: "activities" },
  { href: "/dashboard/talk", icon: "mic", key: "navTalk" },
  { href: "/dashboard/people", icon: "groups", key: "people" },
  { href: "/dashboard/check", icon: "psychology", key: "navCheck" },
];

const CAREGIVER = [
  { href: "/dashboard/care", icon: "assignment", key: "navCare" },
  { href: "/analytics", icon: "monitoring", key: "navAnalytics" },
  { href: "/profile", icon: "person", key: "navProfile" },
  { href: "/settings", icon: "settings", key: "navSettings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const { unlocked } = usePatient();

  const item = (l: { href: string; icon: string; key: string; exact?: boolean }) => {
    const active = l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`);
    return (
      <Link key={l.href} href={l.href} className={styles.link} aria-current={active ? "page" : undefined}>
        <Icon name={l.icon} size={26} />
        {t(l.key)}
      </Link>
    );
  };

  return (
    <aside className={styles.sidebar} aria-label="Sections">
      {PATIENT.map(item)}
      {unlocked && (
        <>
          <p className={styles.group}>{t("caregiver")}</p>
          {CAREGIVER.map(item)}
        </>
      )}
      <button
        type="button"
        className={styles.link}
        onClick={async () => {
          await logout();
          clearResources();
          router.replace("/login");
        }}
      >
        <Icon name="logout" size={26} />
        {t("authSignOut")}
      </button>
      {user && <p className={styles.who}>{t("stSignedInAs", { email: user.email })}</p>}
    </aside>
  );
}
