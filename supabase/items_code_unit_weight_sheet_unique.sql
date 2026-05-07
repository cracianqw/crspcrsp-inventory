-- ============================================================
-- items unique constraint 재정의:
--   (code, production_type)  →  (code, unit, weight_g, sheet_count)
-- 이유: 동일 품목보고번호라도 단위/중량/매수가 다르면 다른 품목으로 취급
-- Supabase Dashboard > SQL Editor 에서 실행 (멱등성 보장)
-- ============================================================

-- 1) 기존 (code, production_type) 복합 unique 제거
alter table public.items drop constraint if exists items_code_prodtype_key;

-- 안전상, 단독 code unique 가 남아 있다면 함께 정리
alter table public.items drop constraint if exists items_code_key;
drop index if exists public.items_code_key;

-- 2) 새 복합 unique (code, unit, weight_g, sheet_count) 추가
-- NULLS NOT DISTINCT: weight_g 또는 sheet_count 가 NULL 인 경우에도 동일 조합은 충돌 처리
-- (PostgreSQL 15+ 필요. Supabase 는 15+ 사용 중)
alter table public.items drop constraint if exists items_code_unit_weight_sheet_key;
alter table public.items
  add constraint items_code_unit_weight_sheet_key
  unique nulls not distinct (code, unit, weight_g, sheet_count);

-- 3) 확인 — UNIQUE 제약 목록
select tc.constraint_name, tc.constraint_type,
       string_agg(kc.column_name, ', ' order by kc.ordinal_position) as columns
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kc
    on kc.constraint_name = tc.constraint_name
 where tc.table_schema = 'public' and tc.table_name = 'items'
   and tc.constraint_type in ('UNIQUE','PRIMARY KEY')
 group by tc.constraint_name, tc.constraint_type
 order by tc.constraint_type desc;
