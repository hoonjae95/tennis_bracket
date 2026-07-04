import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoomWizard, type RoomWizardInitialData } from "@/components/rooms/room-wizard";
import type { MatchType } from "@/lib/bracket/types";
import type { Database } from "@/lib/supabase/types";

type Grade = Database["public"]["Enums"]["grade"];

export default async function EditRoomPage({
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
    .select("name, sort_order, court_type")
    .eq("room_id", id)
    .order("sort_order", { ascending: true });

  const { data: participants } = await supabase
    .from("room_participants")
    .select("member_id, grade_override")
    .eq("room_id", id);

  const { data: members } = await supabase
    .from("members")
    .select("id, name, gender, grade")
    .eq("is_active", true)
    .order("gender", { ascending: true })
    .order("name", { ascending: true });

  // grade_override가 없는 참가자는 회원 기본 등급을 그대로 쓰는 것이므로,
  // gradeOverrides에 null을 넣지 않는다 (넣으면 "미지정"으로 표시되어 등급이 풀린 것처럼 보임).
  const gradeOverrides: Record<string, Grade | null> = {};
  for (const p of participants ?? []) {
    if (p.grade_override !== null) {
      gradeOverrides[p.member_id] = p.grade_override;
    }
  }

  const initialData: RoomWizardInitialData = {
    roomId: id,
    template: room.template,
    title: room.title,
    eventDate: room.event_date,
    location: room.location,
    isIndoor: room.is_indoor,
    startTime: room.start_time,
    endTime: room.end_time,
    courtNames: (courts ?? []).map((c) => c.name),
    courtType: courts?.[0]?.court_type ?? "hard_court",
    gamesPerSet: room.games_per_set,
    minutesPerMatch: room.minutes_per_match,
    breakMinutes: room.break_minutes,
    warmupMinutes: room.warmup_minutes,
    matchTypes: (room.match_types ?? []) as MatchType[],
    participantMemberIds: (participants ?? []).map((p) => p.member_id),
    gradeOverrides,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">방 수정 — {room.title}</h1>
        <p className="text-sm text-zinc-500">
          일정 정보부터 경기 종류까지 처음부터 다시 검토하고 저장할 수 있습니다.
        </p>
      </div>
      <RoomWizard members={members ?? []} initialData={initialData} />
    </div>
  );
}
