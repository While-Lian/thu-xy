/* ============================================================
 * THU-XY · 幸运抽奖（大转盘）v6.1
 * 奖项 / 中奖概率 / 剩余份数 -> 大转盘 -> 中奖人 + 中奖记录
 *
 * 数据存储：
 *   · 优先使用云端（Supabase: class_lottery + lottery_draws，见 sql/lottery.sql）
 *   · 云端不可用时自动降级为浏览器本机存储，功能完整可用
 * ============================================================ */
(function () {
  'use strict';

  const db = window.supabaseClient || null;
  const U = window.Utils || {};
  const $ = (id) => document.getElementById(id);

  const COLORS = ['#7b1fa2', '#d81b60', '#00897b', '#f9a825', '#5e35b1', '#e64a19', '#0288d1', '#43a047', '#8e24aa', '#c2185b', '#6d4c41', '#3949ab'];
  const MAX_PRIZES = 12;
  const LS_PREFIX = 'thu-xy-lucky-draw:v1:';
  const SPIN_TURNS = 6;
  const SPIN_MS = 4600;

  const DEFAULT_PRIZES = [
    { name: '一等奖', weight: 5, stock: 1 },
    { name: '二等奖', weight: 10, stock: 2 },
    { name: '三等奖', weight: 20, stock: 3 },
    { name: '谢谢参与', weight: 65, stock: null }
  ];

  const state = {
    booted: false,
    bound: false,
    user: null,
    classId: null,
    isAdmin: false,
    storage: 'local',        // 'cloud' | 'local'
    configSaved: false,
    prizes: [],
    settings: null,
    draws: [],
    members: [],
    membersLoaded: false,
    dirty: false,
    spinning: false,
    rotation: 0,
    pending: null,
    lastDuration: SPIN_MS,
    drawCount: 0,
    confettiRaf: 0,
    tipDismissed: false
  };

  /* ============ 小工具 ============ */
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const esc = (s) => (U.escapeHtml ? U.escapeHtml(s) : String(s == null ? '' : s));
  const uid = () => 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const fmtTime = (iso) => (U.formatTime ? U.formatTime(iso) : String(iso || ''));

  function rand() {
    if (window.crypto && window.crypto.getRandomValues) {
      const a = new Uint32Array(1);
      window.crypto.getRandomValues(a);
      return a[0] / 4294967296;
    }
    return Math.random();
  }

  function isReduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function spinDuration() { return isReduced() ? 650 : SPIN_MS; }

  function defaultSettings() {
    return { mode: 'members', customNames: '', uniqueWinner: true, resetAt: null };
  }

  function normalizePrize(raw, index) {
    const src = raw || {};
    let stock = src.stock;
    if (stock === undefined || stock === null || stock === '') stock = null;
    else stock = Math.max(0, Math.floor(Number(stock) || 0));
    return {
      id: src.id || uid(),
      name: String(src.name == null ? '' : src.name).slice(0, 10),
      weight: clamp(Number(src.weight) || 0, 0, 100),
      stock: stock,
      color: src.color || COLORS[(index || 0) % COLORS.length]
    };
  }

  function normalizeSettings(raw) {
    const s = Object.assign(defaultSettings(), raw || {});
    if (['members', 'custom', 'none'].indexOf(s.mode) === -1) s.mode = 'members';
    s.customNames = String(s.customNames || '');
    s.uniqueWinner = s.uniqueWinner !== false;
    s.resetAt = s.resetAt || null;
    return s;
  }

  function seedPrizes() {
    return DEFAULT_PRIZES.map((p, i) => normalizePrize({
      id: uid(), name: p.name, weight: p.weight, stock: p.stock, color: COLORS[i % COLORS.length]
    }, i));
  }

  /* ============ 本机存储 ============ */
  function lsKey() { return LS_PREFIX + (state.classId || 'global'); }

  function readLocal() {
    try {
      const raw = localStorage.getItem(lsKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeLocal() {
    try {
      localStorage.setItem(lsKey(), JSON.stringify({
        prizes: state.prizes,
        settings: state.settings,
        draws: state.draws.slice(0, 200),
        savedAt: new Date().toISOString()
      }));
    } catch (e) { /* 隐私模式下忽略 */ }
  }

  /* ============ 启动 ============ */
  window.addEventListener('user-ready', (e) => {
    boot(e.detail).catch((err) => {
      console.error('[抽奖] 初始化失败', err);
      toast('页面初始化失败：' + (err && err.message ? err.message : err), 'error');
    });
  });

  async function boot(user) {
    if (!user || state.booted) return;
    state.booted = true;
    state.user = user;
    state.classId = window.currentClassId || user.active_class_id || user.class_id || null;
    state.isAdmin = !!(U.isAdminRole && U.isAdminRole(user.role));
    if (!state.settings) state.settings = defaultSettings();

    bindEvents();
    applyAdminState();

    if (!state.classId) {
      const info = $('ld-pool-info');
      if (info) info.textContent = '你还没有加入班级，抽奖需要班级场景';
      renderAll();
      return;
    }

    await loadData();
    ensureColors();
    renderAll();
    if (state.storage === 'cloud' && !state.configSaved) {
      setSaveMsg(state.isAdmin ? '还没保存到班级云端，点「保存设置」全班可见' : '班委尚未保存奖项设置', '');
    }
    await loadMembers();
    renderPoolInfo();
    renderPoolDetail();
    subscribeRealtime();
  }

  /* ============ 读取数据 ============ */
  async function loadData() {
    const local = readLocal();
    let cloudRow = null;

    if (db && state.classId) {
      try {
        const res = await db.from('class_lottery')
          .select('prizes,settings')
          .eq('class_id', state.classId)
          .maybeSingle();
        if (!res.error) {
          state.storage = 'cloud';
          cloudRow = res.data || null;
        } else {
          console.warn('[抽奖] class_lottery 不可用，降级为本机保存：', res.error.message);
        }
      } catch (e) {
        console.warn('[抽奖] 云端读取异常，降级为本机保存', e);
      }
    }

    if (state.storage === 'cloud') {
      const drawRes = await db.from('lottery_draws')
        .select('*')
        .eq('class_id', state.classId)
        .order('created_at', { ascending: false })
        .limit(200);
      state.draws = drawRes.error ? [] : (drawRes.data || []);

      if (cloudRow && Array.isArray(cloudRow.prizes) && cloudRow.prizes.length) {
        state.configSaved = true;
        state.prizes = cloudRow.prizes.map(normalizePrize);
        state.settings = normalizeSettings(cloudRow.settings);
        state.dirty = false;
      } else {
        // 云端还没有这个班的抽奖配置：把本机旧设置迁过去，否则用默认奖项
        state.configSaved = false;
        state.prizes = (local && Array.isArray(local.prizes) && local.prizes.length)
          ? local.prizes.map(normalizePrize)
          : seedPrizes();
        state.settings = normalizeSettings(local && local.settings);
        state.dirty = true;
      }
      writeLocal();
    } else {
      state.prizes = (local && Array.isArray(local.prizes) && local.prizes.length)
        ? local.prizes.map(normalizePrize)
        : seedPrizes();
      state.settings = normalizeSettings(local && local.settings);
      state.draws = (local && Array.isArray(local.draws)) ? local.draws : [];
      state.configSaved = !!(local && local.prizes && local.prizes.length);
      state.dirty = false;
    }
  }

  async function loadMembers() {
    if (!db || !state.classId) { state.members = []; state.membersLoaded = true; return; }
    try {
      const { data, error } = await db.from('profiles')
        .select('nickname')
        .or(`class_id.eq.${state.classId},active_class_id.eq.${state.classId}`)
        .order('nickname', { ascending: true });
      if (!error && Array.isArray(data)) {
        state.members = [...new Set(data.map((m) => String(m.nickname || '').trim()).filter(Boolean))];
      }
    } catch (e) {
      console.warn('[抽奖] 班级成员读取失败', e);
    }
    state.membersLoaded = true;
  }

  function ensureColors() {
    state.prizes.forEach((p, i) => {
      if (!p.color) p.color = COLORS[i % COLORS.length];
    });
  }

  /* ============ 保存设置 ============ */
  function validatePrizes() {
    if (!state.prizes.length) return '至少添加一个奖项';
    if (state.prizes.some((p) => !String(p.name || '').trim())) return '奖项名称不能为空';
    const total = state.prizes.reduce((s, p) => s + (Number(p.weight) || 0), 0);
    if (total <= 0) return '奖项概率不能全为 0';
    return '';
  }

  async function saveSettings(opts) {
    const silent = !!(opts && opts.silent);
    if (state.spinning) return false;
    if (!state.isAdmin) {
      if (!silent) toast('只有班委 / 老师可以修改奖项设置', 'error');
      return false;
    }

    const problem = validatePrizes();
    if (problem) {
      setSaveMsg(problem, 'error');
      if (silent) toast(problem, 'error');
      return false;
    }

    if (state.storage === 'cloud' && db) {
      const { error } = await db.from('class_lottery').upsert({
        class_id: state.classId,
        prizes: state.prizes,
        settings: state.settings,
        updated_by: state.user ? state.user.id : null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'class_id' });
      if (error) {
        setSaveMsg('保存失败：' + error.message, 'error');
        if (silent) toast('奖项自动保存失败：' + error.message, 'error');
        return false;
      }
      state.configSaved = true;
    }

    writeLocal();
    state.dirty = false;
    setSaveMsg('已保存', 'success');
    return true;
  }

  function setSaveMsg(text, type) {
    const el = $('ld-save-msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'form-msg' + (type ? ' ' + type : '');
  }

  function markDirty() {
    if (state.storage === 'local') {
      writeLocal();
      state.dirty = false;
      if (state.isAdmin) setSaveMsg('本机模式 · 已自动保存', '');
      return;
    }
    state.dirty = true;
    if (state.isAdmin) setSaveMsg('有未保存的修改', '');
  }
  /* ============ 权限 / 界面状态 ============ */
  function applyAdminState() {
    ['ld-add-prize', 'ld-even-btn', 'ld-stock-btn', 'ld-save-btn', 'ld-reset-round', 'ld-clear-btn'].forEach((id) => {
      const el = $(id);
      if (el) el.style.display = state.isAdmin ? '' : 'none';
    });
    ['ld-save-msg', 'ld-admin-tip'].forEach((id) => {
      const el = $(id);
      if (!el) return;
      if (id === 'ld-admin-tip') el.hidden = state.isAdmin;
      else el.style.display = state.isAdmin ? '' : 'none';
    });
  }

  function updateStorageBadge() {
    const badge = $('ld-mode-badge');
    const tip = $('ld-storage-tip');
    if (!badge) return;
    if (state.storage === 'cloud') {
      badge.textContent = '☁️ 班级云端';
      badge.className = 'ld-mode-badge';
      badge.title = '奖项与中奖记录已保存到班级云端，全班可见';
      if (tip) tip.hidden = true;
    } else {
      badge.textContent = '💾 本机保存';
      badge.className = 'ld-mode-badge local';
      badge.title = '未连接班级云端：奖项与记录保存在这台设备的浏览器';
      if (tip && !state.tipDismissed) tip.hidden = false;
    }
  }

  function renderAll() {
    renderPrizes();
    updateTotal();
    renderWheel();
    renderPeople();
    renderPoolInfo();
    renderRecords();
    updateStorageBadge();
    updateDrawBtnLabel();
  }

  /* ============ 奖项列表 ============ */
  function inputsLocked() { return state.spinning || !state.isAdmin; }

  function renderPrizes() {
    const list = $('ld-prize-list');
    if (!list) return;
    if (!state.prizes.length) {
      list.innerHTML = '<div class="ld-record-empty">还没有奖项，点下面「＋ 添加奖项」</div>';
      return;
    }
    const dis = inputsLocked() ? ' disabled' : '';
    list.innerHTML = state.prizes.map((p, i) => {
      const out = p.stock === 0;
      const stockVal = (p.stock === null || p.stock === undefined) ? '' : p.stock;
      return `<div class="ld-prize-row${out ? ' out' : ''}" data-id="${esc(p.id)}">
        <span class="ld-swatch" style="background:${esc(p.color || COLORS[i % COLORS.length])}"></span>
        <input class="ld-prize-name" type="text" maxlength="10" value="${esc(p.name)}" placeholder="奖项名称" aria-label="奖项名称"${dis}>
        <input class="ld-prize-weight" type="number" min="0" max="100" step="1" value="${Number(p.weight) || 0}" aria-label="中奖概率百分比"${dis}>
        <input class="ld-prize-stock" type="number" min="0" step="1" value="${stockVal}" placeholder="∞" aria-label="剩余份数" title="剩余份数，留空表示不限量"${dis}>
        <button class="ld-prize-del" type="button" title="删除这个奖项"${dis}>✕</button>
      </div>`;
    }).join('');
  }

  function updateTotal() {
    const pctEl = $('ld-total-pct');
    const hintEl = $('ld-total-hint');
    const row = $('ld-total');
    if (!pctEl || !hintEl || !row) return;
    const total = state.prizes.reduce((s, p) => s + (Number(p.weight) || 0), 0);
    pctEl.textContent = (Math.round(total * 10) / 10) + '%';
    const isHundred = Math.abs(total - 100) < 0.01 && total > 0;
    row.classList.toggle('hit', isHundred);
    if (total <= 0) hintEl.textContent = '概率不能全为 0';
    else if (isHundred) hintEl.textContent = '✓ 正好 100%，按上面的概率抽';
    else hintEl.textContent = '≠ 100%，抽奖时按比例折算（实际概率 = 本奖项 ÷ 合计）';
  }

  /* ============ 转盘绘制 ============ */
  function wheelPrizes() {
    return state.prizes.filter((p) => String(p.name || '').trim());
  }

  function renderWheel() {
    const canvas = $('ld-wheel');
    if (!canvas) return;
    const sectors = wheelPrizes();
    const emptyEl = $('ld-wheel-empty');
    if (emptyEl) emptyEl.hidden = sectors.length > 0;

    const disabled = state.spinning || sectors.length === 0 || !state.classId;
    const spinBtn = $('ld-spin-btn');
    const drawBtn = $('ld-draw-btn');
    if (spinBtn) spinBtn.disabled = disabled;
    if (drawBtn) drawBtn.disabled = disabled;

    if (!sectors.length) {
      clearWheel(canvas);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const size = Math.max(220, Math.round(rect.width || canvas.clientWidth || 360));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.round(size * dpr);
    if (canvas.width !== px || canvas.height !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawWheel(ctx, size, sectors);
  }

  function clearWheel(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width || 1;
    const h = canvas.height || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
  }

  function drawWheel(ctx, S, sectors) {
    const cx = S / 2;
    const cy = S / 2;
    const outer = S / 2 - 1;
    const rim = Math.max(5, S * 0.026);
    const R = outer - rim;
    const n = sectors.length;
    const span = (Math.PI * 2) / n;
    const eligibleTotal = sectors.reduce((sum, p) => (p.stock === 0 || !(p.weight > 0) ? sum : sum + p.weight), 0);

    // 外圈金边
    const rimGrad = ctx.createLinearGradient(0, 0, S, S);
    rimGrad.addColorStop(0, '#fbe6a2');
    rimGrad.addColorStop(0.35, '#d4a13a');
    rimGrad.addColorStop(0.6, '#f7d774');
    rimGrad.addColorStop(1, '#b8862a');
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, outer - rim / 2, 0, Math.PI * 2);
    ctx.lineWidth = rim;
    ctx.strokeStyle = rimGrad;
    ctx.stroke();

    // 跑马灯小灯泡
    const bulbs = 28;
    for (let i = 0; i < bulbs; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 / bulbs) * i;
      const bx = cx + Math.cos(a) * (outer - rim / 2);
      const by = cy + Math.sin(a) * (outer - rim / 2);
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(1.6, S * 0.0075), 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? '#fffaf0' : 'rgba(120,74,0,.55)';
      ctx.fill();
    }
    ctx.restore();

    // 扇区
    sectors.forEach((p, i) => {
      const a0 = -Math.PI / 2 + i * span;
      const a1 = a0 + span;
      const out = p.stock === 0;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a1);
      ctx.closePath();
      ctx.fillStyle = out ? '#9d97a5' : (p.color || COLORS[i % COLORS.length]);
      ctx.fill();
      ctx.lineWidth = Math.max(1, S * 0.0035);
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.stroke();
    });

    // 扇区文字（奖项名 + 实际概率）
    sectors.forEach((p, i) => {
      const mid = -Math.PI / 2 + (i + 0.5) * span;
      const out = p.stock === 0;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(mid);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      const setFont = (size, weight) => {
        ctx.font = (weight || 700) + ' ' + size + 'px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif';
      };

      let fs = clamp(S * 0.045, 10, 20);
      const maxW = R * 0.58;
      const name = String(p.name || '').trim();
      setFont(fs);
      while (fs > 9 && ctx.measureText(name).width > maxW) {
        fs -= 1;
        setFont(fs);
      }
      let label = name;
      while (label.length > 1 && ctx.measureText(label).width > maxW) label = label.slice(0, -1);

      const nameW = ctx.measureText(label).width;
      ctx.fillStyle = out ? 'rgba(255,255,255,.72)' : '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,.35)';
      ctx.shadowBlur = Math.max(2, S * 0.006);
      ctx.fillText(label, R - S * 0.03, 0);

      const prob = (eligibleTotal > 0 && p.weight > 0 && !out)
        ? Math.round((p.weight / eligibleTotal) * 1000) / 10
        : 0;
      if (prob > 0 && span > 0.36) {
        const probText = (prob >= 10 ? Math.round(prob) : prob) + '%';
        setFont(Math.max(8, Math.min(12, fs * 0.62)), 600);
        const pw = ctx.measureText(probText).width;
        const px2 = R - S * 0.03 - nameW - S * 0.014;
        if (px2 - pw > R * 0.26) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(255,255,255,.72)';
          ctx.fillText(probText, px2, 0);
        }
      }
      ctx.restore();
    });

    // 中心底盘（外部 HTML 按钮盖在上面）
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.315, 0, Math.PI * 2);
    ctx.fillStyle = '#2b0a33';
    ctx.fill();
    ctx.lineWidth = Math.max(2, S * 0.008);
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.stroke();
  }

  /* ============ 对象 / 名单 ============ */
  function parseNames(text) {
    const arr = String(text || '').split(/[\n,，、;；\t]+/).map((s) => s.trim()).filter(Boolean);
    return [...new Set(arr)].slice(0, 300);
  }

  function participantPool() {
    const mode = state.settings ? state.settings.mode : 'members';
    if (mode === 'members') return state.members;
    if (mode === 'custom') return parseNames(state.settings.customNames);
    return [];
  }

  function roundWinners() {
    const since = state.settings && state.settings.resetAt ? new Date(state.settings.resetAt).getTime() : 0;
    return state.draws
      .filter((d) => d && d.winner_name && new Date(d.created_at || 0).getTime() >= since)
      .map((d) => d.winner_name);
  }

  function renderPeople() {
    if (!state.settings) return;
    const mode = state.settings.mode;
    document.querySelectorAll('input[name="ld-mode"]').forEach((r) => {
      r.checked = r.value === mode;
      r.disabled = inputsLocked();
    });

    const ta = $('ld-custom-names');
    if (ta) {
      if (document.activeElement !== ta) ta.value = state.settings.customNames || '';
      ta.hidden = mode !== 'custom';
      ta.disabled = inputsLocked();
    }

    const cb = $('ld-unique-winner');
    if (cb) {
      cb.checked = state.settings.uniqueWinner !== false;
      cb.disabled = inputsLocked() || mode === 'none';
      const wrap = cb.closest('.ld-check');
      if (wrap) wrap.style.opacity = mode === 'none' ? '.45' : '';
    }

    const resetBtn = $('ld-reset-round');
    if (resetBtn) resetBtn.disabled = inputsLocked();

    renderPoolDetail();
  }

  function renderPoolDetail() {
    const el = $('ld-pool-detail');
    if (!el) return;
    if (!state.settings) { el.textContent = '—'; return; }
    const mode = state.settings.mode;
    if (mode === 'none') {
      el.innerHTML = '当前模式：<b>只抽奖项</b>，转盘决定奖项后不指定中奖人。';
      return;
    }
    if (mode === 'members' && !state.membersLoaded) {
      el.textContent = '正在读取班级名单…';
      return;
    }
    const pool = participantPool();
    const won = new Set(roundWinners());
    const remain = pool.filter((n) => !won.has(n)).length;
    const label = mode === 'members' ? '全班同学' : '自定义名单';
    let html = '<b>' + label + '</b>：' + pool.length + ' 人';
    if (state.settings.uniqueWinner) {
      html += ' · 本轮已中奖 <b>' + (pool.length - remain) + '</b> 人 · 剩余候选 <b>' + remain + '</b> 人';
    } else {
      html += ' · 允许重复中奖';
    }
    if (mode === 'custom' && !pool.length) {
      html += '<br><span style="color:var(--danger)">还没填名字，在上面的输入框里粘贴一份名单吧</span>';
    }
    el.innerHTML = html;
  }

  function renderPoolInfo() {
    const el = $('ld-pool-info');
    if (!el) return;
    if (!state.classId) { el.textContent = '未加入班级，抽奖需要班级场景'; return; }
    if (!state.settings) { el.textContent = ''; return; }
    const mode = state.settings.mode;
    if (mode === 'none') { el.textContent = '只抽奖项 · 转盘只决定奖项，不指定中奖人'; return; }
    if (mode === 'members' && !state.membersLoaded) { el.textContent = '正在读取班级名单…'; return; }
    const pool = participantPool();
    const won = new Set(roundWinners());
    const remain = pool.filter((n) => !won.has(n)).length;
    const label = mode === 'members' ? '全班' : '名单';
    let text = label + ' ' + pool.length + ' 人';
    text += state.settings.uniqueWinner
      ? ' · 本轮已中奖 ' + (pool.length - remain) + ' 人 · 剩余候选 ' + remain + ' 人'
      : ' · 可重复中奖';
    el.textContent = text;
  }

  /* ============ 中奖记录 ============ */
  function renderRecords() {
    const list = $('ld-record-list');
    if (!list) return;
    if (!state.draws.length) {
      list.innerHTML = '<div class="ld-record-empty">还没有人中奖，转动转盘把好运带走吧</div>';
      return;
    }
    list.innerHTML = state.draws.slice(0, 60).map((d) => {
      const color = d.prize_color || '#660874';
      const who = d.winner_name
        ? '<span class="ld-record-name">' + esc(d.winner_name) + '</span>'
        : '<span class="ld-record-name">—</span>';
      const meta = [d.operator_name ? esc(d.operator_name) + ' 抽' : '', fmtTime(d.created_at)]
        .filter(Boolean).join(' · ');
      return '<div class="ld-record">' +
        '<span class="ld-record-dot" style="background:' + esc(color) + '"></span>' +
        '<div class="ld-record-main">' +
          '<div>' + who + '<span class="ld-record-prize">' + esc(d.prize_name) + '</span></div>' +
          '<div class="ld-record-meta">' + meta + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function updateDrawBtnLabel() {
    const draw = $('ld-draw-btn');
    const label = $('ld-hub-label');
    const sub = $('ld-hub-sub');
    const busy = state.spinning;
    if (draw) draw.textContent = busy ? '转盘飞速转动中…' : (state.drawCount ? '再抽一次' : '开始抽奖');
    if (label) label.textContent = busy ? '转动中' : '抽奖';
    if (sub) sub.textContent = busy ? '…' : 'LUCKY';
  }

  /* ============ 抽奖核心 ============ */
  function pickWinner() {
    const mode = state.settings.mode;
    if (mode === 'none') return { name: null };

    const pool = participantPool();
    if (!pool.length) {
      return {
        error: mode === 'members'
          ? '班级里还没有可抽奖的同学'
          : '自定义名单还是空的，先去「👥 对象」填几个名字'
      };
    }

    let candidates = pool;
    if (state.settings.uniqueWinner) {
      const won = new Set(roundWinners());
      candidates = pool.filter((n) => !won.has(n));
      if (!candidates.length) {
        return { error: '本轮所有参与者都已中奖，点「重置本轮中奖状态」再开一轮' };
      }
    }
    return { name: candidates[Math.floor(rand() * candidates.length)] };
  }

  async function startDraw() {
    if (state.spinning || !state.classId) return;

    const sectors = wheelPrizes();
    if (!sectors.length) { toast('先在右侧添加奖项再抽奖', 'error'); return; }

    const eligible = [];
    sectors.forEach((p, i) => {
      if (p.stock === 0) return;
      if (!(Number(p.weight) > 0)) return;
      eligible.push({ prize: p, index: i });
    });
    if (!eligible.length) { toast('所有奖项都已抽完或概率为 0，请调整设置', 'error'); return; }

    if (state.storage === 'cloud' && !state.configSaved && !state.isAdmin) {
      toast('班委还没有保存本班的奖项设置，请稍后再试', 'error');
      return;
    }

    const winner = pickWinner();
    if (winner.error) { toast(winner.error, 'error'); return; }

    // 管理员有未保存的修改时，先自动保存，避免刷新后丢失
    if (state.isAdmin && state.dirty) {
      const ok = await saveSettings({ silent: true });
      if (!ok) { toast('奖项设置还没保存成功，请检查一下', 'error'); return; }
    }

    const total = eligible.reduce((s, x) => s + (Number(x.prize.weight) || 0), 0);
    let roll = rand() * total;
    let picked = eligible[eligible.length - 1];
    for (let i = 0; i < eligible.length; i++) {
      roll -= Number(eligible[i].prize.weight) || 0;
      if (roll <= 0) { picked = eligible[i]; break; }
    }

    state.pending = { prize: picked.prize, winner: winner.name || null, index: picked.index };
    state.spinning = true;
    setSpinUI(true);
    spinTo(sectors.length, picked.index);

    const duration = spinDuration();
    const canvas = $('ld-wheel');
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (canvas) canvas.removeEventListener('transitionend', onEnd);
      finishDraw();
    };
    const onEnd = (ev) => {
      if (ev.target === canvas && ev.propertyName === 'transform') finish();
    };
    if (canvas) canvas.addEventListener('transitionend', onEnd);
    window.setTimeout(finish, duration + 180);
  }

  function spinTo(n, index) {
    const canvas = $('ld-wheel');
    if (!canvas) return;

    const span = 360 / n;
    const centerDeg = -(index + 0.5) * span;
    const jitter = (rand() - 0.5) * span * 0.55;
    const desired = centerDeg + jitter;

    const duration = spinDuration();
    const currentMod = ((state.rotation % 360) + 360) % 360;
    const desiredMod = ((desired % 360) + 360) % 360;
    let delta = desiredMod - currentMod;
    if (delta < 0) delta += 360;

    const turns = duration > 1000 ? SPIN_TURNS : 1;
    const final = state.rotation + turns * 360 + delta;
    state.rotation = final;

    canvas.style.transition = 'transform ' + duration + 'ms cubic-bezier(.14,.72,.12,1)';
    void canvas.offsetWidth; // 强制回流，保证每次都从当前角度重新转
    canvas.style.transform = 'rotate(' + final + 'deg)';
  }

  async function finishDraw() {
    const pending = state.pending;
    state.pending = null;
    state.spinning = false;
    if (!pending || !pending.prize) { setSpinUI(false); return; }

    const prize = pending.prize;
    if (prize.stock !== null && prize.stock !== undefined) {
      prize.stock = Math.max(0, Number(prize.stock) - 1);
    }

    const record = {
      id: 'local_' + Date.now(),
      prize_id: prize.id,
      prize_name: prize.name,
      prize_color: prize.color,
      winner_name: pending.winner,
      operator_name: state.user ? state.user.nickname : '',
      created_at: new Date().toISOString()
    };
    state.draws.unshift(record);
    state.draws = state.draws.slice(0, 200);
    state.drawCount = (state.drawCount || 0) + 1;

    setSpinUI(false);
    renderAll();
    writeLocal();
    showResult(prize, pending.winner, record);

    if (state.storage === 'cloud' && db) {
      try {
        const { data, error } = await db.rpc('lottery_draw', {
          p_class_id: state.classId,
          p_prize_id: prize.id,
          p_prize_name: prize.name,
          p_winner: pending.winner
        });
        if (error) throw error;
        if (data && Array.isArray(data.prizes)) {
          state.prizes = data.prizes.map(normalizePrize);
          if (data.draw_id) record.id = data.draw_id;
          renderAll();
          writeLocal();
        }
      } catch (e) {
        console.warn('[抽奖] 云端记录失败', e);
        toast('中奖记录云端同步失败：' + (e && e.message ? e.message : e), 'error');
      }
    }
  }

  /* ============ 中奖弹窗 / 彩带 ============ */
  function showResult(prize, winner, record) {
    const overlay = $('ld-result');
    if (!overlay) return;
    const winnerEl = $('ld-result-winner');
    winnerEl.textContent = winner || '好运';
    winnerEl.hidden = !winner;
    const lineEl = $('ld-result-line');
    if (lineEl) lineEl.textContent = winner ? '获得了' : '抽中了';
    const prizeEl = $('ld-result-prize');
    if (prizeEl) prizeEl.textContent = prize.name;
    const metaEl = $('ld-result-meta');
    if (metaEl) {
      metaEl.textContent = [
        state.user ? state.user.nickname + ' 抽' : '',
        fmtTime(record.created_at)
      ].filter(Boolean).join(' · ');
    }
    const live = $('ld-live');
    if (live) live.textContent = (winner ? winner + ' 获得 ' : '抽中 ') + prize.name;

    overlay.hidden = false;
    burstConfetti();
  }

  function hideResult() {
    const overlay = $('ld-result');
    if (overlay) overlay.hidden = true;
  }

  function burstConfetti() {
    if (isReduced()) return;
    const canvas = $('ld-confetti');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.hidden = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const colors = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#b56ee6', '#f9a825'];
    const parts = [];
    for (let i = 0; i < 110; i++) {
      parts.push({
        x: w / 2 + (rand() - 0.5) * 180,
        y: h * 0.42 + (rand() - 0.5) * 80,
        vx: (rand() - 0.5) * 12,
        vy: -4 - rand() * 12,
        g: 0.26 + rand() * 0.18,
        size: 5 + rand() * 7,
        rot: rand() * Math.PI,
        vr: (rand() - 0.5) * 0.32,
        color: colors[Math.floor(rand() * colors.length)]
      });
    }

    const start = performance.now();
    cancelAnimationFrame(state.confettiRaf);

    function frame(now) {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      const alpha = Math.max(0, 1 - t / 2600);
      parts.forEach((p) => {
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.995;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.min(1, alpha * 1.6);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });
      if (t < 2650) state.confettiRaf = requestAnimationFrame(frame);
      else {
        ctx.clearRect(0, 0, w, h);
        canvas.hidden = true;
      }
    }
    state.confettiRaf = requestAnimationFrame(frame);
  }

  let toastTimer = 0;
  function toast(msg, type) {
    const el = $('ld-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'ld-toast' + (type === 'error' ? ' error' : '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { el.hidden = true; }, 3400);
  }

  /* ============ 界面操作 ============ */
  function setSpinUI(busy) {
    document.querySelectorAll('.ld-prize-row input, .ld-prize-del').forEach((el) => {
      el.disabled = busy || !state.isAdmin;
    });
    document.querySelectorAll('input[name="ld-mode"], #ld-custom-names, #ld-unique-winner').forEach((el) => {
      el.disabled = busy || !state.isAdmin;
    });
    ['ld-save-btn', 'ld-add-prize', 'ld-even-btn', 'ld-stock-btn', 'ld-reset-round', 'ld-clear-btn', 'ld-export-btn'].forEach((id) => {
      const b = $(id);
      if (b) b.disabled = busy;
    });
    renderWheel();
    updateDrawBtnLabel();
  }

  function onPrizeInput(e) {
    const row = e.target.closest('.ld-prize-row');
    if (!row) return;
    const prize = state.prizes.find((p) => p.id === row.dataset.id);
    if (!prize) return;
    const t = e.target;

    if (t.classList.contains('ld-prize-name')) {
      prize.name = t.value;
      renderWheel();
    } else if (t.classList.contains('ld-prize-weight')) {
      prize.weight = clamp(Number(t.value) || 0, 0, 100);
      updateTotal();
      renderWheel();
    } else if (t.classList.contains('ld-prize-stock')) {
      const raw = t.value.trim();
      prize.stock = raw === '' ? null : Math.max(0, Math.floor(Number(raw) || 0));
      row.classList.toggle('out', prize.stock === 0);
      renderWheel();
    } else {
      return;
    }
    markDirty();
  }

  function onPrizeListClick(e) {
    const btn = e.target.closest('.ld-prize-del');
    if (!btn || !state.isAdmin || state.spinning) return;
    const row = btn.closest('.ld-prize-row');
    if (!row) return;
    if (state.prizes.length <= 1) { toast('至少要保留一个奖项', 'error'); return; }
    state.prizes = state.prizes.filter((p) => p.id !== row.dataset.id);
    ensureColors();
    markDirty();
    renderAll();
  }

  function addPrize() {
    if (!state.isAdmin || state.spinning) return;
    if (state.prizes.length >= MAX_PRIZES) { toast('最多设置 ' + MAX_PRIZES + ' 个奖项', 'error'); return; }
    state.prizes.push({
      id: uid(),
      name: '新奖项',
      weight: 10,
      stock: null,
      color: COLORS[state.prizes.length % COLORS.length]
    });
    markDirty();
    renderAll();
    const inputs = document.querySelectorAll('.ld-prize-name');
    if (inputs.length) {
      const last = inputs[inputs.length - 1];
      last.focus();
      if (last.select) last.select();
    }
  }

  function distributeEven() {
    if (!state.isAdmin || state.spinning) return;
    const n = state.prizes.length;
    if (!n) return;
    const each = Math.round((100 / n) * 10) / 10;
    state.prizes.forEach((p) => { p.weight = each; });
    const sum = state.prizes.reduce((s, p) => s + p.weight, 0);
    const last = state.prizes[state.prizes.length - 1];
    last.weight = Math.round((last.weight + (100 - sum)) * 10) / 10;
    markDirty();
    renderAll();
  }

  // 按剩余份数占比分配概率：一等奖 1 份、二等奖 9 份 → 10% / 90%
  function distributeByStock() {
    if (!state.isAdmin || state.spinning) return;
    const prizes = wheelPrizes();
    if (!prizes.length) { toast('先添加奖项再分配概率', 'error'); return; }

    const blank = prizes.find((p) => p.stock === null || p.stock === undefined || p.stock === '');
    if (blank) {
      toast('「' + blank.name + '」还没填剩余份数（留空表示不限量），请先填好份数再按份数分配', 'error');
      return;
    }

    const stocks = prizes.map((p) => Math.max(0, Math.round(Number(p.stock) || 0)));
    const totalStock = stocks.reduce((s, n) => s + n, 0);
    if (totalStock <= 0) { toast('所有奖项都已抽完，没有份数可以分配', 'error'); return; }

    // 最大余数法：先按 0.1% 取整，再把剩下的单位补给小数部分最大的奖项，保证合计正好 100%
    const raw = stocks.map((n) => (n / totalStock) * 1000);
    const units = raw.map((v) => Math.floor(v));
    let left = 1000 - units.reduce((s, n) => s + n, 0);
    const byFrac = raw
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .filter((x) => stocks[x.i] > 0)
      .sort((a, b) => b.frac - a.frac);
    for (let k = 0; left > 0 && byFrac.length; k++, left--) {
      units[byFrac[k % byFrac.length].i] += 1;
    }

    state.prizes.forEach((p) => { p.weight = 0; });
    prizes.forEach((p, i) => { p.weight = units[i] / 10; });

    markDirty();
    renderAll();
    toast('已按剩余份数分配概率');
  }

  function onModeChange(e) {
    if (!state.isAdmin || state.spinning) return;
    state.settings.mode = e.target.value;
    markDirty();
    renderPeople();
    renderPoolInfo();
  }

  function switchPane(name) {
    document.querySelectorAll('.ld-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.pane === name);
    });
    document.querySelectorAll('.ld-pane').forEach((p) => {
      p.hidden = p.id !== 'ld-pane-' + name;
    });
  }

  async function resetRound() {
    if (!state.isAdmin || state.spinning) return;
    state.settings.resetAt = new Date().toISOString();
    markDirty();
    renderPeople();
    renderPoolInfo();
    if (state.storage === 'cloud') {
      const ok = await saveSettings({ silent: true });
      if (!ok) return;
    }
    toast('本轮中奖标记已清空，可以重新抽啦');
  }

  function exportRecords() {
    if (!state.draws.length) { toast('还没有中奖记录', 'error'); return; }
    if (!U.exportCSV) { toast('导出功能不可用', 'error'); return; }
    const headers = ['时间', '奖项', '中奖人', '操作人'];
    const rows = state.draws.map((d) => [
      d.created_at ? new Date(d.created_at).toLocaleString('zh-CN', { hour12: false }) : '',
      d.prize_name || '',
      d.winner_name || '—',
      d.operator_name || '—'
    ]);
    U.exportCSV('幸运抽奖记录_' + (state.classId || 'class') + '.csv', headers, rows);
  }

  async function clearRecords() {
    if (!state.isAdmin || state.spinning) return;
    if (!state.draws.length) { toast('还没有中奖记录', 'error'); return; }
    if (!confirm('确定清空全部中奖记录吗？奖项的剩余份数不会恢复。')) return;
    if (state.storage === 'cloud' && db) {
      const { error } = await db.from('lottery_draws').delete().eq('class_id', state.classId);
      if (error) { toast('清空失败：' + error.message, 'error'); return; }
    }
    state.draws = [];
    renderRecords();
    renderPoolInfo();
    renderPoolDetail();
    writeLocal();
    toast('已清空中奖记录');
  }

  function toggleFullscreen() {
    const block = document.querySelector('.ld-wheel-block');
    if (!document.fullscreenElement) {
      if (block && block.requestFullscreen) {
        block.requestFullscreen().catch(() => toast('当前浏览器不支持全屏', 'error'));
      } else {
        toast('当前浏览器不支持全屏', 'error');
      }
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }

  /* ============ 事件绑定 ============ */
  function bindEvents() {
    if (state.bound) return;
    state.bound = true;

    const on = (id, evt, fn) => {
      const el = $(id);
      if (el) el.addEventListener(evt, fn);
    };

    on('ld-spin-btn', 'click', startDraw);
    on('ld-draw-btn', 'click', startDraw);
    on('ld-add-prize', 'click', addPrize);
    on('ld-even-btn', 'click', distributeEven);
    on('ld-stock-btn', 'click', distributeByStock);
    on('ld-save-btn', 'click', () => saveSettings());
    on('ld-reset-round', 'click', resetRound);
    on('ld-export-btn', 'click', exportRecords);
    on('ld-clear-btn', 'click', clearRecords);
    on('ld-fullscreen-btn', 'click', toggleFullscreen);
    on('ld-tip-close', 'click', () => {
      state.tipDismissed = true;
      const tip = $('ld-storage-tip');
      if (tip) tip.hidden = true;
    });
    on('ld-unique-winner', 'change', (e) => {
      state.settings.uniqueWinner = e.target.checked;
      markDirty();
      renderPoolInfo();
      renderPoolDetail();
    });
    on('ld-custom-names', 'input', (e) => {
      state.settings.customNames = e.target.value;
      markDirty();
      renderPoolInfo();
      renderPoolDetail();
    });
    on('ld-result-close', 'click', hideResult);
    on('ld-again-btn', 'click', () => {
      hideResult();
      window.setTimeout(startDraw, 280);
    });
    on('ld-result', 'click', (e) => {
      if (e.target === e.currentTarget) hideResult();
    });

    const list = $('ld-prize-list');
    if (list) {
      list.addEventListener('input', onPrizeInput);
      list.addEventListener('change', onPrizeInput);
      list.addEventListener('click', onPrizeListClick);
    }

    document.querySelectorAll('.ld-tab').forEach((tab) => {
      tab.addEventListener('click', () => switchPane(tab.dataset.pane));
    });
    document.querySelectorAll('input[name="ld-mode"]').forEach((radio) => {
      radio.addEventListener('change', onModeChange);
    });

    document.addEventListener('keydown', (e) => {
      const overlay = $('ld-result');
      if (e.key === 'Escape' && overlay && !overlay.hidden) hideResult();
    });

    document.addEventListener('fullscreenchange', () => {
      window.setTimeout(renderWheel, 160);
    });

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(renderWheel, 160);
    });
  }

  /* ============ 实时同步（多人 / 多设备） ============ */
  function subscribeRealtime() {
    if (state.storage !== 'cloud' || !db || !state.classId) return;
    try {
      db.channel('lucky-draw-' + state.classId)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'class_lottery', filter: 'class_id=eq.' + state.classId },
          () => refreshFromCloud('config'))
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'lottery_draws', filter: 'class_id=eq.' + state.classId },
          () => refreshFromCloud('draws'))
        .subscribe();
    } catch (e) {
      console.warn('[抽奖] 实时订阅失败（不影响抽奖）', e);
    }
  }

  async function refreshFromCloud(kind) {
    if (!db || state.storage !== 'cloud' || state.spinning) return;
    try {
      if (kind === 'config') {
        if (state.dirty) return; // 有未保存的本地修改，避免被实时数据覆盖
        const { data, error } = await db.from('class_lottery')
          .select('prizes,settings')
          .eq('class_id', state.classId)
          .maybeSingle();
        if (error || !data) return;
        if (Array.isArray(data.prizes) && data.prizes.length) {
          state.prizes = data.prizes.map(normalizePrize);
          state.configSaved = true;
        }
        state.settings = normalizeSettings(data.settings);
        ensureColors();
        renderAll();
        writeLocal();
      } else {
        const { data } = await db.from('lottery_draws')
          .select('*')
          .eq('class_id', state.classId)
          .order('created_at', { ascending: false })
          .limit(200);
        if (!data) return;
        state.draws = data;
        renderRecords();
        renderPoolInfo();
        renderPoolDetail();
        writeLocal();
      }
    } catch (e) {
      // 实时刷新失败不打扰用户
    }
  }
})();