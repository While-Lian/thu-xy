/* ============================================================
 * THU-XY 班级管理页逻辑
 * - 密码验证（密码在 config.js 中由管理者设置）
 * - 近期工作安排（列表）
 * - 本学期工作安排：时间轴 / 时间表 / 列表 三视图切换，数据同源
 * - 活动周次支持多选（跨周活动），主要负责人限 1 位班委
 * - 职务+姓名筛选（主要/次要负责人均匹配）
 * - 活动增删改，数据存于浏览器 localStorage
 *
 * 【升级预留】如需多人共享数据，将 loadActivities/saveActivities
 * 两个函数替换为后端 API 请求即可，其余逻辑无需改动。
 * ============================================================ */

(function () {
  "use strict";

  /* ---------- 1. 解析当前班级 ---------- */
  const params = new URLSearchParams(window.location.search);
  const classId = params.get("id");
  const classInfo = SITE_CONFIG.classes.find((c) => c.id === classId);

  if (!classInfo) {
    alert("未找到该班级，请从首页进入。");
    window.location.href = "index.html";
    return;
  }

  const STORAGE_KEY = "thu-xy-activities-" + classId;
  const SESSION_KEY = "thu-xy-auth-" + classId;

  /* ---------- 2. 密码门禁 ---------- */
  const gate = document.getElementById("password-gate");
  const content = document.getElementById("class-content");
  const pwdInput = document.getElementById("password-input");
  const pwdError = document.getElementById("password-error");

  document.getElementById("gate-class-name").textContent = classInfo.name;
  document.getElementById("class-name").textContent = classInfo.name + " · 班级管理";
  document.title = classInfo.name + " · THU-XY";

  // 从 Supabase 读取班级密码
  async function getClassPassword() {
    try {
      const { data, error } = await supabaseClient
        .from("class_config")
        .select("password")
        .eq("class_id", classId)
        .single();

      if (error) throw error;
      return data ? data.password : null;
    } catch (e) {
      console.error("读取密码失败", e);
      return null;
    }
  }

  function unlock() {
    gate.style.display = "none";
    content.style.display = "block";
    initMain();
  }

  // 本次会话已验证过则直接进入
  if (sessionStorage.getItem(SESSION_KEY) === "1") {
    unlock();
    return;
  }

  async function tryLogin() {
    const correctPassword = await getClassPassword();
    
    if (!correctPassword) {
      pwdError.textContent = "网络异常，请检查网络后重试";
      return;
    }

    if (pwdInput.value === correctPassword) {
      sessionStorage.setItem(SESSION_KEY, "1");
      unlock();
    } else {
      pwdError.textContent = "密码错误，请重试";
      pwdInput.value = "";
      pwdInput.focus();
    }
  }

  document.getElementById("password-submit").addEventListener("click", tryLogin);
  pwdInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryLogin();
  });
  pwdInput.focus();

  /* ============================================================
   * 以下为主页面逻辑（验证通过后执行）
   * ============================================================ */
  function initMain() {
    /* ---------- 数据存取 ---------- */
    // 数据模型：每条活动的 weeks 为周次数组（如 [3,4,5] 表示跨第3-5周）
    function normalize(a) {
      if (!Array.isArray(a.weeks)) {
        // 兼容旧数据：单周字段 week → weeks 数组
        a.weeks = a.week ? [a.week] : [];
        delete a.week;
      }
      a.weeks = a.weeks
        .map(Number)
        .filter((w) => w >= 1 && w <= SITE_CONFIG.totalWeeks)
        .sort((x, y) => x - y);
      if (!Array.isArray(a.mainOwners)) a.mainOwners = [];
      if (!Array.isArray(a.subOwners)) a.subOwners = [];
      return a;
    }

    /* ---------- 数据存取（Supabase） ---------- */
    // 使用 Supabase 实时同步，任何班委的修改立即推送给所有在线用户
    let realtimeChannel = null;

    async function loadActivities() {
      try {
        const { data, error } = await supabaseClient
          .from("class_activities")
          .select("activities")
          .eq("class_id", classId)
          .single();

        if (error && error.code !== "PGRST116") {
          // PGRST116 = 记录不存在（首次使用）
          throw error;
        }

        if (data && data.activities) {
          return data.activities.map(normalize);
        }

        // 首次使用：写入默认数据
        const defaults = (DEFAULT_ACTIVITIES[classId] || []).map(normalize);
        const { error: insertError } = await supabaseClient
          .from("class_activities")
          .insert({ class_id: classId, activities: defaults });

        if (insertError) throw insertError;
        return defaults;
      } catch (e) {
        console.error("Supabase 读取失败，回退到本地存储", e);
        // 网络异常时回退到 localStorage
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw !== null) {
          try {
            return JSON.parse(raw).map(normalize);
          } catch (e2) {
            console.warn("本地数据解析失败", e2);
          }
        }
        return (DEFAULT_ACTIVITIES[classId] || []).map(normalize);
      }
    }

    async function saveActivities() {
      try {
        const { error } = await supabaseClient
          .from("class_activities")
          .upsert({ class_id: classId, activities }, { onConflict: "class_id" });

        if (error) throw error;
      } catch (e) {
        console.error("Supabase 保存失败，已保存到本地", e);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
        alert("网络异常，数据已保存到本地，恢复网络后请刷新页面同步");
      }
    }

    // 启动实时监听：其他班委的修改会立即反映到本页面
    function startRealtimeSync() {
      realtimeChannel = supabaseClient
        .channel(`class_${classId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "class_activities",
            filter: `class_id=eq.${classId}`,
          },
          (payload) => {
            if (payload.new && payload.new.activities) {
              activities = payload.new.activities.map(normalize);
              renderAll();
            }
          }
        )
        .subscribe();
    }

    let activities = [];

    /* ---------- 工具函数 ---------- */
    // 第X周 → 日期范围（依据 config.js 的 semesterStart）
    function weekDateRange(week) {
      const start = new Date(SITE_CONFIG.semesterStart + "T00:00:00");
      start.setDate(start.getDate() + (week - 1) * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
      return `${fmt(start)} - ${fmt(end)}`;
    }

    // 当前是第几周（学期外返回 null）
    function currentWeek() {
      const start = new Date(SITE_CONFIG.semesterStart + "T00:00:00");
      const diffDays = Math.floor((Date.now() - start.getTime()) / 86400000);
      const week = Math.floor(diffDays / 7) + 1;
      return week >= 1 && week <= SITE_CONFIG.totalWeeks ? week : null;
    }

    // 周次数组 → 显示文本（如 [3,4,5] → "第3-5周"，[2,5] → "第2、5周"）
    function formatWeeks(weeks) {
      if (!weeks || weeks.length === 0) return "—";
      const isContinuous = weeks.every((w, i) => i === 0 || w === weeks[i - 1] + 1);
      if (weeks.length === 1) return `第${weeks[0]}周`;
      if (isContinuous) return `第${weeks[0]}-${weeks[weeks.length - 1]}周`;
      return "第" + weeks.join("、") + "周";
    }

    function formatOwners(owners) {
      if (!owners || owners.length === 0) return "—";
      return owners
        .filter((o) => o.position || o.name)
        .map((o) => `${o.position || ""} ${o.name || ""}`.trim())
        .join("<br>");
    }

    function escapeHtml(s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    // 排序：按起始周，再按结束周
    function byStartWeek(a, b) {
      return (a.weeks[0] || 99) - (b.weeks[0] || 99) || (a.weeks[a.weeks.length - 1] || 0) - (b.weeks[b.weeks.length - 1] || 0);
    }

    /* ---------- 职务筛选 ---------- */
    const positionFilter = document.getElementById("position-filter");
    const nameFilter = document.getElementById("name-filter");

    SITE_CONFIG.positions.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      positionFilter.appendChild(opt);
    });

    // 筛选条件：选了职务（姓名可填可不填，填了更精确）
    function getFilter() {
      return {
        position: positionFilter.value,
        name: nameFilter.value.trim(),
      };
    }

    function matchOwner(owner, filter) {
      if (owner.position !== filter.position) return false;
      if (filter.name && owner.name !== filter.name) return false;
      return true;
    }

    function applyFilter(list) {
      const filter = getFilter();
      if (!filter.position) return list; // 未选职务 → 显示全部
      return list.filter(
        (a) =>
          (a.mainOwners || []).some((o) => matchOwner(o, filter)) ||
          (a.subOwners || []).some((o) => matchOwner(o, filter))
      );
    }

    positionFilter.addEventListener("change", renderAll);
    nameFilter.addEventListener("input", renderAll);
    document.getElementById("filter-clear").addEventListener("click", () => {
      positionFilter.value = "";
      nameFilter.value = "";
      renderAll();
    });

    /* ---------- 渲染：表格行 ---------- */
    function activityRow(a, index) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatWeeks(a.weeks)}</td>
        <td>${escapeHtml(a.title)}</td>
        <td>${escapeHtml(a.time)}</td>
        <td>${escapeHtml(a.location)}</td>
        <td>${escapeHtml(a.requirement)}</td>
        <td class="owner-cell">${formatOwners(a.mainOwners)}</td>
        <td class="owner-cell">${formatOwners(a.subOwners)}</td>
        <td>${escapeHtml(a.remark)}</td>
        <td class="op-cell">
          <button class="btn btn-ghost btn-small" data-edit="${index}">编辑</button>
          <button class="btn btn-danger btn-small" data-del="${index}">删除</button>
        </td>`;
      return tr;
    }

    function emptyRow(colspan, text) {
      const tr = document.createElement("tr");
      tr.className = "empty-row";
      tr.innerHTML = `<td colspan="${colspan}">${text}</td>`;
      return tr;
    }

    /* ---------- 渲染：近期工作安排（当前周 + 下一周，含进行中的跨周活动） ---------- */
    function renderRecent(list) {
      const tbody = document.querySelector("#recent-table tbody");
      tbody.innerHTML = "";
      const cw = currentWeek();
      let recent;
      if (cw === null) {
        // 学期未开始/已结束：显示起始周最早的两周内有活动的条目
        const weeks = [...new Set(list.flatMap((a) => a.weeks))].sort((x, y) => x - y);
        const firstTwo = weeks.slice(0, 2);
        recent = list.filter((a) => a.weeks.some((w) => firstTwo.includes(w)));
      } else {
        recent = list.filter((a) => a.weeks.some((w) => w === cw || w === cw + 1));
      }
      recent.sort(byStartWeek);

      if (recent.length === 0) {
        tbody.appendChild(emptyRow(9, "近期暂无工作安排"));
        return;
      }
      recent.forEach((a) => {
        tbody.appendChild(activityRow(a, activities.indexOf(a)));
      });
    }

    /* ---------- 渲染：时间轴视图（按周分组，跨周活动每周都出现并带角标） ---------- */
    function renderTimeline(list) {
      const box = document.getElementById("view-timeline");
      box.innerHTML = "";
      if (list.length === 0) {
        box.innerHTML = '<div class="timeline-empty">本学期暂无工作安排，可点击下方按钮添加。</div>';
        return;
      }
      const byWeek = {};
      list.forEach((a) => {
        a.weeks.forEach((w) => {
          (byWeek[w] = byWeek[w] || []).push(a);
        });
      });
      Object.keys(byWeek)
        .map(Number)
        .sort((a, b) => a - b)
        .forEach((week) => {
          const item = document.createElement("div");
          item.className = "timeline-item";
          const events = byWeek[week]
            .map((a) => {
              const spanBadge =
                a.weeks.length > 1
                  ? `<span class="event-span">${formatWeeks(a.weeks)}</span>`
                  : "";
              return (
                `<div><span class="event-title">${escapeHtml(a.title)}</span>${spanBadge}` +
                `<span class="event-meta">　${escapeHtml(a.time || "")} ${escapeHtml(a.location || "")}</span></div>`
              );
            })
            .join("");
          item.innerHTML = `
            <span class="timeline-week">第${week}周</span>
            <span class="timeline-date">${weekDateRange(week)}</span>
            <div class="timeline-events">${events}</div>`;
          box.appendChild(item);
        });
    }

    /* ---------- 渲染：时间表视图（甘特式，行=活动，列=周，体现跨周） ---------- */
    function renderSchedule(list) {
      const table = document.getElementById("schedule-table");
      const thead = table.querySelector("thead");
      const tbody = table.querySelector("tbody");
      thead.innerHTML = "";
      tbody.innerHTML = "";

      const total = SITE_CONFIG.totalWeeks;
      const cw = currentWeek();

      // 表头：活动 + 第1..18周
      const headRow = document.createElement("tr");
      headRow.innerHTML =
        '<th class="schedule-title-col">活动</th>' +
        Array.from({ length: total }, (_, i) => `<th title="${weekDateRange(i + 1)}">${i + 1}</th>`).join("");
      thead.appendChild(headRow);

      if (list.length === 0) {
        tbody.appendChild(emptyRow(total + 1, "本学期暂无工作安排"));
        return;
      }

      [...list].sort(byStartWeek).forEach((a) => {
        const tr = document.createElement("tr");
        const weekSet = new Set(a.weeks);
        let cells = `<td class="schedule-title-col" title="${escapeHtml(a.title)}">${escapeHtml(a.title)}</td>`;
        for (let w = 1; w <= total; w++) {
          const classes = [];
          if (weekSet.has(w)) {
            classes.push("bar");
            if (!weekSet.has(w - 1)) classes.push("bar-start");
            if (!weekSet.has(w + 1)) classes.push("bar-end");
          }
          if (w === cw) classes.push("col-current");
          const title = weekSet.has(w) ? ` title="${escapeHtml(a.title)} · 第${w}周（${weekDateRange(w)}）"` : "";
          cells += `<td class="${classes.join(" ")}"${title}>${weekSet.has(w) ? '<div class="bar-fill"></div>' : ""}</td>`;
        }
        tr.innerHTML = cells;
        tbody.appendChild(tr);
      });
    }

    /* ---------- 渲染：列表视图（完整列表，可增删改） ---------- */
    function renderSemester(list) {
      const tbody = document.querySelector("#semester-table tbody");
      tbody.innerHTML = "";
      const sorted = [...list].sort(byStartWeek);
      if (sorted.length === 0) {
        tbody.appendChild(emptyRow(9, "暂无活动，点击下方按钮添加。"));
        return;
      }
      sorted.forEach((a) => {
        tbody.appendChild(activityRow(a, activities.indexOf(a)));
      });
    }

    function renderAll() {
      const filtered = applyFilter(activities);
      renderRecent(filtered);
      renderTimeline(filtered);
      renderSchedule(filtered);
      renderSemester(filtered);
    }

    /* ---------- 视图切换（时间轴 / 时间表 / 列表） ---------- */
    const viewBtns = document.querySelectorAll(".view-btn");
    const viewPanels = {
      timeline: document.getElementById("view-timeline"),
      schedule: document.getElementById("view-schedule"),
      list: document.getElementById("view-list"),
    };

    viewBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        viewBtns.forEach((b) => b.classList.toggle("active", b === btn));
        Object.entries(viewPanels).forEach(([name, el]) => {
          el.style.display = name === btn.dataset.view ? "" : "none";
        });
      });
    });

    /* ---------- 周次多选芯片 ---------- */
    const weeksBox = document.getElementById("f-weeks");
    const selectedWeeks = new Set();

    for (let w = 1; w <= SITE_CONFIG.totalWeeks; w++) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "week-chip";
      chip.textContent = w;
      chip.title = `第${w}周（${weekDateRange(w)}）`;
      chip.dataset.week = w;
      chip.addEventListener("click", () => {
        const n = Number(chip.dataset.week);
        if (selectedWeeks.has(n)) {
          selectedWeeks.delete(n);
          chip.classList.remove("selected");
        } else {
          selectedWeeks.add(n);
          chip.classList.add("selected");
        }
      });
      weeksBox.appendChild(chip);
    }

    document.getElementById("weeks-clear").addEventListener("click", () => {
      selectedWeeks.clear();
      weeksBox.querySelectorAll(".week-chip").forEach((c) => c.classList.remove("selected"));
    });

    function setSelectedWeeks(weeks) {
      selectedWeeks.clear();
      weeksBox.querySelectorAll(".week-chip").forEach((c) => c.classList.remove("selected"));
      (weeks || []).forEach((w) => {
        selectedWeeks.add(w);
        const chip = weeksBox.querySelector(`[data-week="${w}"]`);
        if (chip) chip.classList.add("selected");
      });
    }

    /* ---------- 编辑弹窗 ---------- */
    const modal = document.getElementById("edit-modal");
    let editingIndex = null; // null 表示新增

    // removable：是否显示"移除"按钮（主要负责人不可移除）
    function ownerRowHTML(container, owner, removable) {
      const row = document.createElement("div");
      row.className = "owner-row";
      const select = document.createElement("select");
      SITE_CONFIG.positions.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        select.appendChild(opt);
      });
      select.value = owner.position || SITE_CONFIG.positions[0];
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "姓名";
      input.value = owner.name || "";
      row.appendChild(select);
      row.appendChild(input);
      if (removable) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "remove-owner";
        del.textContent = "×";
        del.title = "移除该负责人";
        del.addEventListener("click", () => row.remove());
        row.appendChild(del);
      }
      container.appendChild(row);
      return row;
    }

    // maxCount：该列表最多允许的负责人数量（主要负责人限 1 位且不可移除）
    function setupOwnerList(containerId, owners, maxCount) {
      const container = document.getElementById(containerId);
      const removable = maxCount > 1; // 主要负责人（限1位）不可移除
      container.innerHTML = "";
      (owners || []).slice(0, maxCount).forEach((o) => ownerRowHTML(container, o, removable));
      if (container.querySelectorAll(".owner-row").length === 0) {
        ownerRowHTML(container, {}, removable);
      }
      if (maxCount > 1) {
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "add-owner";
        addBtn.textContent = "＋ 添加负责人";
        addBtn.addEventListener("click", () => {
          if (container.querySelectorAll(".owner-row").length >= maxCount) return;
          ownerRowHTML(container, {}, removable);
          container.appendChild(addBtn); // 保持按钮在最后
        });
        container.appendChild(addBtn);
      }
    }

    function readOwnerList(containerId) {
      const rows = document.querySelectorAll(`#${containerId} .owner-row`);
      const owners = [];
      rows.forEach((r) => {
        const position = r.querySelector("select").value;
        const name = r.querySelector("input").value.trim();
        if (position || name) owners.push({ position, name });
      });
      return owners;
    }

    function openModal(index) {
      editingIndex = index;
      const a = index === null ? null : activities[index];
      document.getElementById("modal-title").textContent = a ? "编辑活动" : "添加活动";
      setSelectedWeeks(a ? a.weeks : []);
      document.getElementById("f-title").value = a ? a.title : "";
      document.getElementById("f-time").value = a ? a.time : "";
      document.getElementById("f-location").value = a ? a.location : "";
      document.getElementById("f-requirement").value = a ? a.requirement : "";
      document.getElementById("f-remark").value = a ? a.remark : "";
      setupOwnerList("f-main-owner", a ? a.mainOwners : [], 1); // 主要负责人限 1 位
      setupOwnerList("f-sub-owners", a ? a.subOwners : [], 5); // 次要负责人最多 5 位
      modal.style.display = "flex";
    }

    function closeModal() {
      modal.style.display = "none";
      editingIndex = null;
    }

    document.getElementById("modal-cancel").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    document.getElementById("modal-save").addEventListener("click", () => {
      const weeks = [...selectedWeeks].sort((a, b) => a - b);
      const title = document.getElementById("f-title").value.trim();
      if (weeks.length === 0) {
        alert("请选择至少一个周次");
        return;
      }
      if (!title) {
        alert("请填写活动标题");
        return;
      }
      const data = {
        weeks,
        title,
        time: document.getElementById("f-time").value.trim(),
        location: document.getElementById("f-location").value.trim(),
        requirement: document.getElementById("f-requirement").value.trim(),
        mainOwners: readOwnerList("f-main-owner").slice(0, 1), // 主要负责人限 1 位
        subOwners: readOwnerList("f-sub-owners"),
        remark: document.getElementById("f-remark").value.trim(),
      };
      if (editingIndex === null) {
        activities.push(data);
      } else {
        activities[editingIndex] = data;
      }
      saveActivities();
      closeModal();
      renderAll();
    });

    /* ---------- 表格操作（事件委托） ---------- */
    document.querySelector(".class-main").addEventListener("click", (e) => {
      const editIdx = e.target.getAttribute("data-edit");
      const delIdx = e.target.getAttribute("data-del");
      if (editIdx !== null) {
        openModal(Number(editIdx));
      } else if (delIdx !== null) {
        const a = activities[Number(delIdx)];
        if (confirm(`确定删除活动「${a.title}」（${formatWeeks(a.weeks)}）吗？`)) {
          activities.splice(Number(delIdx), 1);
          saveActivities();
          renderAll();
        }
      }
    });

    document.getElementById("add-activity").addEventListener("click", () => openModal(null));

    /* ---------- 修改密码 ---------- */
    const passwordModal = document.getElementById("password-modal");
    const oldPasswordInput = document.getElementById("old-password");
    const newPasswordInput = document.getElementById("new-password");
    const confirmPasswordInput = document.getElementById("confirm-password");
    const passwordModalError = document.getElementById("password-modal-error");

    document.getElementById("change-password").addEventListener("click", () => {
      oldPasswordInput.value = "";
      newPasswordInput.value = "";
      confirmPasswordInput.value = "";
      passwordModalError.textContent = "";
      passwordModal.style.display = "flex";
    });

    document.getElementById("password-modal-cancel").addEventListener("click", () => {
      passwordModal.style.display = "none";
    });

    passwordModal.addEventListener("click", (e) => {
      if (e.target === passwordModal) passwordModal.style.display = "none";
    });

    document.getElementById("password-modal-save").addEventListener("click", async () => {
      const oldPassword = oldPasswordInput.value;
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;

      // 验证
      if (!oldPassword || !newPassword || !confirmPassword) {
        passwordModalError.textContent = "请填写完整";
        return;
      }

      if (newPassword.length < 6) {
        passwordModalError.textContent = "新密码至少6位";
        return;
      }

      if (newPassword !== confirmPassword) {
        passwordModalError.textContent = "两次输入的新密码不一致";
        return;
      }

      // 验证旧密码
      const correctPassword = await getClassPassword();
      if (oldPassword !== correctPassword) {
        passwordModalError.textContent = "当前密码错误";
        return;
      }

      // 更新密码
      try {
        const { error } = await supabaseClient
          .from("class_config")
          .update({ password: newPassword })
          .eq("class_id", classId);

        if (error) throw error;

        alert("密码修改成功！下次登录请使用新密码。");
        passwordModal.style.display = "none";
      } catch (e) {
        console.error("修改密码失败", e);
        passwordModalError.textContent = "修改失败，请检查网络后重试";
      }
    });

    /* ---------- 初始渲染（先加载数据，再启动实时同步） ---------- */
    loadActivities().then((loaded) => {
      activities = loaded;
      renderAll();
      startRealtimeSync(); // 启动实时监听，其他班委的修改会立即同步到本页面
    });
  }
})();
