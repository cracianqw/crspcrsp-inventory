-- ============================================================
-- 생산 계획 통합 스키마 마이그레이션
-- 주간/일간 · 완성품 생산 · 완제품 포장 · 기타작업 일원화
-- Supabase Dashboard > SQL Editor 에서 실행 (멱등성 보장)
-- ============================================================

-- ------------------------------------------------------------
-- 1) production_plans : 계획 헤더 (주간 또는 일간)
-- ------------------------------------------------------------
create table if not exists public.production_plans (
  id                    uuid primary key default uuid_generate_v4(),
  plan_type             text not null check (plan_type in ('weekly','daily')),
  period_start          date not null,
  period_end            date not null,
  holidays              jsonb not null default '[]'::jsonb,  -- ["YYYY-MM-DD", ...]

  -- 일간 계획일 때만 의미 있는 필드
  weekly_plan_id        uuid references public.production_plans(id) on delete set null,
  differs_from_weekly   boolean not null default false,
  diff_reason           text,

  notes                 text,

  -- 감사
  created_by            uuid references public.users(id),
  created_at            timestamptz not null default now(),
  updated_by            uuid references public.users(id),
  updated_at            timestamptz,
  deleted_by            uuid references public.users(id),
  deleted_at            timestamptz,

  constraint production_plans_period_valid check (period_end >= period_start)
);

create index if not exists idx_production_plans_type_period
  on public.production_plans (plan_type, period_start);
create index if not exists idx_production_plans_weekly_ref
  on public.production_plans (weekly_plan_id) where weekly_plan_id is not null;
create index if not exists idx_production_plans_deleted_at
  on public.production_plans (deleted_at) where deleted_at is not null;

-- ------------------------------------------------------------
-- 2) production_plan_items : 계획 내 개별 항목
--    kind = 'production' | 'packaging' | 'other'
--    공통 필드 + 유형별 nullable 필드 묶음
-- ------------------------------------------------------------
create table if not exists public.production_plan_items (
  id                    uuid primary key default uuid_generate_v4(),
  plan_id               uuid not null references public.production_plans(id) on delete cascade,
  kind                  text not null check (kind in ('production','packaging','other')),

  -- 주간 계획: 항목별 특정 일자(기간 내). 일간 계획: plan.period_start와 동일
  target_date           date,

  -- 완성품(공통 식별): production / packaging 양쪽에서 사용
  item_id               uuid references public.items(id),

  -- === 완성품 생산계획 전용 ===
  produce_qty_bags      numeric(12,0),                 -- 생산계획 수량(봉)

  -- === 완제품 포장계획 전용 ===
  pkg_unit              text,                           -- 포장단위 라벨 (예: "4g 5매")
  box_pkg_unit          text,                           -- 박스포장단위 라벨 (예: "24봉/박스")
  bags_per_box          numeric(8,0),                   -- 박스당 봉 수 (자동계산용)
  total_boxes           numeric(12,0),                  -- 총 박스 수량
  total_bags            numeric(12,0),                  -- 총 사용수량(봉) = total_boxes * bags_per_box
  expiry_date           date,                           -- 소비기한 (items.shelf_life_days 기준 자동 계산)

  -- === 기타작업 전용 ===
  custom_item_name      text,                           -- 품목 직접입력
  work_qty              numeric(12,0),                  -- 작업수량
  outer_packing         text,                           -- '종이' | '부직포' | 'custom'
  outer_packing_custom  text,                           -- outer_packing = 'custom' 일 때 자유입력
  combined_packing      boolean not null default false, -- 합포장 여부
  combined_unit         text,                           -- 합포장 단위

  notes                 text,
  sort_order            int not null default 0,

  created_at            timestamptz not null default now()
);

create index if not exists idx_plan_items_plan_id
  on public.production_plan_items (plan_id);
create index if not exists idx_plan_items_kind
  on public.production_plan_items (plan_id, kind);
create index if not exists idx_plan_items_target_date
  on public.production_plan_items (target_date);
create index if not exists idx_plan_items_item_id
  on public.production_plan_items (item_id) where item_id is not null;

-- ------------------------------------------------------------
-- 3) production_plan_materials : 완성품 생산계획의 원재료 사용 계획 (1:N)
-- ------------------------------------------------------------
create table if not exists public.production_plan_materials (
  id                uuid primary key default uuid_generate_v4(),
  plan_item_id      uuid not null references public.production_plan_items(id) on delete cascade,
  raw_material_id   uuid not null references public.raw_materials(id),
  planned_qty       numeric(12,3) not null,
  unit              text not null default 'kg',
  sort_order        int not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists idx_plan_materials_plan_item_id
  on public.production_plan_materials (plan_item_id);

-- ------------------------------------------------------------
-- 4) RLS
-- ------------------------------------------------------------
alter table public.production_plans          enable row level security;
alter table public.production_plan_items     enable row level security;
alter table public.production_plan_materials enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'production_plans','production_plan_items','production_plan_materials'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename  = tbl
        and policyname = 'allow_all_' || tbl
    ) then
      execute format('
        create policy "allow_all_%s"
        on public.%I for all
        to anon, authenticated
        using (true)
        with check (true);
      ', tbl, tbl);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 5) 호환용 뷰 : 기존 Dashboard 의 weekly_plans 로직과 병행 사용 가능
--    production_plans(weekly) + production_plan_items(kind='production') 를
--    {week_start, item_id, planned_qty} 형태로 집계
-- ------------------------------------------------------------
create or replace view public.production_plan_weekly_summary as
select
  p.period_start                          as week_start,
  pi.item_id,
  sum(coalesce(pi.produce_qty_bags, 0))   as planned_qty,
  p.id                                    as plan_id,
  p.created_by,
  p.updated_by,
  p.created_at,
  p.updated_at
from public.production_plans p
join public.production_plan_items pi on pi.plan_id = p.id
where p.plan_type = 'weekly'
  and p.deleted_at is null
  and pi.kind = 'production'
  and pi.item_id is not null
group by p.id, p.period_start, pi.item_id;
