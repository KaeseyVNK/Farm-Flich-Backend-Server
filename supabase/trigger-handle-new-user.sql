-- ============================================================
-- handle_new_user trigger — Masked Farm
-- Tự tạo public."User" row khi auth.users insert (anon + email + Google).
-- Chạy 1 lần trên Supabase SQL Editor (hoặc prisma db execute).
--
-- Lý do: project dùng Prisma (server-authoritative). Migration Prisma
-- không chạy được trigger trên auth schema; trigger này bắt buộc để
-- user mới đăng nhập không bị lỗi "user không tồn tại" khi save farm.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
security definer set search_path = public
as $$
begin
  insert into public."User" (id, "displayName", "isAnonymous", "createdAt", "lastSeenAt")
  values (
    new.id::text,
    coalesce(new.raw_user_meta_data->>'displayName', new.email, null),
    -- Ưu tiên cột is_anonymous (Supabase mới); fallback raw_app_meta_data (bản cũ).
    coalesce(
      case when new.is_anonymous then true else null end,
      (new.raw_app_meta_data->>'is_anonymous')::boolean,
      false
    ),
    now(),
    now()
  )
  on conflict (id) do nothing;

  -- Khởi tạo 2 cloud-sync model (progression + story flags) cho user mới.
  -- Plan ADR-005 line 74/212: trigger tạo row mặc định để first-write cloud sync
  -- (upsert) không đụng chỗ chưa có row. Idempotent — user cũ chạy trigger lại
  -- sau khi bảng được tạo (ghost tables 2026-08-13) chỉ no-op.
  -- TRY/CATCH: bảng mới migrate sau trigger cài (user cũ, không re-run) → skip
  -- thay vì break on_auth_user_created khi bảng chưa tồn tại.
  begin
    insert into public."UserProgression" ("id", "userId")
    values (gen_random_uuid()::text, new.id::text)
    on conflict ("userId") do nothing;
    insert into public."UserStoryFlags" ("id", "userId")
    values (gen_random_uuid()::text, new.id::text)
    on conflict ("userId") do nothing;
  exception when undefined_table then
    null; -- bảng chưa tồn tại (pre-2026-08-13) → bỏ qua, không phá trigger
  end;

  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
