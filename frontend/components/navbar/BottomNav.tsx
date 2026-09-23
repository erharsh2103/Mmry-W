"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/hooks/useI18n";
import { useSpeech } from "@/hooks/useSpeech";
import { Icon } from "@/components/ui/Icon";
import styles from "./navbar.module.css";

const ITEMS = [
  { href: "/dashboard", icon: "home", key: "home", exact: true },
  { href: "/dashboard/day", icon: "event_note", key: "navDayShort" },
  { href: "/dashboard/activities", icon: "extension", key: "navGames" },
  { href: "/dashboard/talk", icon: "mic", key: "navTalk" },
  { href: "/dashboard/places", icon: "home_pin", key: "navPlaces" },
];

/* The patient's five destinations, always at the bottom of the screen. */
export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { cancel } = useSpeech();
  return (
    <nav className={styles.nav} aria-label="Main">
      <div className={styles.navInner}>
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={styles.navItem} aria-current={active ? "page" : undefined} onClick={cancel}>
              <Icon name={item.icon} size={28} />
              <span className={styles.navLabel}>{t(item.key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
