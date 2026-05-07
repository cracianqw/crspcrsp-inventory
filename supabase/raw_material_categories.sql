-- ============================================================
-- 원자재 카테고리/서브카테고리 마스터 + 초기 시드
--   raw_material_categories      : 1차 카테고리 (원초/조미용원료/포장재/기타)
--   raw_material_subcategories   : 2차 항목 (곱창김/재래김/...)
-- raw_materials 에 category_id, subcategory_id FK 추가.
-- 카테고리/항목 명이 '기타' 또는 '직접입력' 인 경우, 등록 폼에서
-- 사용자가 자유 입력한 텍스트를 raw_materials.name 에 저장한다.
-- Supabase Dashboard > SQL Editor 에서 실행 (멱등성 보장)
-- ============================================================

-- 1) 카테고리 마스터
create table if not exists public.raw_material_categories (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- 2) 서브카테고리 마스터
create table if not exists public.raw_material_subcategories (
  id           uuid primary key default uuid_generate_v4(),
  category_id  uuid not null references public.raw_material_categories(id) on delete cascade,
  name         text not null,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  unique (category_id, name)
);

-- 3) raw_materials FK 컬럼
alter table public.raw_materials
  add column if not exists category_id    uuid references public.raw_material_categories(id) on delete set null,
  add column if not exists subcategory_id uuid references public.raw_material_subcategories(id) on delete set null;

-- 4) 카테고리 시드
insert into public.raw_material_categories (name, sort_order) values
  ('원초',       1),
  ('조미용원료', 2),
  ('포장재',     3),
  ('기타',       99)
on conflict (name) do nothing;

-- 5) 서브카테고리 시드
insert into public.raw_material_subcategories (category_id, name, sort_order)
select c.id, v.name, v.sort_order
  from (values
    -- 원초
    ('원초',       '곱창김',                 1),
    ('원초',       '재래김',                 2),
    ('원초',       '김밥김',                 3),
    ('원초',       '기타',                   99),
    -- 조미용원료
    ('조미용원료', '옥배유',                 1),
    ('조미용원료', '참기름',                 2),
    ('조미용원료', '들기름',                 3),
    ('조미용원료', '카놀라유',               4),
    ('조미용원료', '소금',                   5),
    ('조미용원료', '시즈닝',                 6),
    ('조미용원료', '기타',                   99),
    -- 포장재
    ('포장재',     '전장롤',                 1),
    ('포장재',     '절단롤',                 2),
    ('포장재',     '내포장재(종이)',         3),
    ('포장재',     '내포장재(비닐/지퍼)',    4),
    -- 기타
    ('기타',       '직접입력',               1)
  ) v(cat_name, name, sort_order)
  join public.raw_material_categories c on c.name = v.cat_name
on conflict (category_id, name) do nothing;

-- 6) 확인
select c.sort_order as c_ord, c.name as category,
       s.sort_order as s_ord, s.name as subcategory
  from public.raw_material_categories c
  left join public.raw_material_subcategories s on s.category_id = c.id
 order by c.sort_order, s.sort_order;
