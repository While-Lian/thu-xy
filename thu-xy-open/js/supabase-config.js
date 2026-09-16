/* ============================================================
 * Supabase 配置文件（管理者维护）
 *
 * 安全说明：
 * - publishable key 可以安全地放在前端代码中
 * - 数据安全由 Supabase 的行级安全（RLS）策略保护
 * - 永远不要在这里放 service_role key
 *
 * 使用步骤：
 * 1. 访问 https://supabase.com/dashboard 创建项目
 * 2. 项目设置 → API → 复制 Project URL 和 Publishable key
 * 3. 替换下方的 SUPABASE_URL 和 SUPABASE_KEY
 * ============================================================ */

const SUPABASE_URL = "https://你的项目ID.supabase.co";
const SUPABASE_KEY = "sb_publishable_你的密钥";

// 初始化 Supabase 客户端（使用 window.supabase 避免变量名冲突）
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
