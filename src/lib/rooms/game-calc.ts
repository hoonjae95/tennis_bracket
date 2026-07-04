export function calcSlotsPerCourt(params: {
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  minutesPerMatch: number;
  breakMinutes: number;
}): number {
  const { startTime, endTime, minutesPerMatch, breakMinutes } = params;

  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const totalMinutes = eh * 60 + em - (sh * 60 + sm);
  if (totalMinutes <= 0 || minutesPerMatch <= 0) return 0;

  const slotLength = minutesPerMatch + breakMinutes;
  // last match in a court doesn't need a trailing break
  return Math.floor((totalMinutes + breakMinutes) / slotLength);
}
