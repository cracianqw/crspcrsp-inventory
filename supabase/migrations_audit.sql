-- ============================================================
-- 권한 체계 확장 + 감사(audit) + 소프트 딜리트 마이그레이션
-- Supabase Dashboard > SQL Editor 에서 실행
-- 멱등성 보장 (여러 번 실행해도 안전)
-- ============================================================

-- 1) senior_manager 권한 추가
alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check
  check (role in ('master','senior_manager','manager','worker'));

-- 2) 누락된 created_by 보충
alter table public.items         add column if not exists created_by uuid references public.users(id);
alter table public.raw_materials add column if not exists created_by uuid references public.users(id);
alter table public.partners      add column if not exists created_by uuid references public.users(id);
alter table public.partner_specs add column if not exists created_by uuid references public.users(id);

-- 3) updated_by / updated_at / deleted_by / deleted_at 추가
-- items
alter table public.items add column if not exists updated_by uuid references public.users(id);
alter table public.items add column if not exists updated_at timestamptz;
alter table public.items add column if not exists deleted_by uuid references public.users(id);
alter table public.items add column if not exists deleted_at timestamptz;

-- raw_materials
alter table public.raw_materials add column if not exists updated_by uuid references public.users(id);
alter table public.raw_materials add column if not exists updated_at timestamptz;
alter table public.raw_materials add column if not exists deleted_by uuid references public.users(id);
alter table public.raw_materials add column if not exists deleted_at timestamptz;

-- partners
alter table public.partners add column if not exists updated_by uuid references public.users(id);
alter table public.partners add column if not exists updated_at timestamptz;
alter table public.partners add column if not exists deleted_by uuid references public.users(id);
alter table public.partners add column if not exists deleted_at timestamptz;

-- partner_specs
alter table public.partner_specs add column if not exists updated_by uuid references public.users(id);
alter table public.partner_specs add column if not exists updated_at timestamptz;
alter table public.partner_specs add column if not exists deleted_by uuid references public.users(id);
alter table public.partner_specs add column if not exists deleted_at timestamptz;

-- receiving_lots
alter table public.receiving_lots add column if not exists updated_by uuid references public.users(id);
alter table public.receiving_lots add column if not exists updated_at timestamptz;
alter table public.receiving_lots add column if not exists deleted_by uuid references public.users(id);
alter table public.receiving_lots add column if not exists deleted_at timestamptz;

-- weekly_plans
alter table public.weekly_plans add column if not exists updated_by uuid references public.users(id);
alter table public.weekly_plans add column if not exists updated_at timestamptz;
alter table public.weekly_plans add column if not exists deleted_by uuid references public.users(id);
alter table public.weekly_plans add column if not exists deleted_at timestamptz;

-- production_records
alter table public.production_records add column if not exists updated_by uuid references public.users(id);
alter table public.production_records add column if not exists updated_at timestamptz;
alter table public.production_records add column if not exists deleted_by uuid references public.users(id);
alter table public.production_records add column if not exists deleted_at timestamptz;

-- packaging_records
alter table public.packaging_records add column if not exists updated_by uuid references public.users(id);
alter table public.packaging_records add column if not exists updated_at timestamptz;
alter table public.packaging_records add column if not exists deleted_by uuid references public.users(id);
alter table public.packaging_records add column if not exists deleted_at timestamptz;

-- shipping_orders
alter table public.shipping_orders add column if not exists updated_by uuid references public.users(id);
alter table public.shipping_orders add column if not exists updated_at timestamptz;
alter table public.shipping_orders add column if not exists deleted_by uuid references public.users(id);
alter table public.shipping_orders add column if not exists deleted_at timestamptz;

-- shipping_items
alter table public.shipping_items add column if not exists updated_by uuid references public.users(id);
alter table public.shipping_items add column if not exists updated_at timestamptz;
alter table public.shipping_items add column if not exists deleted_by uuid references public.users(id);
alter table public.shipping_items add column if not exists deleted_at timestamptz;

-- waste_records
alter table public.waste_records add column if not exists updated_by uuid references public.users(id);
alter table public.waste_records add column if not exists updated_at timestamptz;
alter table public.waste_records add column if not exists deleted_by uuid references public.users(id);
alter table public.waste_records add column if not exists deleted_at timestamptz;

-- users
alter table public.users add column if not exists updated_by uuid references public.users(id);
alter table public.users add column if not exists updated_at timestamptz;
alter table public.users add column if not exists deleted_by uuid references public.users(id);
alter table public.users add column if not exists deleted_at timestamptz;

-- 4) 소프트 딜리트 조회 최적화 부분 인덱스
create index if not exists idx_items_deleted_at              on public.items              (deleted_at) where deleted_at is not null;
create index if not exists idx_raw_materials_deleted_at      on public.raw_materials      (deleted_at) where deleted_at is not null;
create index if not exists idx_partners_deleted_at           on public.partners           (deleted_at) where deleted_at is not null;
create index if not exists idx_receiving_lots_deleted_at     on public.receiving_lots     (deleted_at) where deleted_at is not null;
create index if not exists idx_weekly_plans_deleted_at       on public.weekly_plans       (deleted_at) where deleted_at is not null;
create index if not exists idx_production_records_deleted_at on public.production_records (deleted_at) where deleted_at is not null;
create index if not exists idx_packaging_records_deleted_at  on public.packaging_records  (deleted_at) where deleted_at is not null;
create index if not exists idx_shipping_orders_deleted_at    on public.shipping_orders    (deleted_at) where deleted_at is not null;
create index if not exists idx_waste_records_deleted_at      on public.waste_records      (deleted_at) where deleted_at is not null;
create index if not exists idx_users_deleted_at              on public.users              (deleted_at) where deleted_at is not null;

-- 5) 확인
select role, count(*) as n from public.users group by role order by role;
