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

export type BracketPlayer = {
  roomParticipantId: string;
  name: string;
  gender: Gender;
  grade: Grade; // effective grade (override applied), defaults to 'C' if unset
};

export type GeneratedMatch = {
  courtIndex: number; // 0-based index into courts[]
  roundNo: number; // 1-based order within the court
  matchType: MatchType;
  team1: BracketPlayer[];
  team2: BracketPlayer[];
};

export type BracketGenerationInput = {
  players: BracketPlayer[];
  courtCount: number;
  slotsPerCourt: number;
  enabledMatchTypes: MatchType[];
};

export type BracketGenerationResult = {
  matches: GeneratedMatch[];
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
// 5분 단위, 5~15분 (경기 사이 휴식)
export const BREAK_MINUTES_OPTIONS = [5, 10, 15] as const;
// 5분 단위, 20~40분 (몸풀기)
export const WARMUP_MINUTES_OPTIONS = [20, 25, 30, 35, 40] as const;

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
