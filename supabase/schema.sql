-- ============================================================
-- CRSP CRSP 생산재고관리 시스템 · DB 스키마
-- ============================================================

-- 확장
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. 사용자 관리
-- ============================================================
create table if not exists users (
  id          uuid primary key default uuid_generate_v4(),
  email       text unique not null,
  name        text not null,
  role        text not null check (role in ('master', 'manager', 'worker')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 2. 원재료 마스터
-- ============================================================
create table if not exists raw_materials (
  id          uuid primary key default uuid_generate_v4(),
  code        text unique not null,
  name        text not null,           -- 예: 원초, 조미액, 참기름
  unit        text not null default 'kg',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 3. 품목 관리 (완성품 규격 — 마스터 전용)
-- ============================================================
create table if not exists items (
  id               uuid primary key default uuid_generate_v4(),
  code             text unique not null,
  name             text not null,            -- 예: 조미김 도시락 4g
  category         text,                     -- 조미김 / 구운김 / 파래김 등
  unit             text not null default '봉',
  weight_g         numeric(8,2),             -- 중량(g)
  sheet_count      int,                      -- 장수
  packaging_type   text,                     -- 낱봉 / 번들 / 박스
  shelf_life_days  int,                      -- 소비기한(일)
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- 4. 거래처 관리
-- ============================================================
create table if not exists partners (
  id            uuid primary key default uuid_generate_v4(),
  code          text unique not null,
  name          text not null,
  type          text not null check (type in ('supplier', 'customer', 'both')),
  contact_name  text,
  phone         text,
  address       text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- 납품 규격 (거래처 × 품목)
create table if not exists partner_specs (
  id            uuid primary key default uuid_generate_v4(),
  partner_id    uuid not null references partners(id) on delete cascade,
  item_id       uuid not null references items(id) on delete cascade,
  spec_name     text,                 -- 규격명 (예: 쿠팡 전용 라벨)
  box_qty       int,                  -- 박스당 수량
  label_type    text,                 -- 라벨 형태
  notes         text,
  created_at    timestamptz not null default now(),
  unique (partner_id, item_id, spec_name)
);

-- ============================================================
-- 5. 입고 관리 (원재료 LOT별)
-- ============================================================
create table if not exists receiving_lots (
  id               uuid primary key default uuid_generate_v4(),
  lot_number       text unique not null,
  raw_material_id  uuid not null references raw_materials(id),
  supplier_id      uuid references partners(id),
  received_date    date not null default current_date,
  quantity         numeric(12,3) not null,
  unit             text not null default 'kg',
  unit_price       numeric(12,2),
  expiry_date      date,
  storage_location text,
  notes            text,
  created_by       uuid references users(id),
  created_at       timestamptz not null default now()
);

-- ============================================================
-- 6. 생산 계획 / 주간 생산 계획 (대시보드)
-- ============================================================
create table if not exists weekly_plans (
  id           uuid primary key default uuid_generate_v4(),
  week_start   date not null,          -- 해당 주 월요일
  item_id      uuid not null references items(id),
  planned_qty  numeric(12,0) not null,
  notes        text,
  created_by   uuid references users(id),
  created_at   timestamptz not null default now(),
  unique (week_start, item_id)
);

-- ============================================================
-- 7. 생산 관리
-- ============================================================
create table if not exists production_records (
  id              uuid primary key default uuid_generate_v4(),
  record_number   text unique not null,   -- 생산 번호 (예: PR-20260420-001)
  item_id         uuid not null references items(id),
  production_date date not null default current_date,
  planned_qty     numeric(12,0),
  input_qty       numeric(12,3),          -- 원재료 투입량 (kg)
  output_qty      numeric(12,0),          -- 생산량 (봉)
  waste_qty       numeric(12,3),          -- 파지량 (kg)
  yield_rate      numeric(5,2),           -- 수율 (%)
  inspector       text,                   -- 검수자명
  qc_passed       boolean,                -- 검수 합격 여부
  status          text not null default 'in_progress'
                  check (status in ('in_progress', 'completed', 'cancelled')),
  notes           text,
  created_by      uuid references users(id),
  created_at      timestamptz not null default now()
);

-- 생산에 투입된 원재료 LOT (다대다)
create table if not exists production_lot_inputs (
  id                    uuid primary key default uuid_generate_v4(),
  production_record_id  uuid not null references production_records(id) on delete cascade,
  receiving_lot_id      uuid not null references receiving_lots(id),
  input_qty             numeric(12,3) not null,
  created_at            timestamptz not null default now()
);

-- 생산 사진
create table if not exists production_photos (
  id                    uuid primary key default uuid_generate_v4(),
  production_record_id  uuid not null references production_records(id) on delete cascade,
  photo_url             text not null,
  photo_type            text,             -- '투입전' / '생산중' / '완성' / '검수'
  uploaded_at           timestamptz not null default now()
);

-- ============================================================
-- 8. 완제품 포장
-- ============================================================
create table if not exists packaging_records (
  id                    uuid primary key default uuid_generate_v4(),
  batch_number          text unique not null,
  production_record_id  uuid references production_records(id),
  item_id               uuid not null references items(id),
  packaged_date         date not null default current_date,
  quantity              numeric(12,0) not null,    -- 포장 수량 (봉)
  expiry_date           date,                      -- 대표 소비기한
  mixed_expiry          boolean not null default false,  -- 소비기한 혼재
  expiry_dates          jsonb,                     -- 혼재 시 [{date, qty}]
  created_by            uuid references users(id),
  created_at            timestamptz not null default now()
);

-- ============================================================
-- 9. 완제품 재고
-- ============================================================
create table if not exists finished_goods_stock (
  id                    uuid primary key default uuid_generate_v4(),
  item_id               uuid not null references items(id),
  packaging_record_id   uuid references packaging_records(id),
  batch_number          text not null,
  quantity              numeric(12,0) not null default 0,
  expiry_date           date,
  location              text,
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- 10. 출고 관리
-- ============================================================
create table if not exists shipping_orders (
  id             uuid primary key default uuid_generate_v4(),
  order_number   text unique not null,
  partner_id     uuid not null references partners(id),
  shipping_date  date not null default current_date,
  status         text not null default 'pending'
                 check (status in ('pending', 'shipped', 'delivered', 'cancelled')),
  notes          text,
  created_by     uuid references users(id),
  created_at     timestamptz not null default now()
);

create table if not exists shipping_items (
  id                      uuid primary key default uuid_generate_v4(),
  shipping_order_id       uuid not null references shipping_orders(id) on delete cascade,
  item_id                 uuid not null references items(id),
  finished_goods_stock_id uuid references finished_goods_stock(id),
  partner_spec_id         uuid references partner_specs(id),
  quantity                numeric(12,0) not null,
  created_at              timestamptz not null default now()
);

-- ============================================================
-- 11. 파지 관리
-- ============================================================
create table if not exists waste_records (
  id                    uuid primary key default uuid_generate_v4(),
  production_record_id  uuid references production_records(id),
  waste_date            date not null default current_date,
  waste_type            text,             -- '생산파지' / '검수불량' / '기타'
  quantity              numeric(12,3) not null,
  unit                  text not null default 'kg',
  reason                text,
  disposal_method       text,             -- '폐기' / '재처리' / '반납'
  created_by            uuid references users(id),
  created_at            timestamptz not null default now()
);

-- ============================================================
-- 12. 알림
-- ============================================================
create table if not exists notifications (
  id              uuid primary key default uuid_generate_v4(),
  type            text not null,    -- 'stock_low' / 'expiry_soon' / 'qc_fail' 등
  message         text not null,
  is_read         boolean not null default false,
  target_user_id  uuid references users(id),
  created_at      timestamptz not null default now()
);

-- ============================================================
-- VIEW: 재고 현황 (완제품)
-- ============================================================
create or replace view inventory_summary as
select
  i.id          as item_id,
  i.code        as item_code,
  i.name        as item_name,
  i.category,
  i.unit,
  coalesce(sum(s.quantity), 0) as total_qty,
  min(s.expiry_date)           as earliest_expiry,
  count(distinct s.id)         as batch_count
from items i
left join finished_goods_stock s on s.item_id = i.id and s.quantity > 0
where i.is_active = true
group by i.id, i.code, i.name, i.category, i.unit;

-- ============================================================
-- VIEW: 원재료 재고 현황 (LOT별 잔량)
-- ============================================================
create or replace view raw_material_stock as
select
  r.id            as raw_material_id,
  r.code,
  r.name,
  r.unit,
  l.id            as lot_id,
  l.lot_number,
  l.received_date,
  l.expiry_date,
  l.quantity      as received_qty,
  coalesce(sum(pi.input_qty), 0)            as used_qty,
  l.quantity - coalesce(sum(pi.input_qty), 0) as remaining_qty
from raw_materials r
join receiving_lots l on l.raw_material_id = r.id
left join production_lot_inputs pi on pi.receiving_lot_id = l.id
group by r.id, r.code, r.name, r.unit, l.id, l.lot_number, l.received_date, l.expiry_date, l.quantity;

-- ============================================================
-- RLS (Row Level Security) — 기본값: 인증된 사용자 접근 허용
-- ============================================================
alter table users                  enable row level security;
alter table raw_materials          enable row level security;
alter table items                  enable row level security;
alter table partners               enable row level security;
alter table partner_specs          enable row level security;
alter table receiving_lots         enable row level security;
alter table weekly_plans           enable row level security;
alter table production_records     enable row level security;
alter table production_lot_inputs  enable row level security;
alter table production_photos      enable row level security;
alter table packaging_records      enable row level security;
alter table finished_goods_stock   enable row level security;
alter table shipping_orders        enable row level security;
alter table shipping_items         enable row level security;
alter table waste_records          enable row level security;
alter table notifications          enable row level security;

-- 개발 단계: anon / authenticated 모두 전체 접근 허용 (추후 역할별 정책으로 교체)
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'users','raw_materials','items','partners','partner_specs',
    'receiving_lots','weekly_plans','production_records',
    'production_lot_inputs','production_photos','packaging_records',
    'finished_goods_stock','shipping_orders','shipping_items',
    'waste_records','notifications'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename  = tbl
        and policyname = 'allow_all_' || tbl
    ) then
      execute format('
        create policy "allow_all_%s"
        on %I for all
        to anon, authenticated
        using (true)
        with check (true);
      ', tbl, tbl);
    end if;
  end loop;
end $$;
