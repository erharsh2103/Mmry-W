import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import styles from "./forms.module.css";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.topInner}>
          <Link href="/" className={styles.brand}>
            Mmry
          </Link>
        </div>
      </header>
      <main className={styles.body}>
        {/* the form reads ?next=, which needs a Suspense boundary to prerender */}
        <Suspense>{children}</Suspense>
      </main>
    </div>
  );
}
