"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthenticated } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/types";

type RoomTemplate = Database["public"]["Enums"]["room_template"];
type Grade = Database["public"]["Enums"]["grade"];
type CourtType = Database["public"]["Enums"]["court_type"];
type MatchType = Database["public"]["Enums"]["match_type"];

export type CreateRoomInput = {
  title: string;
  template: RoomTemplate;
  eventDate: string; // YYYY-MM-DD
  location: string;
  isIndoor: boolean;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  gamesPerSet: number;
  minutesPerMatch: number;
  breakMinutes: number;
  warmupMinutes: number;
  courtNames: string[];
  courtType: CourtType;
  matchTypes: MatchType[];
  participantMemberIds: string[];
  gradeOverrides: Record<string, Grade | null>;
};

export type CreateRoomResult =
  | { success: true; roomId: string }
  | { success: false; error: string };

export async function createRoom(input: CreateRoomInput): Promise<CreateRoomResult> {
  const ok = await isAdminAuthenticated();
  if (!ok) return { success: false, error: "Unauthorized" };

  if (!input.title.trim()) return { success: false, error: "제목을 입력해주세요." };
  if (!input.eventDate) return { success: false, error: "날짜를 선택해주세요." };
  if (!input.location.trim()) return { success: false, error: "장소를 입력해주세요." };
  if (input.courtNames.length === 0) {
    return { success: false, error: "코트를 1개 이상 등록해주세요." };
  }
  if (![4, 5, 6].includes(input.gamesPerSet)) {
    return { success: false, error: "세트당 게임 수는 4, 5, 6 중 하나여야 합니다." };
  }
  if (input.minutesPerMatch <= 0 || input.minutesPerMatch % 5 !== 0) {
    return { success: false, error: "경기 시간은 5분 단위로 설정해주세요." };
  }
  if (input.matchTypes.length === 0) {
    return { success: false, error: "경기 종류를 1개 이상 선택해주세요." };
  }
  if (input.participantMemberIds.length === 0) {
    return { success: false, error: "참가 선수를 1명 이상 선택해주세요." };
  }

  const supabase = createAdminClient();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      title: input.title.trim(),
      template: input.template,
      event_date: input.eventDate,
      location: input.location.trim(),
      is_indoor: input.isIndoor,
      start_time: input.startTime,
      end_time: input.endTime,
      games_per_set: input.gamesPerSet,
      minutes_per_match: input.minutesPerMatch,
      break_minutes: input.breakMinutes,
      warmup_minutes: input.warmupMinutes,
      match_types: input.matchTypes,
      status: "ready",
    })
    .select("id")
    .single();

  if (roomError || !room) {
    return { success: false, error: roomError?.message ?? "방 생성에 실패했습니다." };
  }

  const { error: courtsError } = await supabase.from("courts").insert(
    input.courtNames.map((name, i) => ({
      room_id: room.id,
      name,
      sort_order: i,
      court_type: input.courtType,
    }))
  );

  if (courtsError) {
    return { success: false, error: courtsError.message };
  }

  const { error: participantsError } = await supabase.from("room_participants").insert(
    input.participantMemberIds.map((memberId) => ({
      room_id: room.id,
      member_id: memberId,
      grade_override: input.gradeOverrides[memberId] ?? null,
    }))
  );

  if (participantsError) {
    return { success: false, error: participantsError.message };
  }

  return { success: true, roomId: room.id };
}

export async function createRoomAndRedirect(input: CreateRoomInput) {
  const result = await createRoom(input);
  if (result.success) {
    redirect(`/admin/rooms/${result.roomId}/bracket`);
  }
  return result;
}

export type UpdateRoomInput = CreateRoomInput & { roomId: string };

export type UpdateRoomResult =
  | { success: true; bracketReset: boolean }
  | { success: false; error: string };

export async function updateRoom(input: UpdateRoomInput): Promise<UpdateRoomResult> {
  const ok = await isAdminAuthenticated();
  if (!ok) return { success: false, error: "Unauthorized" };

  if (!input.title.trim()) return { success: false, error: "제목을 입력해주세요." };
  if (!input.eventDate) return { success: false, error: "날짜를 선택해주세요." };
  if (!input.location.trim()) return { success: false, error: "장소를 입력해주세요." };
  if (input.courtNames.length === 0) {
    return { success: false, error: "코트를 1개 이상 등록해주세요." };
  }
  if (![4, 5, 6].includes(input.gamesPerSet)) {
    return { success: false, error: "세트당 게임 수는 4, 5, 6 중 하나여야 합니다." };
  }
  if (input.minutesPerMatch <= 0 || input.minutesPerMatch % 5 !== 0) {
    return { success: false, error: "경기 시간은 5분 단위로 설정해주세요." };
  }
  if (input.matchTypes.length === 0) {
    return { success: false, error: "경기 종류를 1개 이상 선택해주세요." };
  }
  if (input.participantMemberIds.length === 0) {
    return { success: false, error: "참가 선수를 1명 이상 선택해주세요." };
  }

  const supabase = createAdminClient();

  const { data: existingCourts, error: existingCourtsError } = await supabase
    .from("courts")
    .select("id, name, sort_order, court_type")
    .eq("room_id", input.roomId)
    .order("sort_order", { ascending: true });
  if (existingCourtsError) return { success: false, error: existingCourtsError.message };

  const { data: existingParticipants, error: existingParticipantsError } = await supabase
    .from("room_participants")
    .select("id, member_id, grade_override")
    .eq("room_id", input.roomId);
  if (existingParticipantsError) return { success: false, error: existingParticipantsError.message };

  const courtsUnchanged =
    (existingCourts ?? []).length === input.courtNames.length &&
    (existingCourts ?? []).every(
      (c, i) => c.name === input.courtNames[i] && c.court_type === input.courtType
    );

  const existingMemberIds = new Set((existingParticipants ?? []).map((p) => p.member_id));
  const newMemberIds = new Set(input.participantMemberIds);
  const participantsUnchanged =
    existingMemberIds.size === newMemberIds.size &&
    Array.from(existingMemberIds).every((id) => newMemberIds.has(id));

  const bracketReset = !courtsUnchanged || !participantsUnchanged;

  const { error: roomError } = await supabase
    .from("rooms")
    .update({
      title: input.title.trim(),
      template: input.template,
      event_date: input.eventDate,
      location: input.location.trim(),
      is_indoor: input.isIndoor,
      start_time: input.startTime,
      end_time: input.endTime,
      games_per_set: input.gamesPerSet,
      minutes_per_match: input.minutesPerMatch,
      break_minutes: input.breakMinutes,
      warmup_minutes: input.warmupMinutes,
      match_types: input.matchTypes,
      ...(bracketReset ? { status: "ready" as const } : {}),
    })
    .eq("id", input.roomId);
  if (roomError) return { success: false, error: roomError.message };

  if (!courtsUnchanged) {
    // 코트 구성이 바뀌면 courts를 다시 만든다 (matches/match_players는 FK cascade로 함께 삭제됨).
    const { error: deleteCourtsError } = await supabase
      .from("courts")
      .delete()
      .eq("room_id", input.roomId);
    if (deleteCourtsError) return { success: false, error: deleteCourtsError.message };

    const { error: courtsError } = await supabase.from("courts").insert(
      input.courtNames.map((name, i) => ({
        room_id: input.roomId,
        name,
        sort_order: i,
        court_type: input.courtType,
      }))
    );
    if (courtsError) return { success: false, error: courtsError.message };
  }

  if (!participantsUnchanged) {
    // 참가자 명단이 바뀌면 room_participants를 다시 만든다 (matches/match_players는 FK cascade로 함께 삭제됨).
    const { error: deleteParticipantsError } = await supabase
      .from("room_participants")
      .delete()
      .eq("room_id", input.roomId);
    if (deleteParticipantsError) return { success: false, error: deleteParticipantsError.message };

    const { error: participantsError } = await supabase.from("room_participants").insert(
      input.participantMemberIds.map((memberId) => ({
        room_id: input.roomId,
        member_id: memberId,
        grade_override: input.gradeOverrides[memberId] ?? null,
      }))
    );
    if (participantsError) return { success: false, error: participantsError.message };
  } else {
    // 참가자 명단은 그대로지만 등급 override만 바뀌었을 수 있으니 각 참가자 row를 갱신한다 (대진표 보존).
    for (const p of existingParticipants ?? []) {
      const nextOverride = input.gradeOverrides[p.member_id] ?? null;
      if (nextOverride !== p.grade_override) {
        const { error: updateError } = await supabase
          .from("room_participants")
          .update({ grade_override: nextOverride })
          .eq("id", p.id);
        if (updateError) return { success: false, error: updateError.message };
      }
    }
  }

  revalidatePath(`/admin/rooms/${input.roomId}/bracket`);
  revalidatePath(`/rooms/${input.roomId}`);
  revalidatePath("/");

  return { success: true, bracketReset };
}

export type DeleteRoomResult = { success: true } | { success: false; error: string };

export async function deleteRoom(roomId: string): Promise<DeleteRoomResult> {
  const ok = await isAdminAuthenticated();
  if (!ok) return { success: false, error: "Unauthorized" };

  const supabase = createAdminClient();
  const { error } = await supabase.from("rooms").delete().eq("id", roomId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true };
}
