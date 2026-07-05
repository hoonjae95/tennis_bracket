-- 관리자가 일정을 수동으로 종료 처리할 수 있도록 지원 (날짜가 남아있어도 강제 종료 가능)

alter table rooms
  add column is_closed boolean not null default false;
