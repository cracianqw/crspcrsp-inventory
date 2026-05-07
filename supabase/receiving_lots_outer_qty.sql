-- ============================================================
-- receiving_lots 외포장 수량/단위 컬럼 추가
--   기존 quantity/unit 은 내포장(또는 단일 단위) 기준으로 유지.
--   원자재가 외포장 단위까지 정의되어 있으면 outer_quantity/outer_unit 에
--   별도로 박스/통/포대 등의 수량을 함께 기록한다.
-- Supabase Dashboard > SQL Editor 에서 실행 (멱등성 보장)
-- ============================================================

alter table public.receiving_lots
  add column if not exists outer_quantity numeric(12,3),
  add column if not exists outer_unit     text;

-- 확인
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'receiving_lots'
   and column_name in ('quantity', 'unit', 'outer_quantity', 'outer_unit')
 order by column_name;
