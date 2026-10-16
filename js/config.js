/* ============================================================
 * THU-XY 网站配置文件 v1.0.0
 * ============================================================ */

const SITE_CONFIG = {
  siteName: "清华大学行健书院班级共建",
  siteSubtitle: "行健书院班级共建系统",
  shortName: "班级共建",

  developers: ["陈炼", "徐天泽"],

  purpose: "本系统由行健书院同学自主开发，旨在为班级提供便捷的事务管理、论坛交流与文件共享平台，增强班级凝聚力，共建美好班级。",

  semesterStart: "2026-09-14",
  totalWeeks: 18,

  positions: [
    "班长", "副班长", "团支书", "副团支书",
    "党课小组长", "党课小组副组长",
    "学习委员", "组织委员", "宣传委员",
    "文艺委员", "体育委员", "生活委员",
    "实践委员", "志愿委员", "科创委员"
  ],

  classes: [
    { id: "xingjian63", name: "行健63班" },
    { id: "xingjian-li6", name: "行健-力6班" }
  ]
};

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
      remark: ""
    }
  ],
  "xingjian-li6": []
};
