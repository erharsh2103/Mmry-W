export interface Task {
  id: string;
  labelKey: string | null;
  label: string | null;
  timeKey: string | null;
  hour: number;
  icon: string;
  sortOrder: number;
  done: boolean;
}

export interface Person {
  id: string;
  nameKey: string | null;
  name: string | null;
  relationKey: string | null;
  relation: string | null;
  noteKey: string | null;
  note: string | null;
  emoji: string;
  isPlace: boolean;
  location: { lat: number; lon: number } | null;
  locatedAt: string | null;
}
