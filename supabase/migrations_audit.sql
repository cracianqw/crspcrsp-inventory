-- ============================================================
-- 권한 체계 확장 + 감사(audit) + 소프트 딜리트 마이그레이션
-- Supabase Dashboard > SQL Editor 에서 실행
-- ============================================================

-- 1) senior_manager 권한 추가 (기존 제약조건 교체)
alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check
  check (role in ('master','senior_manager','manager','worker'));

-- 2) 누락된 created_by 컬럼 보충
alter table public.items          add column if not exists created_by uuid references public.users(id);
alter table public.raw_materials  add column if not exists created_by uuid references public.users(id);
alter table public.partners       add column if not exists created_by uuid references public.users(id);
alter table public.partner_specs  add column if not exists created_by uuid references public.users(id);

-- 3) 모든 관리 테이블에 updated_by / updated_at / deleted_by / deleted_at 추가
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'items','raw_materials','partners','partner_specs',
      'receiving_lots','weekly_plans',
      'production_records','packaging_records',
      'shipping_orders','shipping_items','waste_records','users'
    ])
  loop
    execute format('alter table public.%I add column if not exists updated_by uuid references public.users(id)', t);
    execute format('alter table public.%I add column if not exists updated_at timestamptz', t);
    execute format('alter table public.%I add column if not exists deleted_by uuid references public.users(id)', t);
    execute format('alter table public.%I add column if not exists deleted_at timestamptz', t);
  end loop;
end $$;

-- 4) 소프트 딜리트 조회 최적화 인덱스
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'items','raw_materials','partners',
      'receiving_lots','weekly_plans',
      'production_records','packaging_records',
      'shipping_orders','waste_records','users'
    ])
  loop
    execute format('create index if not exists idx_%I_deleted_at on public.%I (deleted_at) where deleted_at is not null', t, t);
  end loop;
end $$;

-- 5) 확인
select role, count(*) from public.users group by role;
