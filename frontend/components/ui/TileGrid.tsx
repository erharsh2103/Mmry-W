import type { GameTile } from "@/lib/games/engine";
import styles from "./ui.module.css";

interface Props {
  tiles: GameTile[];
  cols: number;
  onPick: (key: string) => void;
}

/* The large answer tiles shared by games and the mind check. */
export function TileGrid({ tiles, cols, onPick }: Props) {
  return (
    <div className={styles.tileGrid} data-cols={Math.max(1, Math.min(6, cols))}>
      {tiles.map((tile) => (
        <button
          key={tile.key}
          type="button"
          className={styles.tile}
          data-tone={tile.tone}
          disabled={tile.disabled}
          aria-pressed={tile.tone === "picked" ? true : undefined}
          aria-label={tile.label || tile.icon || undefined}
          onClick={() => onPick(tile.key)}
        >
          {tile.icon && <span className={styles.tileIcon} aria-hidden="true">{tile.icon}</span>}
          {tile.label && <span>{tile.label}</span>}
          {tile.sub && <span className={styles.tileSub}>{tile.sub}</span>}
        </button>
      ))}
    </div>
  );
}
