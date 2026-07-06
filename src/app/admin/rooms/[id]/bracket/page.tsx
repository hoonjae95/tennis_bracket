import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchRoomParticipants } from "@/lib/bracket/actions";
import { BracketBuilder } from "@/components/bracket/bracket-builder";

export default async function RoomBracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: room } = await supabase.from("rooms").select("*").eq("id", id).single();
  if (!room) notFound();

  const { data: courts } = await supabase
    .from("courts")
    .select("id, name, sort_order, court_type")
    .eq("room_id", id)
    .order("sort_order", { ascending: true });

  const players = await fetchRoomParticipants(id);

  const { data: existingMatches } = await supabase
    .from("matches")
    .select("id, court_id, match_type, round_no, match_players(room_participant_id, team)")
    .eq("room_id", id)
    .order("round_no", { ascending: true });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">{room.title} — 대진표</h1>
          <p className="text-sm text-zinc-500">
            {room.event_date} · {room.location} · {room.games_per_set}게임 선승 · {room.minutes_per_match}분/경기
          </p>
        </div>
        <Link
          href={`/admin/rooms/${id}/edit`}
          className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:border-emerald-300 hover:text-emerald-700"
        >
          방 정보 수정
        </Link>
      </div>

      <BracketBuilder
        roomId={id}
        courts={courts ?? []}
        players={players}
        room={{
          startTime: room.start_time,
          endTime: room.end_time,
          minutesPerMatch: room.minutes_per_match,
          breakMinutes: room.break_minutes,
          warmupMinutes: room.warmup_minutes,
          wrapupMinutes: room.wrapup_minutes,
          matchTypes: room.match_types,
          fairnessMode: room.fairness_mode,
          maxGamesPerPlayer: room.max_games_per_player ?? null,
        }}
        existingMatches={existingMatches ?? []}
      />
    </div>
  );
}
