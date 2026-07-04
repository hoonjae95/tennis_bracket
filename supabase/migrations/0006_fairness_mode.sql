-- 대진표 생성 시 공정성 모드 지원 ('normal': 최대 1경기 차이 허용, 'tournament': 성별 그룹별 경기수 완전 동일 강제)

create type fairness_mode as enum ('normal', 'tournament');

alter table rooms
  add column fairness_mode fairness_mode not null default 'normal';
