# Lang-Learn 技术架构设计文档

## 📋 项目概述

**目标：** 月入 3000-5000 HKD 的语言学习 SaaS 应用  
**核心功能：** AI 例句生成 + 用户收藏 + 变现系统  
**技术栈：** Next.js + TypeScript + Tailwind + Supabase + WebLLM/OpenRouter

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
│  │ /api/generate│  │ /api/auth/*  │  │ /api/favorites/* │   │
│  │ 例句生成接口  │  │ 登录验证接口  │  │ 收藏管理接口     │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │/api/payments │  │ /api/webhook │                          │
│  │ 支付处理接口  │  │  webhook接收 │                          │
│  └──────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        数据层 (Supabase)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   users      │  │  favorites   │  │  usage_logs      │   │
│  │  用户表      │  │  收藏表      │  │  使用记录表       │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │  email_codes │  │ subscriptions│                          │
│  │  验证码表    │  │  订阅表      │                          │
│  └──────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       外部服务层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  WebLLM      │  │ OpenRouter   │  │  Resend (邮件)   │   │
│  │ 本地AI模型   │  │ 云端AI API   │  │  验证码发送      │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │  Stripe      │  │  AdSense     │                          │
│  │ 支付处理     │  │  广告投放    │                          │
│  └──────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ 数据库设计 (Supabase)

### 1. 用户表 (users)

```sql
-- 用户表（无密码登录）
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  display_name text,
  avatar_url text,
  is_premium boolean default false,
  daily_quota integer default 10, -- 免费用户每日限额
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 启用 RLS
alter table users enable row level security;

-- 用户只能查看自己的数据
create policy "Users can view own profile" on users
  for select using (auth.uid() = id);

create policy "Users can update own profile" on users
  for update using (auth.uid() = id);
```

### 2. 验证码表 (email_codes)

```sql
-- 邮箱验证码表（10分钟有效）
create table email_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null, -- 6位数字
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);

-- 自动清理过期验证码的函数
create or replace function cleanup_expired_codes()
returns void as $$
begin
  delete from email_codes where expires_at < now();
end;
$$ language plpgsql;

-- 每分钟执行一次清理
create extension if not exists pg_cron;
select cron.schedule('cleanup-codes', '0 * * * *', 'select cleanup_expired_codes()');
```

### 3. 收藏表 (favorites)

```sql
-- 用户收藏表
create table favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  word text not null,
  sentence_original text not null,
  sentence_translation text not null,
  context text, -- 语境类型：日常对话、工作场景等
  lang text not null, -- ja, en, zh
  model text, -- 生成模型：qwen3-4b, gemma-2b等
  tags text[], -- 标签数组，方便分类
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

-- RLS策略
create policy "Users can view own favorites" on favorites
  for select using (auth.uid() = user_id);

create policy "Users can insert own favorites" on favorites
  for insert with check (auth.uid() = user_id);

create policy "Users can update own favorites" on favorites
  for update using (auth.uid() = user_id);

create policy "Users can delete own favorites" on favorites
  for delete using (auth.uid() = user_id);

-- 免费用户限额：最多100条收藏
create or replace function check_favorite_limit()
returns trigger as $$
declare
  favorite_count integer;
  user_is_premium boolean;
begin
  -- 检查用户是否付费
  select is_premium into user_is_premium from users where id = new.user_id;
  
  if user_is_premium then
    return new; -- 付费用户无限制
  end if;
  
  -- 检查收藏数量
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
```

### 4. 使用记录表 (usage_logs)

```sql
-- 用户使用记录（用于统计和限额）
create table usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  word text not null,
  lang text not null,
  model text not null,
  backend_type text not null, -- webllm, openrouter
  tokens_used integer, -- API调用token数
  created_at timestamptz default now()
);

-- 索引
create index idx_usage_logs_user_id on usage_logs(user_id);
create index idx_usage_logs_created on usage_logs(created_at);

-- 获取用户今日使用次数的函数
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

### 5. 订阅表 (subscriptions)

```sql
-- 用户订阅表（Stripe集成）
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade unique not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null, -- active, canceled, past_due
  price_id text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 索引
create index idx_subscriptions_user_id on subscriptions(user_id);
create index idx_subscriptions_status on subscriptions(status);

-- RLS
create policy "Users can view own subscription" on subscriptions
  for select using (auth.uid() = user_id);
```

---

## 🔐 认证系统架构

### 无密码登录流程

```
┌─────────┐     输入邮箱      ┌─────────┐
│  用户   │ ────────────────> │ 前端    │
└─────────┘                   └────┬────┘
                                   │
                                   ▼ POST /api/auth/send-code
                              ┌─────────┐
                              │ 后端    │
                              │ - 生成6位验证码
                              │ - 存入email_codes表
                              │ - 调用Resend发送邮件
                              └────┬────┘
                                   │
                                   ▼
                              ┌─────────┐
                              │ Resend  │
                              │ 邮件服务 │
                              └────┬────┘
                                   │ 发送验证码邮件
                                   ▼
┌─────────┐     输入验证码    ┌─────────┐
│  用户   │ ────────────────> │ 前端    │
└─────────┘                   └────┬────┘
                                   │
                                   ▼ POST /api/auth/verify
                              ┌─────────┐
                              │ 后端    │
                              │ - 验证验证码
                              │ - 创建/获取用户
                              │ - 生成JWT token
                              │ - 返回token
                              └────┬────┘
                                   │
                                   ▼
                              ┌─────────┐
                              │  用户   │
                              │ 已登录  │
                              └─────────┘
```

### API 端点设计

```typescript
// 1. 发送验证码
POST /api/auth/send-code
Body: { email: string }
Response: { success: boolean, message: string }

// 2. 验证验证码并登录
POST /api/auth/verify
Body: { email: string, code: string }
Response: { 
  success: boolean, 
  token: string,
  user: { id, email, display_name, is_premium }
}

// 3. 刷新token
POST /api/auth/refresh
Headers: { Authorization: Bearer <token> }
Response: { token: string }

// 4. 登出
POST /api/auth/logout
Headers: { Authorization: Bearer <token> }
Response: { success: boolean }
```

### JWT Token 设计

```typescript
// Token payload
{
  sub: "user_uuid",      // 用户ID
  email: "user@example.com",
  iat: 1645000000,       // 签发时间
  exp: 1645096400,       // 过期时间（7天）
  premium: false         // 是否付费用户
}
```

---

## 💰 变现系统架构

### 变现策略矩阵

| 策略 | 实现难度 | 收入潜力 | 优先级 | 实施阶段 |
|------|----------|----------|--------|----------|
| **Lifetime Deal** | ⭐⭐ | ⭐⭐⭐⭐⭐ | P0 | 阶段1 |
| **Freemium订阅** | ⭐⭐⭐ | ⭐⭐⭐⭐ | P1 | 阶段2 |
| **广告(AdSense)** | ⭐ | ⭐⭐ | P2 | 阶段3 |
| **B2B教育授权** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | P2 | 阶段4 |

### 1. Lifetime Deal 策略

**定价：**
- Early Bird: $19 (前100名)
- Regular: $29
- Pro: $49 (包含所有未来功能)

**实现：**
```typescript
// 购买流程
1. 用户点击"Buy Lifetime" → Stripe Checkout
2. 支付成功 → Stripe webhook → 更新user.is_premium = true
3. 用户获得永久Pro权限
```

**Stripe产品配置：**
```json
{
  "product": {
    "name": "Lang-Learn Lifetime",
    "description": "Lifetime access to all features"
  },
  "price": {
    "unit_amount": 2900, // $29.00
    "currency": "usd",
    "type": "one_time"
  }
}
```

### 2. Freemium 策略

**分层设计：**

```typescript
const TIERS = {
  free: {
    name: 'Free',
    price: 0,
    features: {
      daily_generations: 10,
      max_favorites: 100,
      contexts: ['日常对话', '工作场景', '情感表达'],
      export_formats: ['text'],
      support: 'community'
    }
  },
  pro: {
    name: 'Pro',
    price: 3, // $3/month
    features: {
      daily_generations: 100,
      max_favorites: 1000,
      contexts: 'all', // 全部5种
      export_formats: ['text', 'anki', 'csv'],
      support: 'email',
      beta_features: true
    }
  },
  premium: {
    name: 'Premium',
    price: 8, // $8/month
    features: {
      daily_generations: 'unlimited',
      max_favorites: 'unlimited',
      contexts: 'all',
      export_formats: ['text', 'anki', 'csv', 'pdf'],
      support: 'priority',
      beta_features: true,
      custom_themes: true
    }
  }
};
```

**限额检查中间件：**
```typescript
// middleware.ts
export async function middleware(req: NextRequest) {
  const user = await getUserFromToken(req);
  
  if (!user.is_premium) {
    const todayUsage = await getTodayUsage(user.id);
    if (todayUsage >= 10) {
      return new Response('Daily limit reached', { status: 429 });
    }
  }
}
```

### 3. 广告策略

**实现：**
```typescript
// 免费用户显示广告
const AdBanner = () => {
  const { user } = useAuth();
  
  if (user?.is_premium) return null; // 付费用户不显示
  
  return (
    <ins className="adsbygoogle"
         style={{ display: 'block' }}
         data-ad-client="ca-pub-XXXXXXXX"
         data-ad-slot="XXXXXXXX"
         data-ad-format="auto"
         data-full-width-responsive="true">
    </ins>
  );
};
```

**收入预估：**
- 日 PV 5000 → 月收 ~$200-300 USD
- 需要6-12个月SEO才能达到

---

## 📊 成本分析

### 月度运营成本

| 服务 | 费用 | 说明 |
|------|------|------|
| Vercel Pro | $20 | 托管 + Analytics |
| Supabase Pro | $25 | 数据库 (100万行) |
| Resend | $0 | 免费3000封/月 |
| OpenRouter | ~$20 | 按量付费 |
| Stripe | $0 | 手续费从收入扣 |
| **总计** | **~$65 USD** | **~$500 HKD** |

### 盈亏平衡点

```
成本: $65 USD/month ≈ $500 HKD/month
目标收入: $385-640 USD/month ≈ 3000-5000 HKD/month
净利润: $320-575 USD/month

需要付费用户:
- Lifetime: 2-3个/月 或
- 订阅: 130个@$3/月 或 65个@$5/月
```

---

## 🛠️ 实现路线图

### 阶段1：核心功能（2-3周）

**Week 1-2: 收藏系统**
- [ ] Supabase 数据库设置
- [ ] 收藏CRUD API
- [ ] 前端收藏UI
- [ ] Anki导出功能

**Week 3: 登录系统**
- [ ] Resend邮件集成
- [ ] 验证码API
- [ ] JWT认证
- [ ] 登录UI

**交付：** 用户可以注册、登录、收藏例句

### 阶段2：变现准备（2周）

**Week 4-5: 支付系统**
- [ ] Stripe集成
- [ ] 产品/定价配置
- [ ] 订阅管理
- [ ] 付费墙逻辑

**交付：** 可以接受付费

### 阶段3：产品发布（1-2周）

**Week 6-7: 发布准备**
- [ ] Landing Page优化
- [ ] Product Hunt准备
- [ ] 文档/FAQ
- [ ] 用户反馈渠道

**交付：** 正式发布，开始获客

### 阶段4：增长优化（持续）

- [ ] SEO内容营销
- [ ] 用户反馈迭代
- [ ] 推荐系统（邀请返利）
- [ ] B2B销售

---

## 🔐 安全考虑

### 1. API限流
```typescript
// rate limiter
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 每分钟10次
});
```

### 2. 数据保护
- 所有API启用HTTPS
- 敏感数据加密存储
- 定期备份Supabase

### 3. 隐私合规
- GDPR: 提供数据导出/删除功能
- 隐私政策页面
- Cookie consent

---

## 📈 成功指标

| 指标 | 目标值 | 时间点 |
|------|--------|--------|
| 日活用户 | 100 | 月1 |
| 注册用户 | 1000 | 月3 |
| 付费用户 | 50 | 月3 |
| 月收入 | $300 USD | 月3 |
| 月收入 | $1000 USD | 月6 |

---

## 🚀 下一步行动

**今天可以做的：**
1. 创建Supabase项目
2. 设置Resend账户
3. 申请Stripe账户

**这周要做的：**
1. 实现收藏功能
2. 实现邮件登录
3. 准备Product Hunt发布材料

**需要我帮你写哪个部分的代码？**
- A. Supabase数据库schema
- B. 邮件登录API
- C. Stripe支付集成
- D. 前端收藏UI
