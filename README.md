# THU-XY · 清华大学行健书院班级管理平台

简约风格的班级管理网站，采用清华紫主色调。支持多人实时同步，数据存储在 Supabase。

## ✨ 功能特性

- 📅 **三种视图**：时间轴 / 时间表 / 列表，自由切换
- 🔄 **实时同步**：任何班委的修改立即推送到所有在线用户
- 🔐 **密码保护**：每个班级独立密码，可在线修改
- 👥 **职务筛选**：按职务筛选自己负责的活动
- 📱 **响应式设计**：支持手机、平板、电脑访问
- 🎨 **清华紫主题**：简约美观，符合学校风格

## 🚀 快速开始

### 本地运行

无需安装任何东西，直接用浏览器打开 `index.html` 即可。

推荐使用 VS Code 的 **Live Server** 扩展，或在本目录运行：

```bash
python -m http.server 8000
```

然后访问 http://localhost:8000

### 部署到公网

#### 第一步：创建 Supabase 项目

1. 访问 [Supabase 控制台](https://supabase.com/dashboard)，用 GitHub 账号登录
2. 点击 "New project"
3. 填写：
   - **Project name**：`thu-xy`（或任意名称）
   - **Database Password**：点 "Generate a password" 自动生成（保存好）
   - **Region**：选 **Singapore**（新加坡，国内访问最快）
   - **Pricing Plan**：默认 **Free**
4. 点击 "Create new project"，等待 1-2 分钟

#### 第二步：初始化数据库

1. 项目创建完成后，左侧菜单 → **SQL Editor**
2. 点击 **New query**
3. 执行以下 SQL 脚本（点击展开）：

<details>
<summary>📄 点击展开 SQL 脚本</summary>

```sql
-- 1. 创建班级配置表（存储密码等敏感信息）
CREATE TABLE IF NOT EXISTS class_config (
  id BIGSERIAL PRIMARY KEY,
  class_id TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建班级活动表
CREATE TABLE IF NOT EXISTS class_activities (
  id BIGSERIAL PRIMARY KEY,
  class_id TEXT NOT NULL UNIQUE,
  activities JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 删除旧触发器并重新创建
DROP TRIGGER IF EXISTS update_class_config_updated_at ON class_config;
CREATE TRIGGER update_class_config_updated_at
  BEFORE UPDATE ON class_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_class_activities_updated_at ON class_activities;
CREATE TRIGGER update_class_activities_updated_at
  BEFORE UPDATE ON class_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. 启用行级安全（RLS）
ALTER TABLE class_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_activities ENABLE ROW LEVEL SECURITY;

-- 6. 删除旧策略并重新创建
DROP POLICY IF EXISTS "允许所有人读取班级配置" ON class_config;
CREATE POLICY "允许所有人读取班级配置"
  ON class_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "允许所有人更新班级配置" ON class_config;
CREATE POLICY "允许所有人更新班级配置"
  ON class_config FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "允许所有人读取班级活动" ON class_activities;
CREATE POLICY "允许所有人读取班级活动"
  ON class_activities FOR SELECT USING (true);

DROP POLICY IF EXISTS "允许所有人插入班级活动" ON class_activities;
CREATE POLICY "允许所有人插入班级活动"
  ON class_activities FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "允许所有人更新班级活动" ON class_activities;
CREATE POLICY "允许所有人更新班级活动"
  ON class_activities FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "允许所有人删除班级活动" ON class_activities;
CREATE POLICY "允许所有人删除班级活动"
  ON class_activities FOR DELETE USING (true);

-- 7. 启用实时同步
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'class_activities'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE class_activities;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE class_activities;

-- 8. 插入初始班级密码（请修改为你的密码）
INSERT INTO class_config (class_id, password)
VALUES 
  ('xingjian63', '请设置你的密码'),
  ('xingjian-li6', '请设置你的密码')
ON CONFLICT (class_id) DO NOTHING;
```

</details>

4. 点击 **Run**（或按 Ctrl+Enter）

#### 第三步：配置前端

1. 左侧菜单 → **Settings**（齿轮图标）→ **API**
2. 找到 **Project URL** 和 **Publishable key**
3. 打开 `js/supabase-config.js`，替换：
   ```javascript
   const SUPABASE_URL = "你的 Project URL";
   const SUPABASE_KEY = "你的 Publishable key";
   ```

#### 第四步：部署到 GitHub Pages

1. 把代码推送到 GitHub 仓库
2. 仓库设置 → Pages → Source 选 `main` 分支
3. 访问 `https://你的用户名.github.io/thu-xy`

或使用 [Vercel](https://vercel.com) / [Netlify](https://netlify.com) 一键部署。

## 📁 目录结构

```
thu-xy/
├── index.html            首页（班级管理 / 实践管理 / 个人管理 三板块）
├── class.html            班级管理页面（密码门 + 工作安排）
├── css/
│   └── style.css         全局样式（清华紫主题）
├── js/
│   ├── config.js         网站配置（班级列表、职务、学期设置）
│   ├── supabase-config.js Supabase 配置（URL 和 Key）
│   └── class.js          班级页逻辑（含实时同步）
├── .gitignore            Git 忽略文件
├── LICENSE               MIT 开源协议
└── README.md             本文件
```

## ⚙️ 配置说明

### js/config.js

| 配置项 | 说明 |
|---|---|
| `siteName` | 网站名称（默认 "THU-XY"） |
| `semesterStart` | 第一周周一日期（如 "2026-09-14"） |
| `totalWeeks` | 学期周数（默认 18） |
| `positions` | 班委职务列表 |
| `classes` | 班级列表（ID 和名称） |
| `DEFAULT_ACTIVITIES` | 初始活动数据（可为空数组 `[]`） |

### js/supabase-config.js

从 Supabase 控制台复制的配置信息。**publishable key 可以安全地放在前端**，数据安全由行级安全（RLS）保护。

## 🔐 安全说明

- ✅ 所有数据传输强制 HTTPS
- ✅ 数据库启用了行级安全（RLS）策略
- ✅ 班级密码存储在 Supabase 数据库，可在线修改
- ✅ publishable key 可以公开，但不要泄露 `service_role` key
- ⚠️ 请在 Supabase 控制台修改初始密码（SQL 脚本中的默认密码）

## 📝 使用说明

### 修改班级密码

1. 登录班级管理页面
2. 点击右上角"修改密码"按钮
3. 输入当前密码和新密码
4. 保存后下次登录使用新密码

### 添加/编辑活动

1. 登录班级管理页面
2. 点击"＋ 添加活动"按钮
3. 填写活动信息（周次可多选，支持跨周活动）
4. 保存后所有在线用户立即看到更新

### 职务筛选

1. 在页面顶部选择"我的职务"
2. 可选填姓名（精确筛选）
3. 页面只显示你负责（主要/次要）的活动

## 🛠️ 技术栈

- **前端**：HTML5 + CSS3 + 原生 JavaScript
- **后端**：Supabase（PostgreSQL + 实时同步）
- **部署**：GitHub Pages / Vercel / Netlify

## 📄 开源协议

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- 灵感来自清华大学行健书院的班级管理需求
- 使用 [Supabase](https://supabase.com) 提供后端服务
- 设计风格参考清华大学官方元素

## 📮 反馈

如有问题或建议，欢迎提 Issue 或 Pull Request。

---

**注意**：这是一个班级内部管理工具，请遵守学校相关规定，不要用于非法用途。
