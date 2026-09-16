import styles from "./ui.module.css";

interface Props {
  /* 0-100 */
  value: number;
  color?: string;
  height?: number;
  label?: string;
}

export function Progress({ value, color, height, label }: Props) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={styles.track}
      style={height ? { height } : undefined}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
    >
      <div className={styles.fill} style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
