/* 拾光优选 · 大数据分析与推荐模块（课程设计新增）
   ==========================================================
   模块职责（对应课程设计 3.2 数据采集 / 3.3 数据分析与推荐）：
   1. 数据采集：登录日志（时间/IP）、浏览行为日志（类别/停留时长）、
      销售与管理者操作日志（时间/内容/IP/账号）
   2. 数据分析：销售趋势（日/周/月）、线性回归销售预测与误差评估、
      销售异常判别（z-score）、商品销售排行榜、用户画像（地域/购买力/偏好分类）
   3. 推荐系统：简单共现推荐（"浏览过此商品的人也买了"）+ 基于物品的
      协同过滤（余弦相似度）
   4. 可视化与导出：ECharts 本地渲染、日志/订单/商品 CSV 导出

   演示环境说明：纯前端站点拿不到真实公网 IP 与真实地理位置，
   IP 与地域为首次访问时生成的模拟值（保证演示数据完整，报告已注明）。
*/
window.BigData = (() => {
  'use strict';

  /* ========== 基础工具 ========== */
  // 带种子的伪随机数（mulberry32），保证每次生成的演示数据一致可复现
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const randInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

  const DAY = 86400000;
  const pad2 = n => String(n).padStart(2, '0');
  // 本地时区日期键（toISOString 是 UTC，直接切片会导致晚上 8 点后的订单落到次日）
  function dayKey(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function fmtDT(ts) {
    const d = new Date(ts);
    return `${dayKey(ts)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }

  /* ========== 模拟 IP / 地域 ========== */
  const REGIONS = ['广东', '浙江', '江苏', '上海', '北京', '四川', '湖北', '山东', '福建', '湖南', '河南', '陕西'];
  function ensureMeta(db) {
    if (!db.meta) db.meta = {};
    if (!db.meta.visitorIp) {
      // 模拟公网 IP：仅演示用途，同一浏览器会话保持不变
      const r = mulberry32(Date.now() & 0xffffff);
      db.meta.visitorIp = `112.${randInt(r, 10, 99)}.${randInt(r, 0, 255)}.${randInt(r, 1, 254)}`;
      db.meta.visitorRegion = pick(r, REGIONS);
    }
    return db.meta;
  }
  const visitorIp = db => ensureMeta(db).visitorIp;

  /* ========== 日志采集 ========== */
  const LOG_CAP = 6000; // 每类日志条数上限，防止 localStorage 超限
  function ensureLogs(db) {
    if (!db.logs) db.logs = { logins: [], views: [], ops: [] };
    if (!db.logs.logins) db.logs.logins = [];
    if (!db.logs.views) db.logs.views = [];
    if (!db.logs.ops) db.logs.ops = [];
    return db.logs;
  }
  function nextLogId(db) {
    db.seq = db.seq || {};
    db.seq.log = (db.seq.log || 0) + 1;
    return db.seq.log;
  }
  function pushLog(arr, entry, db) {
    arr.unshift({ id: nextLogId(db), ...entry });
    if (arr.length > LOG_CAP) arr.length = LOG_CAP;
  }
  // 登录信息：时间、IP、账号、角色（失败登录也留痕）
  function logLogin(db, user, ok = true, note = '') {
    const logs = ensureLogs(db);
    pushLog(logs.logins, {
      time: new Date().toISOString(),
      userId: user ? user.id : null,
      username: user ? user.username : (note || '未知账号'),
      role: user ? user.role : '-',
      ip: visitorIp(db),
      ok: !!ok,
    }, db);
  }
  function logLogout(db, user) {
    if (!user) return;
    const logs = ensureLogs(db);
    pushLog(logs.logins, {
      time: new Date().toISOString(),
      userId: user.id, username: user.username, role: user.role,
      ip: visitorIp(db), ok: true, note: '注销',
    }, db);
  }
  // 浏览行为：商品类别、停留时长（秒）、浏览者、时间、IP
  function logView(db, user, product, dwellSec) {
    if (!product) return;
    const logs = ensureLogs(db);
    pushLog(logs.views, {
      time: new Date().toISOString(),
      userId: user ? user.id : null,
      username: user ? user.username : '游客',
      productId: product.id,
      productName: product.name,
      category: product.category || '未分类',
      dwellSec: Math.max(1, Math.round(dwellSec || 1)),
      ip: visitorIp(db),
    }, db);
  }
  // 操作日志：销售/管理者的关键操作（时间、账号、内容、IP）
  function logOp(db, user, action, detail = '') {
    const logs = ensureLogs(db);
    pushLog(logs.ops, {
      time: new Date().toISOString(),
      userId: user ? user.id : null,
      username: user ? user.username : '-',
      role: user ? user.role : '-',
      ip: visitorIp(db),
      action, detail,
    }, db);
  }

  /* ========== 演示数据生成（近 90 天） ==========
     目的：让趋势预测 / 异常检测 / 协同过滤在首次访问即有完整数据可看。
     规律设计：整体上升趋势 + 周末高峰 + 两次"大促"异常点（供异常判别演示）。
     历史订单为导入的演示数据，不再回改商品库存与销量。
     seedVersion 变更时会清掉旧演示数据并重新生成（用户手工数据不受影响）。 */
  const SEED_VERSION = 2;
  function ensureSeed(db) {
    if (!db.products || !db.products.length) return false;
    ensureLogs(db); ensureMeta(db);
    if (db.seedVersion === SEED_VERSION) return false;

    // 清理旧版本演示数据（保留用户手工创建的商品/订单/账号）
    db.orders = (db.orders || []).filter(o => !o.demo);
    db.users = (db.users || []).filter(u => !/^c\d{2}$/.test(u.username));
    db.demoCustomers = null;
    db.logs = { logins: [], views: [], ops: [] };
    db.seq = db.seq || {};
    db.seq.order = db.orders.reduce((m, o) => Math.max(m, o.id || 0), 0);
    db.seq.user = db.users.reduce((m, u) => Math.max(m, u.id || 0), 0);

    const rng = mulberry32(20260927);
    const nowTs = Date.now();
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);

    /* 1) 演示顾客（带地域属性，供用户画像使用） */
    const SURNAME = ['林', '陈', '王', '李', '张', '刘', '黄', '吴', '郑', '周'];
    const GIVEN = ['晓萌', '子轩', '一诺', '思远', '雨桐', '浩然', '佳琪', '梓涵', '天佑', '若曦', '沐宸', '语嫣'];
    db.seq = db.seq || {};
    if (!db.demoCustomers) {
      db.demoCustomers = [];
      for (let i = 0; i < 28; i++) {
        const u = {
          id: ++db.seq.user,
          username: `c${pad2(i + 1)}`,
          password: '123456',
          email: `c${pad2(i + 1)}@demo.example`,
          nickname: pick(rng, SURNAME) + pick(rng, GIVEN),
          role: 'USER',
          shopId: null,
          region: pick(rng, REGIONS),
          createdAt: new Date(nowTs - randInt(rng, 60, 200) * DAY).toISOString(),
        };
        db.demoCustomers.push(u.id);
        db.users.push(u);
      }
      db.users.forEach(u => { if (!u.region) u.region = u.username === 'admin' ? '广东' : pick(rng, REGIONS); });
    }

    db.seq.order = db.seq.order || 0;
    const orders = db.orders = db.orders || [];
    const customers = db.users.filter(u => u.role === 'USER');
    // 商品热度权重：以现有销量为基础
    const weights = db.products.map(p => 30 + Number(p.sales || 0));
    const totalW = weights.reduce((s, w) => s + w, 0);
    const pickProduct = () => {
      let r = rng() * totalW;
      for (let i = 0; i < db.products.length; i++) { r -= weights[i]; if (r <= 0) return db.products[i]; }
      return db.products[0];
    };
    // 两次"大促"异常日（距今 50 / 20 天），销量约为平日 3 倍
    const promoDays = new Set([50, 20]);
    const PAID_SET = ['PAID', 'SHIPPED', 'COMPLETED'];

    for (let d = 89; d >= 0; d--) {
      const dayStart = today0.getTime() - d * DAY;
      const date = new Date(dayStart);
      const weekend = [0, 6].includes(date.getDay());
      let factor = 1 + (89 - d) / 89 * 0.55;         // 上升趋势
      if (weekend) factor *= 1.45;                    // 周末高峰
      if (promoDays.has(d)) factor *= 3.1;            // 大促异常点
      const nOrders = Math.min(30, Math.round(randInt(rng, 5, 12) * factor));

      for (let k = 0; k < nOrders; k++) {
        const user = pick(rng, customers);
        const itemCount = randInt(rng, 1, 3);
        const items = []; let total = 0;
        for (let j = 0; j < itemCount; j++) {
          const p = pickProduct();
          if (items.some(x => x.productId === p.id)) continue;
          const qty = randInt(rng, 1, 2);
          total += Number(p.price) * qty;
          items.push({ productId: p.id, productName: p.name, price: Number(p.price), quantity: qty, shopId: ensureShop(p) });
        }
        if (!items.length) continue;
        // 状态：老订单多为已完成/已发货，近三天有部分待发货/待付款，少量取消
        let status;
        const r = rng();
        if (d > 3) status = r < 0.92 ? (d > 10 ? 'COMPLETED' : 'SHIPPED') : 'CANCELLED';
        else status = r < 0.5 ? 'PAID' : (r < 0.7 ? 'PENDING' : (r < 0.9 ? 'SHIPPED' : 'CANCELLED'));
        const hour = randInt(rng, 9, 22);
        const created = new Date(dayStart + hour * 3600000 + randInt(rng, 0, 3599) * 1000);
        const orderNo = 'SG' + created.getTime().toString(36).toUpperCase() + randInt(rng, 1000, 9999);
        orders.push({
          id: ++db.seq.order,
          orderNo,
          userId: user.id,
          username: user.nickname || user.username,
          totalAmount: total,
          status,
          shippingEmail: user.email,
          name: user.nickname || user.username,
          receiver: user.nickname || user.username,
          phone: `13${randInt(rng, 0, 9)}${randInt(rng, 10000000, 99999999)}`,
          address: `演示数据 · ${user.region}某小区`,
          note: '',
          payMethod: pick(rng, ['alipay', 'wechat', 'card']),
          items,
          createdAt: created.toISOString(),
          demo: true,
        });

        // 对应浏览日志：下单前先"看过"（停留 30~300 秒）
        if (PAID_SET.includes(status)) {
          items.forEach(it => {
            const p = db.products.find(x => x.id === it.productId);
            const t = new Date(created.getTime() - randInt(rng, 2, 30) * 60000);
            pushLog(db.logs.views, {
              time: t.toISOString(), userId: user.id, username: user.username,
              productId: p.id, productName: p.name, category: p.category,
              dwellSec: randInt(rng, 30, 300), ip: db.meta.visitorIp,
            }, db);
          });
        }
      }

      // 日常ambient浏览：未购浏览 + 游客浏览（丰富停留时长样本）
      const ambient = randInt(rng, 10, 20);
      for (let k = 0; k < ambient; k++) {
        const p = pickProduct();
        const anonymous = rng() < 0.25;
        const user = anonymous ? null : pick(rng, customers);
        const t = new Date(dayStart + randInt(rng, 8, 23) * 3600000 + randInt(rng, 0, 3599) * 1000);
        if (t.getTime() > nowTs) continue;
        pushLog(db.logs.views, {
          time: t.toISOString(), userId: user ? user.id : null,
          username: user ? user.username : '游客',
          productId: p.id, productName: p.name, category: p.category,
          dwellSec: randInt(rng, 5, 180), ip: db.meta.visitorIp,
        }, db);
      }
    }

    /* 2) 登录日志（近 90 天抽样）与操作日志 */
    for (let d = 89; d >= 0; d--) {
      const dayStart = today0.getTime() - d * DAY;
      const nLogins = randInt(rng, 3, 9);
      for (let k = 0; k < nLogins; k++) {
        const u = rng() < 0.7 ? pick(rng, customers) : pick(rng, db.users.filter(x => x.role !== 'USER'));
        pushLog(db.logs.logins, {
          time: new Date(dayStart + randInt(rng, 8, 23) * 3600000 + randInt(rng, 0, 3599) * 1000).toISOString(),
          userId: u.id, username: u.username, role: u.role,
          ip: db.meta.visitorIp, ok: true,
        }, db);
      }
      if (promoDays.has(d)) {
        pushLog(db.logs.ops, {
          time: new Date(dayStart + 8 * 3600000).toISOString(),
          userId: 1, username: 'admin', role: 'SUPER', ip: db.meta.visitorIp,
          action: '大促配置', detail: '全站满减大促开启，流量与销量预期倍增',
        }, db);
      }
      if (rng() < 0.35) {
        const p = pick(rng, db.products);
        const staff = pick(rng, db.users.filter(u => u.role === 'ADMIN'));
        pushLog(db.logs.ops, {
          time: new Date(dayStart + randInt(rng, 9, 20) * 3600000).toISOString(),
          userId: staff.id, username: staff.username, role: 'ADMIN', ip: db.meta.visitorIp,
          action: '商品维护', detail: `调整「${p.name}」价格/库存`,
        }, db);
      }
    }

    // 最近一次登录留给当前会话，保证日志"实时感"
    db.seedVersion = SEED_VERSION;
    return true;
  }
  function ensureShop(p) { return Number(p.shopId) || 1; }

  /* ========== 订单口径 ========== */
  // 平台看全站（shopId=null），店长只统计含本店商品的订单
  function orderItemsOf(o, shopId) {
    if (shopId == null) return o.items || [];
    return (o.items || []).filter(it => Number(it.shopId) === shopId);
  }
  function paidOrders(db, shopId) {
    return db.orders.filter(o =>
      ['PAID', 'SHIPPED', 'COMPLETED'].includes(o.status) && orderItemsOf(o, shopId).length > 0);
  }

  /* ========== 销售趋势序列（日 / 周 / 月） ========== */
  function salesSeries(db, { granularity = 'day', window = 90, shopId = null } = {}) {
    const paid = paidOrders(db, shopId);
    const map = new Map();
    const nowTs = Date.now();
    const startTs = nowTs - window * DAY;
    paid.forEach(o => {
      const ts = new Date(o.createdAt).getTime();
      if (ts < startTs) return;
      let key;
      if (granularity === 'day') key = dayKey(ts);
      else if (granularity === 'week') {
        const d = new Date(ts); const dow = (d.getDay() + 6) % 7; // 周一为一周开始
        const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
        key = dayKey(monday.getTime());
      } else key = dayKey(ts).slice(0, 7);
      const cur = map.get(key) || { key, revenue: 0, orders: 0, qty: 0 };
      const amount = orderItemsOf(o, shopId).reduce((s, i) => s + i.price * i.quantity, 0);
      const qty = orderItemsOf(o, shopId).reduce((s, i) => s + i.quantity, 0);
      cur.revenue += amount; cur.orders += 1; cur.qty += qty;
      map.set(key, cur);
    });
    const list = [...map.values()].sort((a, b) => a.key < b.key ? -1 : 1);
    return list.map(x => ({ ...x, label: x.key }));
  }

  /* ========== 线性回归预测与评估 ========== */
  // 最小二乘拟合 y = a + b·x；用后 holdout 个点做留出评估（MAE / MAPE）
  function linregFit(xs, ys) {
    const n = xs.length;
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    const b = den === 0 ? 0 : num / den;
    return { a: my - b * mx, b, mx, my };
  }
  // 序列平滑：trailing 移动平均，消除周末等短周期波动后再拟合趋势
  function movingAvg(ys, win) {
    return ys.map((_, i) => {
      const start = Math.max(0, i - win + 1);
      const seg = ys.slice(start, i + 1);
      return seg.reduce((s, v) => s + v, 0) / seg.length;
    });
  }
  // 稳健化：按 mask 剔除异常位置，用相邻未异常点线性插值补齐，
  // 避免少量极端值拉偏趋势线（异常判别与预测联动的稳健拟合）
  function interpolateMasked(ys, mask) {
    const out = ys.slice();
    for (let i = 0; i < out.length; i++) {
      if (!mask[i]) continue;
      let lo = i - 1, hi = i + 1;
      while (lo >= 0 && mask[lo]) lo--;
      while (hi < out.length && mask[hi]) hi++;
      if (lo < 0 && hi >= out.length) { out[i] = out[hi] ?? out[lo] ?? 0; continue; }
      if (lo < 0) { out[i] = out[hi]; continue; }
      if (hi >= out.length) { out[i] = out[lo]; continue; }
      out[i] = out[lo] + (out[hi] - out[lo]) * (i - lo) / (hi - lo);
    }
    return out;
  }
  // 用原始序列的 z 值找异常日，并连带其后的平滑窗口（trailing MA 会把脉冲
  // 拖成 7 天的鼓包）一起剔除
  function anomalyMask(ys, expand = 0) {
    const mean = ys.reduce((s, v) => s + v, 0) / ys.length;
    const std = Math.sqrt(ys.reduce((s, v) => s + (v - mean) ** 2, 0) / ys.length) || 1;
    const mask = ys.map(y => Math.abs((y - mean) / std) >= 2);
    if (expand > 0) {
      const expanded = mask.slice();
      mask.forEach((m, i) => { if (m) for (let k = 1; k <= expand && i + k < mask.length; k++) expanded[i + k] = true; });
      return expanded;
    }
    return mask;
  }
  function forecastSeries(series, { horizon = 7, holdout = 5, granularity = 'day' } = {}) {
    const res = { future: [], eval: null, fitted: [], slope: 0 };
    if (series.length < 4) return res;
    const xs = series.map((_, i) => i);
    const ys = series.map(p => p.revenue);
    // 日粒度用 7 日移动平均抑制周末周期；周/月粒度本身已是聚合值
    const smoothWin = granularity === 'day' ? Math.min(7, Math.floor(series.length / 3)) : 1;
    const mask = anomalyMask(ys, smoothWin - 1);
    const fitYs = interpolateMasked(smoothWin > 1 ? movingAvg(ys, smoothWin) : ys, mask);

    // 留出评估：只用前 n-holdout 个点训练，对比最后 holdout 个平滑值（MAE / MAPE）
    if (series.length > holdout + 3) {
      const cut = series.length - holdout;
      const f = linregFit(xs.slice(0, cut), fitYs.slice(0, cut));
      let mae = 0, mape = 0, cnt = 0;
      for (let i = cut; i < series.length; i++) {
        const pred = Math.max(0, f.a + f.b * i);
        mae += Math.abs(pred - fitYs[i]);
        if (fitYs[i] > 0) mape += Math.abs(pred - fitYs[i]) / fitYs[i];
        cnt++;
      }
      res.eval = {
        mae: mae / cnt,
        mape: (mape / cnt) * 100,
        trainPoints: cut,
      };
    }

    // 全量训练：R² 取全序列拟合优度，外推预测未来 horizon 个周期（按粒度推进）
    const f = linregFit(xs, fitYs);
    const meanY = fitYs.reduce((s, v) => s + v, 0) / fitYs.length;
    let ssRes = 0, ssTot = 0;
    fitYs.forEach((y, i) => {
      ssRes += (y - (f.a + f.b * i)) ** 2;
      ssTot += (y - meanY) ** 2;
    });
    if (res.eval) res.eval.r2 = ssTot ? Math.max(0, 1 - ssRes / ssTot) : 1;
    res.fitted = series.map((p, i) => ({ ...p, trend: Math.max(0, f.a + f.b * i) }));
    const lastTs = nextTimestamp(series[series.length - 1].key, granularity, 1);
    for (let h = 1; h <= horizon; h++) {
      const ts = lastTs + (h - 1) * stepMs(granularity);
      res.future.push({
        key: keyAt(ts, granularity),
        label: labelAt(ts, granularity),
        value: Math.max(0, f.a + f.b * (series.length - 1 + h)),
      });
    }
    res.slope = f.b;
    return res;
  }
  function stepMs(granularity) {
    return granularity === 'day' ? DAY : granularity === 'week' ? 7 * DAY : 30 * DAY;
  }
  function nextTimestamp(key, granularity, h) {
    if (granularity === 'month') {
      const [y, m] = key.split('-').map(Number);
      return new Date(y, m - 1 + h, 1).getTime();
    }
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).getTime() + h * stepMs(granularity);
  }
  function keyAt(ts, granularity) {
    if (granularity === 'month') return dayKey(ts).slice(0, 7);
    return dayKey(ts);
  }
  function labelAt(ts, granularity) {
    if (granularity === 'month') { const d = new Date(ts); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; }
    return dayKey(ts).slice(5);
  }

  /* ========== 销售异常判别（z-score） ========== */
  function detectAnomalies(series, { threshold = 2 } = {}) {
    if (series.length < 5) return { mean: 0, std: 0, anomalies: [] };
    const ys = series.map(p => p.revenue);
    const mean = ys.reduce((s, v) => s + v, 0) / ys.length;
    const std = Math.sqrt(ys.reduce((s, v) => s + (v - mean) ** 2, 0) / ys.length) || 1;
    const anomalies = series
      .map(p => ({ ...p, z: (p.revenue - mean) / std }))
      .filter(p => Math.abs(p.z) >= threshold)
      .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    return { mean, std, anomalies };
  }

  /* ========== 商品销售排行榜 ========== */
  function rankProducts(db, { shopId = null, by = 'revenue', limit = 10 } = {}) {
    const map = new Map();
    paidOrders(db, shopId).forEach(o => orderItemsOf(o, shopId).forEach(it => {
      const cur = map.get(it.productId) || {
        productId: it.productId, productName: it.productName,
        category: (db.products.find(p => p.id === it.productId) || {}).category || '未分类',
        qty: 0, revenue: 0, orderCount: 0,
      };
      cur.qty += it.quantity;
      cur.revenue += it.price * it.quantity;
      cur.orderCount += 1;
      map.set(it.productId, cur);
    }));
    return [...map.values()].sort((a, b) => b[by] - a[by]).slice(0, limit);
  }

  /* ========== 库存报表 ========== */
  function stockReport(db, { shopId = null, low = 20 } = {}) {
    const list = db.products
      .filter(p => shopId == null || ensureShop(p) === shopId)
      .map(p => ({ id: p.id, name: p.name, category: p.category, stock: Number(p.stock) || 0, sales: p.sales || 0, price: p.price, status: p.status }))
      .sort((a, b) => a.stock - b.stock);
    return { rows: list, lowCount: list.filter(p => p.stock <= low).length };
  }

  /* ========== 用户画像 ========== */
  const TIER_LABEL = { none: '未消费', low: '低购买力', mid: '中购买力', high: '高购买力' };
  function tierOf(spend) {
    if (spend >= 8000) return 'high';
    if (spend >= 1500) return 'mid';
    if (spend > 0) return 'low';
    return 'none';
  }
  function userProfile(db, userId) {
    const u = db.users.find(x => x.id === userId);
    if (!u) return null;
    const paid = db.orders.filter(o => o.userId === userId && ['PAID', 'SHIPPED', 'COMPLETED'].includes(o.status));
    const spend = paid.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const views = db.logs.views.filter(v => v.userId === userId);
    // 偏好分类：浏览 1 权重 + 购买件数 3 权重
    const catMap = new Map();
    views.forEach(v => catMap.set(v.category, (catMap.get(v.category) || 0) + 1));
    paid.forEach(o => (o.items || []).forEach(it => {
      const p = db.products.find(x => x.id === it.productId);
      const c = (p && p.category) || '未分类';
      catMap.set(c, (catMap.get(c) || 0) + it.quantity * 3);
    }));
    const prefCats = [...catMap.entries()]
      .map(([cat, cnt]) => ({ cat, cnt })).sort((a, b) => b.cnt - a.cnt).slice(0, 3);
    return {
      userId,
      username: u.username,
      nickname: u.nickname || u.username,
      region: u.region || '未知',
      role: u.role,
      orderCount: paid.length,
      totalSpend: spend,
      avgOrder: paid.length ? spend / paid.length : 0,
      viewCount: views.length,
      totalDwell: views.reduce((s, v) => s + (v.dwellSec || 0), 0),
      tier: tierOf(spend),
      tierLabel: TIER_LABEL[tierOf(spend)],
      prefCats,
    };
  }
  function profileAggregates(db) {
    const region = new Map(), tier = new Map(), pref = new Map();
    db.users.filter(u => u.role === 'USER').forEach(u => {
      const p = userProfile(db, u.id);
      if (!p) return;
      region.set(p.region, (region.get(p.region) || 0) + 1);
      tier.set(p.tierLabel, (tier.get(p.tierLabel) || 0) + 1);
      p.prefCats.forEach((c, i) => pref.set(c.cat, (pref.get(c.cat) || 0) + (3 - i)));
    });
    const orderTier = ['未消费', '低购买力', '中购买力', '高购买力'];
    return {
      region: [...region.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      tier: orderTier.filter(t => tier.has(t)).map(t => ({ name: t, value: tier.get(t) })),
      pref: [...pref.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    };
  }

  /* ========== 推荐系统 ========== */
  // 用户×商品交互矩阵：浏览权重 1，支付购买件数权重 3
  function interactionMatrix(db) {
    const M = new Map(); // userId → Map(productId → weight)
    const touch = (uid, pid, w) => {
      if (!M.has(uid)) M.set(uid, new Map());
      const row = M.get(uid);
      row.set(pid, (row.get(pid) || 0) + w);
    };
    (db.logs.views || []).forEach(v => { if (v.userId) touch(v.userId, v.productId, 1); });
    db.orders.filter(o => ['PAID', 'SHIPPED', 'COMPLETED'].includes(o.status))
      .forEach(o => (o.items || []).forEach(it => touch(o.userId, it.productId, 3 * it.quantity)));
    return M;
  }
  function cosineSim(m1, m2) {
    let dot = 0, n1 = 0, n2 = 0;
    m1.forEach((w, pid) => { n1 += w * w; if (m2.has(pid)) dot += w * m2.get(pid); });
    m2.forEach(w => { n2 += w * w; });
    return (n1 && n2) ? dot / Math.sqrt(n1 * n2) : 0;
  }
  // 简单推荐：买过/看过此商品的用户还买过什么（共现计数）
  function coPurchase(db, productId, topN = 8) {
    const users = new Set();
    (db.logs.views || []).forEach(v => { if (v.productId === productId && v.userId) users.add(v.userId); });
    paidOrders(db, null).forEach(o => {
      if ((o.items || []).some(it => it.productId === productId)) users.add(o.userId);
    });
    const cnt = new Map();
    users.forEach(uid => {
      db.orders.filter(o => o.userId === uid && ['PAID', 'SHIPPED', 'COMPLETED'].includes(o.status))
        .forEach(o => (o.items || []).forEach(it => {
          if (it.productId === productId) return;
          cnt.set(it.productId, (cnt.get(it.productId) || 0) + 1);
        }));
    });
    return toProducts(db, cnt, topN);
  }
  // 基于物品的协同过滤：与目标商品交互分布最相似的商品（余弦相似度）
  function cfSimilar(db, productId, topN = 8) {
    const M = interactionMatrix(db);
    const scores = new Map();
    M.forEach(row => {
      row.forEach((_, pid) => {
        if (pid === productId) return;
        if (!scores.has(pid)) scores.set(pid, colSimilarity(M, productId, pid));
      });
    });
    return toProducts(db, scores, topN);
  }
  function colSimilarity(M, pidA, pidB) {
    let dot = 0, na = 0, nb = 0;
    M.forEach(row => {
      const a = row.get(pidA) || 0, b = row.get(pidB) || 0;
      dot += a * b; na += a * a; nb += b * b;
    });
    return (na && nb) ? dot / Math.sqrt(na * nb) : 0;
  }
  function toProducts(db, scoreMap, topN) {
    return [...scoreMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([pid, score]) => ({ product: db.products.find(p => p.id === pid), score }))
      .filter(x => x.product && x.product.status === 1);
  }
  // 个性化推荐：以用户交互历史为锚，累计候选商品的相似度
  function recommendForUser(db, userId, topN = 8) {
    const M = interactionMatrix(db);
    const mine = M.get(userId);
    if (!mine || mine.size === 0) return hotProducts(db, topN);
    const scores = new Map();
    M.forEach((row) => {
      row.forEach((_, pid) => {
        if (mine.has(pid)) return; // 排除已交互过的
        let s = 0;
        mine.forEach((w, seen) => {
          if (seen === pid) return;
          s += w * colSimilarity(M, seen, pid);
        });
        if (s > 0) scores.set(pid, s);
      });
    });
    const recs = toProducts(db, scores, topN);
    return recs.length ? recs : hotProducts(db, topN);
  }
  function hotProducts(db, topN = 8) {
    return db.products.filter(p => p.status === 1)
      .sort((a, b) => (b.sales || 0) - (a.sales || 0))
      .slice(0, topN)
      .map(p => ({ product: p, score: p.sales || 0 }));
  }

  /* ========== ECharts 渲染 ========== */
  const PALETTE = ['#f04424', '#c9a227', '#2f6fed', '#1f9d55', '#d97706', '#8b5cf6', '#14b8a6', '#e879a0', '#64748b'];
  const charts = {};
  function renderChart(id, option) {
    const el = document.getElementById(id);
    if (!el || !window.echarts) return null;
    if (charts[id]) { charts[id].setOption(option, true); return charts[id]; }
    const chart = window.echarts.init(el, null, { renderer: 'canvas' });
    chart.setOption(option);
    charts[id] = chart;
    return chart;
  }
  function disposeAll() {
    Object.keys(charts).forEach(k => { charts[k].dispose(); delete charts[k]; });
  }
  function resizeAll() { Object.values(charts).forEach(c => c.resize()); }
  window.addEventListener('resize', resizeAll);

  const AXIS = {
    axisLabel: { color: '#7a736a', fontSize: 11 },
    axisLine: { lineStyle: { color: '#e7e2d9' } },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: '#efeae2' } },
  };
  const GRID = { left: 8, right: 16, top: 40, bottom: 8, containLabel: true };
  const LEGEND = { top: 6, textStyle: { color: '#17140f', fontSize: 12 }, itemWidth: 14, itemHeight: 8 };

  /* ========== CSV 导出 ========== */
  function toCSV(headers, rows) {
    const esc = v => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(','), ...rows.map(r => r.map(esc).join(','))];
    // BOM 保证 Excel 打开中文不乱码
    return '\ufeff' + lines.join('\r\n');
  }
  function downloadCSV(filename, headers, rows) {
    const blob = new Blob([toCSV(headers, rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  return {
    REGIONS, TIER_LABEL, PALETTE, AXIS, GRID, LEGEND,
    mulberry32, randInt, pick, dayKey, fmtDT,
    ensureMeta, ensureLogs, logLogin, logLogout, logView, logOp, visitorIp,
    ensureSeed,
    paidOrders, orderItemsOf, salesSeries, forecastSeries, detectAnomalies,
    rankProducts, stockReport,
    userProfile, profileAggregates, tierOf,
    interactionMatrix, coPurchase, cfSimilar, recommendForUser, hotProducts,
    renderChart, disposeAll, resizeAll,
    downloadCSV,
  };
})();
