"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthenticated } from "@/lib/auth/session";
import type { MatchType, BracketPlayer, GeneratedMatch } from "@/lib/bracket/types";

export type SaveBracketResult = { success: true } | { success: false; error: string };

export async function fetchRoomParticipants(roomId: string): Promise<BracketPlayer[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("room_participants")
    .select("id, grade_override, member:members(name, gender, grade)")
    .eq("room_id", roomId);

  if (error || !data) return [];

  return data.map((row) => {
    const member = row.member as unknown as { name: string; gender: "male" | "female"; grade: string | null };
    return {
      roomParticipantId: row.id,
      name: member.name,
      gender: member.gender,
      grade: (row.grade_override ?? member.grade ?? "C") as BracketPlayer["grade"],
    };
  });
}

export async function saveBracket(
  roomId: string,
  matches: GeneratedMatch[],
  courtIds: string[]
): Promise<SaveBracketResult> {
  const ok = await isAdminAuthenticated();
  if (!ok) return { success: false, error: "Unauthorized" };

  const supabase = createAdminClient();

  // clear existing matches for this room (regeneration)
  const { data: existingMatches } = await supabase
    .from("matches")
    .select("id")
    .eq("room_id", roomId);

  if (existingMatches && existingMatches.length > 0) {
    await supabase
      .from("match_players")
      .delete()
      .in("match_id", existingMatches.map((m) => m.id));
    await supabase.from("matches").delete().eq("room_id", roomId);
  }

  for (const match of matches) {
    const courtId = courtIds[match.courtIndex];
    if (!courtId) continue;

    const { data: inserted, error: matchError } = await supabase
      .from("matches")
      .insert({
        room_id: roomId,
        court_id: courtId,
        match_type: match.matchType as MatchType,
        round_no: match.roundNo,
      })
      .select("id")
      .single();

    if (matchError || !inserted) {
      return { success: false, error: matchError?.message ?? "경기 저장에 실패했습니다." };
    }

    const playerRows = [
      ...match.team1.map((p) => ({
        match_id: inserted.id,
        room_participant_id: p.roomParticipantId,
        team: 1,
      })),
      ...match.team2.map((p) => ({
        match_id: inserted.id,
        room_participant_id: p.roomParticipantId,
        team: 2,
      })),
    ];

    const { error: playersError } = await supabase.from("match_players").insert(playerRows);
    if (playersError) {
      return { success: false, error: playersError.message };
    }
  }

  await supabase.from("rooms").update({ status: "published" }).eq("id", roomId);

  revalidatePath(`/admin/rooms/${roomId}/bracket`);
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/");

  return { success: true };
}
