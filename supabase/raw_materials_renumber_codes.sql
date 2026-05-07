-- ============================================================
-- 원자재 코드 카테고리 기준 일괄 재부여
-- 형식: {카테고리명 앞 2자}-{3자리 순번}
--   원초       → 원초-001, 원초-002, ...
--   조미용원료 → 조미-001, 조미-002, ...
--   포장재     → 포장-001, 포장-002, ...
--   기타       → 기타-001, ...
-- 정렬: 비삭제 먼저, 그 안에서 created_at, id 순
-- 사전 조건: 모든 raw_materials 에 category_id 가 설정되어 있어야 함.
--   category_id NULL 인 행은 건드리지 않음(기존 코드 유지).
-- 멱등성: 두 번 실행해도 동일 결과.
-- Supabase Dashboard > SQL Editor 에서 실행.
-- ============================================================

-- Pass 1) 충돌 방지를 위해 임시 코드로 일괄 변경 (category_id 보유 행 한정)
update public.raw_materials
   set code = 'TMP-' || id::text
 where category_id is not null;

-- Pass 2) 카테고리 + 정렬 기준으로 최종 코드 부여
with renumbered as (
  select rm.id,
         left(c.name, 2) as prefix,
         row_number() over (
           partition by rm.category_id
           order by case when rm.deleted_at is null then 0 else 1 end,
                    rm.created_at, rm.id
         ) as rn
    from public.raw_materials rm
    join public.raw_material_categories c on c.id = rm.category_id
)
update public.raw_materials rm
   set code = r.prefix || '-' || lpad(r.rn::text, 3, '0')
  from renumbered r
 where r.id = rm.id;

-- 확인
select c.sort_order as c_ord, c.name as category, rm.code, rm.name,
       case when rm.deleted_at is null then '' else '(삭제됨)' end as state
  from public.raw_materials rm
  left join public.raw_material_categories c on c.id = rm.category_id
 order by c.sort_order nulls last, rm.code;
