# THU-XY · 清华大学行健书院班级共建系统

简约风格的班级共建平台，采用清华紫主色调。支持账号体系、班级管理、实时论坛、活动统计、文件共享等完整功能，数据存储在 [Supabase](https://supabase.com)。

**版本**：v3.2.0  
**开发者**：陈炼 · 徐天泽  
**在线访问**：https://while-lian.github.io/thu-xy

---

## ✨ 功能特性

### 账号系统
- 📧 **邮箱注册 / 登录**：所有用户必须登录才能访问系统
- 🎭 **三类身份**：学生 / 班委 / 老师（辅导员），权限逐级递增
- 🔄 **身份可变化**：老师可在用户管理中修改任意成员的身份
- 👤 **个人中心**：更换头像、修改昵称、修改密码、注销账号
- 🔐 **密码重置**：忘记密码可联系班级管理员协助重置

### 班级管理
- 🏫 **班级广场**：浏览所有班级，申请加入或创建新班级
- 📨 **申请审批**：班委审批学生申请，老师审批所有申请（含班委/老师申请）
- 🚪 **退出 / 删除班级**：成员可退出，创建者（老师）可删除班级
- 🔔 **通知中心**：申请、批准、拒绝、@提及等消息实时通知

### 班级事务
- 📅 **三种视图**：时间轴 / 时间表 / 列表，自由切换
- 🔄 **实时同步**：任何修改立即推送到所有在线用户
- 👥 **职务筛选**：按职务 + 姓名筛选自己负责的活动
- ✏️ **管理员编辑**：班委/老师可增删改活动，同学只读
- 🎯 **活动报名**：同学一键表态参与/不参与/待定，班委查看统计
- 🖼️ **头像墙**：展示本班所有成员的头像

### 班级论坛
- 🏫 **三级 scope**：本班 / 年级 / 公共 论坛自由切换
- 💬 **嵌套回复**：支持楼中楼（最多 3 层缩进）
- 👍 **发帖 / 点赞 / 搜索**：关键词高亮匹配
- 🖼️ **帖子图片**：发帖可附带最多 9 张图片，点击全屏预览
- @ **@提及**：输入 @ 弹出成员列表，被提及者收到通知
- 📄 **分页加载**：首屏 20 条，底部"加载更多"翻页

### 活动统计
- 🗳️ **时间投票**：When2meet 风格网格，点击/拖动选择空闲时间，颜色深浅显示人数
- 🔗 **接龙**：一键参与/取消，支持截止时间、人数上限、备注
- 📋 **一键复制名单**：方便班委发微信群

### 班级文件
- 📁 **拖拽上传**：支持分类（文件夹），顶部按文件夹筛选
- 👀 **全班可看**：所有同学都能查看和下载
- 🔒 **管理员操作**：上传、删除权限仅限班委/老师

### 班级相册
- 📸 **照片墙**：网格布局，支持批量上传
- 🔍 **点击预览**：全屏查看大图，显示上传者和时间
- 🔒 **管理员管理**：仅班委/老师可上传和删除

### 公告系统
- 📣 **发布公告**：班委/老师可发布公告
- 📌 **置顶功能**：重要公告置顶到首页最上方（橙色醒目）
- ✏️ **编辑 / 删除**：班委/老师可随时修改或删除

### 个人管理
- 📅 **日程**：添加个人日程，仅本人可见
- ⏰ **DDL**：独立于日程，按截止临近程度变色提醒（逾期深红、今天红、3 天橙、7 天黄）
- ✅ **已完成标记**：点击"已完成"后从首页消失
- 🏠 **首页提醒**：未来 7 天日程 + 未完成 DDL 自动显示

### 数据统计（班委/老师专属）
- 📊 **整体概览**：成员、帖子、回复、文件、照片、公告、活动数量
- 📈 **7 天发帖趋势**：柱状图展示每日发帖量
- 🏆 **发帖排行**：Top 10 发帖达人
- 📁 **文件上传排行**
- 🎯 **活动参与率**：每个活动的参与/待定/不参与比例

### 界面
- 📱 **响应式设计**：适配手机、平板、电脑
- 🎨 **清华紫主题**：简约美观，符合学校风格
- 💀 **骨架屏**：加载时显示灰色占位卡片
- 🔄 **实时同步**：基于 Supabase Realtime

---

## 👥 角色权限

| 功能 | 学生 | 班委 | 老师 |
|------|:---:|:---:|:---:|
| 查看班级内容 | ✅ | ✅ | ✅ |
| 发帖 / 回复 / 点赞 | ✅ | ✅ | ✅ |
| 删除自己的帖子 | ✅ | ✅ | ✅ |
| 删除所有人的帖子 | ❌ | ✅ | ✅ |
| 编辑班级事务 | ❌ | ✅ | ✅ |
| 上传 / 删除文件 | ❌ | ✅ | ✅ |
| 上传 / 删除照片 | ❌ | ✅ | ✅ |
| 发布公告 | ❌ | ✅ | ✅ |
| 发布投票 / 接龙 | ❌ | ✅ | ✅ |
| 用户管理 / 重置密码 | ❌ | ✅ | ✅ |
| 数据统计面板 | ❌ | ✅ | ✅ |
| **修改成员身份** | ❌ | ❌ | ✅ |
| **审批班委/老师申请** | ❌ | ❌ | ✅ |

---

## 🚀 快速开始

### 本地运行

推荐使用 VS Code 的 **Live Server** 扩展，或在本目录运行：

```bash
python -m http.server 8000
然后访问 http://localhost:8000/login.html

⚠️ 不要直接双击 HTML 文件打开（file:// 协议），Supabase 请求会失败。

部署到公网
第一步：创建 Supabase 项目
访问 Supabase 控制台，用 GitHub 账号登录

点击 "New project"

填写：

Project name：thu-xy（或任意名称）

Database Password：点 "Generate a password" 自动生成（保存好）

Region：选 Singapore（新加坡，国内访问最快）

Pricing Plan：默认 Free

点击 "Create new project"，等待 1-2 分钟

第二步：初始化数据库
项目创建完成后，左侧菜单 → SQL Editor

点击 New query

执行以下 SQL 脚本（点击展开）：

<details> <summary>📄 点击展开 SQL 脚本（约 500 行）</summary>
sql
-- ============================================================
-- THU-XY v3.2.0 完整数据库配置
-- ============================================================

-- 0. 扩展
create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- 1. 班级表
-- ============================================================
create table if not exists public.classes (
  id text primary key,
  name text not null,
  grade text,
  creator_id uuid references auth.users(id) on delete set null,
  description text,
  created_at timestamptz default now()
);

alter table public.classes enable row level security;
drop policy if exists "classes_select" on public.classes;
create policy "classes_select" on public.classes
  for select using (auth.role() = 'authenticated');

-- 种子数据
insert into public.classes (id, name, grade, creator_id)
values 
  ('xingjian63', '行健63班', 'xingjian2026', null),
  ('xingjian-li6', '行健-力6班', 'xingjian2026', null)
on conflict (id) do nothing;

-- ============================================================
-- 2. profiles 表
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  class_id text,
  grade text,
  role text not null default 'student' check (role in ('student', 'committee', 'teacher')),
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create unique index if not exists profiles_nickname_unique
  on public.profiles (lower(nickname));

-- ============================================================
-- 3. 新用户自动创建 profile
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_code text;
  v_role text := 'student';
begin
  v_code := new.raw_user_meta_data->>'invite_code';

  if v_code is not null and length(trim(v_code)) > 0 then
    select role into v_role
    from public.global_invite_codes
    where code = trim(v_code)
    limit 1;
    if v_role is null then v_role := 'student'; end if;
  end if;

  insert into public.profiles (id, nickname, class_id, role, grade)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nickname', '同学'),
    nullif(new.raw_user_meta_data->>'class_id', ''),
    v_role,
    nullif(new.raw_user_meta_data->>'grade', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 4. 自动确认邮箱（绕过邮件限制）
-- ============================================================
create or replace function public.auto_confirm_email()
returns trigger
language plpgsql security definer
set search_path = public, auth
as $$
begin
  update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_confirm on auth.users;
create trigger on_auth_user_created_confirm
  after insert on auth.users
  for each row execute function public.auto_confirm_email();

-- ============================================================
-- 5. 全局邀请码
-- ============================================================
create table if not exists public.global_invite_codes (
  code text primary key,
  role text not null check (role in ('committee', 'teacher')),
  created_at timestamptz default now()
);

alter table public.global_invite_codes enable row level security;

insert into public.global_invite_codes (code, role)
values 
  ('THU-XY-TEACHER-2026', 'teacher'),
  ('THU-XY-ADMIN-2026', 'committee')
on conflict (code) do nothing;

-- 班级邀请码（兼容旧版）
create table if not exists public.class_admin_codes (
  class_id text primary key,
  code text not null,
  updated_at timestamptz default now()
);

alter table public.class_admin_codes enable row level security;

create table if not exists public.class_invite_codes (
  id bigserial primary key,
  class_id text not null,
  code text not null unique,
  role text not null check (role in ('committee', 'teacher')),
  created_at timestamptz default now()
);

alter table public.class_invite_codes enable row level security;

-- ============================================================
-- 6. 注册前检查
-- ============================================================
create or replace function public.check_nickname_available(p_nickname text)
returns boolean
language sql security definer set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where lower(nickname) = lower(p_nickname)
  );
$$;

create or replace function public.check_email_available(p_email text)
returns boolean
language sql security definer set search_path = public, auth
as $$
  select not exists (
    select 1 from auth.users where lower(email) = lower(p_email)
  );
$$;

grant execute on function public.check_nickname_available to anon, authenticated;
grant execute on function public.check_email_available to anon, authenticated;

-- ============================================================
-- 7. 班级申请
-- ============================================================
create table if not exists public.class_join_requests (
  id bigserial primary key,
  class_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null,
  user_email text,
  requested_role text not null check (requested_role in ('student', 'committee', 'teacher')),
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_by_name text,
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz default now(),
  unique (class_id, user_id)
);

alter table public.class_join_requests enable row level security;

drop policy if exists "join_requests_select" on public.class_join_requests;
create policy "join_requests_select" on public.class_join_requests
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and class_id = class_join_requests.class_id and role in ('committee', 'teacher'))
  );

drop policy if exists "join_requests_insert" on public.class_join_requests;
create policy "join_requests_insert" on public.class_join_requests
  for insert with check (auth.uid() = user_id);

drop policy if exists "join_requests_delete" on public.class_join_requests;
create policy "join_requests_delete" on public.class_join_requests
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and class_id = class_join_requests.class_id and role in ('committee', 'teacher'))
  );

-- ============================================================
-- 8. 通知中心
-- ============================================================
create table if not exists public.notifications (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  related_id bigint,
  is_read boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_user on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications for select using (auth.uid() = user_id);

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications for update using (auth.uid() = user_id);

drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_delete" on public.notifications for delete using (auth.uid() = user_id);

-- ============================================================
-- 9. 论坛帖子
-- ============================================================
create table if not exists public.class_posts (
  id bigserial primary key,
  class_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  author text not null,
  content text not null,
  scope text not null default 'class' check (scope in ('public', 'grade', 'class')),
  grade text,
  likes integer not null default 0,
  image_urls jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table public.class_posts enable row level security;

drop policy if exists "class_posts_select" on public.class_posts;
create policy "class_posts_select" on public.class_posts
  for select using (
    auth.role() = 'authenticated'
    and (
      scope = 'public'
      or (scope = 'grade' and grade = (select grade from public.profiles where id = auth.uid()))
      or (scope = 'class' and class_id = (select class_id from public.profiles where id = auth.uid()))
    )
  );

drop policy if exists "class_posts_insert" on public.class_posts;
create policy "class_posts_insert" on public.class_posts
  for insert with check (
    auth.role() = 'authenticated'
    and auth.uid() = user_id
    and (
      scope = 'public'
      or (scope = 'grade' and grade = (select grade from public.profiles where id = auth.uid()))
      or (scope = 'class' and class_id = (select class_id from public.profiles where id = auth.uid()))
    )
  );

drop policy if exists "class_posts_delete" on public.class_posts;
create policy "class_posts_delete" on public.class_posts
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher'))
  );

drop policy if exists "class_posts_update" on public.class_posts;
create policy "class_posts_update" on public.class_posts
  for update using (auth.role() = 'authenticated');

-- ============================================================
-- 10. 论坛回复
-- ============================================================
create table if not exists public.class_replies (
  id bigint generated by default as identity primary key,
  post_id bigint not null references public.class_posts(id) on delete cascade,
  parent_id bigint references public.class_replies(id) on delete cascade,
  class_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  author text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.class_replies enable row level security;

drop policy if exists "replies_select" on public.class_replies;
create policy "replies_select" on public.class_replies for select using (auth.role() = 'authenticated');

drop policy if exists "replies_insert" on public.class_replies;
create policy "replies_insert" on public.class_replies
  for insert with check (auth.role() = 'authenticated' and auth.uid() = user_id);

drop policy if exists "replies_delete" on public.class_replies;
create policy "replies_delete" on public.class_replies
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher'))
  );

-- ============================================================
-- 11. 点赞表
-- ============================================================
create table if not exists public.post_likes (
  post_id bigint not null references public.class_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

drop policy if exists "likes_select" on public.post_likes;
create policy "likes_select" on public.post_likes for select using (auth.role() = 'authenticated');
drop policy if exists "likes_insert" on public.post_likes;
create policy "likes_insert" on public.post_likes for insert with check (auth.uid() = user_id);
drop policy if exists "likes_delete" on public.post_likes;
create policy "likes_delete" on public.post_likes for delete using (auth.uid() = user_id);

create or replace function public.toggle_post_like(p_post_id bigint)
returns integer
language plpgsql security definer set search_path = public
as $$
declare new_count integer; exists_like boolean;
begin
  if auth.uid() is null then raise exception '未登录'; end if;
  select exists(select 1 from public.post_likes where post_id = p_post_id and user_id = auth.uid()) into exists_like;
  if exists_like then
    delete from public.post_likes where post_id = p_post_id and user_id = auth.uid();
    update public.class_posts set likes = greatest(likes - 1, 0) where id = p_post_id returning likes into new_count;
  else
    insert into public.post_likes (post_id, user_id) values (p_post_id, auth.uid());
    update public.class_posts set likes = likes + 1 where id = p_post_id returning likes into new_count;
  end if;
  return coalesce(new_count, 0);
end;
$$;

grant execute on function public.toggle_post_like to authenticated;

-- ============================================================
-- 12. 班级活动表
-- ============================================================
create table if not exists public.class_activities (
  id bigserial primary key,
  class_id text not null unique,
  activities jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.class_activities enable row level security;

drop policy if exists "允许所有人读取班级活动" on class_activities;
drop policy if exists "仅管理员可插入活动" on class_activities;
drop policy if exists "仅管理员可更新活动" on class_activities;
drop policy if exists "仅管理员可删除活动" on class_activities;

create policy "允许读取班级活动" on class_activities
  for select using (auth.role() = 'authenticated');
create policy "仅管理员可插入活动" on class_activities
  for insert with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));
create policy "仅管理员可更新活动" on class_activities
  for update using (exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));
create policy "仅管理员可删除活动" on class_activities
  for delete using (exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));

-- ============================================================
-- 13. 活动报名
-- ============================================================
create table if not exists public.activity_signups (
  id bigserial primary key,
  class_id text not null,
  activity_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null,
  status text not null check (status in ('yes', 'no', 'maybe')),
  remark text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (class_id, activity_key, user_id)
);

alter table public.activity_signups enable row level security;

drop policy if exists "signups_select" on public.activity_signups;
create policy "signups_select" on public.activity_signups
  for select using (auth.role() = 'authenticated' and exists (select 1 from public.profiles where id = auth.uid() and class_id = activity_signups.class_id));
drop policy if exists "signups_insert" on public.activity_signups;
create policy "signups_insert" on public.activity_signups for insert with check (auth.uid() = user_id);
drop policy if exists "signups_update" on public.activity_signups;
create policy "signups_update" on public.activity_signups for update using (auth.uid() = user_id);
drop policy if exists "signups_delete" on public.activity_signups;
create policy "signups_delete" on public.activity_signups for delete using (auth.uid() = user_id);

-- ============================================================
-- 14. 时间投票
-- ============================================================
create table if not exists public.time_polls (
  id bigserial primary key,
  class_id text not null,
  creator_id uuid references auth.users(id) on delete set null,
  creator_name text not null,
  title text not null,
  description text,
  slots jsonb not null default '[]'::jsonb,
  days jsonb not null default '[1,2,3,4,5]'::jsonb,
  start_hour integer not null default 8,
  end_hour integer not null default 23,
  deadline timestamptz,
  closed boolean not null default false,
  created_at timestamptz default now()
);

alter table public.time_polls enable row level security;

drop policy if exists "time_polls_select" on public.time_polls;
create policy "time_polls_select" on public.time_polls
  for select using (auth.role() = 'authenticated' and exists (select 1 from public.profiles where id = auth.uid() and class_id = time_polls.class_id));
drop policy if exists "time_polls_insert" on public.time_polls;
create policy "time_polls_insert" on public.time_polls
  for insert with check (auth.uid() = creator_id and exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));
drop policy if exists "time_polls_update" on public.time_polls;
create policy "time_polls_update" on public.time_polls
  for update using (auth.uid() = creator_id or exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));
drop policy if exists "time_polls_delete" on public.time_polls;
create policy "time_polls_delete" on public.time_polls
  for delete using (auth.uid() = creator_id or exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));

create table if not exists public.time_poll_votes (
  id bigserial primary key,
  poll_id bigint not null references public.time_polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null,
  slot_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (poll_id, user_id)
);

alter table public.time_poll_votes enable row level security;

drop policy if exists "poll_votes_select" on public.time_poll_votes;
create policy "poll_votes_select" on public.time_poll_votes for select using (auth.role() = 'authenticated');
drop policy if exists "poll_votes_insert" on public.time_poll_votes;
create policy "poll_votes_insert" on public.time_poll_votes for insert with check (auth.uid() = user_id);
drop policy if exists "poll_votes_update" on public.time_poll_votes;
create policy "poll_votes_update" on public.time_poll_votes for update using (auth.uid() = user_id);
drop policy if exists "poll_votes_delete" on public.time_poll_votes;
create policy "poll_votes_delete" on public.time_poll_votes for delete using (auth.uid() = user_id);

-- ============================================================
-- 15. 接龙
-- ============================================================
create table if not exists public.signup_chains (
  id bigserial primary key,
  class_id text not null,
  creator_id uuid references auth.users(id) on delete set null,
  creator_name text not null,
  title text not null,
  description text,
  deadline timestamptz,
  max_count integer,
  need_remark boolean not null default false,
  remark_label text default '备注',
  closed boolean not null default false,
  created_at timestamptz default now()
);

alter table public.signup_chains enable row level security;

drop policy if exists "chains_select" on public.signup_chains;
create policy "chains_select" on public.signup_chains
  for select using (auth.role() = 'authenticated' and exists (select 1 from public.profiles where id = auth.uid() and class_id = signup_chains.class_id));
drop policy if exists "chains_insert" on public.signup_chains;
create policy "chains_insert" on public.signup_chains
  for insert with check (auth.uid() = creator_id and exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));
drop policy if exists "chains_update" on public.signup_chains;
create policy "chains_update" on public.signup_chains
  for update using (auth.uid() = creator_id or exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));
drop policy if exists "chains_delete" on public.signup_chains;
create policy "chains_delete" on public.signup_chains
  for delete using (auth.uid() = creator_id or exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));

create table if not exists public.signup_chain_entries (
  id bigserial primary key,
  chain_id bigint not null references public.signup_chains(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null,
  remark text,
  joined_at timestamptz default now(),
  unique (chain_id, user_id)
);

alter table public.signup_chain_entries enable row level security;

drop policy if exists "chain_entries_select" on public.signup_chain_entries;
create policy "chain_entries_select" on public.signup_chain_entries for select using (auth.role() = 'authenticated');
drop policy if exists "chain_entries_insert" on public.signup_chain_entries;
create policy "chain_entries_insert" on public.signup_chain_entries for insert with check (auth.uid() = user_id);
drop policy if exists "chain_entries_delete" on public.signup_chain_entries;
create policy "chain_entries_delete" on public.signup_chain_entries for delete using (auth.uid() = user_id);

-- ============================================================
-- 16. 班级文件
-- ============================================================
create table if not exists public.class_files (
  id bigserial primary key,
  class_id text not null,
  name text not null,
  path text not null,
  size bigint,
  mime_type text,
  folder text default '默认',
  tags text[] default '{}',
  uploader_id uuid references auth.users(id) on delete set null,
  uploader_name text,
  created_at timestamptz default now()
);

create index if not exists idx_class_files_folder on public.class_files (class_id, folder);

alter table public.class_files enable row level security;

drop policy if exists "files_select" on public.class_files;
create policy "files_select" on public.class_files for select using (auth.role() = 'authenticated');
drop policy if exists "files_insert" on public.class_files;
create policy "files_insert" on public.class_files
  for insert with check (auth.uid() = uploader_id and exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));
drop policy if exists "files_delete" on public.class_files;
create policy "files_delete" on public.class_files
  for delete using (exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));

-- ============================================================
-- 17. 个人日程 / DDL
-- ============================================================
create table if not exists public.personal_events (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  event_date date not null,
  event_time text,
  location text,
  remark text,
  type text not null default 'event' check (type in ('event', 'ddl')),
  completed boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_personal_events_user_date on public.personal_events (user_id, event_date);

alter table public.personal_events enable row level security;

drop policy if exists "personal_events_select" on public.personal_events;
create policy "personal_events_select" on public.personal_events for select using (auth.uid() = user_id);
drop policy if exists "personal_events_insert" on public.personal_events;
create policy "personal_events_insert" on public.personal_events for insert with check (auth.uid() = user_id);
drop policy if exists "personal_events_update" on public.personal_events;
create policy "personal_events_update" on public.personal_events for update using (auth.uid() = user_id);
drop policy if exists "personal_events_delete" on public.personal_events;
create policy "personal_events_delete" on public.personal_events for delete using (auth.uid() = user_id);

-- ============================================================
-- 18. 公告
-- ============================================================
create table if not exists public.announcements (
  id bigserial primary key,
  class_id text not null,
  title text not null,
  content text not null,
  pinned boolean not null default false,
  creator_id uuid references auth.users(id) on delete set null,
  creator_name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_announcements_class on public.announcements (class_id, pinned desc, created_at desc);

alter table public.announcements enable row level security;

drop policy if exists "ann_select" on public.announcements;
create policy "ann_select" on public.announcements for select using (auth.role() = 'authenticated' and class_id = (select class_id from public.profiles where id = auth.uid()));
drop policy if exists "ann_insert" on public.announcements;
create policy "ann_insert" on public.announcements
  for insert with check (auth.uid() = creator_id and exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));
drop policy if exists "ann_update" on public.announcements;
create policy "ann_update" on public.announcements for update using (exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));
drop policy if exists "ann_delete" on public.announcements;
create policy "ann_delete" on public.announcements for delete using (exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));

-- ============================================================
-- 19. 班级相册
-- ============================================================
create table if not exists public.class_photos (
  id bigserial primary key,
  class_id text not null,
  path text not null,
  caption text,
  uploader_id uuid references auth.users(id) on delete set null,
  uploader_name text not null,
  created_at timestamptz default now()
);

create index if not exists idx_class_photos_class on public.class_photos (class_id, created_at desc);

alter table public.class_photos enable row level security;

drop policy if exists "photos_select" on public.class_photos;
create policy "photos_select" on public.class_photos for select using (auth.role() = 'authenticated' and class_id = (select class_id from public.profiles where id = auth.uid()));
drop policy if exists "photos_insert" on public.class_photos;
create policy "photos_insert" on public.class_photos
  for insert with check (auth.uid() = uploader_id and exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));
drop policy if exists "photos_delete" on public.class_photos;
create policy "photos_delete" on public.class_photos for delete using (exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));

-- ============================================================
-- 20. 班级创建 / 申请 / 审批 RPC
-- ============================================================
create or replace function public.create_class(p_id text, p_name text, p_grade text, p_description text default null)
returns boolean
language plpgsql security definer set search_path = public, auth
as $$
declare v_caller_role text;
begin
  if auth.uid() is null then raise exception '未登录'; end if;
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role <> 'teacher' then raise exception '只有老师可以创建班级'; end if;
  if exists (select 1 from public.classes where id = p_id) then raise exception '班级 ID 已存在'; end if;
  if p_id !~ '^[a-z0-9\-]+$' then raise exception '班级 ID 只能包含小写字母、数字、连字符'; end if;
  insert into public.classes (id, name, grade, creator_id, description) values (p_id, p_name, p_grade, auth.uid(), p_description);
  update public.profiles set class_id = p_id, grade = p_grade where id = auth.uid();
  return true;
end;
$$;

grant execute on function public.create_class to authenticated;

create or replace function public.apply_join_class(p_class_id text, p_role text, p_message text default null)
returns bigint
language plpgsql security definer set search_path = public, auth
as $$
declare v_request_id bigint; v_nickname text; v_email text; v_existing_status text;
begin
  if auth.uid() is null then raise exception '未登录'; end if;
  if p_role not in ('student', 'committee', 'teacher') then raise exception '无效的申请身份'; end if;
  if not exists (select 1 from public.classes where id = p_class_id) then raise exception '班级不存在'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and class_id = p_class_id) then raise exception '你已在该班级中'; end if;
  select status into v_existing_status from public.class_join_requests where class_id = p_class_id and user_id = auth.uid();
  if v_existing_status = 'pending' then raise exception '你已经提交过申请，请等待审批'; end if;
  if v_existing_status is not null then delete from public.class_join_requests where class_id = p_class_id and user_id = auth.uid(); end if;
  select nickname into v_nickname from public.profiles where id = auth.uid();
  select email::text into v_email from auth.users where id = auth.uid();
  insert into public.class_join_requests (class_id, user_id, user_name, user_email, requested_role, message)
  values (p_class_id, auth.uid(), coalesce(v_nickname, '同学'), v_email, p_role, p_message) returning id into v_request_id;
  return v_request_id;
end;
$$;

grant execute on function public.apply_join_class to authenticated;

create or replace function public.approve_join_request(p_request_id bigint)
returns boolean
language plpgsql security definer set search_path = public, auth
as $$
declare v_caller_role text; v_caller_class text; v_req record;
begin
  if auth.uid() is null then raise exception '未登录'; end if;
  select p.role, p.class_id into v_caller_role, v_caller_class from public.profiles p where p.id = auth.uid();
  select * into v_req from public.class_join_requests where id = p_request_id;
  if v_req is null then raise exception '申请不存在'; end if;
  if v_req.status <> 'pending' then raise exception '该申请已处理'; end if;
  if v_caller_class is distinct from v_req.class_id or v_caller_role not in ('committee', 'teacher') then raise exception '无权限审批'; end if;
  if v_caller_role = 'committee' and v_req.requested_role <> 'student' then raise exception '班委只能批准学生申请，请老师处理'; end if;
  update public.class_join_requests set status = 'approved', reviewed_by = auth.uid(), reviewed_by_name = (select nickname from public.profiles where id = auth.uid()), reviewed_at = now() where id = p_request_id;
  update public.profiles set class_id = v_req.class_id, role = v_req.requested_role, grade = (select grade from public.classes where id = v_req.class_id) where id = v_req.user_id;
  return true;
end;
$$;

grant execute on function public.approve_join_request to authenticated;

create or replace function public.reject_join_request(p_request_id bigint, p_reason text default null)
returns boolean
language plpgsql security definer set search_path = public, auth
as $$
declare v_caller_role text; v_caller_class text; v_req record;
begin
  if auth.uid() is null then raise exception '未登录'; end if;
  select p.role, p.class_id into v_caller_role, v_caller_class from public.profiles p where p.id = auth.uid();
  select * into v_req from public.class_join_requests where id = p_request_id;
  if v_req is null then raise exception '申请不存在'; end if;
  if v_req.status <> 'pending' then raise exception '该申请已处理'; end if;
  if v_caller_class is distinct from v_req.class_id or v_caller_role not in ('committee', 'teacher') then raise exception '无权限审批'; end if;
  if v_caller_role = 'committee' and v_req.requested_role <> 'student' then raise exception '班委只能处理学生申请'; end if;
  update public.class_join_requests set status = 'rejected', reviewed_by = auth.uid(), reviewed_by_name = (select nickname from public.profiles where id = auth.uid()), reviewed_at = now(), reject_reason = p_reason where id = p_request_id;
  return true;
end;
$$;

grant execute on function public.reject_join_request to authenticated;

create or replace function public.list_class_join_requests()
returns table (id bigint, class_id text, user_id uuid, user_name text, user_email text, requested_role text, message text, status text, reviewed_by_name text, reviewed_at timestamptz, reject_reason text, created_at timestamptz)
language plpgsql security definer set search_path = public, auth
as $$
declare v_caller_role text; v_caller_class text;
begin
  select p.role, p.class_id into v_caller_role, v_caller_class from public.profiles p where p.id = auth.uid();
  if v_caller_role is null or v_caller_role not in ('committee', 'teacher') then raise exception '无权限'; end if;
  return query select r.id, r.class_id, r.user_id, r.user_name, r.user_email, r.requested_role, r.message, r.status, r.reviewed_by_name, r.reviewed_at, r.reject_reason, r.created_at from public.class_join_requests r where r.class_id = v_caller_class order by case when r.status = 'pending' then 0 else 1 end, r.created_at desc;
end;
$$;

grant execute on function public.list_class_join_requests to authenticated;

create or replace function public.list_all_classes()
returns table (id text, name text, grade text, description text, creator_id uuid, creator_name text, member_count bigint, created_at timestamptz)
language plpgsql security definer set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception '未登录'; end if;
  return query
    select c.id, c.name, c.grade, c.description, c.creator_id, coalesce(p.nickname, '系统') as creator_name,
           (select count(*) from public.profiles where class_id = c.id) as member_count, c.created_at
    from public.classes c left join public.profiles p on p.id = c.creator_id order by c.created_at asc;
end;
$$;

grant execute on function public.list_all_classes to authenticated;

create or replace function public.my_join_requests()
returns table (id bigint, class_id text, class_name text, requested_role text, status text, message text, reject_reason text, created_at timestamptz)
language plpgsql security definer set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception '未登录'; end if;
  return query select r.id, r.class_id, c.name, r.requested_role, r.status, r.message, r.reject_reason, r.created_at
    from public.class_join_requests r left join public.classes c on c.id = r.class_id
    where r.user_id = auth.uid() order by r.created_at desc;
end;
$$;

grant execute on function public.my_join_requests to authenticated;

create or replace function public.leave_class()
returns boolean
language plpgsql security definer set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception '未登录'; end if;
  update public.profiles set class_id = null, grade = null, role = 'student' where id = auth.uid();
  return true;
end;
$$;

grant execute on function public.leave_class to authenticated;

-- ============================================================
-- 21. 删除班级
-- ============================================================
create or replace function public.delete_class(p_class_id text)
returns boolean
language plpgsql security definer set search_path = public, auth
as $$
declare v_uid uuid; v_creator uuid; v_member_count int;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception '未登录'; end if;
  select creator_id into v_creator from public.classes where id = p_class_id;
  if v_creator is null then raise exception '班级不存在或已被删除'; end if;
  if v_creator <> v_uid then raise exception '只有班级创建者可以删除'; end if;
  select count(*) into v_member_count from public.profiles where class_id = p_class_id and id <> v_uid;
  if v_member_count > 0 then raise exception '班级中还有 % 名其他成员，请先让他们退出班级后再删除', v_member_count; end if;
  delete from public.class_files where class_id = p_class_id;
  delete from public.class_posts where class_id = p_class_id;
  delete from public.class_activities where class_id = p_class_id;
  delete from public.class_join_requests where class_id = p_class_id;
  delete from public.activity_signups where class_id = p_class_id;
  delete from public.time_polls where class_id = p_class_id;
  delete from public.signup_chains where class_id = p_class_id;
  delete from public.announcements where class_id = p_class_id;
  delete from public.class_photos where class_id = p_class_id;
  delete from public.class_admin_codes where class_id = p_class_id;
  delete from public.class_invite_codes where class_id = p_class_id;
  update public.profiles set class_id = null, grade = null, role = 'teacher' where id = v_uid;
  delete from public.classes where id = p_class_id;
  return true;
end;
$$;

grant execute on function public.delete_class to authenticated;

-- ============================================================
-- 22. 用户管理 RPC
-- ============================================================
create or replace function public.list_class_members()
returns table (id uuid, nickname text, email text, role text, avatar_url text, created_at timestamptz)
language plpgsql security definer set search_path = public, auth
as $$
declare v_caller_role text; v_caller_class text;
begin
  select p.role, p.class_id into v_caller_role, v_caller_class from public.profiles p where p.id = auth.uid();
  if v_caller_role is null or v_caller_role not in ('committee', 'teacher') then raise exception '无权限'; end if;
  return query select p.id, p.nickname, u.email::text, p.role, p.avatar_url, p.created_at
    from public.profiles p join auth.users u on u.id = p.id
    where p.class_id = v_caller_class order by p.created_at asc;
end;
$$;

grant execute on function public.list_class_members to authenticated;

create or replace function public.list_class_members_public()
returns table (id uuid, nickname text, role text, avatar_url text, created_at timestamptz)
language plpgsql security definer set search_path = public, auth
as $$
declare v_caller_class text;
begin
  select class_id into v_caller_class from public.profiles where id = auth.uid();
  if v_caller_class is null then raise exception '你还没有加入班级'; end if;
  return query select p.id, p.nickname, p.role, p.avatar_url, p.created_at
    from public.profiles p where p.class_id = v_caller_class order by p.created_at asc;
end;
$$;

grant execute on function public.list_class_members_public to authenticated;

create or replace function public.admin_reset_password(p_user_id uuid, p_new_password text)
returns boolean
language plpgsql security definer set search_path = public, auth, extensions
as $$
declare v_caller_role text; v_caller_class text; v_target_class text;
begin
  select p.role, p.class_id into v_caller_role, v_caller_class from public.profiles p where p.id = auth.uid();
  if v_caller_role is null or v_caller_role not in ('committee', 'teacher') then raise exception '无权限'; end if;
  if length(p_new_password) < 6 then raise exception '密码至少 6 位'; end if;
  select p.class_id into v_target_class from public.profiles p where p.id = p_user_id;
  if v_target_class is null then raise exception '用户不存在'; end if;
  if v_target_class <> v_caller_class then raise exception '只能重置本班同学的密码'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')) where id = p_user_id;
  return true;
end;
$$;

grant execute on function public.admin_reset_password to authenticated;

create or replace function public.teacher_set_role(p_user_id uuid, p_new_role text)
returns boolean
language plpgsql security definer set search_path = public, auth
as $$
declare v_caller_role text; v_caller_class text; v_target_class text;
begin
  select p.role, p.class_id into v_caller_role, v_caller_class from public.profiles p where p.id = auth.uid();
  if v_caller_role is null or v_caller_role <> 'teacher' then raise exception '只有老师可以修改身份'; end if;
  if p_new_role not in ('student', 'committee', 'teacher') then raise exception '无效的身份'; end if;
  select p.class_id into v_target_class from public.profiles p where p.id = p_user_id;
  if v_target_class is null then raise exception '用户不存在'; end if;
  if v_target_class <> v_caller_class then raise exception '只能修改本班同学'; end if;
  update public.profiles set role = p_new_role where id = p_user_id;
  return true;
end;
$$;

grant execute on function public.teacher_set_role to authenticated;

-- ============================================================
-- 23. 注销账号
-- ============================================================
create or replace function public.delete_own_account()
returns boolean
language plpgsql security definer set search_path = public, auth
as $$
declare uid uuid;
begin
  uid := auth.uid();
  if uid is null then raise exception '未登录'; end if;
  delete from auth.users where id = uid;
  return true;
end;
$$;

grant execute on function public.delete_own_account to authenticated;

-- ============================================================
-- 24. 数据统计 RPC
-- ============================================================
create or replace function public.get_class_stats()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_class_id text; v_result jsonb;
begin
  select class_id into v_class_id from public.profiles where id = auth.uid();
  if v_class_id is null then raise exception '未加入班级'; end if;
  select jsonb_build_object(
    'member_count', (select count(*) from public.profiles where class_id = v_class_id),
    'post_count', (select count(*) from public.class_posts where class_id = v_class_id),
    'reply_count', (select count(*) from public.class_replies where class_id = v_class_id),
    'file_count', (select count(*) from public.class_files where class_id = v_class_id),
    'photo_count', (select count(*) from public.class_photos where class_id = v_class_id),
    'announcement_count', (select count(*) from public.announcements where class_id = v_class_id),
    'activity_count', coalesce((select jsonb_array_length(activities) from public.class_activities where class_id = v_class_id), 0)
  ) into v_result;
  return v_result;
end;
$$;

grant execute on function public.get_class_stats to authenticated;

create or replace function public.get_post_ranking(p_limit int default 10)
returns table (user_id uuid, nickname text, avatar_url text, post_count bigint)
language plpgsql security definer set search_path = public, auth
as $$
declare v_class_id text;
begin
  select class_id into v_class_id from public.profiles where id = auth.uid();
  if v_class_id is null then raise exception '未加入班级'; end if;
  return query select p.user_id, max(coalesce(pr.nickname, p.author)), max(pr.avatar_url), count(*)::bigint
    from public.class_posts p left join public.profiles pr on pr.id = p.user_id
    where p.class_id = v_class_id and p.user_id is not null
    group by p.user_id order by count(*) desc limit p_limit;
end;
$$;

grant execute on function public.get_post_ranking to authenticated;

create or replace function public.get_daily_posts()
returns table (day date, post_count bigint)
language plpgsql security definer set search_path = public
as $$
declare v_class_id text;
begin
  select class_id into v_class_id from public.profiles where id = auth.uid();
  if v_class_id is null then raise exception '未加入班级'; end if;
  return query select date_trunc('day', created_at)::date, count(*)::bigint
    from public.class_posts where class_id = v_class_id and created_at >= now() - interval '7 days'
    group by date_trunc('day', created_at)::date order by 1 asc;
end;
$$;

grant execute on function public.get_daily_posts to authenticated;

create or replace function public.get_file_ranking()
returns table (uploader_id uuid, nickname text, file_count bigint)
language plpgsql security definer set search_path = public
as $$
declare v_class_id text;
begin
  select class_id into v_class_id from public.profiles where id = auth.uid();
  if v_class_id is null then raise exception '未加入班级'; end if;
  return query select f.uploader_id, coalesce(max(pr.nickname), max(f.uploader_name)), count(*)::bigint
    from public.class_files f left join public.profiles pr on pr.id = f.uploader_id
    where f.class_id = v_class_id and f.uploader_id is not null
    group by f.uploader_id order by count(*) desc limit 10;
end;
$$;

grant execute on function public.get_file_ranking to authenticated;

create or replace function public.get_activity_stats()
returns table (activity_key text, activity_title text, total_count bigint, yes_count bigint, no_count bigint, maybe_count bigint)
language plpgsql security definer set search_path = public
as $$
declare v_class_id text;
begin
  select class_id into v_class_id from public.profiles where id = auth.uid();
  if v_class_id is null then raise exception '未加入班级'; end if;
  return query
    select s.activity_key, coalesce(a.act_title, s.activity_key) as activity_title,
      count(*)::bigint,
      sum(case when s.status = 'yes' then 1 else 0 end)::bigint,
      sum(case when s.status = 'no' then 1 else 0 end)::bigint,
      sum(case when s.status = 'maybe' then 1 else 0 end)::bigint
    from public.activity_signups s
    left join lateral (
      select (a2->>'title')::text as act_title
      from public.class_activities ca, jsonb_array_elements(ca.activities) a2
      where ca.class_id = v_class_id and (a2->>'id')::text = s.activity_key limit 1
    ) a on true
    where s.class_id = v_class_id group by s.activity_key, a.act_title order by count(*) desc limit 20;
end;
$$;

grant execute on function public.get_activity_stats to authenticated;

-- ============================================================
-- 25. 实时同步
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='class_posts') then alter publication supabase_realtime add table public.class_posts; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='class_replies') then alter publication supabase_realtime add table public.class_replies; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='class_activities') then alter publication supabase_realtime add table public.class_activities; end if;
end $$;

-- ============================================================
-- 26. Storage 桶
-- ============================================================
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('class-files', 'class-files', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('class-photos', 'class-photos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('forum-images', 'forum-images', true) on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "avatars_auth_write" on storage.objects;
create policy "avatars_auth_write" on storage.objects for insert to authenticated with check (bucket_id = 'avatars');
drop policy if exists "avatars_auth_update" on storage.objects;
create policy "avatars_auth_update" on storage.objects for update to authenticated using (bucket_id = 'avatars') with check (bucket_id = 'avatars');

drop policy if exists "files_public_read" on storage.objects;
create policy "files_public_read" on storage.objects for select using (bucket_id = 'class-files');
drop policy if exists "files_admin_write" on storage.objects;
create policy "files_admin_write" on storage.objects for insert to authenticated with check (bucket_id = 'class-files' and exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));
drop policy if exists "files_admin_delete" on storage.objects;
create policy "files_admin_delete" on storage.objects for delete to authenticated using (bucket_id = 'class-files' and exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));

drop policy if exists "class_photos_public_read" on storage.objects;
create policy "class_photos_public_read" on storage.objects for select using (bucket_id = 'class-photos');
drop policy if exists "class_photos_auth_write" on storage.objects;
create policy "class_photos_auth_write" on storage.objects for insert to authenticated with check (bucket_id = 'class-photos' and exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));
drop policy if exists "class_photos_admin_delete" on storage.objects;
create policy "class_photos_admin_delete" on storage.objects for delete to authenticated using (bucket_id = 'class-photos' and exists (select 1 from public.profiles where id = auth.uid() and role in ('committee', 'teacher')));

drop policy if exists "forum_images_public_read" on storage.objects;
create policy "forum_images_public_read" on storage.objects for select using (bucket_id = 'forum-images');
drop policy if exists "forum_images_auth_write" on storage.objects;
create policy "forum_images_auth_write" on storage.objects for insert to authenticated with check (bucket_id = 'forum-images');
drop policy if exists "forum_images_own_delete" on storage.objects;
create policy "forum_images_own_delete" on storage.objects for delete to authenticated using (bucket_id = 'forum-images');

-- ============================================================
-- 27. 刷新 schema 缓存
-- ============================================================
notify pgrst, 'reload schema';
</details>
点击 Run（或按 Ctrl+Enter）

第三步：关闭邮箱验证
左侧菜单 → Authentication → Sign In / Providers

找到 Email，展开

关闭 Confirm email 开关

点击 Save changes

若不关闭，Supabase 免费版每小时仅能发 2 封确认邮件，注册会受限。

第四步：配置前端
左侧菜单 → Settings（齿轮图标）→ API

找到 Project URL 和 Publishable key

打开 js/supabase-config.js，替换：

javascript
const SUPABASE_URL = "你的 Project URL";
const SUPABASE_KEY = "你的 Publishable key";
第五步：部署到 GitHub Pages
把代码推送到 GitHub 仓库

仓库设置 → Pages → Source 选 main 分支

访问 https://你的用户名.github.io/thu-xy/login.html

📁 目录结构
text
thu-xy/
├── login.html              登录 / 注册 / 忘记密码
├── index.html              首页（公告 + 日程提醒 + 更新日志）
├── class.html              班级事务（三种视图 + 头像墙）
├── forum.html              班级论坛（三级 + 嵌套 + 图片 + @提及）
├── activities.html         活动统计（时间投票 + 接龙）
├── files.html              班级文件（分类 + 搜索）
├── photos.html             班级相册
├── personal.html           个人管理（日程 + DDL + 手册）
├── profile.html            个人中心（含退出班级 / 注销）
├── admin.html              用户管理（成员 / 密码 / 身份）
├── requests.html           申请审批
├── classes.html            班级广场（创建 / 申请 / 删除）
├── stats.html              数据统计（班委/老师）
├── notifications.html      通知中心
├── practice.html           实践管理
├── personal.html           个人管理
├── css/
│   └── style.css           全局样式（清华紫主题）
├── js/
│   ├── config.js           网站配置（班级列表、职务、学期设置）
│   ├── supabase-config.js  Supabase 配置（URL 和 Key）
│   ├── common.js           通用工具 & 顶栏 & 骨架屏
│   ├── auth.js             认证模块（登录 / 注册 / 守卫）
│   ├── class.js            班级事务逻辑
│   ├── forum.js            论坛逻辑
│   ├── activities.js       活动统计逻辑
│   ├── files.js            文件管理逻辑
│   ├── photos.js           相册逻辑
│   ├── personal-events.js  个人日程 / DDL 逻辑
│   ├── profile.js          个人中心逻辑
│   ├── admin.js            用户管理逻辑
│   ├── requests.js         申请审批逻辑
│   ├── classes.js          班级广场逻辑
│   ├── stats.js            数据统计逻辑
│   └── notifications.js    通知中心逻辑
├── .gitignore              Git 忽略文件
├── LICENSE                 MIT 开源协议
└── README.md               本文件
⚙️ 配置说明
js/config.js
配置项	说明
siteName	网站名称
siteSubtitle	副标题
developers	开发者名单
purpose	系统目的
semesterStart	第一周周一日期（如 "2026-09-14"）
totalWeeks	学期周数（默认 18）
positions	班委职务列表
classes	班级列表（ID、名称、年级）
DEFAULT_ACTIVITIES	初始活动数据
全局邀请码
邀请码	角色
THU-XY-TEACHER-2026	老师/辅导员
THU-XY-ADMIN-2026	班委
留空	学生
邀请码可在 Supabase → Table Editor → global_invite_codes 表中修改。

🔐 安全说明
✅ 所有数据传输强制 HTTPS

✅ 数据库启用了行级安全（RLS）策略

✅ 密码使用 bcrypt 加密存储

✅ 前后端双重校验

✅ publishable key 可以公开，但不要泄露 service_role key

⚠️ 邀请码请妥善保管，只告诉对应身份的人

📝 使用说明
注册账号
打开 login.html，点击"立即注册！"

填写邮箱、密码、昵称

老师/辅导员填老师邀请码，班委填班委邀请码，同学留空

注册后自动跳转到「班级广场」

创建班级（老师）
班级广场 → 点"＋ 创建班级"

填班级 ID（小写字母/数字/连字符）、名称、年级、简介

创建后自动加入该班，身份为老师

申请加入班级
班级广场 → 找到目标班级 → 点"申请加入"

选择申请身份（学生/班委/老师）

提交后等待审批

审批申请（班委/老师）
顶栏"管理" → "📨 申请审批"

班委可审批学生申请；老师可审批所有申请

批准后申请人自动加入班级

发布公告（班委/老师）
首页 → "📣 班级公告" → 右上角"＋ 发布公告"

填标题、内容，可选置顶

置顶公告显示在"📢 置顶公告"区块

发帖（含图片/@提及）
论坛 → 顶部选发布范围（本班/年级/公共）

输入内容，可点击🖼️添加图片（最多 9 张）

输入 @ 弹出成员列表，选择即可提及

Ctrl+Enter 快速发布

时间投票 / 接龙
活动统计 → "📊 时间投票"或"🔗 接龙"

班委/老师发布，同学参与

时间投票：点击/拖动格子选择空闲时间

接龙：一键参与/取消

个人日程 / DDL
个人管理 → "📅 我的日程"或"⏰ 我的 DDL"

添加后首页自动显示未来 7 天日程和未完成 DDL

DDL 按临近程度变色：逾期深红 → 今天红 → 3天橙 → 7天黄

🐛 常见问题
注册时报 "email rate limit exceeded"
Supabase 免费版每小时只能发 2 封邮件。解决方法：

等待 1 小时

自动确认触发器已包含在初始化脚本中

或配置自定义 SMTP（生产环境推荐）

页面显示 404 或样式丢失
检查 GitHub 上文件是否完整上传

检查文件大小写（Linux 服务器区分大小写）

等待 GitHub Pages 部署完成（1-5 分钟）

强刷页面（Ctrl + Shift + R）

班级成员加载失败
检查 list_class_members_public 函数是否已创建，跑 SQL 里对应的 create or replace function。

论坛发帖失败
检查 Supabase RLS 策略是否正确

F12 打开 Console 看具体报错

文件上传失败
检查 class-files Storage 桶是否存在

检查 Storage RLS 策略是否配置

检查当前用户是否班委/老师

🛠️ 技术栈
前端：HTML5 + CSS3 + 原生 JavaScript

后端：Supabase（PostgreSQL + Auth + Storage + Realtime）

部署：GitHub Pages / Vercel / Netlify

📄 开源协议
MIT License - 详见 LICENSE 文件

🙏 致谢
灵感来自清华大学行健书院的班级共建需求

使用 Supabase 提供后端服务

设计风格参考清华大学官方元素

感谢所有参与测试和反馈的同学

📮 反馈
如有问题或建议，欢迎提 Issue 或 Pull Request。
