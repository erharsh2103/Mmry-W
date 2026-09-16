import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/dashboard/GamePlayer";
import { GAME_TYPES, type GameType } from "@/types/api";

export const metadata: Metadata = { title: "Activity" };

export function generateStaticParams() {
  return GAME_TYPES.map((game) => ({ game }));
}

export default async function GamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!(GAME_TYPES as readonly string[]).includes(game)) notFound();
  return <GamePlayer game={game as GameType} />;
}
