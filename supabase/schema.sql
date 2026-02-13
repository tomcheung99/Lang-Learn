-- Lang-Learn Database Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. 用户扩展表
-- ============================================
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  display_name text,
  avatar_url text,
  is_premium boolean default false,
  daily_quota integer default 10,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 当 Auth 用户创建时，自动创建 public.users 记录
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS：用户只能看自己的数据
create policy "Users can view own profile" on public.users
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

-- ============================================
-- 2. 收藏表
-- ============================================
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  word text not null,
  sentence_original text not null,
  sentence_translation text not null,
  context text, -- 语境类型：日常对话、工作场景等
  lang text not null, -- ja, en, zh
  model text, -- 生成模型：qwen3-4b, gemma-2b等
  tags text[], -- 标签数组
  notes text, -- 用户笔记
  is_exported boolean default false, -- 是否已导出到Anki
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 索引
create index idx_favorites_user_id on favorites(user_id);
create index idx_favorites_word on favorites(word);
create index idx_favorites_lang on favorites(lang);
create index idx_favorites_created on favorites(created_at desc);

-- RLS
create policy "Users can CRUD own favorites" on favorites
  for all using (auth.uid() = user_id);

-- 免费用户限制：100条收藏
create or replace function check_favorite_limit()
returns trigger as $$
declare
  favorite_count integer;
  user_is_premium boolean;
begin
  select is_premium into user_is_premium from public.users where id = new.user_id;
  
  if user_is_premium then
    return new;
  end if;
  
  select count(*) into favorite_count from favorites where user_id = new.user_id;
  
  if favorite_count >= 100 then
    raise exception 'Free users can only save up to 100 favorites. Upgrade to Premium for unlimited.';
  end if;
  
  return new;
end;
$$ language plpgsql;

create trigger check_favorite_limit_trigger
  before insert on favorites
  for each row execute function check_favorite_limit();

-- ============================================
-- 3. 使用记录表
-- ============================================
create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  word text not null,
  lang text not null,
  model text not null,
  backend_type text not null, -- webllm, openrouter
  tokens_used integer,
  created_at timestamptz default now()
);

create index idx_usage_user_created on usage_logs(user_id, created_at);

-- RLS
create policy "Users can view own usage logs" on usage_logs
  for select using (auth.uid() = user_id);

-- 获取今日使用量
create or replace function get_today_usage(user_uuid uuid)
returns integer as $$
begin
  return (
    select count(*) from usage_logs
    where user_id = user_uuid
    and created_at >= date_trunc('day', now())
  );
end;
$$ language plpgsql;

-- ============================================
-- 4. 订阅表（Stripe集成）
-- ============================================
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade unique not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null, -- active, canceled, past_due
  price_id text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_subscriptions_user_id on subscriptions(user_id);
create index idx_subscriptions_status on subscriptions(status);

-- RLS
create policy "Users can view own subscription" on subscriptions
  for select using (auth.uid() = user_id);

-- ============================================
-- 5. 启用 RLS 对所有表
-- ============================================
alter table public.users enable row level security;
alter table public.favorites enable row level security;
alter table public.usage_logs enable row level security;
alter table public.subscriptions enable row level security;

-- ============================================
-- 6. 自动更新时间戳函数
-- ============================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 为所有表添加自动更新触发器
create trigger update_users_updated_at
  before update on public.users
  for each row execute function update_updated_at_column();

create trigger update_favorites_updated_at
  before update on public.favorites
  for each row execute function update_updated_at_column();

create trigger update_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function update_updated_at_column();

-- ============================================
-- 7. 清理旧使用记录的函数（可选）
-- ============================================
create or replace function cleanup_old_usage_logs()
returns void as $$
begin
  -- 删除 90 天前的使用记录
  delete from usage_logs where created_at < now() - interval '90 days';
end;
$$ language plpgsql;

-- 每天运行一次清理（需要 pg_cron 扩展）
-- select cron.schedule('cleanup-usage-logs', '0 0 * * *', 'select cleanup_old_usage_logs()');
