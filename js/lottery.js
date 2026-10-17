/* 随机抽签 / 点名转盘 v1.0 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const U = window.Utils;

  let currentUser = null;
  let memberNames = [];
  let isRolling = false;
  let rollTimer = null;

  // 获取 DOM
  const display = document.getElementById('lottery-display');
  const singleControls = document.getElementById('single-controls');
  const groupControls = document.getElementById('group-controls');
  const groupResult = document.getElementById('group-result');

  window.addEventListener('user-ready', async (e) => {
    currentUser = e.detail;
    await loadMembers();
    initEvents();
  });

  async function loadMembers() {
    const { data, error } = await db.from('profiles')
      .select('nickname')
      .or(`class_id.eq.${window.currentClassId},active_class_id.eq.${window.currentClassId}`);
      
    if (error) {
      display.textContent = '名单加载失败';
      display.style.fontSize = '32px';
      return;
    }
    
    memberNames = (data || []).map(m => m.nickname).filter(Boolean);
    if (memberNames.length === 0) {
      display.textContent = '班级暂无成员';
      display.style.fontSize = '32px';
    }
  }

  function initEvents() {
    // 切换模式
    document.getElementById('switch-to-group-btn').addEventListener('click', () => {
      if (isRolling) return;
      singleControls.style.display = 'none';
      groupControls.style.display = 'flex';
      display.style.display = 'none';
      groupResult.style.display = 'grid';
      groupResult.innerHTML = '';
    });

    document.getElementById('switch-to-single-btn').addEventListener('click', () => {
      if (isRolling) return;
      singleControls.style.display = 'flex';
      groupControls.style.display = 'none';
      display.style.display = 'flex';
      groupResult.style.display = 'none';
      groupResult.innerHTML = '';
    });

    // 单人抽签
    document.getElementById('start-draw-btn').addEventListener('click', startSingleDraw);
    
    // 分组抽签
    document.getElementById('start-group-btn').addEventListener('click', startGroupDraw);
  }

  /* ============ 单人抽签 ============ */
  function startSingleDraw() {
    if (isRolling || memberNames.length === 0) return;
    if (memberNames.length === 1) {
      display.textContent = memberNames[0];
      return;
    }

    isRolling = true;
    display.classList.add('rolling');
    const btn = document.getElementById('start-draw-btn');
    btn.disabled = true;
    btn.textContent = '抽签中…';

    // 洗牌，保证随机
    const shuffled = [...memberNames].sort(() => Math.random() - 0.5);
    let i = 0;

    // 动画：每 50 毫秒换一个名字
    rollTimer = setInterval(() => {
      display.textContent = shuffled[i % shuffled.length];
      i++;
    }, 50);

    // 2.5 秒后停止，定格在最后一个名字
    setTimeout(() => {
      clearInterval(rollTimer);
      display.classList.remove('rolling');
      display.textContent = shuffled[shuffled.length - 1]; // 最终结果
      
      // 添加一个闪烁特效
      display.style.transform = 'scale(1.1)';
      display.style.color = '#e53935';
      setTimeout(() => {
        display.style.transform = 'scale(1)';
        display.style.color = 'var(--primary)';
      }, 300);

      isRolling = false;
      btn.disabled = false;
      btn.textContent = '再抽一次';
    }, 2500);
  }

  /* ============ 随机分组 ============ */
  function startGroupDraw() {
    if (isRolling || memberNames.length === 0) return;
    const groupCount = Number(document.getElementById('group-count').value);
    if (groupCount < 2 || groupCount > memberNames.length) {
      return alert('请输入合理的组数');
    }

    isRolling = true;
    const btn = document.getElementById('start-group-btn');
    btn.disabled = true;
    btn.textContent = '分配中…';
    groupResult.innerHTML = '<div style="font-size:20px; color:var(--text-secondary); text-align:center; grid-column: 1/-1;">正在打乱名单...</div>';

    setTimeout(() => {
      // Fisher-Yates 洗牌算法
      const shuffled = [...memberNames];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // 均分到各组
      const groups = Array.from({ length: groupCount }, () => []);
      shuffled.forEach((name, index) => {
        groups[index % groupCount].push(name);
      });

      // 渲染结果
      groupResult.innerHTML = groups.map((group, i) => `
        <div class="group-card" style="animation: fadeIn 0.5s ease ${i * 0.1}s both;">
          <div class="group-title">第 ${i + 1} 组 (${group.length}人)</div>
          ${group.map(name => `<div class="group-member">${U.escapeHtml(name)}</div>`).join('')}
        </div>
      `).join('');

      btn.disabled = false;
      btn.textContent = '重新分组';
      isRolling = false;
    }, 1000); // 给一点缓冲时间
  }
})();