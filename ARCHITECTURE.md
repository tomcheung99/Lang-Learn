# Lang-Learn 技术架构设计文档 (V2 - 完全免费版)

## 📋 项目概述

**目标：** 月入 3000-5000 HKD 的语言学习 SaaS 应用  
**核心功能：** AI 例句生成 + 用户收藏 + 变现系统  
**技术栈：** Next.js + TypeScript + Tailwind + Supabase (Auth + DB) + WebLLM/OpenRouter

**关键决策：** 使用 **Supabase Auth Magic Link** 实现零成本邮件登录

---

## 💰 成本优化策略

### 免费服务组合

| 服务 | 免费额度 | 成本 | 说明 |
|------|----------|------|------|
| **Vercel** | 100GB/月, 6000分钟构建 | **$0** | 足够 1000-5000 用户 |
| **Supabase** | 500MB DB, 2GB 流量 | **$0** | Auth + DB 一体 |
| **OpenRouter** | Pay-as-you-go | **~$10 HKD/月** | Qwen3 8B 超便宜 |
| **邮件服务** | Supabase 内置 | **$0** | Magic Link 无限免费 |

**总计月度成本：~$10 HKD (仅 API 调用费)**

---

## 🏗️ 系统架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层 (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   例句生成    │  │   用户界面    │  │   收藏/历史管理   │   │
│  │  - WebLLM    │  │  - 登录/注册  │  │  - 收藏列表      │   │
│  │  - OpenRouter│  │  - 主题切换   │  │  - Anki导出      │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API 层 (Next.js API)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ /api/generate│  │ /api/favorites│  │ /api/payments    │   │
│  │ 例句生成接口  │  │ 收藏管理接口  │  │ 支付处理接口     │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Supabase 平台                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Auth       │  │   Database   │  │   Storage        │   │
│  │  - Magic Link│  │  - users     │  │  (可选)          │   │
│  │  - JWT Token │  │  - favorites │  │                  │   │
│  │  - RLS       │  │  - usage_logs│  │                  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       外部服务层                              │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │  WebLLM      │  │ OpenRouter   │                         │
│  │ 本地AI模型   │  │ 云端AI API   │                         │
│  └──────────────┘  └──────────────┘                         │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │  Stripe      │  │  AdSense     │                         │
│  │ 支付处理     │  │  广告投放    │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 认证系统架构 (Supabase Auth)

### 为什么选择 Supabase Auth？

| 功能 | Supabase Auth | 自建方案 |
|------|---------------|----------|
| **开发速度** | ⭐⭐⭐⭐⭐ 开箱即用 | ⭐⭐ 需大量代码 |
| **Magic Link** | ✅ 内置免费 | ❌ 需集成 Resend |
| **OAuth** | ✅ Google/GitHub 一键集成 | ❌ 需自己开发 |
| **Session 管理** | ✅ 自动处理 | ❌ 需自己实现 |
| **安全性** | ⭐⭐⭐⭐⭐ 专业维护 | ⭐⭐⭐ 靠自己 |
| **成本** | **$0** | Resend $0-20/月 |

### Magic Link 登录流程

```
┌─────────┐     输入邮箱      ┌─────────┐     调用 signInWithOtp()   ┌─────────┐
│  用户   │ ────────────────> │  前端   │ ─────────────────────────> │ Supabase│
└─────────┘                   └─────────┘                           │  Auth   │
                                                                     │         │
                                                                     │ 自动生成 │
                                                                     │ Magic   │
                                                                     │ Link    │
                                                                     │ 邮件    │
                                                                     └────┬────┘
                                                                          │
                                                                          │ 发送邮件
                                                                          ▼
┌─────────┐     点击邮件链接    ┌─────────┐     自动登录 + JWT      ┌─────────┐
│  用户   │ ─────────────────> │ 浏览器  │ ─────────────────────> │  已登录  │
│  邮箱   │                     │ 跳转    │                         │  用户   │
└─────────┘                     └─────────┘                         └─────────┘
```

### 实现代码示例

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 登录组件
export function LoginForm() {
  const [email, setEmail] = useState('')
  
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })
    
    if (error) {
      alert('发送失败: ' + error.message)
    } else {
      alert('Magic Link 已发送到您的邮箱！')
    }
  }
  
  return (
    <form>
      <input 
        type="email" 
        value={email} 
        onChange={e => setEmail(e.target.value)}
        placeholder="输入邮箱"
      />
      <button onClick={handleLogin}>发送 Magic Link</button>
    </form>
  )
}

// 获取当前用户
export function useUser() {
  const [user, setUser] = useState(null)
  
  useEffect(() => {
    // 获取当前 session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    
    // 监听登录状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )
    
    return () => subscription.unsubscribe()
  }, [])
  
  return user
}

// 登出
export async function signOut() {
  await supabase.auth.signOut()
}
```

### 自定义邮件模板（可选）

```typescript
// 在 Supabase Dashboard - Auth - Email Templates 中配置

// Magic Link 邮件模板
{
  "subject": "登录到 Lang-Learn",
  "content": `
    <h2>点击以下链接登录</h2>
    <p><a href="{{ .ConfirmationURL }}">登录到 Lang-Learn</a></p>
    <p>或复制链接: {{ .ConfirmationURL }}</p>
    <p>此链接 60 分钟内有效。</p>
  `
}
```

---

## 🗄️ 数据库设计 (Supabase)

### 1. 启用 Auth 用户表

Supabase Auth 自动创建 `auth.users` 表，我们只需要关联表：

```sql
-- 用户扩展表（存储应用特定信息）
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
```

### 2. 收藏表

```sql
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  word text not null,
  sentence_original text not null,
  sentence_translation text not null,
  context text,
  lang text not null,
  model text,
  tags text[],
  notes text,
  is_exported boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 索引
create index idx_favorites_user_id on favorites(user_id);
create index idx_favorites_word on favorites(word);
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
    raise exception 'Free users can only save up to 100 favorites.';
  end if;
  
  return new;
end;
$$ language plpgsql;

create trigger check_favorite_limit_trigger
  before insert on favorites
  for each row execute function check_favorite_limit();
```

### 3. 使用记录表

```sql
create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  word text not null,
  lang text not null,
  model text not null,
  backend_type text not null,
  tokens_used integer,
  created_at timestamptz default now()
);

create index idx_usage_user_created on usage_logs(user_id, created_at);

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
```

---

## 💰 变现系统

### 收入模型

| 策略 | 定价 | 目标收入 |
|------|------|----------|
| **Lifetime Deal** | $29 一次性 | 首月 $500-1000 |
| **月度订阅** | $3-8/月 | 稳定 $300-800/月 |
| **广告** | AdSense | $100-200/月 (后期) |

### 盈亏平衡分析

```
月度成本: ~$10 HKD (仅 OpenRouter API)
目标收入: 3000-5000 HKD (~$385-640 USD)

需要付费用户:
- Lifetime: 15-25 个 ($29)
- 或订阅: 130-215 个 ($3/月)
- 或混合: 10 Lifetime + 100 订阅
```

**结论：只需要 2-3 个付费用户就能回本！** 🎉

---

## 🛠️ 实现路线图

### 阶段 1：核心功能（1-2周）

**Week 1: Supabase 设置**
- [ ] 创建 Supabase 项目
- [ ] 配置 Auth (Magic Link)
- [ ] 创建数据库表
- [ ] 设置 RLS 策略

**Week 2: 认证 + 收藏**
- [ ] 登录 UI (Magic Link)
- [ ] 收藏功能 (CRUD)
- [ ] 用户状态管理
- [ ] Anki 导出

**交付：** 用户可登录、生成例句、收藏

### 阶段 2：变现（1周）

- [ ] Stripe 集成
- [ ] 订阅系统
- [ ] 付费墙逻辑

### 阶段 3：发布（1周）

- [ ] Landing Page
- [ ] Product Hunt 发布
- [ ] 用户反馈收集

---

## 🔐 环境变量配置

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# OpenRouter (云端 AI)
OPENROUTER_API_KEY=sk-or-v1-...

# Stripe (支付)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## 📈 成功指标

| 阶段 | 时间 | 目标 |
|------|------|------|
| MVP | Week 2 | 可登录、收藏、导出 |
| Beta | Week 3 | 10 个测试用户 |
| Launch | Week 4 | Product Hunt 发布 |
| 盈利 | Month 2 | 首笔收入 |
| 目标 | Month 6 | 月入 3000-5000 HKD |

---

## 🚀 下一步行动

**今天就做：**
1. 创建 Supabase 项目 (https://supabase.com)
2. 启用 Auth，测试 Magic Link
3. 创建数据库表

**这周完成：**
- 登录功能
- 收藏功能
- 基础 UI

**要我帮你写哪部分代码？**
- A. Supabase 配置 + 数据库 schema
- B. Magic Link 登录组件
- C. 收藏功能完整实现
- D. 全部一起来 💪
