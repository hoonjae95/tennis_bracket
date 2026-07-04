"use client";

import { useMemo, useState, useTransition } from "react";
import { generateBracket } from "@/lib/bracket/generate";
import { calcSlotsPerCourt } from "@/lib/rooms/game-calc";
import { saveBracket } from "@/lib/bracket/actions";
import {
  MATCH_TYPE_LABEL,
  GRADE_SCORE,
  type BracketPlayer,
  type GeneratedMatch,
  type MatchType,
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
  room: { startTime: string; endTime: string; minutesPerMatch: number; breakMinutes: number };
  existingMatches: ExistingMatch[];
}) {
  const [selectedTypes, setSelectedTypes] = useState<Set<MatchType>>(new Set(["mens_doubles", "womens_doubles"]));
  const [generated, setGenerated] = useState<GeneratedMatch[] | null>(
    existingMatches.length > 0 ? mapExistingToGenerated(existingMatches, courts, players) : null
  );
  const [isSaving, startSaving] = useTransition();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const slotsPerCourt = calcSlotsPerCourt({
    startTime: room.startTime,
    endTime: room.endTime,
    minutesPerMatch: room.minutesPerMatch,
    breakMinutes: room.breakMinutes,
  });

  function toggleType(type: MatchType) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function handleGenerate() {
    const result = generateBracket({
      players,
      courtCount: courts.length,
      slotsPerCourt,
      enabledMatchTypes: Array.from(selectedTypes),
    });
    setGenerated(result.matches);
    setWarnings(result.warnings);
    setSaveMessage(null);
  }

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

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-zinc-800">경기 종류 선택 (다중 선택 가능)</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_MATCH_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                selectedTypes.has(type)
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-zinc-300 text-zinc-600"
              }`}
            >
              {MATCH_TYPE_LABEL[type]}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          참가자 {players.length}명 · 코트 {courts.length}개 · 코트당 {slotsPerCourt}경기 (총{" "}
          {slotsPerCourt * courts.length}경기)
        </p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={selectedTypes.size === 0 || courts.length === 0 || slotsPerCourt === 0}
          className="mt-3 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          대진표 생성 (랜덤)
        </button>
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
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-zinc-800">선수별 참가 경기 수</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {players.map((p) => (
                <div key={p.roomParticipantId} className="flex justify-between text-zinc-700">
                  <span>{p.name}</span>
                  <span className="text-zinc-500">{statsByPlayer.get(p.roomParticipantId) ?? 0}경기</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {courts.map((court, idx) => (
              <div key={court.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                <h3 className="mb-2 font-semibold text-zinc-800">코트 {court.name}</h3>
                <ul className="flex flex-col divide-y divide-zinc-100">
                  {(matchesByCourt.get(idx) ?? []).map((m, i) => (
                    <MatchRow key={i} match={m} />
                  ))}
                </ul>
              </div>
            ))}
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

function MatchRow({ match }: { match: GeneratedMatch }) {
  const t1sum = match.team1.reduce((s, p) => s + GRADE_SCORE[p.grade], 0);
  const t2sum = match.team2.reduce((s, p) => s + GRADE_SCORE[p.grade], 0);

  return (
    <li className="flex items-center justify-between py-2 text-sm">
      <span className="w-16 shrink-0 text-zinc-400">R{match.roundNo}</span>
      <span className="w-20 shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-center text-xs text-zinc-600">
        {MATCH_TYPE_LABEL[match.matchType]}
      </span>
      <span className="flex-1 text-right text-zinc-800">
        {match.team1.map((p) => `${p.name}(${p.grade})`).join(" · ")}
      </span>
      <span className="mx-2 text-zinc-400">
        {t1sum} : {t2sum}
      </span>
      <span className="flex-1 text-zinc-800">
        {match.team2.map((p) => `${p.name}(${p.grade})`).join(" · ")}
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
