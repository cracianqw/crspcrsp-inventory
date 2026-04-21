-- ============================================================
-- 출고 계획 (shipping_plans) 테이블
-- Supabase Dashboard > SQL Editor 에서 실행
-- 멱등성 보장 (재실행 안전)
-- ============================================================

create table if not exists public.shipping_plans (
  id            uuid primary key default uuid_generate_v4(),
  partner_id    uuid not null references public.partners(id),
  item_id       uuid not null references public.items(id),
  planned_date  date not null,
  quantity      numeric(12,0) not null,
  manager       text,                                        -- 담당자 (자유 입력)
  status        text not null default 'pending'
                check (status in ('pending','shipped','cancelled')),
  notes         text,
  -- 감사 / 소프트 딜리트
  created_by    uuid references public.users(id),
  created_at    timestamptz not null default now(),
  updated_by    uuid references public.users(id),
  updated_at    timestamptz,
  deleted_by    uuid references public.users(id),
  deleted_at    timestamptz
);

-- 인덱스
create index if not exists idx_shipping_plans_date
  on public.shipping_plans (planned_date);
create index if not exists idx_shipping_plans_partner
  on public.shipping_plans (partner_id);
create index if not exists idx_shipping_plans_deleted_at
  on public.shipping_plans (deleted_at) where deleted_at is not null;

-- 확인
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'shipping_plans'
 order by ordinal_position;
