-- 정회원이 아닌 게스트를 방 참가자로 등록할 수 있도록 지원.
-- 게스트는 members 테이블에 정식 등록되지 않고, 해당 방(room_participants)에서만 유효하다.

alter table room_participants
  alter column member_id drop not null,
  add column guest_name text,
  add column guest_gender gender,
  add column guest_grade grade;

alter table room_participants
  add constraint room_participants_member_or_guest check (
    (member_id is not null and guest_name is null and guest_gender is null)
    or
    (member_id is null and guest_name is not null and guest_gender is not null)
  );
