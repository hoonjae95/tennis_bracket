export type MatchType =
  | "mens_doubles"
  | "womens_doubles"
  | "mixed_doubles"
  | "mixed_any_doubles"
  | "mens_singles"
  | "womens_singles";

export type Gender = "male" | "female";
export type Grade = "A" | "B" | "C" | "D";
export type CourtType = "artificial_grass" | "hard_court" | "clay_court";
// normal: 참가자별 경기수 차이 최대 1 허용, tournament: 성별 그룹별 경기수를 최대한 동일하게 강제
export type FairnessMode = "normal" | "tournament";

export type BracketPlayer = {
  roomParticipantId: string;
  name: string;
  gender: Gender;
  grade: Grade; // effective grade (override applied), defaults to 'C' if unset
};

// 비고: 같은 연속 출전 횟수를 겪는 선수들을 묶어서 표시하기 위한 그룹
export type ConsecutivePlayNote = {
  names: string[];
  consecutiveCount: number; // 이번 라운드까지 포함한 연속 출전 라운드 수
};

export type GeneratedMatch = {
  courtIndex: number; // 0-based index into courts[]
  roundNo: number; // 1-based order within the court
  matchType: MatchType;
  team1: BracketPlayer[];
  team2: BracketPlayer[];
  note?: ConsecutivePlayNote[]; // 비고: 연속 출전 등 조건 미충족으로 강행 배정된 경우의 안내 정보
};

export type BracketGenerationInput = {
  players: BracketPlayer[];
  courtCount: number;
  slotsPerCourt: number;
  enabledMatchTypes: MatchType[];
  fairnessMode?: FairnessMode; // 기본값 "normal"
};

// 참가 인원이 부족해 특정 라운드에 경기를 배정할 수 없는 코트: 자유 랠리 연습으로 안내
export type FreePracticeSlot = {
  courtIndex: number;
  roundNo: number;
};

// 라운드별로 실제 쉬는 선수 명단
export type RestingPlayers = {
  roundNo: number;
  players: BracketPlayer[];
};

export type BracketGenerationResult = {
  matches: GeneratedMatch[];
  freePracticeSlots: FreePracticeSlot[];
  restingPlayersByRound: RestingPlayers[];
  playerStats: Map<string, { gamesPlayed: number }>;
  warnings: string[];
};

export const GRADE_SCORE: Record<Grade, number> = { A: 3, B: 2, C: 1, D: 0 };

export const MATCH_TYPE_LABEL: Record<MatchType, string> = {
  mens_doubles: "남자 복식",
  womens_doubles: "여자 복식",
  mixed_doubles: "혼합 복식",
  mixed_any_doubles: "잡복식",
  mens_singles: "남자 단식",
  womens_singles: "여자 단식",
};

export const MATCH_TYPE_BADGE: Record<MatchType, string> = {
  mens_doubles: "bg-sky-100 text-sky-800",
  womens_doubles: "bg-pink-100 text-pink-800",
  mixed_doubles: "bg-violet-100 text-violet-800",
  mixed_any_doubles: "bg-amber-100 text-amber-800",
  mens_singles: "bg-sky-50 text-sky-700",
  womens_singles: "bg-pink-50 text-pink-700",
};

export const COURT_TYPE_LABEL: Record<CourtType, string> = {
  artificial_grass: "인조잔디",
  hard_court: "하드코트",
  clay_court: "클레이 코트",
};

// 5분 단위, 20~40분
export const MATCH_MINUTES_OPTIONS = [20, 25, 30, 35, 40] as const;
// 0~15분 (경기 사이 휴식, 0은 휴식 없음)
export const BREAK_MINUTES_OPTIONS = [0, 5, 10, 15] as const;
// 5분 단위, 10~40분 (몸풀기)
export const WARMUP_MINUTES_OPTIONS = [10, 15, 20, 25, 30, 35, 40] as const;
// 0~15분 (대회 마무리/시상식 등 종료 직전 버퍼, 0은 사용 안 함)
export const WRAPUP_MINUTES_OPTIONS = [0, 5, 10, 15] as const;

// 세트당 게임 수에 따른 추천 경기 시간
export const RECOMMENDED_MINUTES_BY_GAMES: Record<number, number> = {
  4: 20,
  5: 25,
  6: 30,
};

export const GENDER_TEXT_COLOR: Record<Gender, string> = {
  male: "text-blue-700",
  female: "text-pink-600",
};

export function isDoubles(type: MatchType): boolean {
  return type !== "mens_singles" && type !== "womens_singles";
}

export function playersPerTeam(type: MatchType): number {
  return isDoubles(type) ? 2 : 1;
}

// 성별별 최소 인원 (남/여). null이면 해당 성별 제약 없음(잡복식 등 성별 무관).
export function minGenderCounts(type: MatchType): { male: number; female: number } {
  const needed = playersPerTeam(type) * 2;
  if (type === "mens_doubles" || type === "mens_singles") return { male: needed, female: 0 };
  if (type === "womens_doubles" || type === "womens_singles") return { male: 0, female: needed };
  if (type === "mixed_doubles") return { male: needed / 2, female: needed / 2 };
  return { male: 0, female: 0 };
}
