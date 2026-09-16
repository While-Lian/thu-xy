/* ============================================================
 * THU-XY 网站配置文件（管理者维护）
 * 修改本文件后刷新页面即可生效，无需改动其他代码。
 * ============================================================ */

const SITE_CONFIG = {
  // 网站名称
  siteName: "THU-XY",
  siteSubtitle: "清华大学行健书院 · 班级管理平台",

  // 学期第一周周一（用于自动计算"第X周"对应的日期）
  semesterStart: "2026-09-14",
  totalWeeks: 18,

  // 班委职务列表（下拉选择，不允许手动输入职位）
  // 正副职分开列出，便于"职位+姓名"格式的负责人填写
  positions: [
    "班长",
    "副班长",
    "团支书",
    "副团支书",
    "党课小组长",
    "党课小组副组长",
    "学习委员",
    "组织委员",
    "宣传委员",
    "文艺委员",
    "体育委员",
  ],

  // 首页板块（后续要增加板块，只需在这里加一项并在 index.html 加对应卡片）
  sections: [
    { id: "class", name: "班级管理", enabled: true },
    { id: "practice", name: "实践管理", enabled: false }, // 后续补充
    { id: "personal", name: "个人管理", enabled: false }, // 后续补充
  ],

  // 班级列表（密码存储在 Supabase 的 class_config 表中，可在线修改）
  classes: [
    {
      id: "xingjian63",
      name: "行健63班",
    },
    {
      id: "xingjian-li6",
      name: "行健-力6班",
    },
    // 未来"创建自己的班级"功能将在这里动态追加
  ],
};

/* ------------------------------------------------------------
 * 活动数据（当前为示例数据，方便查看效果；可清空为 [] ）
 *
 * 字段说明：
 *   weeks       活动涉及的周次数组（1-18，可跨多周，如 [3,4,5]）
 *   title       活动标题
 *   time        活动具体时间（如 "周六 14:00-16:00"）
 *   location    地点
 *   requirement 主要要求
 *   mainOwners  主要负责人数组：[{ position: "班长", name: "张三" }]
 *   subOwners   次要负责人数组，格式同上
 *   remark      备注
 *
 * 数据保存在浏览器 localStorage 中；在网页上的增删改会自动保存。
 * 如需恢复初始数据，清除浏览器 localStorage 后刷新即可。
 * ------------------------------------------------------------ */
const DEFAULT_ACTIVITIES = {
  xingjian63: [
    {
      weeks: [1],
      title: "开学班会",
      time: "周一 19:00-20:30",
      location: "书院会议室",
      requirement: "全体同学参加，签到",
      mainOwners: [{ position: "班长", name: "" }],
      subOwners: [{ position: "团支书", name: "" }],
      remark: "示例数据，可删除",
    },
    {
      weeks: [3],
      title: "学风建设讨论会",
      time: "周三 16:00-17:00",
      location: "线上腾讯会议",
      requirement: "班委参加，提前准备议题",
      mainOwners: [{ position: "学习委员", name: "" }],
      subOwners: [],
      remark: "示例数据，可删除",
    },
  ],
  "xingjian-li6": [],
};
