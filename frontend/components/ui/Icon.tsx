import styles from "./ui.module.css";

interface Props {
  name: string;
  size?: number;
  color?: string;
  className?: string;
}

/* Material Symbols ligature icon. Decorative: the adjacent label carries the meaning. */
export function Icon({ name, size = 24, color, className }: Props) {
  return (
    <span aria-hidden="true" className={className ? `${styles.icon} ${className}` : styles.icon} style={{ fontSize: size, color }}>
      {name}
    </span>
  );
}
