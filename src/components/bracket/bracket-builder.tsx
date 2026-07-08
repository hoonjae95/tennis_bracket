"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { generateBracket, computeConsecutivePlayNotes } from "@/lib/bracket/generate";
import { calcSlotsPerCourt, calcRoundTimeRange, calcWarmupTimeRange, calcWrapupTimeRange } from "@/lib/rooms/game-calc";
import { saveBracket } from "@/lib/bracket/actions";
import {
  MATCH_TYPE_LABEL,
  MATCH_TYPE_LABEL_SHORT,
  MATCH_TYPE_BADGE,
  GRADE_SCORE,
  GENDER_TEXT_COLOR,
  minGenderCounts,
  isDoubles,
  playersPerTeam,
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

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTE_OPTIONS = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

// select 옵션은 5분 단위이므로, 방 시작 시각의 분이 5분 단위가 아니면 가장 가까운 5분 단위로 맞춘다.
function roundToNearestFiveMinutes(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const rounded = Math.round(m / 5) * 5;
  const carry = Math.floor(rounded / 60);
  const mm = rounded % 60;
  const hh = (h + carry) % 24;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

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
    maxGamesPerPlayer: number | null;
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
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  // 수동 편집 모드: 랜덤 생성 없이 빈 틀만 만들고 관리자가 코트/라운드별로 경기종류·선수를 직접 채운다.
  const [isManualMode, setIsManualMode] = useState(false);
  // 코트 예약 자체는 room.startTime~endTime 그대로지만, 참가자가 늦게 다 모이는 등의 이유로
  // 실제 대진표 생성은 다른 시각부터 시작하고 싶을 때 이 값만 바꿔서 재계산한다. (방 정보 자체는 수정하지 않음)
  const roomStartTime = roundToNearestFiveMinutes(room.startTime.slice(0, 5));
  const [effectiveStartTime, setEffectiveStartTime] = useState(roomStartTime);
  // 실제 시작 시각을 재설정했다는 건 그 시각까지 이미 몸을 풀고 왔다는 뜻이므로, 몸풀기 시간 없이 바로 경기를 시작한다.
  const isRescheduled = effectiveStartTime !== roomStartTime;
  const effectiveWarmupMinutes = isRescheduled ? 0 : room.warmupMinutes;

  const slotsPerCourt = calcSlotsPerCourt({
    startTime: effectiveStartTime,
    endTime: room.endTime,
    minutesPerMatch: room.minutesPerMatch,
    breakMinutes: room.breakMinutes,
    warmupMinutes: effectiveWarmupMinutes,
    wrapupMinutes: room.wrapupMinutes,
  });

  function roundTimeLabel(roundNo: number): string {
    const { start, end } = calcRoundTimeRange({
      startTime: effectiveStartTime,
      minutesPerMatch: room.minutesPerMatch,
      breakMinutes: room.breakMinutes,
      warmupMinutes: effectiveWarmupMinutes,
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

  function handleGenerate(typesOverride?: Set<MatchType>, startTimeOverride?: string) {
    const types = typesOverride ?? selectedTypes;
    const startTime = startTimeOverride ?? effectiveStartTime;
    const warmupMinutes = startTime !== roomStartTime ? 0 : room.warmupMinutes;
    const slots = calcSlotsPerCourt({
      startTime,
      endTime: room.endTime,
      minutesPerMatch: room.minutesPerMatch,
      breakMinutes: room.breakMinutes,
      warmupMinutes,
      wrapupMinutes: room.wrapupMinutes,
    });
    const result = generateBracket({
      players,
      courtCount: courts.length,
      slotsPerCourt: slots,
      enabledMatchTypes: Array.from(types),
      fairnessMode: room.fairnessMode,
      ...(room.maxGamesPerPlayer != null ? { maxGamesPerPlayer: room.maxGamesPerPlayer } : {}),
    });
    setIsManualMode(false);
    setGenerated(result.matches);
    setFreePracticeSlots(result.freePracticeSlots);
    setRestingPlayersByRound(result.restingPlayersByRound);
    setWarnings(result.warnings);
    setSaveMessage(null);
  }

  // 빈 틀만 만들고 관리자가 코트/라운드별로 경기종류·선수를 직접 채우도록 한다.
  function handleStartManual() {
    const defaultType = availableMatchTypes[0] ?? "mixed_any_doubles";
    const emptyMatches: GeneratedMatch[] = [];
    for (let court = 0; court < courts.length; court++) {
      for (let round = 1; round <= slotsPerCourt; round++) {
        emptyMatches.push({
          courtIndex: court,
          roundNo: round,
          matchType: defaultType,
          team1: [],
          team2: [],
        });
      }
    }
    setIsManualMode(true);
    setGenerated(emptyMatches);
    setFreePracticeSlots([]);
    setRestingPlayersByRound([]);
    setWarnings([]);
    setSaveMessage(null);
  }

  // 수동 편집: 특정 슬롯의 경기 종류를 바꾼다. 팀 인원 수가 달라지면 넘치는 자리는 비운다.
  function handleManualTypeChange(courtIndex: number, roundNo: number, type: MatchType) {
    if (!generated) return;
    const perTeam = playersPerTeam(type);
    setGenerated(
      generated.map((m) =>
        m.courtIndex === courtIndex && m.roundNo === roundNo
          ? { ...m, matchType: type, team1: m.team1.slice(0, perTeam), team2: m.team2.slice(0, perTeam) }
          : m
      )
    );
    setSaveMessage(null);
  }

  // 수동 편집: 특정 슬롯의 팀 내 자리에 선수를 배정(빈 값이면 배정 해제).
  function handleManualPlayerChange(
    courtIndex: number,
    roundNo: number,
    team: 1 | 2,
    slotIdx: number,
    roomParticipantId: string
  ) {
    if (!generated) return;
    const player = roomParticipantId ? players.find((p) => p.roomParticipantId === roomParticipantId) ?? null : null;
    setGenerated(
      generated.map((m) => {
        if (m.courtIndex !== courtIndex || m.roundNo !== roundNo) return m;
        const key = team === 1 ? "team1" : "team2";
        const nextTeam = [...m[key]];
        if (player) nextTeam[slotIdx] = player;
        else nextTeam.splice(slotIdx, 1);
        return { ...m, [key]: nextTeam };
      })
    );
    setSaveMessage(null);
  }

  // 저장된 대진표가 없는 새 방이면, 경기 종류 선택 화면을 보자마자 바로 한 번 랜덤 대진표를 만들어준다.
  useEffect(() => {
    if (generated === null && selectedTypes.size > 0 && courts.length > 0 && slotsPerCourt > 0) {
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 수동 편집 중 아직 선수가 다 안 채워진 슬롯 (팀별 필요 인원 미달)
  const incompleteManualSlots = useMemo(() => {
    if (!isManualMode || !generated) return [];
    return generated.filter((m) => {
      const perTeam = playersPerTeam(m.matchType);
      return m.team1.length < perTeam || m.team2.length < perTeam;
    });
  }, [isManualMode, generated]);

  function handleSave() {
    if (!generated) return;
    // 수동 모드에서 아직 선수를 안 채운 슬롯은 저장 대상에서 제외한다 (자유 랠리 연습으로 취급하지 않고 그냥 미배정 상태로 둠).
    const toSave = isManualMode ? generated.filter((m) => !incompleteManualSlots.includes(m)) : generated;
    startSaving(async () => {
      const result = await saveBracket(
        roomId,
        toSave,
        courts.map((c) => c.id)
      );
      setSaveMessage(result.success ? "저장되었습니다." : `저장 실패: ${result.error}`);
      setSaveSuccess(result.success);
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

  // 수동 편집 모드에서 실시간으로 계산하는 유의사항 (막지 않고 경고만 표시)
  const manualWarnings = useMemo(() => {
    if (!isManualMode || !generated) return [];
    const result: string[] = [];
    const nameById = new Map(players.map((p) => [p.roomParticipantId, p.name]));

    // 같은 라운드 중복 배정 (한 선수가 같은 라운드 여러 코트/슬롯에 배정)
    const byRound = new Map<number, Map<string, number>>();
    for (const m of generated) {
      const countMap = byRound.get(m.roundNo) ?? new Map<string, number>();
      for (const p of [...m.team1, ...m.team2]) {
        countMap.set(p.roomParticipantId, (countMap.get(p.roomParticipantId) ?? 0) + 1);
      }
      byRound.set(m.roundNo, countMap);
    }
    for (const [roundNo, countMap] of [...byRound.entries()].sort((a, b) => a[0] - b[0])) {
      for (const [id, count] of countMap) {
        if (count > 1) {
          result.push(`R${roundNo}: ${nameById.get(id) ?? id}님이 같은 라운드에 ${count}번 중복 배정되어 있습니다.`);
        }
      }
    }

    // 연속 출전 (MAX_CONSECUTIVE_PLAY 초과)
    const notesByMatch = computeConsecutivePlayNotes(generated.filter((m) => m.team1.length > 0 || m.team2.length > 0));
    for (const [match, notes] of notesByMatch) {
      for (const note of notes) {
        result.push(`R${match.roundNo}: ${note.names.join(", ")}님이 ${note.consecutiveCount}경기 연속 출전 중입니다.`);
      }
    }

    // 경기 수 편차
    const statsMap = new Map<string, number>();
    for (const m of generated) {
      for (const p of [...m.team1, ...m.team2]) {
        statsMap.set(p.roomParticipantId, (statsMap.get(p.roomParticipantId) ?? 0) + 1);
      }
    }
    const counts = players.map((p) => statsMap.get(p.roomParticipantId) ?? 0);
    if (counts.length > 0) {
      const max = Math.max(...counts);
      const min = Math.min(...counts);
      if (max - min > 1) {
        const maxNames = players.filter((p) => (statsMap.get(p.roomParticipantId) ?? 0) === max).map((p) => p.name);
        const minNames = players.filter((p) => (statsMap.get(p.roomParticipantId) ?? 0) === min).map((p) => p.name);
        result.push(
          `경기 수 편차가 ${max - min}경기입니다 (최다 ${max}경기: ${maxNames.join(", ")} / 최소 ${min}경기: ${minNames.join(", ")}).`
        );
      }
    }

    return result;
  }, [isManualMode, generated, players]);

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
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-600">실제 대진표 시작 시각</span>
          <select
            aria-label="시작 시각 - 시"
            value={effectiveStartTime.split(":")[0]}
            onChange={(e) => {
              const next = `${e.target.value}:${effectiveStartTime.split(":")[1]}`;
              setEffectiveStartTime(next);
              handleGenerate(undefined, next);
            }}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h}시
              </option>
            ))}
          </select>
          <select
            aria-label="시작 시각 - 분"
            value={effectiveStartTime.split(":")[1]}
            onChange={(e) => {
              const next = `${effectiveStartTime.split(":")[0]}:${e.target.value}`;
              setEffectiveStartTime(next);
              handleGenerate(undefined, next);
            }}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
          >
            {MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}분
              </option>
            ))}
          </select>
          {isRescheduled && (
            <span className="text-xs text-amber-700">
              코트 예약 시간({room.startTime.slice(0, 5)}~{room.endTime.slice(0, 5)})은 그대로 두고, 몸풀기 없이 이
              시각부터 바로 경기를 시작하는 대진표로 다시 짭니다.
            </span>
          )}
        </div>
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
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={selectedTypes.size === 0 || courts.length === 0 || slotsPerCourt === 0}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            대진표 생성 (랜덤)
          </button>
          <button
            type="button"
            onClick={handleStartManual}
            disabled={courts.length === 0 || slotsPerCourt === 0}
            className="rounded-md border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            빈 틀로 시작 (수동 편성)
          </button>
          <span className="text-xs text-zinc-500">
            {isManualMode ? "코트/라운드별로 경기 종류와 선수를 직접 선택하세요" : "다시 랜덤으로 돌리려면 선택해주세요"}
          </span>
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

      {isManualMode && manualWarnings.length > 0 && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          <p className="mb-1 font-medium">유의사항 (저장을 막지는 않습니다)</p>
          <ul className="list-disc pl-4">
            {manualWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {isManualMode && incompleteManualSlots.length > 0 && (
        <div className="rounded-md bg-zinc-100 p-3 text-sm text-zinc-600">
          아직 선수가 다 채워지지 않은 경기 {incompleteManualSlots.length}개는 저장 시 제외됩니다.
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
                  {sortedRestingPlayersByRound.map(({ roundNo, players: restingPlayers }) => {
                    const maleResting = restingPlayers.filter((p) => p.gender === "male");
                    const femaleResting = restingPlayers.filter((p) => p.gender === "female");
                    return (
                      <li key={roundNo} className="flex items-start gap-3 py-2">
                        <span className="w-12 shrink-0 text-zinc-400">R{roundNo}</span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          {maleResting.length > 0 && (
                            <span className={`truncate whitespace-nowrap ${GENDER_TEXT_COLOR.male}`}>
                              {maleResting.map((p, i) => (
                                <span key={p.roomParticipantId}>
                                  {i > 0 && " · "}
                                  {p.name}
                                </span>
                              ))}
                            </span>
                          )}
                          {femaleResting.length > 0 && (
                            <span className={`truncate whitespace-nowrap ${GENDER_TEXT_COLOR.female}`}>
                              {femaleResting.map((p, i) => (
                                <span key={p.roomParticipantId}>
                                  {i > 0 && " · "}
                                  {p.name}
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

          <div className="flex flex-col gap-4">
            {courts.map((court, idx) => {
              const rows: Array<
                | { kind: "match"; roundNo: number; match: GeneratedMatch }
                | { kind: "free"; roundNo: number }
              > = [
                ...(matchesByCourt.get(idx) ?? []).map((m) => ({ kind: "match" as const, roundNo: m.roundNo, match: m })),
                ...(freeSlotsByCourt.get(idx) ?? []).map((s) => ({ kind: "free" as const, roundNo: s.roundNo })),
              ].sort((a, b) => a.roundNo - b.roundNo);

              const warmup =
                effectiveWarmupMinutes > 0
                  ? calcWarmupTimeRange({ startTime: effectiveStartTime, warmupMinutes: effectiveWarmupMinutes })
                  : null;

              const wrapup =
                room.fairnessMode === "tournament" && room.wrapupMinutes > 0 && slotsPerCourt > 0
                  ? calcWrapupTimeRange({
                      startTime: effectiveStartTime,
                      minutesPerMatch: room.minutesPerMatch,
                      breakMinutes: room.breakMinutes,
                      warmupMinutes: effectiveWarmupMinutes,
                      wrapupMinutes: room.wrapupMinutes,
                      lastRoundNo: slotsPerCourt,
                    })
                  : null;

              return (
                <div key={court.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                  <h3 className="mb-2 font-semibold text-zinc-800">코트 {court.name}</h3>
                  <ul className="flex flex-col divide-y divide-zinc-100">
                    {warmup && <TimeBadgeRow label="몸풀기" start={warmup.start} end={warmup.end} />}
                    {rows.map((row, i) =>
                      row.kind === "match" ? (
                        <MatchRow
                          key={i}
                          match={row.match}
                          timeLabel={roundTimeLabel(row.roundNo)}
                          editable={isManualMode}
                          availableTypes={availableMatchTypes}
                          players={players}
                          onTypeChange={(type) => handleManualTypeChange(row.match.courtIndex, row.match.roundNo, type)}
                          onPlayerChange={(team, slotIdx, id) =>
                            handleManualPlayerChange(row.match.courtIndex, row.match.roundNo, team, slotIdx, id)
                          }
                        />
                      ) : (
                        <FreePracticeRow key={i} roundNo={row.roundNo} timeLabel={roundTimeLabel(row.roundNo)} />
                      )
                    )}
                    {wrapup && (
                      <TimeBadgeRow
                        label="대회 마무리 (시상식 등)"
                        start={wrapup.start}
                        end={wrapup.end}
                        emphasis
                      />
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
            {saveSuccess && (
              <Link
                href={`/rooms/${roomId}`}
                className="rounded-md border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
              >
                방 조회하러 가기
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MatchRow({
  match,
  timeLabel,
  editable,
  availableTypes,
  players,
  onTypeChange,
  onPlayerChange,
}: {
  match: GeneratedMatch;
  timeLabel: string;
  editable?: boolean;
  availableTypes?: MatchType[];
  players?: BracketPlayer[];
  onTypeChange?: (type: MatchType) => void;
  onPlayerChange?: (team: 1 | 2, slotIdx: number, roomParticipantId: string) => void;
}) {
  const t1sum = match.team1.reduce((s, p) => s + GRADE_SCORE[p.grade], 0);
  const t2sum = match.team2.reduce((s, p) => s + GRADE_SCORE[p.grade], 0);

  if (editable && availableTypes && players && onTypeChange && onPlayerChange) {
    const perTeam = playersPerTeam(match.matchType);
    return (
      <li className="flex flex-col gap-2 py-2 text-xs sm:text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-8 shrink-0 text-[11px] text-zinc-400 sm:w-16 sm:text-sm">R{match.roundNo}</span>
          <span className="shrink-0 whitespace-nowrap text-[11px] text-zinc-400 sm:text-xs">{timeLabel}</span>
          <select
            aria-label="경기 종류"
            value={match.matchType}
            onChange={(e) => onTypeChange(e.target.value as MatchType)}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs sm:text-sm"
          >
            {availableTypes.map((t) => (
              <option key={t} value={t}>
                {MATCH_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-zinc-400 sm:text-xs">
            페어 점수 {t1sum} : {t2sum}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TeamSlots
            team={1}
            perTeam={perTeam}
            current={match.team1}
            allPlayers={players}
            onChange={(slotIdx, id) => onPlayerChange(1, slotIdx, id)}
          />
          <span className="text-xs text-zinc-400">vs</span>
          <TeamSlots
            team={2}
            perTeam={perTeam}
            current={match.team2}
            allPlayers={players}
            onChange={(slotIdx, id) => onPlayerChange(2, slotIdx, id)}
          />
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col py-2 text-xs sm:text-sm">
      <div className="flex items-center gap-0.5 sm:gap-2">
        <span className="w-5 shrink-0 text-[11px] text-zinc-400 sm:w-16 sm:text-sm">R{match.roundNo}</span>
        <span className="w-[4.7rem] shrink-0 whitespace-nowrap text-[11px] text-zinc-400 sm:w-28 sm:text-xs">
          {timeLabel}
        </span>
        <span
          className={`shrink-0 whitespace-nowrap rounded-full px-1 py-0.5 text-center text-[10px] sm:w-20 sm:px-2 sm:text-xs ${MATCH_TYPE_BADGE[match.matchType]}`}
        >
          <span className="sm:hidden">{MATCH_TYPE_LABEL_SHORT[match.matchType]}</span>
          <span className="hidden sm:inline">{MATCH_TYPE_LABEL[match.matchType]}</span>
        </span>
        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-right text-zinc-800">
          {match.team1.map((p, i) => (
            <span key={p.roomParticipantId}>
              {i > 0 && " · "}
              <span className={GENDER_TEXT_COLOR[p.gender]}>{p.name}</span>
              {`(${p.grade})`}
            </span>
          ))}
        </span>
        <span className="mx-0.5 shrink-0 text-[10px] text-zinc-400 sm:mx-2 sm:text-xs">
          <span className="sm:hidden">
            {t1sum}:{t2sum}
          </span>
          <span className="hidden sm:inline">
            페어 점수 {t1sum} : {t2sum}
          </span>
        </span>
        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-zinc-800">
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

function TeamSlots({
  team,
  perTeam,
  current,
  allPlayers,
  onChange,
}: {
  team: 1 | 2;
  perTeam: number;
  current: BracketPlayer[];
  allPlayers: BracketPlayer[];
  onChange: (slotIdx: number, roomParticipantId: string) => void;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {Array.from({ length: perTeam }, (_, slotIdx) => {
        const selected = current[slotIdx]?.roomParticipantId ?? "";
        return (
          <select
            key={slotIdx}
            aria-label={`팀${team} 선수 ${slotIdx + 1}`}
            value={selected}
            onChange={(e) => onChange(slotIdx, e.target.value)}
            className="min-w-0 max-w-[7rem] rounded-md border border-zinc-300 px-1.5 py-1 text-xs sm:max-w-none sm:text-sm"
          >
            <option value="">선수 선택</option>
            {allPlayers.map((p) => (
              <option key={p.roomParticipantId} value={p.roomParticipantId}>
                {p.name}
                {p.isGuest ? " (게스트)" : ""}
              </option>
            ))}
          </select>
        );
      })}
    </span>
  );
}

function FreePracticeRow({ roundNo, timeLabel }: { roundNo: number; timeLabel: string }) {
  return (
    <li className="flex items-center gap-0.5 py-2 text-xs sm:gap-2 sm:text-sm">
      <span className="w-5 shrink-0 text-[11px] text-zinc-400 sm:w-16 sm:text-sm">R{roundNo}</span>
      <span className="w-[4.7rem] shrink-0 whitespace-nowrap text-[11px] text-zinc-400 sm:w-28 sm:text-xs">
        {timeLabel}
      </span>
      <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-center text-[11px] text-zinc-500 sm:px-2 sm:text-xs">
        자유 랠리 연습
      </span>
    </li>
  );
}

function TimeBadgeRow({
  label,
  start,
  end,
  emphasis,
}: {
  label: string;
  start: string;
  end: string;
  emphasis?: boolean;
}) {
  return (
    <li className="flex items-center py-2 text-sm">
      <span className="w-16 shrink-0 text-zinc-400"></span>
      <span className="w-28 shrink-0 text-xs text-zinc-400">
        {start}~{end}
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-center text-xs ${
          emphasis ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-500"
        }`}
      >
        {label}
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
