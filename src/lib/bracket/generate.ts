import {
  type BracketGenerationInput,
  type BracketGenerationResult,
  type BracketPlayer,
  type ConsecutivePlayNote,
  type FreePracticeSlot,
  type GeneratedMatch,
  type MatchType,
  type RestingPlayers,
  GRADE_SCORE,
  playersPerTeam,
} from "@/lib/bracket/types";

// 성별 제약 없이 아무나 짝지을 수 있는 매치타입: 인원 부족 시 자동 폴백용
const GENDER_FREE_FALLBACK_TYPE: MatchType = "mixed_any_doubles";

const MAX_BALANCE_DIFF = 2; // 팀 간 등급 점수 합 차이 허용 한도
const MAX_CONSECUTIVE_PLAY = 2; // 연속 출전 최대 (3연속 금지)
const MAX_CONSECUTIVE_REST = 2; // 연속 휴식 최대 (3연속 금지)

type PlayerState = {
  player: BracketPlayer;
  gamesPlayed: number;
  consecutivePlay: number; // 직전까지 연속으로 뛴 라운드 수
  consecutiveRest: number; // 직전까지 연속으로 쉰 라운드 수
};

function eligiblePlayersFor(
  type: MatchType,
  states: PlayerState[]
): PlayerState[] {
  if (type === "mens_doubles" || type === "mens_singles") {
    return states.filter((s) => s.player.gender === "male");
  }
  if (type === "womens_doubles" || type === "womens_singles") {
    return states.filter((s) => s.player.gender === "female");
  }
  // mixed_doubles / mixed_any_doubles: anyone
  return states;
}

function forcedMustPlay(states: PlayerState[]): Set<string> {
  // 3연속 휴식 방지: 이미 2연속 쉰 사람은 이번 라운드에 반드시 뛰어야 함
  return new Set(
    states
      .filter((s) => s.consecutiveRest >= MAX_CONSECUTIVE_REST)
      .map((s) => s.player.roomParticipantId)
  );
}

function forcedMustRest(states: PlayerState[]): Set<string> {
  // 3연속 출전 방지: 이미 2연속 뛴 사람은 이번 라운드에 반드시 쉬어야 함
  return new Set(
    states
      .filter((s) => s.consecutivePlay >= MAX_CONSECUTIVE_PLAY)
      .map((s) => s.player.roomParticipantId)
  );
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...rest] = arr;
  const withHead = combinations(rest, k - 1).map((c) => [head, ...c]);
  const withoutHead = combinations(rest, k);
  return [...withHead, ...withoutHead];
}

function gradeSum(players: BracketPlayer[]): number {
  return players.reduce((sum, p) => sum + GRADE_SCORE[p.grade], 0);
}

/**
 * Pick the best team1/team2 split from a pool of candidates for a single match,
 * prioritizing (1) fewer games played so far, (2) grade balance within MAX_BALANCE_DIFF,
 * (3) mixed_doubles gender split (1 male + 1 female per team when possible).
 */
function buildMatch(
  type: MatchType,
  pool: PlayerState[],
  mustPlayIds: Set<string>
): { team1: PlayerState[]; team2: PlayerState[] } | null {
  const perTeam = playersPerTeam(type);
  const totalNeeded = perTeam * 2;
  if (pool.length < totalNeeded) return null;

  // Sort pool: must-play first, then fewer games played, then randomize ties
  const sorted = [...pool].sort((a, b) => {
    const aMust = mustPlayIds.has(a.player.roomParticipantId) ? 0 : 1;
    const bMust = mustPlayIds.has(b.player.roomParticipantId) ? 0 : 1;
    if (aMust !== bMust) return aMust - bMust;
    if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;
    return Math.random() - 0.5;
  });

  // Candidate pool: must include every player tied at the lowest gamesPlayed count
  // (so nobody gets a 2nd game while someone else is still waiting for their 1st),
  // plus a bit more headroom to find a grade-balanced split.
  const minGamesInPool = sorted.length > 0 ? sorted[0].gamesPlayed : 0;
  const tiedAtMinCount = sorted.filter(
    (s) => s.gamesPlayed === minGamesInPool || mustPlayIds.has(s.player.roomParticipantId)
  ).length;
  const candidateSlice = sorted.slice(
    0,
    Math.min(sorted.length, Math.max(totalNeeded * 3, 8, tiedAtMinCount))
  );

  let best: { team1: PlayerState[]; team2: PlayerState[]; diff: number; priorityScore: number } | null =
    null;

  const combosForMatch = combinations(candidateSlice, totalNeeded);
  for (const group of combosForMatch) {
    const mustPlayIncluded = candidateSlice
      .filter((s) => mustPlayIds.has(s.player.roomParticipantId))
      .every((s) => group.includes(s) || !candidateSlice.includes(s));

    const teamSplits = splitIntoTeams(group, perTeam, type);
    for (const { team1, team2 } of teamSplits) {
      const diff = Math.abs(
        gradeSum(team1.map((s) => s.player)) - gradeSum(team2.map((s) => s.player))
      );
      if (diff > MAX_BALANCE_DIFF) continue;

      const priorityScore =
        group.reduce((sum, s) => sum + s.gamesPlayed, 0) * 10 +
        (mustPlayIncluded ? 0 : 100) +
        diff;

      if (!best || priorityScore < best.priorityScore) {
        best = { team1, team2, diff, priorityScore };
      }
    }
  }

  if (best) return { team1: best.team1, team2: best.team2 };

  // Relax must-play/balance constraints if nothing satisfied them (small pools)
  const fallbackGroup = sorted.slice(0, totalNeeded);
  const fallbackSplits = splitIntoTeams(fallbackGroup, perTeam, type);
  if (fallbackSplits.length === 0) return null;
  fallbackSplits.sort((a, b) => {
    const diffA = Math.abs(gradeSum(a.team1.map((s) => s.player)) - gradeSum(a.team2.map((s) => s.player)));
    const diffB = Math.abs(gradeSum(b.team1.map((s) => s.player)) - gradeSum(b.team2.map((s) => s.player)));
    return diffA - diffB;
  });
  return fallbackSplits[0];
}

function splitIntoTeams(
  group: PlayerState[],
  perTeam: number,
  type: MatchType
): Array<{ team1: PlayerState[]; team2: PlayerState[] }> {
  if (group.length !== perTeam * 2) return [];

  if (perTeam === 1) {
    return [{ team1: [group[0]], team2: [group[1]] }];
  }

  // doubles: try all ways to split 4 into 2+2
  const results: Array<{ team1: PlayerState[]; team2: PlayerState[] }> = [];
  const team1Combos = combinations(group, perTeam);
  for (const team1 of team1Combos) {
    const team2 = group.filter((s) => !team1.includes(s));
    if (team2.length !== perTeam) continue;

    if (type === "mixed_doubles") {
      // require 1 male + 1 female per team
      const t1Genders = team1.map((s) => s.player.gender).sort();
      const t2Genders = team2.map((s) => s.player.gender).sort();
      const valid =
        t1Genders.join(",") === "female,male" && t2Genders.join(",") === "female,male";
      if (!valid) continue;
    }

    results.push({ team1, team2 });
  }
  return results;
}

export function generateBracket(input: BracketGenerationInput): BracketGenerationResult {
  const { players, courtCount, slotsPerCourt, enabledMatchTypes } = input;
  const warnings: string[] = [];

  if (enabledMatchTypes.length === 0) {
    return {
      matches: [],
      freePracticeSlots: [],
      restingPlayersByRound: [],
      playerStats: new Map(),
      warnings: ["경기 종류를 1개 이상 선택해주세요."],
    };
  }

  // 매치타입별 성별 무관 폴백을 시도할 때, 최소 필요 인원 기준으로 실제 동시에 경기 가능한 코트 수를 계산.
  // 참가 인원이 코트 수 x 최소인원보다 적으면, 그만큼의 코트는 매 라운드 돌아가며 자유 랠리 연습 코트가 된다.
  const minTotalNeeded = Math.min(...enabledMatchTypes.map((t) => playersPerTeam(t) * 2));
  const activeCourtsCount = Math.max(0, Math.min(courtCount, Math.floor(players.length / minTotalNeeded)));
  const freePracticeCourtsCount = courtCount - activeCourtsCount;

  if (freePracticeCourtsCount > 0) {
    warnings.push(
      `참가 인원(${players.length}명)이 코트 ${courtCount}개를 모두 채우기엔 부족해, 매 라운드 ${freePracticeCourtsCount}개 코트가 자유 랠리 연습으로 배정됩니다.`
    );
  }

  const states: PlayerState[] = players.map((p) => ({
    player: p,
    gamesPlayed: 0,
    consecutivePlay: 0,
    consecutiveRest: 0,
  }));

  const stateById = new Map(states.map((s) => [s.player.roomParticipantId, s]));
  const matches: GeneratedMatch[] = [];
  const freePracticeSlots: FreePracticeSlot[] = [];
  const restingPlayersByRound: RestingPlayers[] = [];

  for (let round = 1; round <= slotsPerCourt; round++) {
    const playingThisRound = new Set<string>();

    // 코트를 라운드마다 돌아가며 자유 랠리 연습 코트로 배정 (round-robin)
    const freeCourtsThisRound = new Set<number>();
    for (let k = 0; k < freePracticeCourtsCount; k++) {
      freeCourtsThisRound.add((round - 1 + k) % courtCount);
    }

    for (let court = 0; court < courtCount; court++) {
      if (freeCourtsThisRound.has(court)) {
        freePracticeSlots.push({ courtIndex: court, roundNo: round });
        continue;
      }

      const mustPlay = forcedMustPlay(states);
      const mustRest = forcedMustRest(states);

      const notPlayingYet = (s: PlayerState) => !playingThisRound.has(s.player.roomParticipantId);

      // pool = not already playing this round, not forced to rest
      const availablePool = states.filter((s) => notPlayingYet(s) && !mustRest.has(s.player.roomParticipantId));

      // pick a match type: prefer one whose eligible pool (accounting for must-play backlog) is largest relative to need
      let picked: { type: MatchType; team1: PlayerState[]; team2: PlayerState[] } | null = null;

      const shuffledTypes = [...enabledMatchTypes].sort(() => Math.random() - 0.5);
      for (const type of shuffledTypes) {
        const eligible = eligiblePlayersFor(type, availablePool);
        const built = buildMatch(type, eligible, mustPlay);
        if (built) {
          picked = { type, ...built };
          break;
        }
      }

      // 조건(3연속 출전 금지)을 지키면 대진을 만들 수 없는 경우:
      // 그냥 포기하지 않고, 3연속 출전 제한을 풀어서라도 경기를 배정한다.
      // 대신 어떤 선수가 그 제약 때문에 강행 배정됐는지, 실제 몇 연속째인지 비고로 남긴다.
      let forced: PlayerState[] = [];
      if (!picked) {
        const relaxedPool = states.filter(notPlayingYet);
        for (const type of shuffledTypes) {
          const eligible = eligiblePlayersFor(type, relaxedPool);
          const built = buildMatch(type, eligible, mustPlay);
          if (built) {
            picked = { type, ...built };
            forced = [...built.team1, ...built.team2].filter((s) =>
              mustRest.has(s.player.roomParticipantId)
            );
            break;
          }
        }
      }

      // 특정 성별이 부족해 선택된 매치타입으로는 대진을 못 만드는 경우:
      // 성별 무관 잡복식으로 자동 전환해서라도 코트를 채운다.
      if (!picked && !enabledMatchTypes.includes(GENDER_FREE_FALLBACK_TYPE)) {
        const relaxedPool = states.filter(notPlayingYet);
        const built =
          buildMatch(GENDER_FREE_FALLBACK_TYPE, availablePool, mustPlay) ??
          buildMatch(GENDER_FREE_FALLBACK_TYPE, relaxedPool, mustPlay);
        if (built) {
          picked = { type: GENDER_FREE_FALLBACK_TYPE, ...built };
          forced = [...built.team1, ...built.team2].filter((s) =>
            mustRest.has(s.player.roomParticipantId)
          );
        }
      }

      if (!picked) {
        warnings.push(`${round}라운드 코트${court + 1}: 조건에 맞는 대진을 만들지 못했습니다.`);
        continue;
      }

      // consecutivePlay는 "이전까지" 연속 출전 라운드 수이므로, 이번 라운드까지 포함하면 +1
      const countByName = new Map<number, string[]>();
      for (const s of forced) {
        const count = s.consecutivePlay + 1;
        const names = countByName.get(count) ?? [];
        names.push(s.player.name);
        countByName.set(count, names);
      }
      const forcedNote: ConsecutivePlayNote[] = Array.from(countByName.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([consecutiveCount, names]) => ({ names, consecutiveCount }));

      matches.push({
        courtIndex: court,
        roundNo: round,
        matchType: picked.type,
        team1: picked.team1.map((s) => s.player),
        team2: picked.team2.map((s) => s.player),
        note: forcedNote.length > 0 ? forcedNote : undefined,
      });

      for (const s of [...picked.team1, ...picked.team2]) {
        playingThisRound.add(s.player.roomParticipantId);
      }
    }

    const resting = states
      .filter((s) => !playingThisRound.has(s.player.roomParticipantId))
      .map((s) => s.player);
    if (resting.length > 0) {
      restingPlayersByRound.push({ roundNo: round, players: resting });
    }

    // update consecutive counters + games played after this round is fully assigned
    for (const s of states) {
      if (playingThisRound.has(s.player.roomParticipantId)) {
        s.gamesPlayed += 1;
        s.consecutivePlay += 1;
        s.consecutiveRest = 0;
      } else {
        s.consecutivePlay = 0;
        s.consecutiveRest += 1;
      }
    }
  }

  const playerStats = new Map(
    states.map((s) => [s.player.roomParticipantId, { gamesPlayed: s.gamesPlayed }])
  );

  // 성별 그룹별로 편차를 따로 체크 (남복/여복만 켠 경우 등 그룹 인원 차이로 인한
  // 자연스러운 총량 차이를 편차로 오인하지 않도록)
  for (const gender of ["male", "female"] as const) {
    const group = states.filter((s) => s.player.gender === gender);
    if (group.length === 0) continue;
    const counts = group.map((s) => s.gamesPlayed);
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    if (max - min > 1) {
      warnings.push(
        `${gender === "male" ? "남자" : "여자"} 선수 간 경기 수 편차가 ${max - min}게임입니다.`
      );
    }
  }

  void stateById;
  return { matches, freePracticeSlots, restingPlayersByRound, playerStats, warnings };
}
