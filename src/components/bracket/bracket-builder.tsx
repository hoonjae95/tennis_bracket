"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { generateBracket } from "@/lib/bracket/generate";
import { calcSlotsPerCourt, calcRoundTimeRange } from "@/lib/rooms/game-calc";
import { saveBracket } from "@/lib/bracket/actions";
import {
  MATCH_TYPE_LABEL,
  MATCH_TYPE_BADGE,
  GRADE_SCORE,
  GENDER_TEXT_COLOR,
  minGenderCounts,
  isDoubles,
  type BracketPlayer,
  type FairnessMode,
  type FreePracticeSlot,
  type GeneratedMatch,
  type MatchType,
  type RestingPlayers,
} from "@/lib/bracket/types";

type Court = { id: string; name: string; sort_order: number };
type ExistingMatch = {
  id: string;
  court_id: string;
  match_type: string;
  round_no: number;
  match_players: { room_participant_id: string; team: number }[];
};

const ALL_MATCH_TYPES: MatchType[] = [
  "mens_doubles",
  "womens_doubles",
  "mixed_doubles",
  "mixed_any_doubles",
  "mens_singles",
  "womens_singles",
];

export function BracketBuilder({
  roomId,
  courts,
  players,
  room,
  existingMatches,
}: {
  roomId: string;
  courts: Court[];
  players: BracketPlayer[];
  room: {
    startTime: string;
    endTime: string;
    minutesPerMatch: number;
    breakMinutes: number;
    warmupMinutes: number;
    wrapupMinutes: number;
    matchTypes: MatchType[];
    fairnessMode: FairnessMode;
  };
  existingMatches: ExistingMatch[];
}) {
  const [selectedTypes, setSelectedTypes] = useState<Set<MatchType>>(
    new Set(room.matchTypes.length > 0 ? room.matchTypes : ["mens_doubles", "womens_doubles"])
  );
  const [generated, setGenerated] = useState<GeneratedMatch[] | null>(
    existingMatches.length > 0 ? mapExistingToGenerated(existingMatches, courts, players) : null
  );

  // 방이 복식/단식 중 어느 쪽으로 만들어졌는지에 따라 선택 가능한 경기 종류를 그 종류로만 제한한다.
  const isDoublesRoom = room.matchTypes.length === 0 || room.matchTypes.some(isDoubles);
  const availableMatchTypes = ALL_MATCH_TYPES.filter((t) => isDoubles(t) === isDoublesRoom);
  const [freePracticeSlots, setFreePracticeSlots] = useState<FreePracticeSlot[]>([]);
  const [restingPlayersByRound, setRestingPlayersByRound] = useState<RestingPlayers[]>([]);
  const [isSaving, startSaving] = useTransition();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const slotsPerCourt = calcSlotsPerCourt({
    startTime: room.startTime,
    endTime: room.endTime,
    minutesPerMatch: room.minutesPerMatch,
    breakMinutes: room.breakMinutes,
    warmupMinutes: room.warmupMinutes,
    wrapupMinutes: room.wrapupMinutes,
  });

  function roundTimeLabel(roundNo: number): string {
    const { start, end } = calcRoundTimeRange({
      startTime: room.startTime,
      minutesPerMatch: room.minutesPerMatch,
      breakMinutes: room.breakMinutes,
      warmupMinutes: room.warmupMinutes,
      roundNo,
    });
    return `${start}~${end}`;
  }

  function toggleType(type: MatchType) {
    const next = new Set(selectedTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setSelectedTypes(next);
    // 경기 종류 선택을 바꾸면 바로 랜덤 대진표를 생성해준다.
    if (next.size > 0) handleGenerate(next);
  }

  const maleCount = players.filter((p) => p.gender === "male").length;
  const femaleCount = players.filter((p) => p.gender === "female").length;

  function ineligibleReason(type: MatchType): string | null {
    const { male, female } = minGenderCounts(type);
    if (male > 0 && maleCount < male) return `남자 ${male}명 필요 (현재 ${maleCount}명)`;
    if (female > 0 && femaleCount < female) return `여자 ${female}명 필요 (현재 ${femaleCount}명)`;
    return null;
  }

  function handleGenerate(typesOverride?: Set<MatchType>) {
    const types = typesOverride ?? selectedTypes;
    const result = generateBracket({
      players,
      courtCount: courts.length,
      slotsPerCourt,
      enabledMatchTypes: Array.from(types),
      fairnessMode: room.fairnessMode,
    });
    setGenerated(result.matches);
    setFreePracticeSlots(result.freePracticeSlots);
    setRestingPlayersByRound(result.restingPlayersByRound);
    setWarnings(result.warnings);
    setSaveMessage(null);
  }

  // 저장된 대진표가 없는 새 방이면, 경기 종류 선택 화면을 보자마자 바로 한 번 랜덤 대진표를 만들어준다.
  useEffect(() => {
    if (generated === null && selectedTypes.size > 0 && courts.length > 0 && slotsPerCourt > 0) {
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSave() {
    if (!generated) return;
    startSaving(async () => {
      const result = await saveBracket(
        roomId,
        generated,
        courts.map((c) => c.id)
      );
      setSaveMessage(result.success ? "저장되었습니다." : `저장 실패: ${result.error}`);
    });
  }

  const statsByPlayer = useMemo(() => {
    const map = new Map<string, number>();
    if (!generated) return map;
    for (const m of generated) {
      for (const p of [...m.team1, ...m.team2]) {
        map.set(p.roomParticipantId, (map.get(p.roomParticipantId) ?? 0) + 1);
      }
    }
    return map;
  }, [generated]);

  const matchesByCourt = useMemo(() => {
    const map = new Map<number, GeneratedMatch[]>();
    if (!generated) return map;
    for (const m of generated) {
      const arr = map.get(m.courtIndex) ?? [];
      arr.push(m);
      map.set(m.courtIndex, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.roundNo - b.roundNo);
    return map;
  }, [generated]);

  const freeSlotsByCourt = useMemo(() => {
    const map = new Map<number, FreePracticeSlot[]>();
    for (const s of freePracticeSlots) {
      const arr = map.get(s.courtIndex) ?? [];
      arr.push(s);
      map.set(s.courtIndex, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.roundNo - b.roundNo);
    return map;
  }, [freePracticeSlots]);

  const sortedRestingPlayersByRound = useMemo(
    () => [...restingPlayersByRound].sort((a, b) => a.roundNo - b.roundNo),
    [restingPlayersByRound]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="font-semibold text-zinc-800">경기 종류 선택 (다중 선택 가능)</h2>
          {room.fairnessMode === "tournament" && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              대회 모드: 경기수 최대한 균등
            </span>
          )}
        </div>
        <p className="mb-3 text-xs text-zinc-500">누르면 바로 랜덤 생성됩니다.</p>
        <div className="flex flex-wrap gap-2">
          {availableMatchTypes.map((type) => {
            const reason = ineligibleReason(type);
            return (
              <button
                key={type}
                type="button"
                disabled={Boolean(reason)}
                title={reason ?? undefined}
                onClick={() => toggleType(type)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  reason
                    ? "cursor-not-allowed border-zinc-200 text-zinc-300"
                    : selectedTypes.has(type)
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-zinc-300 text-zinc-600"
                }`}
              >
                {MATCH_TYPE_LABEL[type]}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          참가자 {players.length}명 · 코트 {courts.length}개 · 코트당 {slotsPerCourt}경기 (총{" "}
          {slotsPerCourt * courts.length}경기)
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={selectedTypes.size === 0 || courts.length === 0 || slotsPerCourt === 0}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            대진표 생성 (랜덤)
          </button>
          <span className="text-xs text-zinc-500">다시 랜덤으로 돌리려면 선택해주세요</span>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          <ul className="list-disc pl-4">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {generated && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="mb-3 font-semibold text-zinc-800">선수별 참가 경기 수</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {players.map((p) => (
                  <div key={p.roomParticipantId} className="flex justify-between text-zinc-700">
                    <span className={GENDER_TEXT_COLOR[p.gender]}>{p.name}</span>
                    <span className="text-zinc-500">{statsByPlayer.get(p.roomParticipantId) ?? 0}경기</span>
                  </div>
                ))}
              </div>
            </div>

            {sortedRestingPlayersByRound.length > 0 && (
              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <h2 className="mb-3 font-semibold text-zinc-800">라운드별 휴식 선수</h2>
                <ul className="flex flex-col divide-y divide-zinc-100 text-sm">
                  {sortedRestingPlayersByRound.map(({ roundNo, players: restingPlayers }) => (
                    <li key={roundNo} className="flex items-start gap-3 py-2">
                      <span className="w-12 shrink-0 text-zinc-400">R{roundNo}</span>
                      <span className="flex-1 text-zinc-700">
                        {restingPlayers.map((p, i) => (
                          <span key={p.roomParticipantId}>
                            {i > 0 && " · "}
                            <span className={GENDER_TEXT_COLOR[p.gender]}>{p.name}</span>
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {courts.map((court, idx) => {
              const rows: Array<
                | { kind: "match"; roundNo: number; match: GeneratedMatch }
                | { kind: "free"; roundNo: number }
              > = [
                ...(matchesByCourt.get(idx) ?? []).map((m) => ({ kind: "match" as const, roundNo: m.roundNo, match: m })),
                ...(freeSlotsByCourt.get(idx) ?? []).map((s) => ({ kind: "free" as const, roundNo: s.roundNo })),
              ].sort((a, b) => a.roundNo - b.roundNo);

              return (
                <div key={court.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                  <h3 className="mb-2 font-semibold text-zinc-800">코트 {court.name}</h3>
                  <ul className="flex flex-col divide-y divide-zinc-100">
                    {rows.map((row, i) =>
                      row.kind === "match" ? (
                        <MatchRow key={i} match={row.match} timeLabel={roundTimeLabel(row.roundNo)} />
                      ) : (
                        <FreePracticeRow key={i} roundNo={row.roundNo} timeLabel={roundTimeLabel(row.roundNo)} />
                      )
                    )}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {isSaving ? "저장 중..." : "대진표 저장 및 공개"}
            </button>
            {saveMessage && <p className="text-sm text-zinc-600">{saveMessage}</p>}
          </div>
        </>
      )}
    </div>
  );
}

function MatchRow({ match, timeLabel }: { match: GeneratedMatch; timeLabel: string }) {
  const t1sum = match.team1.reduce((s, p) => s + GRADE_SCORE[p.grade], 0);
  const t2sum = match.team2.reduce((s, p) => s + GRADE_SCORE[p.grade], 0);

  return (
    <li className="flex flex-col py-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="w-16 shrink-0 text-zinc-400">R{match.roundNo}</span>
        <span className="w-28 shrink-0 text-xs text-zinc-400">{timeLabel}</span>
        <span
          className={`w-20 shrink-0 rounded-full px-2 py-0.5 text-center text-xs ${MATCH_TYPE_BADGE[match.matchType]}`}
        >
          {MATCH_TYPE_LABEL[match.matchType]}
        </span>
        <span className="flex-1 text-right text-zinc-800">
          {match.team1.map((p, i) => (
            <span key={p.roomParticipantId}>
              {i > 0 && " · "}
              <span className={GENDER_TEXT_COLOR[p.gender]}>{p.name}</span>
              {`(${p.grade})`}
            </span>
          ))}
        </span>
        <span className="mx-2 shrink-0 text-xs text-zinc-400">
          페어 점수 {t1sum} : {t2sum}
        </span>
        <span className="flex-1 text-zinc-800">
          {match.team2.map((p, i) => (
            <span key={p.roomParticipantId}>
              {i > 0 && " · "}
              <span className={GENDER_TEXT_COLOR[p.gender]}>{p.name}</span>
              {`(${p.grade})`}
            </span>
          ))}
        </span>
      </div>
      {match.note && match.note.length > 0 && (
        <p className="mt-1 text-right text-xs text-amber-600">
          비고:{" "}
          {match.note.map((group, i) => (
            <span key={group.consecutiveCount}>
              {i > 0 && " / "}
              {group.names.join(", ")}님이 <strong className="font-bold">{group.consecutiveCount}</strong>경기 연속
              진행중입니다!
            </span>
          ))}
        </p>
      )}
    </li>
  );
}

function FreePracticeRow({ roundNo, timeLabel }: { roundNo: number; timeLabel: string }) {
  return (
    <li className="flex items-center py-2 text-sm">
      <span className="w-16 shrink-0 text-zinc-400">R{roundNo}</span>
      <span className="w-28 shrink-0 text-xs text-zinc-400">{timeLabel}</span>
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-center text-xs text-zinc-500">
        자유 랠리 연습
      </span>
    </li>
  );
}

function mapExistingToGenerated(
  existingMatches: ExistingMatch[],
  courts: Court[],
  players: BracketPlayer[]
): GeneratedMatch[] {
  const courtIndexById = new Map(courts.map((c, i) => [c.id, i]));
  const playerById = new Map(players.map((p) => [p.roomParticipantId, p]));

  return existingMatches.map((m) => ({
    courtIndex: courtIndexById.get(m.court_id) ?? 0,
    roundNo: m.round_no,
    matchType: m.match_type as MatchType,
    team1: m.match_players
      .filter((mp) => mp.team === 1)
      .map((mp) => playerById.get(mp.room_participant_id))
      .filter((p): p is BracketPlayer => Boolean(p)),
    team2: m.match_players
      .filter((mp) => mp.team === 2)
      .map((mp) => playerById.get(mp.room_participant_id))
      .filter((p): p is BracketPlayer => Boolean(p)),
  }));
}
