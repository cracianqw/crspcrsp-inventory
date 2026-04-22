-- ============================================================
-- 외주 생산 관련 스키마 변경
-- Supabase Dashboard > SQL Editor 에서 실행
-- 멱등성 보장 (재실행 안전)
-- ============================================================

-- 1) items: 생산 유형 (internal/outsourced) + 월별 안전재고 (jsonb)
alter table public.items
  add column if not exists production_type text
  default 'internal'
  check (production_type in ('internal','outsourced'));

alter table public.items
  add column if not exists safety_stock_by_month jsonb default '{}'::jsonb;

-- 기존 행 기본값 보정
update public.items
   set production_type = 'internal'
 where production_type is null;

create index if not exists idx_items_production_type
  on public.items (production_type);

-- 2) 외주 완성품 입고 이력 테이블
create table if not exists public.outsourced_receipts (
  id             uuid primary key default uuid_generate_v4(),
  item_id        uuid not null references public.items(id),
  supplier_id    uuid references public.partners(id),
  quantity       numeric(12,0) not null,
  expiry_date    date,
  received_date  date not null default current_date,
  batch_number   text,
  notes          text,
  -- 감사 / 소프트 딜리트
  created_by     uuid references public.users(id),
  created_at     timestamptz not null default now(),
  updated_by     uuid references public.users(id),
  updated_at     timestamptz,
  deleted_by     uuid references public.users(id),
  deleted_at     timestamptz
);

create index if not exists idx_outsourced_receipts_date
  on public.outsourced_receipts (received_date desc);
create index if not exists idx_outsourced_receipts_item
  on public.outsourced_receipts (item_id);
create index if not exists idx_outsourced_receipts_deleted_at
  on public.outsourced_receipts (deleted_at) where deleted_at is not null;

-- 3) 확인
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'items'
   and column_name in ('production_type', 'safety_stock_by_month')
 order by ordinal_position;

select count(*) as internal_items from public.items where production_type = 'internal';
select count(*) as outsourced_items from public.items where production_type = 'outsourced';
