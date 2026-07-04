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
  MATCH_TYPE_BADGE,
  GRADE_SCORE,
  GENDER_TEXT_COLOR,
  type Grade,
  type Gender,
  type MatchType,
} from "@/lib/bracket/types";

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
      "id, court_id, match_type, round_no, match_players(team, room_participant:room_participants(id, grade_override, member:members(name, gender, grade)))"
    )
    .eq("room_id", id)
    .order("round_no", { ascending: true });

  const { data: participants } = await supabase
    .from("room_participants")
    .select("id, grade_override, member:members(name, gender, grade)")
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
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">{room.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {TEMPLATE_LABEL[room.template] ?? room.template} · {room.event_date} · {room.start_time}~
          {room.end_time}
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
        <div className="flex flex-col gap-4">
          {(restingByRound.length > 0 || (participants && participants.length > 0)) && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {participants && participants.length > 0 && (
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <h2 className="mb-2 font-semibold text-zinc-800">선수별 참가 경기 수</h2>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    {participants.map((p) => (
                      <div key={p.id} className="flex justify-between text-zinc-700">
                        <span className={GENDER_TEXT_COLOR[p.member?.gender as Gender]}>{p.member?.name}</span>
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
                      const maleResting = resting.filter((p) => p.member?.gender === "male");
                      const femaleResting = resting.filter((p) => p.member?.gender === "female");
                      return (
                        <li key={roundNo} className="flex items-start gap-3 py-2">
                          <span className="w-12 shrink-0 text-zinc-400">R{roundNo}</span>
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            {maleResting.length > 0 && (
                              <span className={`truncate whitespace-nowrap ${GENDER_TEXT_COLOR.male}`}>
                                {maleResting.map((p, i) => (
                                  <span key={p.id}>
                                    {i > 0 && " · "}
                                    {p.member?.name}
                                  </span>
                                ))}
                              </span>
                            )}
                            {femaleResting.length > 0 && (
                              <span className={`truncate whitespace-nowrap ${GENDER_TEXT_COLOR.female}`}>
                                {femaleResting.map((p, i) => (
                                  <span key={p.id}>
                                    {i > 0 && " · "}
                                    {p.member?.name}
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
                    <li className="flex items-center py-2 text-sm">
                      <span className="w-14 shrink-0 text-zinc-400"></span>
                      <span className="w-28 shrink-0 text-xs text-zinc-400">
                        {warmup.start}~{warmup.end}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-center text-xs text-zinc-500">
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
                          <li key={`free-${row.roundNo}`} className="flex items-center py-2 text-sm">
                            <span className="w-14 shrink-0 text-zinc-400">R{row.roundNo}</span>
                            <span className="w-28 shrink-0 text-xs text-zinc-400">
                              {start}~{end}
                            </span>
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-center text-xs text-zinc-500">
                              자유 랠리 연습
                            </span>
                          </li>
                        );
                      }

                      const m = row.match;
                      const team1 = m.match_players.filter((mp) => mp.team === 1);
                      const team2 = m.match_players.filter((mp) => mp.team === 2);
                      const effectiveGrade = (mp: (typeof team1)[number]): Grade =>
                        (mp.room_participant?.grade_override ?? mp.room_participant?.member?.grade ?? "C") as Grade;
                      const t1sum = team1.reduce((s, mp) => s + GRADE_SCORE[effectiveGrade(mp)], 0);
                      const t2sum = team2.reduce((s, mp) => s + GRADE_SCORE[effectiveGrade(mp)], 0);

                      return (
                        <li key={m.id} className="flex flex-col gap-1.5 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-0">
                          <div className="flex shrink-0 items-center gap-2 sm:contents">
                            <span className="w-14 shrink-0 text-zinc-400">R{m.round_no}</span>
                            <span className="w-28 shrink-0 text-xs text-zinc-400">
                              {start}~{end}
                            </span>
                            <span
                              className={`w-20 shrink-0 rounded-full px-2 py-0.5 text-center text-xs ${
                                MATCH_TYPE_BADGE[m.match_type as MatchType] ?? "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {MATCH_TYPE_LABEL[m.match_type as keyof typeof MATCH_TYPE_LABEL] ?? m.match_type}
                            </span>
                          </div>
                          <div className="flex min-w-0 items-center pl-14 sm:contents sm:pl-0">
                            <span className="min-w-0 flex-1 truncate whitespace-nowrap text-right text-zinc-800">
                              {team1.map((mp, i) => (
                                <span key={mp.room_participant?.id ?? i}>
                                  {i > 0 && " · "}
                                  <span className={GENDER_TEXT_COLOR[mp.room_participant?.member?.gender as Gender]}>
                                    {mp.room_participant?.member?.name}
                                  </span>
                                </span>
                              ))}
                            </span>
                            <span className="mx-2 shrink-0 text-xs text-zinc-400">
                              {isAdmin ? `페어 점수 ${t1sum} : ${t2sum}` : "vs"}
                            </span>
                            <span className="min-w-0 flex-1 truncate whitespace-nowrap text-zinc-800">
                              {team2.map((mp, i) => (
                                <span key={mp.room_participant?.id ?? i}>
                                  {i > 0 && " · "}
                                  <span className={GENDER_TEXT_COLOR[mp.room_participant?.member?.gender as Gender]}>
                                    {mp.room_participant?.member?.name}
                                  </span>
                                </span>
                              ))}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  {wrapup && (
                    <li className="flex items-center py-2 text-sm">
                      <span className="w-14 shrink-0 text-zinc-400"></span>
                      <span className="w-28 shrink-0 text-xs text-zinc-400">
                        {wrapup.start}~{wrapup.end}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-center text-xs text-amber-800">
                        대회 마무리 (시상식 등)
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
