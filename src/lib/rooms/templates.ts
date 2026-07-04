export type RoomTemplateKey = "tuesday" | "thursday" | "saturday" | "custom";

export type RoomTemplateDefaults = {
  title: string;
  location: string;
  isIndoor: boolean;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  courtOptions: string[][]; // pick one of these court-name sets
};

export const ROOM_TEMPLATES: Record<Exclude<RoomTemplateKey, "custom">, RoomTemplateDefaults> = {
  tuesday: {
    title: "화요일 정기모임",
    location: "장현 배수지",
    isIndoor: false,
    startTime: "19:00",
    endTime: "23:00",
    courtOptions: [
      ["A", "B"],
      ["C", "D"],
    ],
  },
  saturday: {
    title: "토요일 정기모임",
    location: "장현 배수지",
    isIndoor: false,
    startTime: "11:00",
    endTime: "15:00",
    courtOptions: [
      ["A", "B"],
      ["C", "D"],
    ],
  },
  thursday: {
    title: "목요일 정기모임",
    location: "구리 왕숙체육공원",
    isIndoor: false,
    startTime: "19:00",
    endTime: "22:00",
    // 1~17번 코트 중 두 코트를 랜덤 배정
    courtOptions: Array.from({ length: 17 }, (_, i) => i + 1).flatMap((a, i, arr) =>
      arr.slice(i + 1).map((b) => [`${a}번`, `${b}번`])
    ),
  },
};

export function pickRandomCourtSet(template: Exclude<RoomTemplateKey, "custom">): string[] {
  const options = ROOM_TEMPLATES[template].courtOptions;
  return options[Math.floor(Math.random() * options.length)];
}

export const TEMPLATE_LABEL: Record<RoomTemplateKey, string> = {
  tuesday: "화요일 정기모임",
  thursday: "목요일 정기모임",
  saturday: "토요일 정기모임",
  custom: "커스텀 일정",
};
