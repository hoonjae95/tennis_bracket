export function calcSlotsPerCourt(params: {
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  minutesPerMatch: number;
  breakMinutes: number;
  warmupMinutes?: number;
  wrapupMinutes?: number;
}): number {
  const { startTime, endTime, minutesPerMatch, breakMinutes, warmupMinutes = 0, wrapupMinutes = 0 } = params;

  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const totalMinutes = eh * 60 + em - (sh * 60 + sm) - warmupMinutes - wrapupMinutes;
  if (totalMinutes <= 0 || minutesPerMatch <= 0) return 0;

  const slotLength = minutesPerMatch + breakMinutes;
  // last match in a court doesn't need a trailing break
  return Math.floor((totalMinutes + breakMinutes) / slotLength);
}

function minutesToHHmm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 몸풀기 시간대: 시작 시각 ~ 시작 시각 + 몸풀기 시간
export function calcWarmupTimeRange(params: { startTime: string; warmupMinutes: number }): {
  start: string;
  end: string;
} {
  const { startTime, warmupMinutes } = params;
  const [sh, sm] = startTime.split(":").map(Number);
  const startMinutes = sh * 60 + sm;
  return { start: minutesToHHmm(startMinutes), end: minutesToHHmm(startMinutes + warmupMinutes) };
}

// 라운드(1-based)의 시작~종료 시각. 몸풀기 시간 이후 라운드마다 (경기시간 + 휴식시간)씩 진행.
export function calcRoundTimeRange(params: {
  startTime: string; // HH:mm
  minutesPerMatch: number;
  breakMinutes: number;
  warmupMinutes?: number;
  roundNo: number; // 1-based
}): { start: string; end: string } {
  const { startTime, minutesPerMatch, breakMinutes, warmupMinutes = 0, roundNo } = params;
  const [sh, sm] = startTime.split(":").map(Number);
  const baseMinutes = sh * 60 + sm + warmupMinutes;
  const slotLength = minutesPerMatch + breakMinutes;
  const roundStart = baseMinutes + (roundNo - 1) * slotLength;
  const roundEnd = roundStart + minutesPerMatch;
  return { start: minutesToHHmm(roundStart), end: minutesToHHmm(roundEnd) };
}

// 대회 마무리(시상식 등) 시간대: 마지막 라운드 종료 시각 ~ + 마무리 시간
export function calcWrapupTimeRange(params: {
  startTime: string;
  minutesPerMatch: number;
  breakMinutes: number;
  warmupMinutes?: number;
  wrapupMinutes: number;
  lastRoundNo: number;
}): { start: string; end: string } {
  const { wrapupMinutes, lastRoundNo, ...roundParams } = params;
  const { end } = calcRoundTimeRange({ ...roundParams, roundNo: lastRoundNo });
  const [eh, em] = end.split(":").map(Number);
  const endMinutes = eh * 60 + em;
  return { start: end, end: minutesToHHmm(endMinutes + wrapupMinutes) };
}
