-- ============================================================
-- 테스트 데이터 시드
-- Supabase Dashboard > SQL Editor 에서 실행
-- ============================================================
-- 실제 items 테이블 컬럼 (확인 완료):
--   id, code, name, category, unit, weight_g, sheet_count,
--   packaging_type, shelf_life_days, is_active, created_at
-- 실제 raw_materials 테이블 컬럼:
--   id, code, name, unit, is_active
-- "장당 N매 필요"를 저장할 컬럼이 없어서 신규 컬럼을 추가합니다.
-- ============================================================

-- 0) 신규 컬럼: 완성품 1단위당 원초 장수
alter table items
  add column if not exists raw_sheets_per_unit int;

-- 0-1) 품목 변경 이력 테이블
create table if not exists item_change_logs (
  id          uuid primary key default uuid_generate_v4(),
  item_id     uuid not null references items(id) on delete cascade,
  user_id     uuid references users(id),
  user_name   text,
  action      text not null check (action in ('create','update','activate','deactivate')),
  changes     jsonb,                       -- {field: {before, after}, ...}
  created_at  timestamptz not null default now()
);
create index if not exists idx_item_change_logs_item on item_change_logs (item_id, created_at desc);

-- ============================================================
-- 1) 원자재
-- ============================================================
insert into raw_materials (code, name, unit) values
  ('RM-001', '조미김 원초', '장'),
  ('RM-002', '구운김 원초', '장')
on conflict (code) do nothing;

-- ============================================================
-- 2) 완성품 품목 (6종)
--   packaging_type: '전장' | '절단'
--   sheet_count:    완성품 1단위의 김 매수
--   raw_sheets_per_unit: 완성품 1단위에 필요한 원초 장수
-- ============================================================
insert into items
  (code, name, category, unit, weight_g, sheet_count, packaging_type, raw_sheets_per_unit, shelf_life_days)
values
  ('IT-001', '맛있게 구운 곱창김 뿅김', '구운김', '봉', 15,  5, '전장', 5, 365),
  ('IT-002', '뿅김 간간한 조미김',       '조미김', '봉', 25,  5, '전장', 5, 365),
  ('IT-003', 'CRSP CRSP 오리지널',        '조미김', '봉',  3,  9, '절단', 1, 365),
  ('IT-004', 'CRSP CRSP 씨솔트',          '조미김', '봉',  5,  9, '절단', 1, 365),
  ('IT-005', 'CRSP CRSP 오리지널 캔',     '조미김', '캔', 23, 63, '절단', 7, 365),
  ('IT-006', 'CRSP CRSP 씨솔트 캔',       '조미김', '캔', 35, 63, '절단', 7, 365)
on conflict (code) do nothing;

-- ============================================================
-- 확인
-- ============================================================
select column_name
  from information_schema.columns
 where table_schema='public' and table_name='items'
 order by ordinal_position;

select * from raw_materials order by code;

select code, name, category, unit,
       weight_g, sheet_count, packaging_type,
       raw_sheets_per_unit, shelf_life_days
  from items order by code;
