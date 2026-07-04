export type MatchType =
  | "mens_doubles"
  | "womens_doubles"
  | "mixed_doubles"
  | "mixed_any_doubles"
  | "mens_singles"
  | "womens_singles";

export type Gender = "male" | "female";
export type Grade = "A" | "B" | "C";

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

export const GRADE_SCORE: Record<Grade, number> = { A: 3, B: 2, C: 1 };

export const MATCH_TYPE_LABEL: Record<MatchType, string> = {
  mens_doubles: "남자 복식",
  womens_doubles: "여자 복식",
  mixed_doubles: "혼합 복식",
  mixed_any_doubles: "잡복식",
  mens_singles: "남자 단식",
  womens_singles: "여자 단식",
};

export function isDoubles(type: MatchType): boolean {
  return type !== "mens_singles" && type !== "womens_singles";
}

export function playersPerTeam(type: MatchType): number {
  return isDoubles(type) ? 2 : 1;
}
