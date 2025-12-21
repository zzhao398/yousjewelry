// miniprogram/utils/busiApi.js
//
// 统一封装所有“业务 API”，在这里做：
//   - wx.cloud.callFunction 封装（通过 request.js 里的 call）
//   - 结果缓存（TTL）
//   - 尽量保证所有页面只关心数据，不关心缓存实现
//

const { call } = require('./request');
const app = getApp();

// =======================
// TTL 规则
// =======================

// 短缓存：5 分钟
// - 订单列表（orders.list）
// - 订单详情（orders.detail）
// - 主播信息管理（admin.anchors.list 等）
const TTL_SHORT = 5 * 60 * 1000;

// 长缓存：10 分钟
// - 当前用户信息（users.me）
// - 首页概况（dashboard.summary）
// - 其它“不是特别敏感，需要经常刷新的”数据
const TTL_LONG = 10 * 60 * 1000;

// 防御式初始化全局缓存对象
function ensureGlobalCache() {
  if (!app.globalData) app.globalData = {};
  const g = app.globalData;

  g.meCache = g.meCache || null;                 // { data, cachedAt }
  g.dashboardCache = g.dashboardCache || null;   // { data, cachedAt }

  g.orderCache = g.orderCache || {};             // key -> { data, cachedAt }
  g.orderDetailCache = g.orderDetailCache || {}; // oid -> { data, cachedAt }

  g.anchorListCache = g.anchorListCache || null; // { data, cachedAt }

  return g;
}

// =======================
// 用户信息：users.me（10 分钟）
// =======================

function getMe() {
  const g = ensureGlobalCache();
  const now = Date.now();

  if (g.meCache && now - g.meCache.cachedAt < TTL_LONG) {
    return Promise.resolve(g.meCache.data);
  }

  return call('users.me').then((res) => {
    g.meCache = {
      data: res,
      cachedAt: Date.now(),
    };
    return res;
  });
}

// =======================
// 首页概况：dashboard.summary（10 分钟）
// =======================

function getDashboardSummary() {
  const g = ensureGlobalCache();
  const now = Date.now();

  if (g.dashboardCache && now - g.dashboardCache.cachedAt < TTL_LONG) {
    return Promise.resolve(g.dashboardCache.data);
  }

  return call('dashboard.summary').then((res) => {
    g.dashboardCache = {
      data: res,
      cachedAt: Date.now(),
    };
    return res;
  });
}

// =======================
// 订单列表：orders.list（第一页 5 分钟缓存）
// =======================

function getOrders(params = {}) {
  const g = ensureGlobalCache();
  const isFirstPage = !params.page || params.page === 1;

  // 只有第一页用缓存，其它页直接打云函数
  if (!isFirstPage) {
    return call('orders.list', params);
  }

  const now = Date.now();

  // 只用 status + keyword 做 key（可按需再加条件）
  const key = JSON.stringify({
    status: params.status || 'all',
    keyword: (params.keyword || '').trim(),
    anchorId: params.anchorId || '',
    channelType: params.channelType || '',
  });

  const cached = g.orderCache[key];
  if (cached && now - cached.cachedAt < TTL_SHORT) {
    return Promise.resolve(cached.data);
  }

  return call('orders.list', params).then((res) => {
    g.orderCache[key] = {
      data: res,
      cachedAt: Date.now(),
    };
    return res;
  });
}

// =======================
// 订单详情：orders.detail（按 oid 5 分钟缓存）
// 调用方式：getOrderDetail(oid)
// =======================

function getOrderDetail(oid) {
  const g = ensureGlobalCache();
  const now = Date.now();
  const key = String(oid || '').trim();

  if (!key) {
    return Promise.reject(new Error('MISSING_OID'));
  }

  const cached = g.orderDetailCache[key];
  if (cached && now - cached.cachedAt < TTL_SHORT) {
    return Promise.resolve(cached.data);
  }

  return call('orders.detail', { oid: key }).then((res) => {
    g.orderDetailCache[key] = {
      data: res,
      cachedAt: Date.now(),
    };
    return res;
  });
}

// =======================
// 注册 / 登录（不缓存）
// =======================

const registerUser = (params) => call('users.register', params || {});
const login = (loginAccount, password) =>
  call('users.login', { loginAccount, password });

// =======================
// 管理后台：
//   1) 待审核主播列表（users.listPending）—— 不缓存（随时最新）
//   2) 主播信息管理列表（admin.anchors.list）—— 5 分钟缓存
// =======================

const listPendingUsers = () => call('users.listPending');

// 审核用户（通过 / 拒绝）
const approveUser = (params) =>
  call('users.approve', params || {});


  function listAnchors() {
    const g = ensureGlobalCache();
    const now = Date.now();
  
    if (g.anchorListCache && now - g.anchorListCache.cachedAt < TTL_SHORT) {
      return Promise.resolve(g.anchorListCache.data);
    }
  
    return call('admin.anchors.list').then((res) => {
      g.anchorListCache = {
        data: res,
        cachedAt: Date.now(),
      };
      return res;
    });
  }

// 设置主播绑定商品：写操作，不缓存
const setAnchorProducts = (anchorId, productIds) =>
  call('admin.anchor.setProducts', { anchorId, productIds });

// ========== 如果以后有“写操作”，可以顺带清理相关缓存 ==========
function clearAllCaches() {
  const g = ensureGlobalCache();
  g.meCache = null;
  g.dashboardCache = null;
  g.orderCache = {};
  g.orderDetailCache = {};
  g.anchorListCache = null;
}

// 例如：登录 / 退出登录后可以主动清一下缓存：
// login(...).then(res => { clearAllCaches(); return res; });

module.exports = {
  getMe,
  getOrders,
  getOrderDetail,
  getDashboardSummary,
  registerUser,
  login,
  listPendingUsers,
  listAnchors,
  setAnchorProducts,
  clearAllCaches,
  approveUser,
};
