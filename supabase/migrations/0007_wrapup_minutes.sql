-- 대회 마무리 시간(시상식 등 종료 직전 버퍼) 지원

alter table rooms
  add column wrapup_minutes smallint not null default 0;
