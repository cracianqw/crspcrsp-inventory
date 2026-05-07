-- ============================================================
-- raw_materials 이중 포장 단위 컬럼 추가
--   inner_unit_qty / inner_unit  : 내포장 (예: 1속, 10kg)
--   outer_unit_qty / outer_unit  : 외포장 (예: 1박스, 1통)
--   units_per_outer              : 1 외포장당 내포장 수량 (예: 1박스 = 8속)
-- 기존 unit 컬럼은 입고/생산 화면 호환을 위해 유지하며,
-- 신규 등록 시 inner_unit 값을 unit 에도 함께 저장한다.
-- Supabase Dashboard > SQL Editor 에서 실행 (멱등성 보장)
-- ============================================================

alter table public.raw_materials
  add column if not exists inner_unit_qty   numeric(12,3) not null default 1,
  add column if not exists inner_unit       text          not null default 'kg',
  add column if not exists outer_unit_qty   numeric(12,3) not null default 1,
  add column if not exists outer_unit       text          not null default '박스',
  add column if not exists units_per_outer  numeric(12,3) not null default 1;

-- 기존 행 보정: inner_unit 이 기본값인 경우 기존 unit 값으로 채움
update public.raw_materials
   set inner_unit = unit
 where inner_unit = 'kg' and unit is not null and unit <> 'kg';

-- 확인
select code, name, unit,
       inner_unit_qty, inner_unit,
       outer_unit_qty, outer_unit,
       units_per_outer
  from public.raw_materials
 order by name;
