"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROOM_TEMPLATES, TEMPLATE_LABEL, type RoomTemplateKey } from "@/lib/rooms/templates";
import { calcSlotsPerCourt } from "@/lib/rooms/game-calc";
import { createRoom } from "@/lib/rooms/actions";
import {
  COURT_TYPE_LABEL,
  MATCH_MINUTES_OPTIONS,
  BREAK_MINUTES_OPTIONS,
  WARMUP_MINUTES_OPTIONS,
  RECOMMENDED_MINUTES_BY_GAMES,
  MATCH_TYPE_LABEL,
  minGenderCounts,
  type CourtType,
  type MatchType,
} from "@/lib/bracket/types";
import type { Database } from "@/lib/supabase/types";

type Member = Pick<Database["public"]["Tables"]["members"]["Row"], "id" | "name" | "gender" | "grade">;
type Grade = Database["public"]["Enums"]["grade"];

const STEPS = ["일정 정보", "경기 규칙", "참가자 등록", "경기 종류", "확인"] as const;

const COURT_TYPES: CourtType[] = ["artificial_grass", "hard_court", "clay_court"];
const DOUBLES_TYPES: MatchType[] = ["mens_doubles", "womens_doubles", "mixed_doubles", "mixed_any_doubles"];
const SINGLES_TYPES: MatchType[] = ["mens_singles", "womens_singles"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function RoomWizard({ members }: { members: Member[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [template, setTemplate] = useState<RoomTemplateKey>("custom");
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(todayStr());
  const [location, setLocation] = useState("");
  const [isIndoor, setIsIndoor] = useState(false);
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("22:00");
  const [courtNamesText, setCourtNamesText] = useState("A, B");
  const [courtType, setCourtType] = useState<CourtType>("hard_court");

  // Step 2 state
  const [gamesPerSet, setGamesPerSetState] = useState(5);
  const [minutesPerMatch, setMinutesPerMatch] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [warmupMinutes, setWarmupMinutes] = useState(20);

  function setGamesPerSet(n: number) {
    setGamesPerSetState(n);
    setMinutesPerMatch(RECOMMENDED_MINUTES_BY_GAMES[n] ?? 25);
  }

  // Step 3 state (경기 종류)
  const [isDoublesRoom, setIsDoublesRoom] = useState(true);
  const [selectedMatchTypes, setSelectedMatchTypes] = useState<Set<MatchType>>(
    new Set<MatchType>(["mens_doubles", "womens_doubles"])
  );

  function toggleMatchType(type: MatchType) {
    setSelectedMatchTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function switchMatchKind(doubles: boolean) {
    setIsDoublesRoom(doubles);
    setSelectedMatchTypes(
      new Set<MatchType>(doubles ? ["mens_doubles", "womens_doubles"] : ["mens_singles"])
    );
  }

  // Step 5 state
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [gradeOverrides, setGradeOverrides] = useState<Record<string, Grade | null>>({});

  const courtNames = useMemo(
    () =>
      courtNamesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [courtNamesText]
  );

  function applyTemplate(key: RoomTemplateKey) {
    setTemplate(key);
    if (key === "custom") return;
    const t = ROOM_TEMPLATES[key];
    setTitle(t.title);
    setLocation(t.location);
    setIsIndoor(t.isIndoor);
    setStartTime(t.startTime);
    setEndTime(t.endTime);
    setCourtNamesText(t.courtOptions[0].join(", "));
  }

  const slotsPerCourt = calcSlotsPerCourt({ startTime, endTime, minutesPerMatch, breakMinutes, warmupMinutes });
  const totalMatches = slotsPerCourt * courtNames.length;

  const maleMembers = members.filter((m) => m.gender === "male");
  const femaleMembers = members.filter((m) => m.gender === "female");

  const selectedMaleCount = members.filter(
    (m) => m.gender === "male" && selectedMemberIds.has(m.id)
  ).length;
  const selectedFemaleCount = members.filter(
    (m) => m.gender === "female" && selectedMemberIds.has(m.id)
  ).length;

  function ineligibleReason(type: MatchType): string | null {
    const { male, female } = minGenderCounts(type);
    if (male > 0 && selectedMaleCount < male) return `남자 ${male}명 필요 (선택됨 ${selectedMaleCount}명)`;
    if (female > 0 && selectedFemaleCount < female) return `여자 ${female}명 필요 (선택됨 ${selectedFemaleCount}명)`;
    return null;
  }

  // 참가자 선택에 따라 더 이상 불가능해진 경기종류(예: 여자 부족으로 여자복식)는
  // 검증/제출 시 자동으로 제외한다 (버튼에 남아있던 선택을 강제로 지우지 않고 무시만 함).
  const effectiveMatchTypes = new Set(
    Array.from(selectedMatchTypes).filter((type) => !ineligibleReason(type))
  );

  function toggleMember(id: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function canProceedStep(currentStep: number): string | null {
    if (currentStep === 0) {
      if (!title.trim()) return "제목을 입력해주세요.";
      if (!location.trim()) return "장소를 입력해주세요.";
      if (courtNames.length === 0) return "코트를 1개 이상 입력해주세요.";
      if (startTime >= endTime) return "종료 시간은 시작 시간보다 늦어야 합니다.";
    }
    if (currentStep === 1) {
      if (slotsPerCourt <= 0) return "설정된 시간 안에 경기를 진행할 수 없습니다. 시간을 조정해주세요.";
    }
    if (currentStep === 2) {
      if (selectedMemberIds.size === 0) return "참가 선수를 1명 이상 선택해주세요.";
    }
    if (currentStep === 3) {
      if (effectiveMatchTypes.size === 0) return "경기 종류를 1개 이상 선택해주세요.";
    }
    return null;
  }

  function goNext() {
    const err = canProceedStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleSubmit() {
    if (selectedMemberIds.size === 0) {
      setError("참가 선수를 1명 이상 선택해주세요.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createRoom({
        title,
        template,
        eventDate,
        location,
        isIndoor,
        startTime,
        endTime,
        gamesPerSet,
        minutesPerMatch,
        breakMinutes,
        warmupMinutes,
        courtNames,
        courtType,
        matchTypes: Array.from(effectiveMatchTypes),
        participantMemberIds: Array.from(selectedMemberIds),
        gradeOverrides,
      });
      if (result.success) {
        router.push(`/admin/rooms/${result.roomId}/bracket`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex items-center gap-2 text-xs">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-1 rounded-full px-3 py-1 ${
              i === step
                ? "bg-emerald-700 text-white"
                : i < step
                ? "bg-emerald-100 text-emerald-700"
                : "bg-zinc-100 text-zinc-400"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {step === 0 && (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">템플릿</label>
            <div className="flex flex-wrap gap-2">
              {(["tuesday", "saturday", "thursday", "custom"] as RoomTemplateKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyTemplate(key)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    template === key
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-zinc-300 text-zinc-600"
                  }`}
                >
                  {TEMPLATE_LABEL[key]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">제목</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: L.P.T 내부 교류전"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">날짜</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">장소</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">시작 시간</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">종료 시간</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">실내/실외</label>
              <select
                value={isIndoor ? "indoor" : "outdoor"}
                onChange={(e) => setIsIndoor(e.target.value === "indoor")}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              >
                <option value="outdoor">실외</option>
                <option value="indoor">실내</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              코트 (쉼표로 구분)
            </label>
            <input
              value={courtNamesText}
              onChange={(e) => setCourtNamesText(e.target.value)}
              placeholder="예: A, B 또는 3번, 7번"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
            <p className="mt-1 text-xs text-zinc-400">
              현재 {courtNames.length}개 코트: {courtNames.join(", ") || "-"}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">코트 유형</label>
            <div className="flex flex-wrap gap-2">
              {COURT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCourtType(type)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    courtType === type
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-zinc-300 text-zinc-600"
                  }`}
                >
                  {COURT_TYPE_LABEL[type]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              세트당 선승 게임 수
            </label>
            <div className="flex gap-2">
              {[4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGamesPerSet(n)}
                  className={`rounded-md border px-4 py-2 text-sm ${
                    gamesPerSet === n
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-zinc-300 text-zinc-600"
                  }`}
                >
                  {n}게임
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              도움말: 4게임 추천 20분 · 5게임 추천 25분 · 6게임 추천 30분 (게임 수 선택 시 자동 반영, 아래에서 조정 가능)
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">경기당 시간</label>
            <div className="flex gap-2">
              {MATCH_MINUTES_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMinutesPerMatch(n)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    minutesPerMatch === n
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-zinc-300 text-zinc-600"
                  }`}
                >
                  {n}분
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">휴식 시간 (경기 사이)</label>
            <div className="flex gap-2">
              {BREAK_MINUTES_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setBreakMinutes(n)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    breakMinutes === n
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-zinc-300 text-zinc-600"
                  }`}
                >
                  {n}분
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">몸풀기 시간</label>
            <div className="flex gap-2">
              {WARMUP_MINUTES_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setWarmupMinutes(n)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    warmupMinutes === n
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-zinc-300 text-zinc-600"
                  }`}
                >
                  {n}분
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              일정 시작 후 몸풀기 시간이 지나고 나서 1라운드 경기가 시작됩니다.
            </p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm text-zinc-500">
            이번 일정에 참여할 선수를 선택하세요. 방 안에서만 적용되는 등급 조정도 가능합니다.
          </p>
          <MemberPickerGroup
            title="남자"
            members={maleMembers}
            selected={selectedMemberIds}
            overrides={gradeOverrides}
            onToggle={toggleMember}
            onGradeChange={(id, g) => setGradeOverrides((prev) => ({ ...prev, [id]: g }))}
          />
          <MemberPickerGroup
            title="여자"
            members={femaleMembers}
            selected={selectedMemberIds}
            overrides={gradeOverrides}
            onToggle={toggleMember}
            onGradeChange={(id, g) => setGradeOverrides((prev) => ({ ...prev, [id]: g }))}
          />
          <p className="text-sm text-zinc-600">
            선택됨: {selectedMemberIds.size}명 (남 {selectedMaleCount}명 · 여 {selectedFemaleCount}명)
          </p>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">경기 방식</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => switchMatchKind(true)}
                className={`rounded-md border px-4 py-2 text-sm ${
                  isDoublesRoom
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-zinc-300 text-zinc-600"
                }`}
              >
                복식
              </button>
              <button
                type="button"
                onClick={() => switchMatchKind(false)}
                className={`rounded-md border px-4 py-2 text-sm ${
                  !isDoublesRoom
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-zinc-300 text-zinc-600"
                }`}
              >
                단식
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              경기 종류 (다중 선택 가능)
            </label>
            <p className="mb-2 text-xs text-zinc-400">
              선택된 참가자 기준 남 {selectedMaleCount}명 · 여 {selectedFemaleCount}명 — 인원이 부족한 종류는 선택할 수 없습니다.
            </p>
            <div className="flex flex-wrap gap-2">
              {(isDoublesRoom ? DOUBLES_TYPES : SINGLES_TYPES).map((type) => {
                const reason = ineligibleReason(type);
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={Boolean(reason)}
                    title={reason ?? undefined}
                    onClick={() => toggleMatchType(type)}
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      reason
                        ? "cursor-not-allowed border-zinc-200 text-zinc-300"
                        : selectedMatchTypes.has(type)
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                        : "border-zinc-300 text-zinc-600"
                    }`}
                  >
                    {MATCH_TYPE_LABEL[type]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="font-semibold text-zinc-800">설정 요약</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-zinc-500">제목</dt>
            <dd className="text-zinc-900">{title}</dd>
            <dt className="text-zinc-500">일시</dt>
            <dd className="text-zinc-900">
              {eventDate} {startTime}~{endTime}
            </dd>
            <dt className="text-zinc-500">장소</dt>
            <dd className="text-zinc-900">
              {location} ({isIndoor ? "실내" : "실외"})
            </dd>
            <dt className="text-zinc-500">코트</dt>
            <dd className="text-zinc-900">
              {courtNames.join(", ")} ({courtNames.length}개, {COURT_TYPE_LABEL[courtType]})
            </dd>
            <dt className="text-zinc-500">경기 방식</dt>
            <dd className="text-zinc-900">
              {gamesPerSet}게임 선승 · {minutesPerMatch}분/경기 · 휴식 {breakMinutes}분 · 몸풀기 {warmupMinutes}분
            </dd>
            <dt className="text-zinc-500">참가자</dt>
            <dd className="text-zinc-900">
              {selectedMemberIds.size}명 (남 {selectedMaleCount}명 · 여 {selectedFemaleCount}명)
            </dd>
            <dt className="text-zinc-500">경기 종류</dt>
            <dd className="text-zinc-900">
              {Array.from(effectiveMatchTypes).map((t) => MATCH_TYPE_LABEL[t]).join(", ")}
            </dd>
          </dl>
          <div className="rounded-md bg-emerald-50 p-4">
            <p className="text-sm text-emerald-800">
              코트당 <strong>{slotsPerCourt}경기</strong> 진행 가능 → 총{" "}
              <strong>{totalMatches}경기</strong>를 대진표에 배치합니다.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || isPending}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-600 disabled:opacity-40"
        >
          이전
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            다음
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {isPending ? "생성 중..." : "대진표 짜러가기"}
          </button>
        )}
      </div>
    </div>
  );
}

function MemberPickerGroup({
  title,
  members,
  selected,
  overrides,
  onToggle,
  onGradeChange,
}: {
  title: string;
  members: Member[];
  selected: Set<string>;
  overrides: Record<string, Grade | null>;
  onToggle: (id: string) => void;
  onGradeChange: (id: string, grade: Grade | null) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-zinc-700">{title}</h3>
      <ul className="flex flex-col divide-y divide-zinc-100">
        {members.map((m) => {
          const isSelected = selected.has(m.id);
          const effectiveGrade = overrides[m.id] !== undefined ? overrides[m.id] : m.grade;
          return (
            <li key={m.id} className="flex items-center justify-between py-1.5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(m.id)}
                />
                {m.name}
              </label>
              {isSelected && (
                <select
                  value={effectiveGrade ?? ""}
                  onChange={(e) =>
                    onGradeChange(m.id, e.target.value === "" ? null : (e.target.value as Grade))
                  }
                  className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs"
                >
                  <option value="">미지정</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
