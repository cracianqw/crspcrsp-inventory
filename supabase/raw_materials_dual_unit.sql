-- ============================================================
-- raw_materials 이중 포장 단위 컬럼 추가
--   inner_unit : 내포장 단위 (kg/g/L/ml/개/롤/장/속/박스/통/포대 또는 NULL)
--   outer_unit : 외포장 단위 (위와 동일 옵션)
-- 기존 unit 컬럼은 입고/생산 화면 호환을 위해 유지하며,
-- 신규 등록 시 inner_unit 값을 unit 에도 함께 저장한다.
-- Supabase Dashboard > SQL Editor 에서 실행 (멱등성 보장)
-- ============================================================

alter table public.raw_materials
  add column if not exists inner_unit text,
  add column if not exists outer_unit text;

-- 기존 행 보정: inner_unit 이 NULL 인 경우 기존 unit 값으로 채움
update public.raw_materials
   set inner_unit = unit
 where inner_unit is null and unit is not null;

-- 확인
select code, name, unit, inner_unit, outer_unit
  from public.raw_materials
 order by name;
