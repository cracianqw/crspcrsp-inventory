-- ============================================================
-- items.code 단독 unique → (code, production_type) 복합 unique 로 변경
-- 이유: 동일 품목코드를 자체생산과 외주 양쪽에 각각 등록할 수 있게
-- Supabase Dashboard > SQL Editor 에서 실행 (멱등성 보장)
-- ============================================================

-- 선행 조건: production_type 컬럼이 이미 존재해야 함 (outsourced.sql 실행 후)

-- 1) 기존 code 단독 unique 제약/인덱스 제거
alter table public.items drop constraint if exists items_code_key;
drop index if exists public.items_code_key;

-- 2) production_type이 null 인 행은 'internal'로 보정 (보험)
update public.items set production_type = 'internal' where production_type is null;

-- 3) 복합 unique (code, production_type) 추가
-- 이미 존재할 경우 대비 drop → add
alter table public.items drop constraint if exists items_code_prodtype_key;
alter table public.items
  add constraint items_code_prodtype_key unique (code, production_type);

-- 4) 확인 — UNIQUE 제약 목록
select tc.constraint_name, tc.constraint_type,
       string_agg(kc.column_name, ', ' order by kc.ordinal_position) as columns
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kc
    on kc.constraint_name = tc.constraint_name
 where tc.table_schema = 'public' and tc.table_name = 'items'
   and tc.constraint_type in ('UNIQUE','PRIMARY KEY')
 group by tc.constraint_name, tc.constraint_type
 order by tc.constraint_type desc;
