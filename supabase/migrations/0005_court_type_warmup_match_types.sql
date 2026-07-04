-- 코트 유형, 몸풀기 시간, 방 단위 경기종류 선택 지원

create type court_type as enum ('artificial_grass', 'hard_court', 'clay_court');

alter table courts
  add column court_type court_type not null default 'hard_court';

alter table rooms
  add column warmup_minutes smallint not null default 20,
  add column match_types match_type[] not null default array['mens_doubles', 'womens_doubles']::match_type[];
