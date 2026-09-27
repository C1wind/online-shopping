/* 拾光优选 · 纯前端电商 SPA
   本地数据层（localStorage）+ 全部顾客/商家功能
*/
(() => {
  'use strict';

  /* ========== 常量 / 工具 ========== */
  const CATS = ['数码', '外设', '家电', '运动', '图书', '家居'];
  const SEED_SHOPS = [
    { id: 1, name: '拾光自营旗舰店', desc: '官方自营 · 正品保障 · 极速发货', icon: '🏪', rating: 4.9 },
    { id: 2, name: '极客数码工坊', desc: '电脑外设 · 影音数码 · 专业选品', icon: '💻', rating: 4.8 },
    { id: 3, name: '安居生活馆', desc: '家居好物 · 品质生活 · 匠心之选', icon: '🛋️', rating: 4.7 },
    { id: 4, name: '悦动运动站', desc: '跑步健身 · 户外运动 · 装备齐全', icon: '🏃', rating: 4.8 },
    { id: 5, name: '墨香书屋', desc: '文学社科 · 畅销新书 · 正版图书', icon: '📚', rating: 4.9 },
  ];
  const CAT_SHOP = {
    '数码': 1, '外设': 2, '家电': 3, '运动': 4, '图书': 5, '家居': 3,
  };
  const IMG = {
    'MacBook Pro 14': 'assets/products/macbook.jpg',
    'iPhone 15 Pro': 'assets/products/iphone.jpg',
    'AirPods Pro 2': 'assets/products/airpods.jpg',
    'iPad Air 11': 'assets/products/ipad.jpg',
    '机械键盘 K8 Pro': 'assets/products/keyboard.jpg',
    '无线鼠标 M3': 'assets/products/mouse.jpg',
    '4K 显示器 27': 'assets/products/monitor.jpg',
    '降噪耳机 WH': 'assets/products/headphones.jpg',
    '意式咖啡机 Mini': 'assets/products/coffee.jpg',
    '双门冰箱 450L': 'assets/products/fridge.jpg',
    '破壁料理机': 'assets/products/blender.jpg',
    '跑步鞋 Air': 'assets/products/shoes.jpg',
    '瑜伽垫 加厚': 'assets/products/yoga.jpg',
    '智能手表 Fit': 'assets/products/watch.jpg',
    '三体 全集': 'assets/products/book1.jpg',
    '经济学原理': 'assets/products/book2.jpg',
    '设计中的设计': 'assets/products/book3.jpg',
    '羊毛地毯 客厅': 'assets/products/carpet.jpg',
    '香薰蜡烛礼盒': 'assets/products/candle.jpg',
    '记忆棉枕': 'assets/products/pillow.jpg',
  };
  const CAT_META = {
    '数码': { icon: '📱', cls: 't-digital' },
    '外设': { icon: '⌨️', cls: 't-accessory' },
    '家电': { icon: '🏠', cls: 't-home' },
    '运动': { icon: '🏃', cls: 't-sport' },
    '图书': { icon: '📚', cls: 't-book' },
    '家居': { icon: '🛋️', cls: 't-life' },
  };
  const STATUS = {
    PENDING: '待付款', PAID: '待发货', SHIPPED: '已发货',
    COMPLETED: '已完成', CANCELLED: '已取消',
  };
  const KEY = 'shiguang-shop-v3';
  const OLD_KEY = 'shiguang-shop-v2';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const money = n => '¥' + Number(n || 0).toFixed(2);
  // 长金额（如 ¥3507723.00）在窄卡片里会溢出，超出阈值时用小字号档位渲染
  const moneyCls = n => (money(n).length > 9 ? ' long' : '');
  const uid = () => Math.random().toString(36).slice(2, 10);
  const now = () => new Date().toISOString();
  const fmtTime = s => (s || '').replace('T', ' ').slice(0, 19);

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2400);
  }

  /** 居中确认弹窗（黑白按钮） */
  function confirmDialog({ title = '确认操作', message = '', okText = '确定', cancelText = '取消', danger = false }) {
    return new Promise((resolve) => {
      const mask = $('#confirm-mask');
      const okBtn = $('#confirm-ok');
      const cancelBtn = $('#confirm-cancel');
      $('#confirm-title').textContent = title;
      $('#confirm-message').textContent = message;
      okBtn.textContent = okText;
      cancelBtn.textContent = cancelText;
      okBtn.classList.toggle('danger-text', !!danger);
      mask.hidden = false;

      const cleanup = (val) => {
        mask.hidden = true;
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        resolve(val);
      };
      okBtn.onclick = () => cleanup(true);
      cancelBtn.onclick = () => cleanup(false);
      mask.onclick = (e) => {
        if (e.target === mask) cleanup(false);
      };
    });
  }

  function thumbCls(cat) {
    return (CAT_META[cat] && CAT_META[cat].cls) || 't-life';
  }
  function productImg(p) {
    if (p && p.image) return p.image;
    return '';
  }
  function productVisual(p, cls = '') {
    const src = productImg(p) || (p && p.name && IMG[p.name]) || '';
    if (src) {
      return `<img class="pimg ${cls}" src="${src}" alt="${(p && p.name) || ''}" loading="lazy" onerror="this.remove()" />`;
    }
    return `<span class="pemoji ${cls}">${thumbIcon(p && p.category)}</span>`;
  }
  function thumbIcon(cat, name) {
    if (CAT_META[cat]) return CAT_META[cat].icon;
    return '🛍️';
  }
  function shops() {
    return (DB && DB.shops) || SEED_SHOPS;
  }
  function shopById(id) {
    const n = Number(id);
    return shops().find(s => s.id === n) || shops()[0] || SEED_SHOPS[0];
  }
  function ensureShopId(p) {
    if (p.shopId) return Number(p.shopId);
    p.shopId = CAT_SHOP[p.category] || 1;
    return p.shopId;
  }
  /** 店铺统计：始终由商品实时计算，保证与库存/销量一致 */
  function shopStats(shopId) {
    const list = (DB.products || []).filter(p => ensureShopId(p) === Number(shopId));
    const onSale = list.filter(p => p.status === 1);
    return {
      productCount: onSale.length,
      allCount: list.length,
      stock: onSale.reduce((s, p) => s + Number(p.stock || 0), 0),
      sales: list.reduce((s, p) => s + Number(p.sales || 0), 0),
      revenue: list.reduce((s, p) => s + Number(p.sales || 0) * Number(p.price || 0), 0),
    };
  }

  /** 店长返回本店 ID；平台管理员/顾客返回 null（null=不限店铺，可看全站） */
  function myShopId() {
    if (!state.user) return null;
    if (isSuper()) return null;
    if (state.user.role === 'ADMIN') return Number(state.user.shopId) || 1;
    return null;
  }

  function isStaff() {
    return !!(state.user && (state.user.role === 'SUPER' || state.user.role === 'ADMIN'));
  }
  function isSuper() {
    if (!state.user) return false;
    // 平台管理员账号固定看全站，防止旧数据/会话被绑成单店
    return state.user.role === 'SUPER' || state.user.username === 'admin';
  }

  /* ========== 种子数据 ========== */
  function seedProducts() {
    const rows = [
      ['MacBook Pro 14', 14999, 20, '数码', 'Apple M3 芯片 · 14 英寸 Liquid Retina XDR', 128, 1],
      ['iPhone 15 Pro', 7999, 50, '数码', '钛金属设计 · A17 Pro · 256GB', 356, 1],
      ['AirPods Pro 2', 1899, 100, '数码', '自适应降噪 · USB-C · 空间音频', 892, 2],
      ['iPad Air 11', 4599, 35, '数码', 'M2 芯片 · 11 英寸 · 全天候续航', 210, 1],
      ['机械键盘 K8 Pro', 499, 80, '外设', '87 键热插拔 · Gasket 结构 · RGB', 640, 2],
      ['无线鼠标 M3', 199, 120, '外设', '静音微动 · 多模连接 · 长续航', 1102, 2],
      ['4K 显示器 27', 2299, 30, '外设', '27 英寸 IPS · 99% sRGB · Type-C 65W', 188, 2],
      ['降噪耳机 WH', 2499, 45, '外设', '旗舰降噪 · 30 小时续航 · LDAC', 421, 2],
      ['意式咖啡机 Mini', 899, 40, '家电', '20Bar 泵压 · 奶泡系统 · 小巧机身', 267, 3],
      ['双门冰箱 450L', 2599, 18, '家电', '风冷无霜 · 双循环 · 超薄嵌入', 233, 3],
      ['破壁料理机', 599, 55, '家电', '冷热双杯 · 12 小时预约', 333, 3],
      ['跑步鞋 Air', 599, 60, '运动', '轻量缓震 · 透气飞织 · 日常训练', 578, 4],
      ['瑜伽垫 加厚', 89, 200, '运动', 'NBR 加厚 10mm · 防滑回弹', 1520, 4],
      ['智能手表 Fit', 899, 70, '运动', '血氧心率 · 14 天续航 · 100+ 运动模式', 445, 4],
      ['三体 全集', 168, 150, '图书', '刘慈欣科幻经典 · 精装三册', 980, 5],
      ['经济学原理', 88, 90, '图书', '曼昆 · 微观+宏观 · 第 8 版', 412, 5],
      ['设计中的设计', 76, 110, '图书', '原研哉 · 设计美学经典', 298, 5],
      ['羊毛地毯 客厅', 459, 33, '家居', '新西兰羊毛 · 手工簇绒 · 防滑底', 96, 3],
      ['香薰蜡烛礼盒', 128, 180, '家居', '大豆蜡 · 木质调 · 长燃 40h', 763, 3],
      ['记忆棉枕', 199, 95, '家居', '慢回弹 · 护颈曲线 · 可拆洗', 534, 3],
    ];
    return rows.map((r, i) => ({
      id: i + 1,
      name: r[0], price: r[1], stock: r[2], category: r[3],
      description: r[4], sales: r[5], status: 1,
      shopId: r[6],
      image: IMG[r[0]] || '',
      createdAt: now(),
    }));
  }

  function seedUsers() {
    return [
      // SUPER = 平台管理员，可看全站；ADMIN = 店长，仅本店
      { id: 1, username: 'admin', password: '123456', email: 'admin@shop.example', nickname: '平台管理员', role: 'SUPER', shopId: null },
      { id: 2, username: 'alice', password: '123456', email: 'alice@example.com', nickname: 'Alice', role: 'USER', shopId: null },
      { id: 3, username: 'bob', password: '123456', email: 'bob@example.com', nickname: 'Bob', role: 'USER', shopId: null },
      { id: 4, username: 'shiguang', password: '123456', email: 'sg@shop.example', nickname: '拾光店长', role: 'ADMIN', shopId: 1 },
      { id: 5, username: 'geek', password: '123456', email: 'geek@shop.example', nickname: '极客店长', role: 'ADMIN', shopId: 2 },
      { id: 6, username: 'home', password: '123456', email: 'home@shop.example', nickname: '安居店长', role: 'ADMIN', shopId: 3 },
      { id: 7, username: 'sport', password: '123456', email: 'sport@shop.example', nickname: '悦动店长', role: 'ADMIN', shopId: 4 },
      { id: 8, username: 'book', password: '123456', email: 'book@shop.example', nickname: '墨香店长', role: 'ADMIN', shopId: 5 },
    ];
  }

  /* ========== 本地存储 ========== */
  function normalizeDB(db) {
    if (!Array.isArray(db.shops) || !db.shops.length) db.shops = SEED_SHOPS.map(s => ({ ...s }));
    if (!Array.isArray(db.users) || !db.users.length) db.users = seedUsers();
    // 补齐商家账号绑定店铺
    const shopOwnerMap = {
      shiguang: 1, geek: 2, home: 3, sport: 4, book: 5,
    };
    db.users.forEach(u => {
      // 平台管理员：始终 SUPER + 不限店铺
      if (u.username === 'admin') {
        u.role = 'SUPER';
        u.shopId = null;
        u.nickname = u.nickname && u.nickname !== '拾光店长' ? u.nickname : '平台管理员';
        return;
      }
      // 店长：绑定本店
      if (u.role === 'ADMIN' || u.role === 'SUPER') {
        if (u.role === 'SUPER' && u.username !== 'admin') u.role = 'ADMIN';
        const sid = shopOwnerMap[u.username];
        u.shopId = sid != null ? sid : (u.shopId != null ? Number(u.shopId) : 1);
        u.role = 'ADMIN';
      }
    });
    // 确保 5 个商家账号存在
    const need = seedUsers().filter(s => !db.users.some(u => u.username === s.username));
    need.forEach(u => db.users.push(u));
    if (!Array.isArray(db.products)) db.products = seedProducts();
    db.products.forEach(p => {
      // 旧商品迁移：空气净化器 → 双门冰箱
      if (p.name === '空气净化器 Pro') {
        p.name = '双门冰箱 450L';
        p.price = 2599;
        p.description = '风冷无霜 · 双循环 · 超薄嵌入';
        p.image = 'assets/products/fridge.jpg';
      }
      if (p.name === '双门冰箱 450L' && p.image && p.image.indexOf('fridge') >= 0) {
        p.image = 'assets/products/fridge.jpg';
      }
      if (!p.image && IMG[p.name]) p.image = IMG[p.name];
      if (p.sales == null) p.sales = 0;
      if (p.stock == null) p.stock = 0;
      ensureShopId(p);
    });
    if (!db.seq) db.seq = { product: 20, user: 10, order: 0, cart: 0, mail: 0 };
    // 保证自增 ID 不冲突
    db.seq.user = Math.max(db.seq.user || 0, ...db.users.map(u => u.id));
    db.seq.product = Math.max(db.seq.product || 20, ...db.products.map(p => p.id));
    db.seq.order = Math.max(db.seq.order || 0, ...(db.orders || []).map(o => o.id || 0));
    // —— 课程设计新增：商品类别（销售可增删）、日志区、访问者模拟信息 ——
    if (!Array.isArray(db.cats) || !db.cats.length) db.cats = CATS.slice();
    db.products.forEach(p => { if (!db.cats.includes(p.category)) db.cats.push(p.category); });
    BigData.ensureLogs(db);
    BigData.ensureMeta(db);
    db.users.forEach(u => { if (!u.region) u.region = u.username === 'admin' ? '广东' : BigData.REGIONS[0]; });
    return db;
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normalizeDB(JSON.parse(raw));
    } catch (_) {}
    // 旧版本数据迁移（v2 → v3）：保留商品/用户/订单等既有数据
    try {
      const old = localStorage.getItem(OLD_KEY) || localStorage.getItem('shiguang-shop-v1');
      if (old) {
        const db = normalizeDB(JSON.parse(old));
        localStorage.setItem(KEY, JSON.stringify(db));
        return db;
      }
    } catch (_) {}
    const db = normalizeDB({
      products: seedProducts(),
      users: seedUsers(),
      shops: SEED_SHOPS.map(s => ({ ...s })),
      cart: [],
      orders: [],
      mails: [],
      seq: { product: 20, user: 3, order: 0, cart: 0, mail: 0 },
    });
    saveDB(db);
    return db;
  }
  function saveDB(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }
  let DB = loadDB();
  // 首次运行时生成 90 天演示数据（历史订单 + 浏览/登录/操作日志），供分析模块开箱即用
  if (BigData.ensureSeed(DB)) saveDB(DB);

  /* ========== 状态 ========== */
  const state = {
    user: DB.sessionUser || null,
    view: 'home',
    keyword: '',
    category: '',
    sort: 'default',
    page: 1,
    size: 8,
    detailId: null,
    detailQty: 1,
    adminPage: 1,
    adminKeyword: '',
    adminOrderStatus: '',
    orderStatus: '',
    searchMode: 'product', // product | shop
    shopId: 1,
    checkoutItems: [], // buy-now or from cart
    checkoutFrom: 'cart',
    selected: new Set(),
    // —— 课程设计新增 ——
    dwellStart: null,        // 详情页停留计时
    anaTimer: null,          // 实时监控定时器
    anaGranularity: 'day',   // 趋势粒度：day | week | month
    anaRankBy: 'qty',        // 排行榜口径：qty | revenue
    anaUserId: null,         // 画像选中的用户
    logsType: 'logins',      // 日志审计页签
  };
  // restore session（从 DB 重读，确保 admin 始终是全站 SUPER）
  if (DB.sessionUserId) {
    state.user = DB.users.find(u => u.id === DB.sessionUserId) || null;
    if (state.user && state.user.username === 'admin') {
      state.user.role = 'SUPER';
      state.user.shopId = null;
    }
  }

  function persistSession() {
    DB.sessionUserId = state.user ? state.user.id : null;
    saveDB(DB);
  }

  /* ========== 课程设计新增：采集与分析的接入点 ========== */
  // 当前登录用户可用的商品类别（销售可增删，存于 DB.cats）
  const cats = () => (Array.isArray(DB.cats) && DB.cats.length ? DB.cats : CATS);
  // 管理操作留痕（时间 / 账号 / 内容 / IP），失败不影响主流程
  function logOp(action, detail) {
    try {
      BigData.logOp(DB, state.user, action, detail);
    } catch (_) {}
  }

  /* ========== 业务 API ========== */
  const api = {
    register({ username, password, email, nickname }) {
      if (DB.users.some(u => u.username === username)) throw new Error('用户名已存在');
      const user = {
        id: ++DB.seq.user,
        username, password, email,
        nickname: nickname || username,
        role: 'USER',
        // 演示环境：以访问者模拟地域作为注册地域（画像用）
        region: DB.meta.visitorRegion || BigData.REGIONS[0],
      };
      DB.users.push(user);
      BigData.logLogin(DB, user, true, '注册'); // 注册即视为登录留痕
      saveDB(DB);
      return user;
    },
    login({ username, password }) {
      const user = DB.users.find(u => u.username === username && u.password === password);
      if (!user) {
        BigData.logLogin(DB, null, false, username); // 失败登录也留痕
        saveDB(DB);
        throw new Error('用户名或密码错误');
      }
      BigData.logLogin(DB, user, true);
      saveDB(DB);
      return user;
    },
    logout() {
      BigData.logLogout(DB, state.user);
      state.user = null;
      persistSession();
    },

    listProducts({ page = 1, size = 8, keyword = '', category = '', sort = 'default', onSale = true }) {
      let items = DB.products.slice();
      items.forEach(ensureShopId);
      if (onSale) items = items.filter(p => p.status === 1);
      if (category) items = items.filter(p => p.category === category);
      if (keyword) {
        const k = keyword.trim().toLowerCase();
        items = items.filter(p =>
          p.name.toLowerCase().includes(k) ||
          (p.category || '').toLowerCase().includes(k) ||
          (p.description || '').toLowerCase().includes(k)
        );
      }
      if (sort === 'price_asc') items.sort((a, b) => a.price - b.price);
      else if (sort === 'price_desc') items.sort((a, b) => b.price - a.price);
      else items.sort((a, b) => b.id - a.id);

      const total = items.length;
      const start = (page - 1) * size;
      return { total, page, size, items: items.slice(start, start + size) };
    },
    getProduct(id) {
      const p = DB.products.find(x => x.id === Number(id));
      if (!p) throw new Error('商品不存在');
      return p;
    },
    createProduct(data) {
      const sid = myShopId();
      const shopId = sid != null ? sid : (Number(data.shopId) || CAT_SHOP[data.category] || 1);
      const p = {
        id: ++DB.seq.product,
        name: data.name, price: Number(data.price), stock: Number(data.stock),
        category: data.category, description: data.description || '',
        sales: 0, status: Number(data.status ?? 1),
        shopId,
        image: data.image || IMG[data.name] || '',
        createdAt: now(),
      };
      DB.products.unshift(p);
      logOp('添加商品', `「${p.name}」 ¥${p.price} · 库存${p.stock} · 分类「${p.category}」`);
      saveDB(DB);
      return p;
    },
    updateProduct(id, data) {
      const p = this.getProduct(id);
      const sid = myShopId();
      if (sid != null && ensureShopId(p) !== sid) {
        throw new Error('只能修改本店商品');
      }
      Object.assign(p, {
        name: data.name, price: Number(data.price), stock: Number(data.stock),
        category: data.category, description: data.description || '',
        status: Number(data.status ?? 1),
        shopId: ensureShopId(p),
      });
      if (data.image) p.image = data.image;
      if (!p.image && IMG[p.name]) p.image = IMG[p.name];
      logOp('修改商品', `「${p.name}」 ¥${p.price} · 库存${p.stock} · ${p.status === 1 ? '上架' : '下架'}`);
      saveDB(DB);
      return p;
    },
    /** 售出：扣库存、加销量（数量按件精确累计） */
    sell(productId, qty) {
      const n = Math.max(1, Math.floor(Number(qty) || 1));
      const p = this.getProduct(productId);
      const stock = Number(p.stock) || 0;
      if (stock < n) throw new Error(`「${p.name}」库存不足，仅剩 ${stock}`);
      p.stock = stock - n;
      p.sales = (Number(p.sales) || 0) + n;
      saveDB(DB);
      return p;
    },
    /** 退货/取消：回补库存、减销量 */
    restock(productId, qty) {
      const n = Math.max(1, Math.floor(Number(qty) || 1));
      const p = this.getProduct(productId);
      p.stock = (Number(p.stock) || 0) + n;
      p.sales = Math.max(0, (Number(p.sales) || 0) - n);
      saveDB(DB);
      return p;
    },
    deleteProduct(id) {
      // 物理删除，且只能删自己店铺的
      const p = this.getProduct(id);
      const sid = myShopId();
      if (sid != null && ensureShopId(p) !== sid) {
        throw new Error('只能删除本店商品');
      }
      logOp('删除商品', `「${p.name}」`);
      DB.products = DB.products.filter(x => x.id !== Number(id));
      DB.cart = DB.cart.filter(c => c.productId !== Number(id));
      saveDB(DB);
    },
    offShelfProduct(id) {
      const p = this.getProduct(id);
      const sid = myShopId();
      if (sid != null && ensureShopId(p) !== sid) {
        throw new Error('只能操作本店商品');
      }
      p.status = p.status === 1 ? 0 : 1;
      logOp(p.status === 1 ? '上架商品' : '下架商品', `「${p.name}」`);
      saveDB(DB);
      return p;
    },

    getCart(userId) {
      return DB.cart
        .filter(c => c.userId === userId)
        .map(c => {
          const p = DB.products.find(x => x.id === c.productId);
          return {
            ...c,
            product: p,
            subtotal: p ? p.price * c.quantity : 0,
          };
        })
        .filter(x => x.product);
    },
    cartTotal(userId, onlySelected) {
      const items = this.getCart(userId);
      const list = onlySelected
        ? items.filter(i => state.selected.has(i.id))
        : items;
      return {
        count: list.reduce((s, i) => s + i.quantity, 0),
        goods: list.reduce((s, i) => s + i.subtotal, 0),
        items: list,
      };
    },
    addToCart(userId, productId, quantity = 1) {
      const qty = Math.max(1, Math.floor(Number(quantity) || 1));
      const p = this.getProduct(productId);
      if (p.status !== 1) throw new Error('商品已下架');
      const exist = DB.cart.find(c => c.userId === userId && c.productId === productId);
      const nextQty = (Number(exist && exist.quantity) || 0) + qty;
      if (nextQty > Number(p.stock)) throw new Error(`库存不足，仅剩 ${p.stock} 件`);
      if (exist) exist.quantity = nextQty;
      else DB.cart.push({ id: ++DB.seq.cart, userId, productId, quantity: qty });
      saveDB(DB);
    },
    setCartQty(userId, cartId, quantity) {
      const qty = Math.max(1, Math.floor(Number(quantity) || 1));
      const item = DB.cart.find(c => c.id === cartId && c.userId === userId);
      if (!item) throw new Error('购物车项不存在');
      const p = DB.products.find(x => x.id === item.productId);
      if (qty > Number(p.stock)) throw new Error(`库存不足，仅剩 ${p.stock} 件`);
      item.quantity = qty;
      saveDB(DB);
    },
    removeCart(userId, cartId) {
      DB.cart = DB.cart.filter(c => !(c.id === cartId && c.userId === userId));
      state.selected.delete(cartId);
      saveDB(DB);
    },
    clearCart(userId) {
      DB.cart = DB.cart.filter(c => c.userId !== userId);
      saveDB(DB);
    },

    checkout(userId, payload) {
      const user = DB.users.find(u => u.id === userId);
      const lines = payload.items;
      if (!lines.length) throw new Error('没有可结算的商品');

      let total = 0;
      const orderItems = [];
      for (const line of lines) {
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
        const p = this.getProduct(line.productId);
        if (p.status !== 1) throw new Error(`「${p.name}」已下架`);
        // 按购买数量扣库存、加销量（买 2 台 → 库存-2、销量+2）
        this.sell(p.id, qty);
        total += Number(p.price) * qty;
        orderItems.push({
          productId: p.id, productName: p.name,
          price: p.price, quantity: qty,
          shopId: ensureShopId(p),
        });
      }

      const order = {
        id: ++DB.seq.order,
        orderNo: 'SG' + Date.now().toString(36).toUpperCase() + uid().toUpperCase().slice(0, 4),
        userId,
        username: user ? user.nickname || user.username : '顾客',
        totalAmount: total,
        status: 'PAID',
        shippingEmail: payload.email,
        name: payload.name || (user ? user.nickname || user.username : ''),
        receiver: payload.name || (user ? user.nickname || user.username : '本人'),
        phone: payload.phone || '',
        address: payload.address || '',
        note: payload.note || '',
        payMethod: payload.payMethod || 'alipay',
        items: orderItems,
        createdAt: now(),
      };
      DB.orders.unshift(order);

      // 清空已购购物车项
      if (payload.from === 'cart') {
        const ids = new Set(lines.map(l => l.cartId).filter(Boolean));
        DB.cart = DB.cart.filter(c => !ids.has(c.id));
      }

      // 发货确认邮件
      this.sendMail({
        to: payload.email,
        subject: `【拾光优选】订单 ${order.orderNo} 支付成功 · 发货确认`,
        content: this.renderShipMail(order, user),
      });

      saveDB(DB);
      return order;
    },

    listOrders(userId, status) {
      let list = DB.orders.filter(o => o.userId === userId);
      if (status) list = list.filter(o => o.status === status);
      return list;
    },
    listAllOrders(status) {
      let list = DB.orders.slice();
      const sid = myShopId();
      if (sid != null) {
        // 商家只看含本店商品的订单
        list = list.map(o => {
          const mine = (o.items || []).filter(it =>
            it.shopId != null ? Number(it.shopId) === sid
              : ensureShopId(DB.products.find(p => p.id === it.productId) || { category: '' }) === sid
          );
          if (!mine.length) return null;
          const amount = mine.reduce((s, i) => s + i.price * i.quantity, 0);
          return { ...o, items: mine, totalAmount: amount, allItems: o.items };
        }).filter(Boolean);
      }
      if (status) list = list.filter(o => o.status === status);
      return list;
    },
    getOrder(id) {
      const o = DB.orders.find(x => x.id === Number(id));
      if (!o) throw new Error('订单不存在');
      return o;
    },
    updateOrderStatus(id, status) {
      const o = this.getOrder(id);
      if (['COMPLETED', 'CANCELLED'].includes(o.status)) throw new Error('订单已结束');
      const prev = o.status;
      o.status = status;
      if (status === 'CANCELLED' && prev !== 'PENDING') {
        o.items.forEach(it => this.restock(it.productId, Number(it.quantity) || 1));
      }
      if (status === 'SHIPPED') {
        this.sendMail({
          to: o.shippingEmail,
          subject: `【拾光优选】订单 ${o.orderNo} 已发货`,
          content: `尊敬的 ${o.name || '顾客'}：\n\n您的订单 ${o.orderNo} 已发货，请注意查收。\n\n—— 拾光优选`,
        });
      }
      logOp('更新订单状态', `订单 ${o.orderNo}：${STATUS[prev] || prev} → ${STATUS[status] || status}`);
      saveDB(DB);
      return o;
    },

    sendMail({ to, subject, content }) {
      DB.mails.unshift({
        id: ++DB.seq.mail,
        to, subject, content,
        status: 'SENT',
        createdAt: now(),
      });
      saveDB(DB);
    },
    renderShipMail(order, user) {
      const lines = order.items.map(i =>
        `  · ${i.productName} × ${i.quantity}　${money(i.price * i.quantity)}`
      ).join('\n');
      return `尊敬的 ${order.name || user?.nickname || '顾客'}，您好！

感谢您的购买。订单已完成支付，我们将尽快发货。

订单号：${order.orderNo}
下单时间：${fmtTime(order.createdAt)}
支付方式：${order.payMethod}
订单金额：${money(order.totalAmount)}
收货邮箱：${order.shippingEmail}
收货地址：${order.address || '—'}

商品明细：
${lines}

— 拾光优选 品质购物`;
    },

    stats() {
      const sid = myShopId();
      const inShop = (it) => {
        if (sid == null) return true;
        if (it.shopId != null) return Number(it.shopId) === sid;
        const p = DB.products.find(x => x.id === it.productId);
        return ensureShopId(p || { category: '' }) === sid;
      };
      const orderItemsOf = (o) => (o.items || []).filter(inShop);
      const orderAmount = (o) => orderItemsOf(o).reduce((s, i) => s + i.price * i.quantity, 0);
      const relevant = DB.orders.filter(o => orderItemsOf(o).length > 0);
      const paid = relevant.filter(o => ['PAID', 'SHIPPED', 'COMPLETED'].includes(o.status));
      const revenue = paid.reduce((s, o) => s + orderAmount(o), 0);
      const byStatus = {};
      relevant.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });

      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const dayOrders = paid.filter(o => (o.createdAt || '').slice(0, 10) === key);
        days.push({
          day: key,
          order_count: dayOrders.length,
          revenue: dayOrders.reduce((s, o) => s + orderAmount(o), 0),
        });
      }

      const map = new Map();
      paid.forEach(o => orderItemsOf(o).forEach(it => {
        const cur = map.get(it.productId) || { productId: it.productId, productName: it.productName, qty: 0, revenue: 0 };
        cur.qty += it.quantity;
        cur.revenue += it.price * it.quantity;
        map.set(it.productId, cur);
      }));
      const top = [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);

      const catMap = new Map();
      paid.forEach(o => orderItemsOf(o).forEach(it => {
        const p = DB.products.find(x => x.id === it.productId);
        const c = (p && p.category) || '未分类';
        catMap.set(c, (catMap.get(c) || 0) + it.price * it.quantity);
      }));
      const byCat = [...catMap.entries()].map(([category, revenue]) => ({ category, revenue }))
        .sort((a, b) => b.revenue - a.revenue);

      const myProducts = sid == null
        ? DB.products
        : DB.products.filter(p => ensureShopId(p) === sid);

      return {
        totalRevenue: revenue,
        paidOrderCount: paid.length,
        allOrderCount: relevant.length,
        statusBreakdown: Object.entries(byStatus).map(([status, cnt]) => ({ status, cnt })),
        days, top, byCat,
        sku: myProducts.filter(p => p.status === 1).length,
        shopId: sid,
      };
    },

    /* ===== 课程设计新增：人员管理 / 类别管理（平台管理员） ===== */
    // 销售人员 ID 管理：添加（绑定店铺，角色 ADMIN）
    addSales({ username, password, nickname, shopId }) {
      if (DB.users.some(u => u.username === username)) throw new Error('账号已存在');
      if (!password || password.length < 6) throw new Error('密码至少 6 位');
      const user = {
        id: ++DB.seq.user,
        username, password,
        nickname: nickname || username,
        email: `${username}@shop.example`,
        role: 'ADMIN',
        shopId: Number(shopId) || 1,
        region: DB.meta.visitorRegion || BigData.REGIONS[0],
      };
      DB.users.push(user);
      logOp('添加销售人员', `账号「${username}」绑定「${shopById(user.shopId).name}」`);
      saveDB(DB);
      return user;
    },
    // 销售人员 ID 管理：删除
    deleteSales(id) {
      const u = DB.users.find(x => x.id === Number(id));
      if (!u) throw new Error('账号不存在');
      if (u.role === 'SUPER') throw new Error('平台管理员不可删除');
      if (u.username === 'admin') throw new Error('内置管理员账号不可删除');
      DB.users = DB.users.filter(x => x.id !== Number(id));
      if (DB.sessionUserId === Number(id)) {
        state.user = null;
        DB.sessionUserId = null;
      }
      logOp('删除销售人员', `账号「${u.username}」（${shopById(u.shopId).name}）`);
      saveDB(DB);
    },
    // 销售人员密码重置
    resetSalesPassword(id, newPwd) {
      const u = DB.users.find(x => x.id === Number(id));
      if (!u) throw new Error('账号不存在');
      if (!newPwd || newPwd.length < 6) throw new Error('密码至少 6 位');
      const old = u.password;
      u.password = newPwd;
      logOp('重置密码', `账号「${u.username}」${old === newPwd ? '（与新密码相同）' : ''}`);
      saveDB(DB);
      return u;
    },
    // 商品类别管理：添加 / 删除（有商品引用的类别不允许删除）
    addCategory(name) {
      const n = (name || '').trim();
      if (!n) throw new Error('类别名称不能为空');
      if (cats().includes(n)) throw new Error('类别已存在');
      DB.cats.push(n);
      logOp('添加商品类别', `「${n}」`);
      saveDB(DB);
      return DB.cats;
    },
    removeCategory(name) {
      const used = DB.products.some(p => p.category === name);
      if (used) throw new Error(`「${name}」下仍有商品，无法删除`);
      DB.cats = DB.cats.filter(c => c !== name);
      logOp('删除商品类别', `「${name}」`);
      saveDB(DB);
      return DB.cats;
    },
  };

  /* ========== 视图路由 ========== */
  // 浏览行为采集：进入详情开始计时，离开详情结算停留时长（秒）
  function startDwell() {
    state.dwellStart = { id: state.detailId, t: Date.now() };
  }
  function flushDwell() {
    const d = state.dwellStart;
    state.dwellStart = null;
    if (!d || !state.detailId || d.id !== state.detailId) return;
    const dwellSec = (Date.now() - d.t) / 1000;
    if (dwellSec < 1) return;
    try {
      const p = api.getProduct(d.id);
      BigData.logView(DB, state.user, p, dwellSec);
      saveDB(DB);
    } catch (_) {}
  }

  function show(view) {
    // 离开详情页时结算本次浏览的停留时长
    if (state.view === 'detail' && view !== 'detail') flushDwell();
    // 离开后台时释放 ECharts 实例与实时刷新定时器
    if (state.view === 'admin' && view !== 'admin') leaveAdmin();
    if (['cart', 'orders', 'checkout', 'admin'].includes(view) && !state.user) {
      toast('请先登录');
      view = 'login';
    }
    if (view === 'admin' && state.user && !isStaff()) {
      toast('需要商家或平台管理员账号');
      return;
    }
    state.view = view;
    $$('.view').forEach(v => { v.hidden = v.id !== `view-${view}`; });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof syncChannelActive === 'function') syncChannelActive();

    if (view === 'home') renderHome();
    if (view === 'products') renderProducts();
    if (view === 'shops') renderShops();
    if (view === 'shop') renderShop();
    if (view === 'detail') renderDetail();
    if (view === 'cart') renderCart();
    if (view === 'checkout') renderCheckout();
    if (view === 'orders') renderOrders();
    if (view === 'admin') renderAdmin();
  }

  // 离开商家后台：释放图表 + 停止实时监控定时器
  function leaveAdmin() {
    BigData.disposeAll();
    if (state.anaTimer) { clearInterval(state.anaTimer); state.anaTimer = null; }
  }

  function renderShops() {
    const kw = (state.keyword || '').trim().toLowerCase();
    let list = shops().slice();
    if (kw) {
      list = list.filter(s =>
        s.name.toLowerCase().includes(kw) || s.desc.toLowerCase().includes(kw)
      );
    }
    $('#shops-title').textContent = kw ? `店铺搜索：${state.keyword}` : '全部店铺';
    const box = $('#shop-list');
    $('#shops-empty').hidden = list.length > 0;
    box.innerHTML = list.map(s => {
      const st = shopStats(s.id);
      return `
        <article class="shop-card panel" data-shop="${s.id}">
          <div class="shop-icon">${s.icon}</div>
          <div class="shop-body">
            <h3 data-shop="${s.id}">${s.name}</h3>
            <p class="muted">${s.desc}</p>
            <div class="shop-meta">评分 <strong>${s.rating}</strong> · 在售 <strong>${st.productCount}</strong> 件 · 库存 <strong>${st.stock}</strong> · 累计销量 <strong>${st.sales}</strong></div>
          </div>
          <button class="btn primary" data-shop="${s.id}">进店逛逛</button>
        </article>`;
    }).join('') || '';
    $$('[data-shop]', box).forEach(el => {
      el.onclick = e => {
        e.stopPropagation();
        openShop(Number(el.dataset.shop));
      };
    });
    $('#btn-shops-clear').onclick = () => {
      state.keyword = '';
      $('#global-search').value = '';
      renderShops();
    };
  }

  function renderAuthBar() {
    const login = $('#link-login');
    const reg = $('#link-register');
    const out = $('#btn-logout');
    const admin = $('#link-admin');
    const greet = $('#greet-text');

    if (state.user) {
      login.textContent = state.user.nickname || state.user.username;
      login.onclick = e => { e.preventDefault(); show(isStaff() ? 'admin' : 'orders'); };
      reg.hidden = true;
      out.hidden = false;
      admin.hidden = !isStaff();
      greet.textContent = `Hi，${state.user.nickname || state.user.username}`;
    } else {
      login.textContent = '亲，请登录';
      login.onclick = e => { e.preventDefault(); show('login'); };
      reg.hidden = false;
      out.hidden = true;
      admin.hidden = true;
      greet.textContent = '欢迎来到拾光优选';
    }
    refreshCartBadge();
  }

  function refreshCartBadge() {
    const badge = $('#cart-badge');
    const n = state.user ? api.getCart(state.user.id).reduce((s, i) => s + i.quantity, 0) : 0;
    badge.textContent = String(n);
    badge.classList.remove('bump');
    void badge.offsetWidth;
    badge.classList.add('bump');
  }

  /* ========== 商品卡片 ========== */
  function productCard(p) {
    ensureShopId(p);
    const shop = shopById(p.shopId);
    return `
      <article class="card" data-id="${p.id}">
        <div class="thumb ${thumbCls(p.category)}" data-detail="${p.id}">${productVisual(p)}</div>
        <div class="card-body">
          <h3 data-detail="${p.id}">${p.name}</h3>
          <div class="meta">
            <span data-shop="${shop.id}" class="shop-link">${shop.name}</span>
            <span>已售 ${p.sales || 0}</span>
          </div>
          <div class="price"><span class="yen">¥</span>${Number(p.price).toFixed(2)}</div>
          <div class="actions">
            <button class="btn small" data-detail="${p.id}">查看详情</button>
            <button class="btn primary small" data-add="${p.id}">加入购物车</button>
          </div>
        </div>
      </article>`;
  }

  function bindProductCards(root) {
    $$('[data-detail]', root).forEach(el => {
      el.onclick = () => openDetail(el.dataset.detail);
    });
    $$('[data-add]', root).forEach(el => {
      el.onclick = e => {
        e.stopPropagation();
        addToCart(Number(el.dataset.add), 1);
      };
    });
    $$('[data-shop]', root).forEach(el => {
      el.onclick = e => {
        e.stopPropagation();
        openShop(Number(el.dataset.shop));
      };
    });
  }

  function requireLogin() {
    if (state.user) return true;
    toast('请先登录');
    show('login');
    return false;
  }

  function addToCart(productId, qty = 1, goBuy = false) {
    if (!requireLogin()) return;
    try {
      api.addToCart(state.user.id, productId, qty);
      refreshCartBadge();
      if (goBuy) {
        const p = api.getProduct(productId);
        state.checkoutFrom = 'buy';
        state.checkoutItems = [{
          productId: p.id, productName: p.name, price: p.price,
          quantity: qty, cartId: null,
        }];
        show('checkout');
      } else {
        toast('已加入购物车');
        openDrawer();
      }
    } catch (e) {
      toast(e.message);
    }
  }

  /* ========== 首页 ========== */
  function renderChannels() {
    $('#channel-cats').innerHTML = cats().map(c =>
      `<button data-cat="${c}" class="${state.category === c ? 'active' : ''}">${c}</button>`
    ).join('');
    $$('#channel-cats button[data-cat]').forEach(b => {
      b.onclick = () => {
        state.category = b.dataset.cat;
        state.keyword = '';
        state.page = 1;
        $('#global-search').value = '';
        syncChannelActive();
        show('products');
      };
    });
  }

  function syncChannelActive() {
    $$('#channel-cats button[data-cat]').forEach(b => {
      b.classList.toggle('active', b.dataset.cat === state.category && state.view === 'products');
    });
  }

  function renderHome() {
    const featured = api.listProducts({ page: 1, size: 10 }).items;
    $('#home-products').innerHTML = featured.map(productCard).join('');
    bindProductCards($('#home-products'));

    // 个性化推荐（协同过滤）：仅登录顾客展示
    const recBox = $('#home-recs');
    const recHead = $('#home-rec-head');
    if (state.user && state.user.role === 'USER') {
      const recs = BigData.recommendForUser(DB, state.user.id, 5).map(x => x.product);
      recBox.innerHTML = recs.map(productCard).join('');
      bindProductCards(recBox);
      recBox.hidden = recs.length === 0;
      recHead.hidden = recs.length === 0;
    } else {
      recBox.hidden = true;
      recHead.hidden = true;
    }

    // hero floats
    const floats = featured.slice(0, 4);
    $('#hero-stage').innerHTML = floats.map(p => `
      <div class="float-card" data-detail="${p.id}">
        <div class="thumb">${productVisual(p)}</div>
        <strong>${p.name}</strong>
        <span>${money(p.price)}</span>
      </div>
    `).join('');
    bindProductCards($('#hero-stage'));

    $('#stat-sku').textContent = DB.products.filter(p => p.status === 1).length;

    $('#home-cats').innerHTML = cats().map(c => {
      const n = DB.products.filter(p => p.category === c && p.status === 1).length;
      const icon = (CAT_META[c] || { icon: '🛍️' }).icon;
      return `<div class="cat-card" data-cat="${c}">
        <div class="icon">${icon}</div>
        <strong>${c}</strong>
        <span>${n} 件商品</span>
      </div>`;
    }).join('');
    $$('#home-cats .cat-card').forEach(el => {
      el.onclick = () => {
        state.category = el.dataset.cat;
        state.keyword = '';
        state.page = 1;
        show('products');
      };
    });
    $('#btn-hero-cats').onclick = () => {
      state.category = '';
      show('products');
    };
  }

  /* ========== 商品列表 ========== */
  function renderProducts() {
    const data = api.listProducts({
      page: state.page, size: state.size,
      keyword: state.keyword, category: state.category, sort: state.sort,
    });
    $('#products-title').textContent = state.category
      ? state.category
      : (state.keyword ? `搜索：${state.keyword}` : '全部商品');

    // 顶部频道栏负责分类切换（黑底白字），此处只保留排序
    $$('.sort-row .chip').forEach(b => {
      b.classList.toggle('active', b.dataset.sort === state.sort);
      b.onclick = () => {
        state.sort = b.dataset.sort;
        state.page = 1;
        renderProducts();
      };
    });

    const box = $('#product-list');
    box.innerHTML = data.items.map(productCard).join('');
    bindProductCards(box);
    $('#product-empty').hidden = data.total > 0;
    box.hidden = data.total === 0;
    $('#product-pager').hidden = data.total === 0;

    const pages = Math.max(1, Math.ceil(data.total / state.size));
    $('#page-info').textContent = `${state.page} / ${pages}　共 ${data.total} 件`;
    $('#page-prev').disabled = state.page <= 1;
    $('#page-next').disabled = state.page >= pages;

    $('#page-prev').onclick = () => { if (state.page > 1) { state.page--; renderProducts(); } };
    $('#page-next').onclick = () => { if (state.page < pages) { state.page++; renderProducts(); } };
    $('#btn-clear-search').onclick = () => {
      state.keyword = ''; state.category = ''; state.page = 1;
      $('#global-search').value = '';
      renderProducts();
    };
  }

  /* ========== 详情 ========== */
  function openDetail(id) {
    const next = Number(id);
    // 详情→详情直接切换时，先结算上一个商品的停留时长
    if (state.dwellStart && state.dwellStart.id !== next) flushDwell();
    state.detailId = next;
    state.detailQty = 1;
    show('detail');
  }

  function openShop(id) {
    state.shopId = Number(id);
    state.searchMode = 'shop';
    show('shop');
  }

  function renderShop() {
    const shop = shopById(state.shopId);
    const items = DB.products.filter(p => p.status === 1 && ensureShopId(p) === shop.id);
    const st = shopStats(shop.id);
    $('#shop-name').textContent = `${shop.icon} ${shop.name}`;
    $('#shop-crumb').textContent = shop.name;
    $('#shop-desc').textContent = shop.desc;
    $('#shop-meta').innerHTML = `评分 <strong>${shop.rating}</strong> · 在售 <strong>${st.productCount}</strong> 件 · 总库存 <strong>${st.stock}</strong> · 累计销量 <strong>${st.sales}</strong>`;
    $('#shop-count').textContent = `本店共 ${items.length} 件商品`;
    const box = $('#shop-products');
    box.innerHTML = items.map(productCard).join('') || '<p class="muted">本店暂无在售商品</p>';
    bindProductCards(box);
    $('#btn-shop-all').onclick = () => {
      state.keyword = '';
      state.category = '';
      state.page = 1;
      state.searchMode = 'product';
      show('products');
    };
  }

  function renderDetail() {
    const p = api.getProduct(state.detailId);
    $('#detail-crumb').textContent = p.name;
    $('#detail-media').className = `detail-media ${thumbCls(p.category)}`;
    $('#detail-media').innerHTML = productVisual(p, 'big');
    const shop = shopById(p.shopId);
    const shopEl = $('#detail-shop');
    if (shopEl) {
      shopEl.innerHTML = `<a href="#" data-shop="${shop.id}">${shop.icon} ${shop.name}</a> · ${shop.desc}`;
      shopEl.querySelector('[data-shop]').onclick = e => { e.preventDefault(); openShop(shop.id); };
    }
    $('#detail-name').textContent = p.name;
    $('#detail-desc').textContent = p.description || '暂无描述';
    $('#detail-price').textContent = Number(p.price).toFixed(2);
    $('#detail-sales').textContent = p.sales || 0;
    $('#detail-stock').textContent = p.stock;
    $('#detail-cat').textContent = p.category || '—';
    $('#qty-input').value = state.detailQty;

    $('#qty-minus').onclick = () => {
      state.detailQty = Math.max(1, state.detailQty - 1);
      $('#qty-input').value = state.detailQty;
    };
    $('#qty-plus').onclick = () => {
      state.detailQty = Math.min(p.stock || 1, state.detailQty + 1);
      $('#qty-input').value = state.detailQty;
      if (p.stock <= 0) toast('当前无库存');
    };
    $('#qty-input').onchange = e => {
      let v = parseInt(e.target.value, 10) || 1;
      v = Math.max(1, Math.min(p.stock || 1, v));
      state.detailQty = v;
      e.target.value = v;
    };

    function readDetailQty() {
      const raw = parseInt($('#qty-input').value, 10);
      const n = Math.max(1, Math.min(p.stock || 1, Number.isFinite(raw) ? raw : 1));
      state.detailQty = n;
      $('#qty-input').value = n;
      return n;
    }

    $('#btn-add-cart').onclick = () => addToCart(p.id, readDetailQty(), false);
    $('#btn-buy-now').onclick = () => {
      if (!requireLogin()) return;
      try {
        const qty = readDetailQty();
        api.getProduct(p.id);
        state.checkoutFrom = 'buy';
        state.checkoutItems = [{
          productId: p.id, productName: p.name, price: p.price,
          quantity: qty, cartId: null,
        }];
        show('checkout');
      } catch (e) { toast(e.message); }
    };

    startDwell();
    renderDetailRecs(p);
  }

  /* ========== 推荐位渲染（课程设计 3.3 推荐系统） ========== */
  function miniRecCard(item, tag) {
    const p = item.product;
    return `
      <article class="card rec-card" data-id="${p.id}">
        ${tag ? `<span class="rec-tag">${tag}</span>` : ''}
        <div class="thumb ${thumbCls(p.category)}" data-detail="${p.id}">${productVisual(p)}</div>
        <div class="card-body">
          <h3 data-detail="${p.id}">${p.name}</h3>
          <div class="meta"><span>${p.category}</span><span>已售 ${p.sales || 0}</span></div>
          <div class="price"><span class="yen">¥</span>${Number(p.price).toFixed(2)}</div>
        </div>
      </article>`;
  }
  function renderDetailRecs(p) {
    const alsoBlock = $('#rec-alsobuy-block');
    const cfBlock = $('#rec-cf-block');
    const alsoBox = $('#rec-alsobuy');
    const cfBox = $('#rec-cf');

    // 简单推荐："浏览过此商品的人也买了"（共现计数）
    const also = BigData.coPurchase(DB, p.id, 5);
    alsoBlock.hidden = also.length === 0;
    alsoBox.innerHTML = also.map(x => miniRecCard(x, `${Math.round(x.score)} 人买过`)).join('');
    bindProductCards(alsoBox);

    // 协同过滤推荐："看了又看"（物品余弦相似度）
    const cf = BigData.cfSimilar(DB, p.id, 5);
    cfBlock.hidden = cf.length === 0;
    cfBox.innerHTML = cf.map(x => miniRecCard(x, `相似度 ${(x.score * 100).toFixed(0)}%`)).join('');
    bindProductCards(cfBox);
  }

  /* ========== 购物车 ========== */
  function renderCart() {
    const items = api.getCart(state.user.id);
    const list = $('#cart-list');
    $('#cart-empty').hidden = items.length > 0;
    $('.cart-head').hidden = items.length === 0;

    list.innerHTML = items.map(it => `
      <div class="cart-row" data-cart="${it.id}">
        <label class="check">
          <input type="checkbox" data-sel="${it.id}" ${state.selected.has(it.id) ? 'checked' : ''} />
        </label>
        <div class="cart-prod">
          <div class="mini ${thumbCls(it.product.category)}">${productVisual(it.product)}</div>
          <div>
            <strong data-detail="${it.product.id}">${it.product.name}</strong>
            <span>${it.product.category} · 库存 ${it.product.stock}</span>
          </div>
        </div>
        <div class="col-price">${money(it.product.price)}</div>
        <div class="col-qty">
          <div class="stepper">
            <button data-dec="${it.id}">−</button>
            <input data-qty="${it.id}" type="number" min="1" value="${it.quantity}" />
            <button data-inc="${it.id}">+</button>
          </div>
        </div>
        <div class="col-sub"><strong>${money(it.subtotal)}</strong></div>
        <div class="col-op">
          <button class="btn small danger" data-del="${it.id}">删除</button>
        </div>
      </div>
    `).join('');

    $$('[data-sel]', list).forEach(cb => {
      cb.onchange = () => {
        const id = Number(cb.dataset.sel);
        if (cb.checked) state.selected.add(id); else state.selected.delete(id);
        updateCartSummary(items);
      };
    });
    $$('[data-inc]', list).forEach(b => b.onclick = () => {
      const it = items.find(x => x.id === Number(b.dataset.inc));
      try {
        api.setCartQty(state.user.id, it.id, it.quantity + 1);
        renderCart(); refreshCartBadge();
      } catch (e) { toast(e.message); }
    });
    $$('[data-dec]', list).forEach(b => b.onclick = () => {
      const it = items.find(x => x.id === Number(b.dataset.dec));
      try {
        api.setCartQty(state.user.id, it.id, it.quantity - 1);
        renderCart(); refreshCartBadge();
      } catch (e) { toast(e.message); }
    });
    $$('[data-qty]', list).forEach(inp => inp.onchange = () => {
      const id = Number(inp.dataset.qty);
      try {
        api.setCartQty(state.user.id, id, Number(inp.value) || 1);
        renderCart(); refreshCartBadge();
      } catch (e) { toast(e.message); renderCart(); }
    });
    $$('[data-del]', list).forEach(b => b.onclick = () => {
      api.removeCart(state.user.id, Number(b.dataset.del));
      toast('已删除');
      renderCart(); refreshCartBadge();
    });
    $$('[data-detail]', list).forEach(el => el.onclick = () => openDetail(el.dataset.detail));

    $('#cart-check-all').checked = items.length > 0 && items.every(i => state.selected.has(i.id));
    $('#cart-check-all').onchange = e => {
      state.selected.clear();
      if (e.target.checked) items.forEach(i => state.selected.add(i.id));
      renderCart();
    };

    updateCartSummary(items);
    $('#btn-checkout').onclick = () => {
      const sel = items.filter(i => state.selected.has(i.id));
      if (!sel.length) { toast('请先勾选商品'); return; }
      state.checkoutFrom = 'cart';
      state.checkoutItems = sel.map(i => ({
        productId: i.product.id, productName: i.product.name,
        price: i.product.price,
        quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
        cartId: i.id,
      }));
      show('checkout');
    };
  }

  function updateCartSummary(items) {
    const sel = items.filter(i => state.selected.has(i.id));
    const goods = sel.reduce((s, i) => s + i.subtotal, 0);
    const count = sel.reduce((s, i) => s + i.quantity, 0);
    $('#sum-count').textContent = `${count} 件`;
    $('#sum-goods').textContent = money(goods);
    $('#sum-ship').textContent = goods >= 99 || goods === 0 ? '免运费' : money(8);
    const ship = (goods >= 99 || goods === 0) ? 0 : 8;
    $('#sum-total').textContent = money(goods + ship);
  }

  /* ========== 结算 ========== */
  function renderCheckout() {
    const items = state.checkoutItems;
    const goods = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const ship = goods >= 99 ? 0 : 8;
    $('#checkout-items').innerHTML = items.map(i => `
      <div class="ck-item">
        <span>${i.productName} × ${i.quantity}</span>
        <strong>${money(i.price * i.quantity)}</strong>
      </div>
    `).join('');
    $('#ck-goods').textContent = money(goods);
    $('#ck-ship').textContent = ship ? money(ship) : '免运费';
    $('#ck-total').textContent = money(goods + ship);

    // defaults from user
    if (state.user) {
      if (!$('#ck-email').value) $('#ck-email').value = state.user.email || '';
      $('#ck-name').value = state.user.nickname || state.user.username || '';
    }

    $$('.pay-card').forEach(card => {
      card.onclick = () => {
        $$('.pay-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        card.querySelector('input').checked = true;
      };
    });

    $('#btn-pay').onclick = () => {
      const email = $('#ck-email').value.trim();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        toast('请填写有效邮箱');
        $('#ck-email').focus();
        return;
      }
      const payMethod = ($('input[name="pay"]:checked') || {}).value || 'alipay';
      try {
        const order = api.checkout(state.user.id, {
          items: items.map(i => ({ ...i })),
          email,
          name: $('#ck-name').value.trim(),
          phone: $('#ck-phone').value.trim(),
          address: $('#ck-address').value.trim(),
          note: $('#ck-note').value.trim(),
          payMethod,
          from: state.checkoutFrom,
        });
        toast(`支付成功，订单 ${order.orderNo}`);
        refreshCartBadge();
        state.orderStatus = '';
        show('orders');
      } catch (e) {
        toast(e.message);
      }
    };
  }

  /* ========== 订单 ========== */
  function renderOrders() {
    const list = api.listOrders(state.user.id, state.orderStatus);
    $$('#order-tabs .chip').forEach(b => {
      b.classList.toggle('active', b.dataset.status === state.orderStatus);
      b.onclick = () => {
        state.orderStatus = b.dataset.status;
        renderOrders();
      };
    });

    const box = $('#order-list');
    $('#order-empty').hidden = list.length > 0;
    box.innerHTML = list.map(o => `
      <article class="order-card">
        <div class="order-card-head">
          <div>
            <strong>${o.orderNo}</strong>
            <span style="margin-left:10px">${fmtTime(o.createdAt)}</span>
          </div>
          <div>
            <span class="status ${o.status}">${STATUS[o.status] || o.status}</span>
          </div>
        </div>
        <div class="order-card-body">
          <div class="order-items">
            ${o.items.map(it => `
              <div class="order-item">
                <div class="mini t-digital">${productVisual(DB.products.find(p => p.id === it.productId) || {})}</div>
                <div>
                  <strong>${it.productName}</strong>
                  <div class="muted">× ${it.quantity}　${money(it.price)}</div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="muted">
            收货人：${o.name || o.username || '本人'}<br/>
            <span class="muted">联系：${o.shippingEmail || '—'}</span><br/>
            ${o.address || ''}
          </div>
          <div style="text-align:right">
            <div class="muted">实付</div>
            <strong style="font-size:20px;color:var(--price)">${money(o.totalAmount)}</strong>
            <div style="margin-top:8px">
              ${['PENDING', 'PAID'].includes(o.status)
                ? `<button class="btn small danger" data-cancel="${o.id}">取消订单</button>` : ''}
              ${o.status === 'SHIPPED'
                ? `<button class="btn small primary" data-done="${o.id}">确认收货</button>` : ''}
            </div>
          </div>
        </div>
      </article>
    `).join('');

    $$('[data-cancel]', box).forEach(b => b.onclick = async () => {
      const yes = await confirmDialog({
        title: '取消订单',
        message: '确定取消该订单吗？已扣库存将自动退回。',
        okText: '取消订单',
        cancelText: '再想想',
        danger: true,
      });
      if (!yes) return;
      try {
        api.updateOrderStatus(Number(b.dataset.cancel), 'CANCELLED');
        toast('订单已取消');
        renderOrders();
      } catch (e) { toast(e.message); }
    });
    $$('[data-done]', box).forEach(b => b.onclick = () => {
      try {
        api.updateOrderStatus(Number(b.dataset.done), 'COMPLETED');
        toast('确认收货成功');
        renderOrders();
      } catch (e) { toast(e.message); }
    });
  }

  /* ========== 抽屉 ========== */
  function openDrawer() {
    if (!requireLogin()) return;
    renderDrawer();
    $('#drawer-mask').hidden = false;
    $('#cart-drawer').hidden = false;
  }
  function closeDrawer() {
    $('#drawer-mask').hidden = true;
    $('#cart-drawer').hidden = true;
  }
  function renderDrawer() {
    const items = api.getCart(state.user.id);
    $('#drawer-items').innerHTML = items.length ? items.map(it => `
      <div class="drawer-item">
        <div class="mini ${thumbCls(it.product.category)}">${productVisual(it.product)}</div>
        <div>
          <strong style="font-size:13px">${it.product.name}</strong>
          <div class="muted">× ${it.quantity}　${money(it.subtotal)}</div>
        </div>
        <button class="icon-btn" data-del="${it.id}">✕</button>
      </div>
    `).join('') : '<p class="muted center">购物车是空的</p>';
    $('#drawer-total').textContent = money(items.reduce((s, i) => s + i.subtotal, 0));
    $$('#drawer-items [data-del]').forEach(b => b.onclick = () => {
      api.removeCart(state.user.id, Number(b.dataset.del));
      renderDrawer(); refreshCartBadge();
    });
    $('#drawer-checkout').onclick = () => {
      const all = api.getCart(state.user.id);
      if (!all.length) { toast('购物车是空的'); return; }
      state.selected.clear();
      all.forEach(i => state.selected.add(i.id));
      closeDrawer();
      show('cart');
    };
  }

  /* ========== 管理后台 ========== */
  // 页签按角色动态渲染：店长 5 个；平台管理员 7 个（多数据分析、人员管理）
  const ADMIN_TABS = [
    { id: 'products', label: '商品管理', roles: ['SUPER', 'ADMIN'] },
    { id: 'orders', label: '订单管理', roles: ['SUPER', 'ADMIN'] },
    { id: 'stats', label: '销售统计', roles: ['SUPER', 'ADMIN'] },
    { id: 'analytics', label: '数据分析', roles: ['SUPER'], superOnly: true },
    { id: 'logs', label: '日志审计', roles: ['SUPER', 'ADMIN'] },
    { id: 'staff', label: '人员管理', roles: ['SUPER'], superOnly: true },
    { id: 'mails', label: '邮件日志', roles: ['SUPER', 'ADMIN'] },
  ];
  function renderAdminTabs() {
    const role = isSuper() ? 'SUPER' : 'ADMIN';
    $('#admin-tabs').innerHTML = ADMIN_TABS
      .filter(t => t.roles.includes(role))
      .map((t, i) => `<button class="tab ${i === 0 ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`)
      .join('');
    $$('#admin-tabs .tab').forEach(t => { t.onclick = () => switchAdminTab(t.dataset.tab); });
  }

  function renderAdmin() {
    const s = api.stats();
    const sid = myShopId();
    const shop = sid != null ? shopById(sid) : null;
    const titleEl = $('#admin-shop-title');
    if (titleEl) {
      titleEl.textContent = shop
        ? `${shop.icon} ${shop.name} · 商家后台`
        : (isSuper() ? '平台管理后台 · 全站数据' : '商家运营后台');
    }
    const label = shop ? '本店' : '全站';
    const views = isSuper() ? (DB.logs.views || []).length : 0;
    $('#admin-kpis').innerHTML = `
      <div class="kpi"><span>${label}销售额</span><strong class="kpi-strong${moneyCls(s.totalRevenue)}">${money(s.totalRevenue)}</strong></div>
      <div class="kpi"><span>${label}订单</span><strong>${s.paidOrderCount}</strong></div>
      <div class="kpi"><span>在售 SKU</span><strong>${s.sku}</strong></div>
      ${isSuper() ? `<div class="kpi"><span>行为日志</span><strong>${views}</strong></div>` : ''}
    `;
    renderAdminTabs();
    switchAdminTab('products');
  }

  function switchAdminTab(tab) {
    $$('#admin-tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    ADMIN_TABS.forEach(t => {
      const el = $(`#admin-${t.id}`);
      if (el) el.hidden = t.id !== tab;
    });
    if (tab === 'products') renderAdminProducts();
    if (tab === 'orders') renderAdminOrders();
    if (tab === 'stats') renderAdminStats();
    if (tab === 'analytics') renderAdminAnalytics();
    if (tab === 'logs') renderAdminLogs();
    if (tab === 'staff') renderAdminStaff();
    if (tab === 'mails') renderAdminMails();
  }

  function renderAdminProducts() {
    const sid = myShopId();
    let items = DB.products.slice();
    items.forEach(ensureShopId);
    if (sid != null) items = items.filter(p => ensureShopId(p) === sid);
    if (state.adminKeyword) {
      const k = state.adminKeyword.toLowerCase();
      items = items.filter(p =>
        p.name.toLowerCase().includes(k) || (p.category || '').toLowerCase().includes(k));
    }
    items.sort((a, b) => b.id - a.id);
    const total = items.length;
    const size = 8;
    const pages = Math.max(1, Math.ceil(total / size));
    state.adminPage = Math.min(state.adminPage, pages);
    const pageItems = items.slice((state.adminPage - 1) * size, state.adminPage * size);

    const tbody = $('#admin-product-table tbody');
    tbody.innerHTML = pageItems.map(p => `
      <tr>
        <td class="col-id">${p.id}</td>
        <td class="col-product">
          <div class="prod-cell">
            <div class="mini ${thumbCls(p.category)}">${productVisual(p)}</div>
            <div class="prod-text">
              <strong>${p.name}</strong>
              <div class="muted">${shopById(ensureShopId(p)).name}</div>
            </div>
          </div>
        </td>
        <td class="col-price">${money(p.price)}</td>
        <td class="col-stock">${p.stock}</td>
        <td class="col-cat">${p.category}</td>
        <td class="col-sales">${p.sales || 0}</td>
        <td class="col-status">${p.status === 1 ? '<span class="status PAID">上架</span>' : '<span class="status CANCELLED">下架</span>'}</td>
        <td class="col-ops">
          <div class="ops">
            <button class="btn small" data-edit="${p.id}">编辑</button>
            <button class="btn small" data-off="${p.id}">${p.status === 1 ? '下架' : '上架'}</button>
            <button class="btn small danger" data-del="${p.id}">删除</button>
          </div>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="8" class="muted">本店暂无商品，点右上角添加</td></tr>';

    $('#admin-page-info').textContent = `${state.adminPage} / ${pages}　共 ${total} 件`;
    $('#admin-page-prev').disabled = state.adminPage <= 1;
    $('#admin-page-next').disabled = state.adminPage >= pages;

    $$('[data-edit]', tbody).forEach(b => b.onclick = () => openProductModal(Number(b.dataset.edit)));
    $$('[data-off]', tbody).forEach(b => b.onclick = () => {
      try {
        const p = api.offShelfProduct(Number(b.dataset.off));
        toast(p.status === 1 ? '已重新上架' : '已下架');
        renderAdminProducts();
      } catch (e) { toast(e.message); }
    });
    $$('[data-del]', tbody).forEach(b => b.onclick = async () => {
      const id = Number(b.dataset.del);
      const p = api.getProduct(id);
      const yes = await confirmDialog({
        title: '删除商品',
        message: `确定要删除「${p.name}」吗？删除后不可恢复。`,
        okText: '删除',
        cancelText: '取消',
        danger: true,
      });
      if (!yes) return;
      try {
        api.deleteProduct(id);
        toast('商品已删除');
        renderAdminProducts();
        renderAdmin();
      } catch (e) { toast(e.message); }
    });

    $('#admin-page-prev').onclick = () => { if (state.adminPage > 1) { state.adminPage--; renderAdminProducts(); } };
    $('#admin-page-next').onclick = () => { if (state.adminPage < pages) { state.adminPage++; renderAdminProducts(); } };
  }

  function openProductModal(id) {
    const form = $('#product-form');
    form.reset();
    $('#p-id').value = '';
    $('#product-modal-title').textContent = '添加商品';
    // 类别下拉动态填充（支持销售自行增删的类别）
    $('#p-category').innerHTML = cats().map(c => `<option>${c}</option>`).join('');
    const sid = myShopId();
    const shopSel = $('#p-shop');
    if (sid != null) {
      const s = shopById(sid);
      shopSel.innerHTML = `<option value="${s.id}">${s.icon} ${s.name}（本店）</option>`;
      shopSel.disabled = true;
      shopSel.value = String(s.id);
    } else {
      shopSel.disabled = false;
      shopSel.innerHTML = shops().map(s => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join('');
      shopSel.value = '1';
    }
    const preview = $('#p-image-preview');
    const fileInput = $('#p-image-file');
    const urlInput = $('#p-image');
    if (fileInput) {
      fileInput.value = '';
      fileInput.onchange = () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          urlInput.value = reader.result;
          preview.innerHTML = `<img src="${reader.result}" alt="预览" />`;
        };
        reader.readAsDataURL(file);
      };
    }
    if (id) {
      const p = api.getProduct(id);
      if (sid != null && ensureShopId(p) !== sid) {
        toast('只能编辑本店商品');
        return;
      }
      $('#product-modal-title').textContent = '编辑商品';
      $('#p-id').value = p.id;
      $('#p-name').value = p.name;
      $('#p-price').value = p.price;
      $('#p-stock').value = p.stock;
      $('#p-category').value = p.category;
      $('#p-desc').value = p.description || '';
      $('#p-status').value = String(p.status);
      if (sid == null) shopSel.value = String(ensureShopId(p));
      const img = (p.image || IMG[p.name] || '');
      if (urlInput) urlInput.value = img;
      if (preview) preview.innerHTML = img ? `<img src="${img}" alt="" />` : '<span class="muted">未选择图片</span>';
    } else {
      if (urlInput) urlInput.value = '';
      if (preview) preview.innerHTML = '<span class="muted">未选择图片</span>';
    }
    $('#product-modal').showModal();
  }

  function renderAdminOrders() {
    const list = api.listAllOrders(state.adminOrderStatus);
    const tbody = $('#admin-order-table tbody');
    tbody.innerHTML = list.map(o => `
      <tr>
        <td><strong>${o.orderNo}</strong></td>
        <td>${o.username || o.userId}</td>
        <td>${money(o.totalAmount)}</td>
        <td class="muted">${o.items.map(i => `${i.productName}×${i.quantity}`).join('，')}</td>
        <td><span class="status ${o.status}">${STATUS[o.status] || o.status}</span></td>
        <td class="muted">${o.name || o.username || '—'}</td>
        <td class="muted">${fmtTime(o.createdAt)}</td>
        <td class="col-ops">
          <div class="ops">
            <select data-st="${o.id}">
              ${Object.entries(STATUS).map(([k, v]) =>
                `<option value="${k}" ${k === o.status ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
            <button class="btn small primary" data-save="${o.id}">更新</button>
          </div>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="muted">暂无订单</td></tr>';

    $$('[data-save]', tbody).forEach(b => b.onclick = () => {
      const id = Number(b.dataset.save);
      const st = $(`[data-st="${id}"]`).value;
      try {
        api.updateOrderStatus(id, st);
        toast('订单状态已更新');
        renderAdminOrders();
        renderAdmin();
      } catch (e) { toast(e.message); }
    });
  }

  function renderAdminStats() {
    const s = api.stats();
    $('#stats-overview').innerHTML = `
      <div class="stat-card"><div class="label">总销售额</div><div class="value${moneyCls(s.totalRevenue)}">${money(s.totalRevenue)}</div></div>
      <div class="stat-card"><div class="label">有效订单</div><div class="value">${s.paidOrderCount}</div></div>
      <div class="stat-card"><div class="label">全部订单</div><div class="value">${s.allOrderCount}</div></div>
      ${s.statusBreakdown.map(x => `
        <div class="stat-card">
          <div class="label">${STATUS[x.status] || x.status}</div>
          <div class="value">${x.cnt}</div>
        </div>`).join('')}
    `;

    // 近 7 日趋势（ECharts：柱=销售额，线=订单数）
    BigData.renderChart('stats-daily', {
      color: BigData.PALETTE,
      tooltip: { trigger: 'axis' },
      legend: { ...BigData.LEGEND, data: ['销售额', '订单数'] },
      grid: BigData.GRID,
      xAxis: { type: 'category', data: s.days.map(d => d.day.slice(5)), ...BigData.AXIS },
      yAxis: [
        { type: 'value', name: '销售额', ...BigData.AXIS },
        { type: 'value', name: '订单', ...BigData.AXIS, splitLine: { show: false } },
      ],
      series: [
        { name: '销售额', type: 'bar', data: s.days.map(d => d.revenue), barMaxWidth: 26, itemStyle: { borderRadius: [4, 4, 0, 0] } },
        { name: '订单数', type: 'line', yAxisIndex: 1, data: s.days.map(d => d.order_count), smooth: true },
      ],
    });

    BigData.renderChart('stats-top', {
      color: BigData.PALETTE,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { ...BigData.GRID, left: 4 },
      xAxis: { type: 'value', ...BigData.AXIS, splitLine: { show: false } },
      yAxis: {
        type: 'category',
        data: s.top.map(t => t.productName).reverse(),
        ...BigData.AXIS, splitLine: { show: false },
        axisLabel: { ...BigData.AXIS.axisLabel, width: 90, overflow: 'truncate' },
      },
      series: [{ type: 'bar', data: s.top.map(t => t.revenue).reverse(), barMaxWidth: 16, itemStyle: { borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', formatter: p => money(p.value), color: '#7a736a', fontSize: 11 } }],
    });

    BigData.renderChart('stats-cat', {
      color: BigData.PALETTE,
      tooltip: { trigger: 'item', formatter: p => `${p.name}<br/>${money(p.value)}（${p.percent}%）` },
      legend: { ...BigData.LEGEND, type: 'scroll' },
      series: [{
        type: 'pie', radius: ['38%', '66%'], center: ['50%', '56%'],
        data: s.byCat.map(c => ({ name: c.category, value: c.revenue })),
        label: { formatter: '{b}\n{d}%', color: '#17140f', fontSize: 12 },
      }],
    });

    // 库存报表（按库存升序，低库存标红）
    const stock = BigData.stockReport(DB, { shopId: myShopId(), low: 20 });
    $('#stats-stock-table tbody').innerHTML = stock.rows.map(r => `
      <tr class="${r.stock <= 20 ? 'row-warn' : ''}">
        <td><strong>${r.name}</strong></td>
        <td>${r.category}</td>
        <td>${r.stock}</td>
        <td>${r.sales}</td>
        <td>${r.stock <= 20 ? '<span class="status CANCELLED">低库存 · 需补货</span>' : (r.status === 1 ? '<span class="status PAID">在售</span>' : '<span class="status">已下架</span>')}</td>
      </tr>
    `).join('');
  }

  function renderAdminMails() {
    const sid = myShopId();
    let mails = DB.mails.slice();
    if (sid != null && sid !== 1) {
      const myNos = DB.orders
        .filter(o => (o.items || []).some(it => Number(it.shopId) === sid))
        .map(o => o.orderNo);
      mails = mails.filter(m => {
        const text = (m.subject || '') + (m.content || '');
        return myNos.some(no => text.includes(no));
      });
    }
    const tbody = $('#admin-mail-table tbody');
    tbody.innerHTML = mails.map(m => `
      <tr>
        <td class="muted">${fmtTime(m.createdAt)}</td>
        <td>${m.to}</td>
        <td>${m.subject}</td>
        <td><span class="status PAID">${m.status}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="4" class="muted">暂无邮件</td></tr>';
  }

  /* ========== 数据分析仪表盘（课程设计 3.3 必做功能） ========== */
  function anaWindow() {
    return { day: 90, week: 182, month: 365 }[state.anaGranularity] || 90;
  }

  function renderAdminAnalytics() {
    renderAnalyticsKpis();
    renderAnalyticsRealtime();
    renderAnalyticsTrend();
    renderAnalyticsAnomaly();
    renderAnalyticsRank();
    renderAnalyticsProfile();

    // 实时监控面板定时刷新（进入页签时启动，离开后台时清除）
    if (state.anaTimer) clearInterval(state.anaTimer);
    state.anaTimer = setInterval(() => {
      if (state.view === 'admin' && !$('#admin-analytics').hidden) {
        renderAnalyticsKpis();
        renderAnalyticsRealtime();
      }
    }, 20000);
  }

  function renderAnalyticsKpis() {
    const sid = null; // 数据分析为平台管理员专属，固定全站口径
    const paid = BigData.paidOrders(DB, sid);
    const revenue = paid.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const views = (DB.logs.views || []).length;
    const users = DB.users.filter(u => u.role === 'USER').length;
    const avg = paid.length ? revenue / paid.length : 0;
    // 转化率：有效订单数 / 浏览次数
    const cvr = views ? (paid.length / views * 100) : 0;
    $('#ana-kpis').innerHTML = `
      <div class="stat-card"><div class="label">全站销售额</div><div class="value${moneyCls(revenue)}">${money(revenue)}</div></div>
      <div class="stat-card"><div class="label">有效订单</div><div class="value">${paid.length}</div></div>
      <div class="stat-card"><div class="label">客单价</div><div class="value${moneyCls(avg)}">${money(avg)}</div></div>
      <div class="stat-card"><div class="label">浏览行为</div><div class="value">${views}</div></div>
      <div class="stat-card"><div class="label">浏览-下单转化率</div><div class="value">${cvr.toFixed(1)}%</div></div>
      <div class="stat-card"><div class="label">注册用户</div><div class="value">${users}</div></div>
    `;
  }

  // 实时监控：今日销售 vs 历史均值区间 + 实时订单流水 + 低库存预警
  function renderAnalyticsRealtime() {
    const today = BigData.dayKey(Date.now());
    const todays = DB.orders.filter(o => BigData.dayKey(new Date(o.createdAt).getTime()) === today);
    const paidToday = todays.filter(o => ['PAID', 'SHIPPED', 'COMPLETED'].includes(o.status));
    const revToday = paidToday.reduce((s, o) => s + Number(o.totalAmount || 0), 0);

    const series = BigData.salesSeries(DB, { granularity: 'day', window: 90 });
    const { mean, std } = BigData.detectAnomalies(series.slice(0, -1)); // 基线不含今天
    let status, cls;
    if (revToday > mean + 2 * std) { status = '销售异常偏高（可能大促或刷单，请关注）'; cls = 'warn'; }
    else if (revToday < Math.max(0, mean - 2 * std)) { status = '销售异常偏低（请检查服务与库存）'; cls = 'danger'; }
    else { status = '运行正常，处于正常波动区间'; cls = 'ok'; }

    const stock = BigData.stockReport(DB, { shopId: null, low: 20 });
    const recent = DB.orders.slice(0, 8);

    $('#ana-realtime').innerHTML = `
      <div class="realtime-row">
        <div class="rt-card"><span>今日销售额</span><strong>${money(revToday)}</strong></div>
        <div class="rt-card"><span>今日订单</span><strong>${todays.length}</strong><small class="muted">其中有效 ${paidToday.length}</small></div>
        <div class="rt-card"><span>近 90 天日均值</span><strong>${money(mean)}</strong><small class="muted">±2σ 区间 ${money(Math.max(0, mean - 2 * std))} ~ ${money(mean + 2 * std)}</small></div>
        <div class="rt-card"><span>监控判定</span><strong class="rt-${cls}">${status}</strong></div>
        <div class="rt-card"><span>低库存预警</span><strong class="${stock.lowCount ? 'rt-warn' : ''}">${stock.lowCount} 个 SKU</strong></div>
      </div>
      <div class="table-wrap" style="margin-top:10px">
        <table class="table">
          <thead><tr><th>实时订单流水（最新 8 笔）</th><th>用户</th><th>金额</th><th>状态</th><th>时间</th></tr></thead>
          <tbody>
            ${recent.map(o => `<tr>
              <td>${o.orderNo}</td><td>${o.username || o.userId}</td>
              <td>${money(o.totalAmount)}</td>
              <td><span class="status ${o.status}">${STATUS[o.status] || o.status}</span></td>
              <td class="muted">${fmtTime(o.createdAt)}</td>
            </tr>`).join('') || '<tr><td colspan="5" class="muted">暂无订单</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  // 趋势图 + 线性回归预测 + 误差评估
  function renderAnalyticsTrend() {
    const g = state.anaGranularity;
    const series = BigData.salesSeries(DB, { granularity: g, window: anaWindow() });
    const fc = BigData.forecastSeries(series, { horizon: 7, granularity: g });

    const labels = series.map(p => p.label);
    const catLabels = [...labels, ...fc.future.map(p => p.label)];
    BigData.renderChart('ana-trend', {
      color: BigData.PALETTE,
      tooltip: { trigger: 'axis' },
      legend: { ...BigData.LEGEND, data: ['实际销售额', '趋势线', '未来预测'] },
      grid: BigData.GRID,
      xAxis: { type: 'category', data: catLabels, ...BigData.AXIS },
      yAxis: { type: 'value', name: '销售额(¥)', ...BigData.AXIS },
      series: [
        {
          name: '实际销售额', type: 'line', smooth: true, symbolSize: 4,
          data: [...series.map(p => p.revenue), ...fc.future.map(() => null)],
          lineStyle: { width: 2.5 },
          areaStyle: { opacity: 0.06 },
        },
        {
          name: '趋势线', type: 'line', smooth: true, symbol: 'none',
          data: fc.fitted.map(p => p.trend),
          lineStyle: { type: 'dashed', width: 1.5, opacity: 0.8 },
        },
        {
          name: '未来预测', type: 'line', smooth: true, symbolSize: 5,
          data: [...series.map(() => null), ...fc.future.map(p => Math.round(p.value))],
          lineStyle: { type: 'dashed', width: 2, color: '#f04424' },
          itemStyle: { color: '#f04424' },
        },
      ],
    });

    $('#ana-trend-note').textContent =
      `口径：全站有效订单（已付款/已发货/已完成） · ${g === 'day' ? '按日' : g === 'week' ? '按周' : '按月'}聚合 · 虚线为最小二乘线性回归对未来 7 个周期的预测`;

    const evalBox = $('#ana-eval');
    if (fc.eval) {
      const holdoutCnt = series.length - fc.eval.trainPoints;
      const smoothNote = state.anaGranularity === 'day' ? '对 7 日移动平均序列、剔除异常点后拟合，' : '剔除异常点后拟合，';
      const trendText = fc.slope > 0 ? '整体呈上升趋势' : fc.slope < 0 ? '整体呈下降趋势' : '整体平稳';
      evalBox.innerHTML = `
        <span>预测评估（${smoothNote}留出最后 ${holdoutCnt} 个周期做验证）：
        <b>MAE ¥${fc.eval.mae.toFixed(0)}</b> ·
        <b>MAPE ${fc.eval.mape.toFixed(1)}%</b> ·
        <b>R² ${fc.eval.r2.toFixed(3)}</b></span>
        <span class="muted">回归斜率 ${fc.slope >= 0 ? '+' : ''}${fc.slope.toFixed(1)}/周期，销售${trendText}${fc.eval.mape < 30 ? '，拟合可用' : '，波动较大仅供参考'}</span>`;
    } else {
      evalBox.innerHTML = '<span class="muted">数据点不足，暂无法进行预测评估</span>';
    }
  }

  // 异常判别：z-score 标注 + 明细表
  function renderAnalyticsAnomaly() {
    const series = BigData.salesSeries(DB, { granularity: 'day', window: 90 });
    const det = BigData.detectAnomalies(series);
    const anomalyKeys = new Set(det.anomalies.map(a => a.key));

    BigData.renderChart('ana-anomaly', {
      color: BigData.PALETTE,
      tooltip: { trigger: 'axis' },
      grid: BigData.GRID,
      xAxis: { type: 'category', data: series.map(p => p.label.slice(5)), ...BigData.AXIS },
      yAxis: { type: 'value', name: '日销售额(¥)', ...BigData.AXIS },
      dataZoom: [{ type: 'inside', start: 40, end: 100 }],
      series: [
        {
          name: '日销售额', type: 'bar', data: series.map(p => p.revenue), barMaxWidth: 12,
          itemStyle: { color: p => (anomalyKeys.has(series[p.dataIndex].key) ? '#d97706' : '#2f6fed'), borderRadius: [3, 3, 0, 0] },
          markLine: {
            silent: true, symbol: 'none',
            data: [
              { yAxis: det.mean, lineStyle: { color: '#1f9d55', type: 'dashed' }, label: { formatter: `均值 ¥${det.mean.toFixed(0)}`, color: '#1f9d55' } },
              { yAxis: det.mean + 2 * det.std, lineStyle: { color: '#dc2626', type: 'dotted' }, label: { formatter: '+2σ', color: '#dc2626' } },
              { yAxis: Math.max(0, det.mean - 2 * det.std), lineStyle: { color: '#dc2626', type: 'dotted' }, label: { formatter: '-2σ', color: '#dc2626' } },
            ],
          },
        },
      ],
    });

    $('#ana-anomaly-table').innerHTML = det.anomalies.length ? `
      <table class="table" style="margin-top:10px">
        <thead><tr><th>日期</th><th>销售额</th><th>z 值</th><th>判别</th></tr></thead>
        <tbody>
          ${det.anomalies.slice(0, 6).map(a => `<tr class="${a.z > 0 ? 'row-warn' : ''}">
            <td>${a.key}</td><td>${money(a.revenue)}</td>
            <td>${a.z > 0 ? '+' : ''}${a.z.toFixed(2)}</td>
            <td>${a.z > 0 ? '<span class="status PENDING">异常偏高 · 疑似大促/刷单</span>' : '<span class="status CANCELLED">异常偏低 · 疑似断供/故障</span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : '<p class="muted" style="margin-top:10px">近 90 天无异常点（|z| ≥ 2）</p>';
  }

  function renderAnalyticsRank() {
    const by = state.anaRankBy;
    const rows = BigData.rankProducts(DB, { shopId: null, by, limit: 10 });
    BigData.renderChart('ana-rank', {
      color: BigData.PALETTE,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: p => {
        const d = rows[p[0].dataIndex];
        return `${d.productName}<br/>${p[0].marker}${p[0].name === '按销量' ? d.qty + ' 件' : money(d.revenue)}`;
      } },
      grid: { ...BigData.GRID, left: 4 },
      xAxis: { type: 'value', ...BigData.AXIS, splitLine: { show: false } },
      yAxis: {
        type: 'category', inverse: true,
        data: rows.map(r => r.productName),
        ...BigData.AXIS, splitLine: { show: false },
        axisLabel: { ...BigData.AXIS.axisLabel, width: 110, overflow: 'truncate' },
      },
      series: [{
        name: by === 'qty' ? '按销量' : '按销售额',
        type: 'bar', barMaxWidth: 16,
        data: rows.map(r => by === 'qty' ? r.qty : r.revenue),
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', formatter: p => by === 'qty' ? p.value + ' 件' : money(p.value), color: '#7a736a', fontSize: 11 },
      }],
    });
  }

  // 用户画像：单用户卡片 + 全站三类聚合图
  function renderAnalyticsProfile() {
    const users = DB.users.filter(u => u.role === 'USER');
    if (!state.anaUserId || !users.some(u => u.id === state.anaUserId)) {
      state.anaUserId = users.length ? users[0].id : null;
    }
    $('#ana-user').innerHTML = users.map(u =>
      `<option value="${u.id}" ${u.id === state.anaUserId ? 'selected' : ''}>${u.nickname || u.username}（${u.username}）</option>`
    ).join('');
    $('#ana-user').onchange = e => {
      state.anaUserId = Number(e.target.value);
      renderAnalyticsProfile();
    };

    const p = state.anaUserId ? BigData.userProfile(DB, state.anaUserId) : null;
    $('#ana-user-card').innerHTML = p ? `
      <div class="profile-card">
        <div class="p-item"><span>用户</span><strong>${p.nickname}（${p.username}）</strong></div>
        <div class="p-item"><span>地域</span><strong>${p.region}</strong></div>
        <div class="p-item"><span>购买力分层</span><strong><span class="tier tier-${p.tier}">${p.tierLabel}</span></strong></div>
        <div class="p-item"><span>累计消费</span><strong>${money(p.totalSpend)}</strong></div>
        <div class="p-item"><span>订单 / 客单</span><strong>${p.orderCount} 单 · ${money(p.avgOrder)}</strong></div>
        <div class="p-item"><span>浏览 / 停留</span><strong>${p.viewCount} 次 · ${(p.totalDwell / 60).toFixed(0)} 分钟</strong></div>
        <div class="p-item"><span>偏好分类 TOP3</span><strong>${p.prefCats.map(c => c.cat).join(' ＞ ') || '—'}</strong></div>
      </div>
      <p class="muted" style="margin:6px 0 0">画像口径：地域取账号属性；购买力按累计支付金额分层（<1.5k 低 / <8k 中 / ≥8k 高）；偏好按浏览 1 权重 + 购买件数 3 权重加权。</p>
    ` : '<p class="muted">暂无用户</p>';

    const agg = BigData.profileAggregates(DB);
    BigData.renderChart('ana-region', {
      color: BigData.PALETTE,
      tooltip: { trigger: 'item', formatter: '{b}：{c} 人（{d}%）' },
      series: [{ type: 'pie', radius: ['34%', '64%'], center: ['50%', '54%'], data: agg.region, label: { fontSize: 11, formatter: '{b} {d}%' } }],
    });
    BigData.renderChart('ana-tier', {
      color: BigData.PALETTE,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { ...BigData.GRID, top: 20 },
      xAxis: { type: 'category', data: agg.tier.map(t => t.name), ...BigData.AXIS },
      yAxis: { type: 'value', ...BigData.AXIS },
      series: [{ type: 'bar', data: agg.tier.map(t => t.value), barMaxWidth: 30, itemStyle: { borderRadius: [4, 4, 0, 0] }, label: { show: true, position: 'top', color: '#7a736a' } }],
    });
    BigData.renderChart('ana-pref', {
      color: BigData.PALETTE,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { ...BigData.GRID, top: 20 },
      xAxis: { type: 'category', data: agg.pref.map(t => t.name), ...BigData.AXIS },
      yAxis: { type: 'value', ...BigData.AXIS },
      series: [{ type: 'bar', data: agg.pref.map(t => t.value), barMaxWidth: 30, itemStyle: { color: '#c9a227', borderRadius: [4, 4, 0, 0] } }],
    });
  }

  /* ========== 日志审计（登录 / 浏览 / 操作） ========== */
  function logsInScope(type) {
    const sid = myShopId();
    const all = (DB.logs && DB.logs[type]) || [];
    if (sid == null) return all; // 平台管理员：全站日志
    if (type === 'views') {
      // 店长：只看本店商品的浏览行为
      const myIds = new Set(DB.products.filter(p => ensureShopId(p) === sid).map(p => p.id));
      return all.filter(v => myIds.has(v.productId));
    }
    if (type === 'ops') {
      // 店长：只看自己的操作日志
      return all.filter(o => o.userId === state.user.id);
    }
    return all; // 登录日志对店长展示全部（含自己的），用于教学演示
  }

  function renderAdminLogs() {
    const type = state.logsType;
    $$('#logs-tabs .chip').forEach(c => c.classList.toggle('active', c.dataset.lt === type));

    const rows = logsInScope(type).slice(0, 200);
    const thead = $('#logs-table thead');
    const tbody = $('#logs-table tbody');
    $('#logs-scope-note').textContent = isSuper()
      ? `平台管理员视角：展示全站日志（仅最新 200 条，可导出全部）`
      : `店长视角：展示与本店商品相关的浏览行为与本人操作日志`;

    if (type === 'logins') {
      thead.innerHTML = '<tr><th>时间</th><th>账号</th><th>角色</th><th>IP 地址</th><th>结果</th></tr>';
      tbody.innerHTML = rows.map(r => `<tr>
        <td class="muted">${fmtTime(r.time)}</td><td>${r.username}</td>
        <td>${r.role}</td><td>${r.ip}</td>
        <td>${r.ok ? '<span class="status PAID">成功</span>' : '<span class="status CANCELLED">失败</span>'}${r.note ? ` · ${r.note}` : ''}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="muted">暂无日志</td></tr>';
    } else if (type === 'views') {
      thead.innerHTML = '<tr><th>时间</th><th>浏览者</th><th>商品</th><th>类别</th><th>停留时长</th><th>IP 地址</th></tr>';
      tbody.innerHTML = rows.map(r => `<tr>
        <td class="muted">${fmtTime(r.time)}</td><td>${r.username || '游客'}</td>
        <td>${r.productName}</td><td>${r.category}</td>
        <td>${r.dwellSec}s</td><td>${r.ip}</td>
      </tr>`).join('') || '<tr><td colspan="6" class="muted">暂无日志</td></tr>';
    } else {
      thead.innerHTML = '<tr><th>时间</th><th>账号</th><th>角色</th><th>操作内容</th><th>详情</th><th>IP 地址</th></tr>';
      tbody.innerHTML = rows.map(r => `<tr>
        <td class="muted">${fmtTime(r.time)}</td><td>${r.username}</td>
        <td>${r.role}</td><td>${r.action}</td><td class="muted">${r.detail || '—'}</td><td>${r.ip}</td>
      </tr>`).join('') || '<tr><td colspan="6" class="muted">暂无日志</td></tr>';
    }
  }

  function exportLogsCSV() {
    const type = state.logsType;
    const rows = logsInScope(type);
    if (type === 'logins') {
      BigData.downloadCSV('登录日志.csv', ['时间', '账号', '角色', 'IP', '结果', '备注'],
        rows.map(r => [fmtTime(r.time), r.username, r.role, r.ip, r.ok ? '成功' : '失败', r.note || '']));
    } else if (type === 'views') {
      BigData.downloadCSV('浏览行为日志.csv', ['时间', '浏览者', '商品', '类别', '停留时长(秒)', 'IP'],
        rows.map(r => [fmtTime(r.time), r.username || '游客', r.productName, r.category, r.dwellSec, r.ip]));
    } else {
      BigData.downloadCSV('操作日志.csv', ['时间', '账号', '角色', '操作', '详情', 'IP'],
        rows.map(r => [fmtTime(r.time), r.username, r.role, r.action, r.detail || '', r.ip]));
    }
    toast('已导出 CSV');
  }

  function exportOrdersCSV() {
    const sid = myShopId();
    const rows = DB.orders.filter(o =>
      sid == null || (o.items || []).some(it => Number(it.shopId) === sid));
    BigData.downloadCSV('订单数据.csv',
      ['订单号', '用户', '金额', '状态', '支付方式', '收件邮箱', '下单时间', '商品明细'],
      rows.map(o => [
        o.orderNo, o.username || o.userId, o.totalAmount,
        STATUS[o.status] || o.status, o.payMethod, o.shippingEmail, fmtTime(o.createdAt),
        (o.items || []).map(i => `${i.productName}×${i.quantity}`).join('；'),
      ]));
    toast('已导出订单 CSV');
  }

  function exportProductsCSV() {
    const sid = myShopId();
    const rows = DB.products.filter(p => sid == null || ensureShopId(p) === sid);
    BigData.downloadCSV('商品数据.csv',
      ['ID', '名称', '分类', '价格', '库存', '累计销量', '状态', '店铺'],
      rows.map(p => [p.id, p.name, p.category, p.price, p.stock, p.sales || 0,
        p.status === 1 ? '在售' : '下架', shopById(ensureShopId(p)).name]));
    toast('已导出商品 CSV');
  }

  /* ========== 人员管理（销售人员 ID / 密码重置） ========== */
  function renderAdminStaff() {
    const staff = DB.users.filter(u => u.role === 'ADMIN' || u.role === 'SUPER');
    $('#staff-table tbody').innerHTML = staff.map(u => `
      <tr>
        <td>${u.id}</td>
        <td><strong>${u.username}</strong>${u.role === 'SUPER' ? ' <span class="status PENDING">平台管理员</span>' : ''}</td>
        <td>${u.nickname || '—'}</td>
        <td>${u.role === 'SUPER' ? '全站' : `${shopById(u.shopId).icon} ${shopById(u.shopId).name}`}</td>
        <td class="muted">${u.email || '—'}</td>
        <td>
          <div class="ops">
            <button class="btn small" data-pwd="${u.id}">重置密码</button>
            ${u.role === 'SUPER' ? '' : `<button class="btn small danger" data-del-staff="${u.id}">删除</button>`}
          </div>
        </td>
      </tr>
    `).join('');

    $$('#staff-table [data-pwd]').forEach(b => b.onclick = () => {
      const u = DB.users.find(x => x.id === Number(b.dataset.pwd));
      $('#pwd-user-id').value = u.id;
      $('#pwd-title').textContent = `重置密码 · ${u.username}`;
      $('#pwd-new').value = '';
      $('#pwd-modal').showModal();
    });
    $$('#staff-table [data-del-staff]').forEach(b => b.onclick = async () => {
      const u = DB.users.find(x => x.id === Number(b.dataset.delStaff));
      const yes = await confirmDialog({
        title: '删除销售人员',
        message: `确定删除账号「${u.username}」（${shopById(u.shopId).name}）吗？`,
        okText: '删除', danger: true,
      });
      if (!yes) return;
      try {
        api.deleteSales(u.id);
        toast('已删除');
        renderAdminStaff();
      } catch (e) { toast(e.message); }
    });
  }

  function openStaffModal() {
    $('#staff-form').reset();
    $('#s-shop').innerHTML = shops().map(s => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join('');
    $('#staff-modal').showModal();
  }

  /* ========== 商品类别管理 ========== */
  function renderCatList() {
    $('#cat-list').innerHTML = cats().map(c => {
      const used = DB.products.filter(p => p.category === c).length;
      return `<div class="cat-row">
        <span><strong>${c}</strong> <small class="muted">${used} 件商品</small></span>
        <button type="button" class="btn small danger" data-del-cat="${c}" ${used ? 'disabled title="类别下仍有商品，不可删除"' : ''}>删除</button>
      </div>`;
    }).join('');
    $$('#cat-list [data-del-cat]').forEach(b => b.onclick = () => {
      try {
        api.removeCategory(b.dataset.delCat);
        toast('类别已删除');
        afterCatChange();
      } catch (e) { toast(e.message); }
    });
  }
  function afterCatChange() {
    renderCatList();
    renderChannels();
    renderProducts && state.view === 'products' && renderProducts();
    saveDB(DB);
  }

  /* ========== 登录 / 注册 ========== */
  function bindAuth() {
    $('#form-login').onsubmit = e => {
      e.preventDefault();
      try {
        state.user = api.login({
          username: $('#login-username').value.trim(),
          password: $('#login-password').value,
        });
        persistSession();
        renderAuthBar();
        toast(`欢迎回来，${state.user.nickname || state.user.username}`);
        show(isStaff() ? 'admin' : 'home');
      } catch (err) {
        toast(err.message);
      }
    };

    $('#form-register').onsubmit = e => {
      e.preventDefault();
      try {
        state.user = api.register({
          username: $('#reg-username').value.trim(),
          password: $('#reg-password').value,
          email: $('#reg-email').value.trim(),
          nickname: $('#reg-nickname').value.trim(),
        });
        persistSession();
        renderAuthBar();
        toast('注册成功，欢迎加入拾光优选');
        show('home');
      } catch (err) {
        toast(err.message);
      }
    };

    $$('[data-demo]').forEach(b => b.onclick = () => {
      const u = b.dataset.demo;
      $('#login-username').value = u;
      $('#login-password').value = '123456';
      $('#form-login').requestSubmit();
    });

    $('#btn-logout').onclick = () => {
      api.logout();
      renderAuthBar();
      toast('已退出登录');
      show('home');
    };
  }

  /* ========== 全局事件 ========== */
  function bindGlobal() {
    document.addEventListener('click', e => {
      const nav = e.target.closest('[data-nav]');
      if (nav) {
        e.preventDefault();
        show(nav.dataset.nav);
      }
      const hot = e.target.closest('[data-hot]');
      if (hot) {
        e.preventDefault();
        state.keyword = hot.dataset.hot;
        state.category = '';
        state.page = 1;
        $('#global-search').value = state.keyword;
        show('products');
      }
      const cat = e.target.closest('#btn-all-cats');
      if (cat) {
        state.category = '';
        show('products');
      }
    });

    $('#btn-search').onclick = () => {
      state.keyword = $('#global-search').value.trim();
      state.category = '';
      state.page = 1;
      if (state.searchMode === 'shop') {
        show('shops');
      } else {
        show('products');
      }
    };
    $('#global-search').addEventListener('keydown', e => {
      if (e.key === 'Enter') $('#btn-search').click();
    });

    $('#btn-cart').onclick = openDrawer;
    $('#drawer-close').onclick = closeDrawer;
    $('#drawer-mask').onclick = closeDrawer;

    $('#btn-product-new').onclick = () => openProductModal();
    $('#btn-product-cancel').onclick = () => $('#product-modal').close();
    $('#product-form').onsubmit = e => {
      e.preventDefault();
      const data = {
        name: $('#p-name').value.trim(),
        price: $('#p-price').value,
        stock: $('#p-stock').value,
        category: $('#p-category').value,
        description: $('#p-desc').value.trim(),
        status: $('#p-status').value,
        shopId: $('#p-shop') ? $('#p-shop').value : 1,
        image: $('#p-image') ? $('#p-image').value : '',
      };
      const id = $('#p-id').value;
      try {
        if (id) {
          api.updateProduct(Number(id), data);
          toast('商品已更新');
        } else {
          api.createProduct(data);
          toast('商品已添加');
        }
        $('#product-modal').close();
        renderAdminProducts();
        renderAdmin();
      } catch (err) { toast(err.message); }
    };

    $('#btn-admin-search').onclick = () => {
      state.adminKeyword = $('#admin-q').value.trim();
      state.adminPage = 1;
      renderAdminProducts();
    };
    $('#admin-q').addEventListener('keydown', e => {
      if (e.key === 'Enter') $('#btn-admin-search').click();
    });
    $('#btn-admin-order-search').onclick = () => {
      state.adminOrderStatus = $('#admin-order-status').value;
      renderAdminOrders();
    };

    $$('#admin-tabs .tab').forEach(t => {
      t.onclick = () => switchAdminTab(t.dataset.tab);
    });

    // shop quick entry in channel nav
    const shopEntry = document.createElement('button');
    shopEntry.textContent = '店铺';
    shopEntry.onclick = () => {
      state.searchMode = 'shop';
      state.keyword = '';
      $('#global-search').value = '';
      $$('.stab').forEach(t => t.classList.toggle('active', t.dataset.stab === 'shop'));
      show('shops');
    };
    $('#channel-cats').appendChild(shopEntry);

    // search mode tabs
    $$('.stab').forEach(tab => {
      tab.onclick = () => {
        $$('.stab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.searchMode = tab.dataset.stab === 'shop' ? 'shop' : 'product';
        $('#global-search').placeholder = state.searchMode === 'shop'
          ? '搜索店铺名称，如：数码 / 书屋'
          : '搜索商品名称、分类，如：耳机 / 数码';
      };
    });

    /* ===== 课程设计新增控件绑定 ===== */
    // 商品管理工具条：类别管理
    $('#btn-cat-mgr').onclick = () => { renderCatList(); $('#cat-modal').showModal(); };
    $('#btn-cat-close').onclick = () => $('#cat-modal').close();
    $('#cat-form').onsubmit = e => {
      e.preventDefault();
      try {
        api.addCategory($('#cat-new').value);
        $('#cat-new').value = '';
        renderCatList();
        toast('类别已添加');
      } catch (err) { toast(err.message); }
    };

    // 数据分析页：粒度 / 排行口径 / 导出 / 手动刷新
    $$('#ana-granularity .chip').forEach(c => c.onclick = () => {
      state.anaGranularity = c.dataset.g;
      $$('#ana-granularity .chip').forEach(x => x.classList.toggle('active', x === c));
      renderAnalyticsTrend();
    });
    $$('#ana-rank-by .chip').forEach(c => c.onclick = () => {
      state.anaRankBy = c.dataset.by;
      $$('#ana-rank-by .chip').forEach(x => x.classList.toggle('active', x === c));
      renderAnalyticsRank();
    });
    $('#btn-ana-refresh').onclick = () => { renderAnalyticsKpis(); renderAnalyticsRealtime(); };
    $('#btn-export-orders').onclick = exportOrdersCSV;
    $('#btn-export-products').onclick = exportProductsCSV;

    // 日志审计页：类型切换 / 导出
    $$('#logs-tabs .chip').forEach(c => c.onclick = () => {
      state.logsType = c.dataset.lt;
      renderAdminLogs();
    });
    $('#btn-export-logs').onclick = exportLogsCSV;

    // 人员管理：添加 / 重置密码弹窗
    $('#btn-staff-new').onclick = openStaffModal;
    $('#btn-staff-cancel').onclick = () => $('#staff-modal').close();
    $('#staff-form').onsubmit = e => {
      e.preventDefault();
      try {
        api.addSales({
          username: $('#s-username').value.trim(),
          password: $('#s-password').value,
          nickname: $('#s-nickname').value.trim(),
          shopId: $('#s-shop').value,
        });
        $('#staff-modal').close();
        toast('销售人员已添加');
        renderAdminStaff();
      } catch (err) { toast(err.message); }
    };
    $('#btn-pwd-cancel').onclick = () => $('#pwd-modal').close();
    $('#pwd-form').onsubmit = e => {
      e.preventDefault();
      try {
        const u = api.resetSalesPassword(Number($('#pwd-user-id').value), $('#pwd-new').value);
        $('#pwd-modal').close();
        toast(`「${u.username}」密码已重置`);
        renderAdminStaff();
      } catch (err) { toast(err.message); }
    };

    // channel category buttons already bound in renderChannels
  }

  /* ========== 启动 ========== */
  function stripAiMarks() {
    document.querySelectorAll('[data-aigc-mark]').forEach(el => el.remove());
    document.querySelectorAll('body > p').forEach(el => {
      if ((el.textContent || '').trim() === 'AI生成') el.remove();
    });
  }

  function init() {
    stripAiMarks();
    renderChannels();
    bindGlobal();
    bindAuth();
    renderAuthBar();
    show('home');
  }

  init();
})();
