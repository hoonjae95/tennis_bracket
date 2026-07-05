import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminAuthenticated } from "@/lib/auth/session";
import {
  calcRoundTimeRange,
  calcSlotsPerCourt,
  calcWarmupTimeRange,
  calcWrapupTimeRange,
} from "@/lib/rooms/game-calc";
import { TEMPLATE_LABEL } from "@/lib/rooms/templates";
import {
  MATCH_TYPE_LABEL,
  MATCH_TYPE_LABEL_SHORT,
  MATCH_TYPE_BADGE,
  GRADE_SCORE,
  GENDER_TEXT_COLOR,
  type Grade,
  type Gender,
  type MatchType,
} from "@/lib/bracket/types";
import { PairScoreVisibilityProvider, VsOrPairScore } from "@/components/bracket/pair-score-visibility";
import { BracketNotesVisibilityProvider, BracketNote } from "@/components/bracket/bracket-notes-visibility";
import { computeConsecutivePlayNotes } from "@/lib/bracket/generate";
import type { ConsecutivePlayNote } from "@/lib/bracket/types";

type ParticipantLike = {
  guest_name: string | null;
  guest_gender: Gender | null;
  guest_grade: Grade | null;
  member: { name: string; gender: Gender; grade: Grade | null } | null;
};

function participantName(p: ParticipantLike): string {
  return p.member?.name ?? p.guest_name ?? "";
}

function participantGender(p: ParticipantLike): Gender {
  return (p.member?.gender ?? p.guest_gender ?? "male") as Gender;
}

function participantGrade(p: ParticipantLike): Grade | null {
  return p.member?.grade ?? p.guest_grade ?? null;
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const isAdmin = await isAdminAuthenticated();

  const { data: room } = await supabase.from("rooms").select("*").eq("id", id).single();
  if (!room) notFound();

  const { data: courts } = await supabase
    .from("courts")
    .select("id, name, sort_order")
    .eq("room_id", id)
    .order("sort_order", { ascending: true });

  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, court_id, match_type, round_no, match_players(team, room_participant:room_participants(id, grade_override, guest_name, guest_gender, guest_grade, member:members(name, gender, grade)))"
    )
    .eq("room_id", id)
    .order("round_no", { ascending: true });

  const { data: participants } = await supabase
    .from("room_participants")
    .select("id, grade_override, guest_name, guest_gender, guest_grade, member:members(name, gender, grade)")
    .eq("room_id", id);

  const matchesByCourt = new Map<string, typeof matches>();
  for (const m of matches ?? []) {
    const arr = matchesByCourt.get(m.court_id) ?? [];
    arr.push(m);
    matchesByCourt.set(m.court_id, arr);
  }

  const gameCountByParticipant = new Map<string, number>();
  for (const m of matches ?? []) {
    for (const mp of m.match_players) {
      const pid = mp.room_participant?.id;
      if (!pid) continue;
      gameCountByParticipant.set(pid, (gameCountByParticipant.get(pid) ?? 0) + 1);
    }
  }

  const playingByRound = new Map<number, Set<string>>();
  for (const m of matches ?? []) {
    const set = playingByRound.get(m.round_no) ?? new Set<string>();
    for (const mp of m.match_players) {
      const pid = mp.room_participant?.id;
      if (pid) set.add(pid);
    }
    playingByRound.set(m.round_no, set);
  }

  const restingByRound = Array.from(playingByRound.keys())
    .sort((a, b) => a - b)
    .map((roundNo) => {
      const playing = playingByRound.get(roundNo)!;
      const resting = (participants ?? []).filter((p) => !playing.has(p.id));
      return { roundNo, resting };
    })
    .filter((r) => r.resting.length > 0);

  // note는 DB에 저장되지 않으므로(생성 알고리즘의 부산물), 저장된 대진표 순서를 그대로
  // 훑어서 실제 몇 연속 출전인지 다시 계산한다.
  const notesForNoteCalc = (matches ?? []).map((m) => ({
    id: m.id,
    roundNo: m.round_no,
    team1: m.match_players
      .filter((mp) => mp.team === 1)
      .map((mp) => ({
        roomParticipantId: mp.room_participant?.id ?? "",
        name: mp.room_participant ? participantName(mp.room_participant) : "",
      })),
    team2: m.match_players
      .filter((mp) => mp.team === 2)
      .map((mp) => ({
        roomParticipantId: mp.room_participant?.id ?? "",
        name: mp.room_participant ? participantName(mp.room_participant) : "",
      })),
  }));
  const notesByMatchRef = computeConsecutivePlayNotes(notesForNoteCalc);
  const noteByMatchId = new Map<string, ConsecutivePlayNote[]>();
  for (const entry of notesForNoteCalc) {
    const note = notesByMatchRef.get(entry);
    if (note) noteByMatchId.set(entry.id, note);
  }

  const slotsPerCourt = calcSlotsPerCourt({
    startTime: room.start_time,
    endTime: room.end_time,
    minutesPerMatch: room.minutes_per_match,
    breakMinutes: room.break_minutes,
    warmupMinutes: room.warmup_minutes,
    wrapupMinutes: room.wrapup_minutes,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
      >
        ← 전체 일정 목록 보러가기
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">{room.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {TEMPLATE_LABEL[room.template] ?? room.template} · {room.event_date} · {room.start_time.slice(0, 5)}~
          {room.end_time.slice(0, 5)}
        </p>
        <p className="text-sm text-zinc-500">
          {room.location} ({room.is_indoor ? "실내" : "실외"}) · {room.games_per_set}게임 선승 ·{" "}
          {room.minutes_per_match}분/경기 · 휴식 {room.break_minutes}분 · 몸풀기 {room.warmup_minutes}분
          {room.fairness_mode === "tournament" && room.wrapup_minutes > 0 && ` · 마무리 ${room.wrapup_minutes}분`}
        </p>
        <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {room.status === "published" ? "대진표 확정" : room.status === "ready" ? "구성 완료" : "준비 중"}
        </span>
      </div>

      {(!matches || matches.length === 0) ? (
        <div className="rounded-lg border border-dashed border-zinc-300 py-16 text-center text-zinc-500">
          아직 대진표가 생성되지 않았습니다.
        </div>
      ) : (
        <BracketBody isAdmin={isAdmin}>
          {(restingByRound.length > 0 || (participants && participants.length > 0)) && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {participants && participants.length > 0 && (
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <h2 className="mb-2 font-semibold text-zinc-800">선수별 참가 경기 수</h2>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    {participants.map((p) => (
                      <div key={p.id} className="flex justify-between text-zinc-700">
                        <span className={GENDER_TEXT_COLOR[participantGender(p)]}>{participantName(p)}</span>
                        <span className="text-zinc-500">{gameCountByParticipant.get(p.id) ?? 0}경기</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {restingByRound.length > 0 && (
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <h2 className="mb-2 font-semibold text-zinc-800">라운드별 휴식 선수</h2>
                  <ul className="flex flex-col divide-y divide-zinc-100 text-sm">
                    {restingByRound.map(({ roundNo, resting }) => {
                      const maleResting = resting.filter((p) => participantGender(p) === "male");
                      const femaleResting = resting.filter((p) => participantGender(p) === "female");
                      return (
                        <li key={roundNo} className="flex items-start gap-3 py-2">
                          <span className="w-12 shrink-0 text-zinc-400">R{roundNo}</span>
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            {maleResting.length > 0 && (
                              <span className={`truncate whitespace-nowrap ${GENDER_TEXT_COLOR.male}`}>
                                {maleResting.map((p, i) => (
                                  <span key={p.id}>
                                    {i > 0 && " · "}
                                    {participantName(p)}
                                  </span>
                                ))}
                              </span>
                            )}
                            {femaleResting.length > 0 && (
                              <span className={`truncate whitespace-nowrap ${GENDER_TEXT_COLOR.female}`}>
                                {femaleResting.map((p, i) => (
                                  <span key={p.id}>
                                    {i > 0 && " · "}
                                    {participantName(p)}
                                  </span>
                                ))}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {(courts ?? []).map((court) => {
            const courtMatches = matchesByCourt.get(court.id) ?? [];
            const matchedRounds = new Set(courtMatches.map((m) => m.round_no));
            const freeRounds =
              slotsPerCourt > 0
                ? Array.from({ length: slotsPerCourt }, (_, i) => i + 1).filter((r) => !matchedRounds.has(r))
                : [];

            const warmup =
              room.warmup_minutes > 0
                ? calcWarmupTimeRange({ startTime: room.start_time, warmupMinutes: room.warmup_minutes })
                : null;

            const wrapup =
              room.fairness_mode === "tournament" && room.wrapup_minutes > 0 && slotsPerCourt > 0
                ? calcWrapupTimeRange({
                    startTime: room.start_time,
                    minutesPerMatch: room.minutes_per_match,
                    breakMinutes: room.break_minutes,
                    warmupMinutes: room.warmup_minutes,
                    wrapupMinutes: room.wrapup_minutes,
                    lastRoundNo: slotsPerCourt,
                  })
                : null;

            return (
              <div key={court.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                <h2 className="mb-2 font-semibold text-zinc-800">코트 {court.name}</h2>
                <ul className="flex flex-col divide-y divide-zinc-100">
                  {warmup && (
                    <li className="flex items-center gap-0.5 py-2 text-xs sm:gap-2 sm:text-sm">
                      <span className="w-5 shrink-0 text-zinc-400 sm:w-14"></span>
                      <span className="w-[4.7rem] shrink-0 whitespace-nowrap text-[11px] text-zinc-400 sm:w-28 sm:text-xs">
                        {warmup.start}~{warmup.end}
                      </span>
                      <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-center text-[11px] text-zinc-500 sm:px-2 sm:text-xs">
                        몸풀기
                      </span>
                    </li>
                  )}
                  {[
                    ...courtMatches.map((m) => ({ kind: "match" as const, roundNo: m.round_no, match: m })),
                    ...freeRounds.map((r) => ({ kind: "free" as const, roundNo: r, match: null })),
                  ]
                    .sort((a, b) => a.roundNo - b.roundNo)
                    .map((row) => {
                      const { start, end } = calcRoundTimeRange({
                        startTime: room.start_time,
                        minutesPerMatch: room.minutes_per_match,
                        breakMinutes: room.break_minutes,
                        warmupMinutes: room.warmup_minutes,
                        roundNo: row.roundNo,
                      });

                      if (row.kind === "free") {
                        return (
                          <li key={`free-${row.roundNo}`} className="flex items-center gap-0.5 py-2 text-xs sm:gap-2 sm:text-sm">
                            <span className="w-5 shrink-0 text-[11px] text-zinc-400 sm:w-14 sm:text-sm">R{row.roundNo}</span>
                            <span className="w-[4.7rem] shrink-0 whitespace-nowrap text-[11px] text-zinc-400 sm:w-28 sm:text-xs">
                              {start}~{end}
                            </span>
                            <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-center text-[11px] text-zinc-500 sm:px-2 sm:text-xs">
                              자유 랠리 연습
                            </span>
                          </li>
                        );
                      }

                      const m = row.match;
                      const team1 = m.match_players.filter((mp) => mp.team === 1);
                      const team2 = m.match_players.filter((mp) => mp.team === 2);
                      const effectiveGrade = (mp: (typeof team1)[number]): Grade =>
                        (mp.room_participant?.grade_override ??
                          (mp.room_participant ? participantGrade(mp.room_participant) : null) ??
                          "C") as Grade;
                      const t1sum = team1.reduce((s, mp) => s + GRADE_SCORE[effectiveGrade(mp)], 0);
                      const t2sum = team2.reduce((s, mp) => s + GRADE_SCORE[effectiveGrade(mp)], 0);

                      const note = noteByMatchId.get(m.id);

                      return (
                        <li key={m.id} className="flex flex-col py-2 text-xs sm:text-sm">
                          <div className="flex items-center gap-0.5 sm:gap-2">
                            <span className="w-5 shrink-0 text-[11px] text-zinc-400 sm:w-14 sm:text-sm">R{m.round_no}</span>
                            <span className="w-[4.7rem] shrink-0 whitespace-nowrap text-[11px] text-zinc-400 sm:w-28 sm:text-xs">
                              {start}~{end}
                            </span>
                            <span
                              className={`shrink-0 whitespace-nowrap rounded-full px-1 py-0.5 text-center text-[10px] sm:w-20 sm:px-2 sm:text-xs ${
                                MATCH_TYPE_BADGE[m.match_type as MatchType] ?? "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              <span className="sm:hidden">
                                {MATCH_TYPE_LABEL_SHORT[m.match_type as keyof typeof MATCH_TYPE_LABEL_SHORT] ?? m.match_type}
                              </span>
                              <span className="hidden sm:inline">
                                {MATCH_TYPE_LABEL[m.match_type as keyof typeof MATCH_TYPE_LABEL] ?? m.match_type}
                              </span>
                            </span>
                            <span className="min-w-0 flex-1 truncate whitespace-nowrap text-right text-zinc-800">
                              {team1.map((mp, i) => (
                                <span key={mp.room_participant?.id ?? i}>
                                  {i > 0 && " · "}
                                  <span
                                    className={GENDER_TEXT_COLOR[mp.room_participant ? participantGender(mp.room_participant) : "male"]}
                                  >
                                    {mp.room_participant ? participantName(mp.room_participant) : ""}
                                  </span>
                                </span>
                              ))}
                            </span>
                            <span className="mx-0.5 shrink-0 text-[10px] text-zinc-400 sm:mx-2 sm:text-xs">
                              {isAdmin ? <VsOrPairScore t1sum={t1sum} t2sum={t2sum} /> : "vs"}
                            </span>
                            <span className="min-w-0 flex-1 truncate whitespace-nowrap text-zinc-800">
                              {team2.map((mp, i) => (
                                <span key={mp.room_participant?.id ?? i}>
                                  {i > 0 && " · "}
                                  <span
                                    className={GENDER_TEXT_COLOR[mp.room_participant ? participantGender(mp.room_participant) : "male"]}
                                  >
                                    {mp.room_participant ? participantName(mp.room_participant) : ""}
                                  </span>
                                </span>
                              ))}
                            </span>
                          </div>
                          {note && note.length > 0 && <BracketNote note={note} />}
                        </li>
                      );
                    })}
                  {wrapup && (
                    <li className="flex items-center gap-0.5 py-2 text-xs sm:gap-2 sm:text-sm">
                      <span className="w-5 shrink-0 text-zinc-400 sm:w-14"></span>
                      <span className="w-[4.7rem] shrink-0 whitespace-nowrap text-[11px] text-zinc-400 sm:w-28 sm:text-xs">
                        {wrapup.start}~{wrapup.end}
                      </span>
                      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-center text-[11px] text-amber-800 sm:px-2 sm:text-xs">
                        대회 마무리 (시상식 등)
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </BracketBody>
      )}

      <div className="mt-6 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
        >
          전체 일정 목록 보러가기 →
        </Link>
      </div>
    </div>
  );
}

function BracketBody({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  const body = <div className="flex flex-col gap-4">{children}</div>;
  const withNotes = <BracketNotesVisibilityProvider>{body}</BracketNotesVisibilityProvider>;
  if (!isAdmin) {
    return withNotes;
  }
  return <PairScoreVisibilityProvider>{withNotes}</PairScoreVisibilityProvider>;
}
