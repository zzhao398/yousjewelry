// cloudfunctions/backendFunction/index.js
//
// 职责：
//   - 作为小程序前端的统一 API 入口：前端只调用这个云函数
//   - 根据 event.action 分发到具体 handler
//   - 在这里做：
//       * 用户角色识别（管理员 / 主播）
//       * 节流
//       * 返回统一格式 { code, msg, data }
//
// 维护要点：
//   - 如果要新增前端接口，只需要：
//       1) 写一个 handleXXX 函数
//       2) 在 switch(action) 里加一个 case
//   - 主播看不到邮箱的逻辑写在这里（列表/详情统一控制）
//

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const crypto = require('crypto');

const { initLogger, log, LEVEL } = require('./utils/logger');

initLogger(db);

const USERS_COLL = 'users';

/* ---------- 掩码工具 ---------- */

const maskEmail = (email = '') => {
  const [name, domain] = String(email).split('@');
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name[0] || ''}***@${domain}`;
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
};

const maskPhone = (phone = '') => {
  const s = String(phone).replace(/\s+/g, '');
  if (s.length <= 4) return '****';
  return s.slice(0, 3) + '****' + s.slice(-2);
};

const maskIp = (ip = '') => {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.***.${parts[3]}`;
};

/* ---------- 密码工具 ---------- */

// 生成随机盐：16 字节 → 32 位 hex 字符串
const generateSalt = () => crypto.randomBytes(16).toString('hex');

// 带盐的密码哈希：sha256(password + ':' + salt)
const hashPassword = (plain, salt) =>
  crypto
    .createHash('sha256')
    .update(String(plain) + ':' + String(salt))
    .digest('hex');

// 兼容旧数据：无盐哈希
const hashPasswordLegacy = (plain) =>
  crypto.createHash('sha256').update(String(plain)).digest('hex');

/* ---------- 用户工具 ---------- */

const toSafeUser = (doc = {}) => ({
  _id: doc._id,
  openid: doc.openid || '',
  role: doc.role || 'anchor',
  status: doc.status || 'pending', // pending / approved / rejected / unregistered
  displayName: doc.displayName || '',
  realName: doc.realName || '',
  loginAccount: doc.loginAccount || '',
  phone: doc.phone || '',
  email: doc.email || '',
  platform: doc.platform || '',
  accountId: doc.accountId || '',
  remark: doc.remark || '',
});

const getOpenId = () => cloud.getWXContext().OPENID;

// 根据 openid 找用户（用于自动登录）
const getUserByOpenId = async (openid) => {
  const { data } = await db
    .collection(USERS_COLL)
    .where({ openid })
    .limit(1)
    .get();
  return data[0] || null;
};

// 根据账号（手机号/邮箱）找用户
const getUserByLoginAccount = async (loginAccount) => {
  const { data } = await db
    .collection(USERS_COLL)
    .where({ loginAccount })
    .limit(1)
    .get();
  return data[0] || null;
};

// 简单角色信息（owner/admin/anchor）
const getUserRole = async () => {
  const openid = getOpenId();
  const { data } = await db.collection('users').where({ openid }).limit(1).get();

  if (!data.length) {
    return { openid, role: 'anchor', anchorId: null, displayName: '' };
  }

  const u = data[0];
  return {
    openid,
    role: u.role || 'anchor',
    anchorId: u.anchorId || null,
    displayName: u.displayName || '',
  };
};

/* ---------- 节流 ---------- */

const checkThrottle = async (key, ms = 5000) => {
  const coll = db.collection('throttle');
  const now = Date.now();
  const { data } = await coll.where({ key }).limit(1).get();
  if (!data.length) {
    await coll.add({ data: { key, last: now } });
    return true;
  }
  const last = data[0].last || 0;
  if (now - last < ms) return false;
  await coll.doc(data[0]._id).update({ data: { last: now } });
  return true;
};

/* =========================================================
 * 一、管理员：主播列表 + PID 映射
 * =======================================================*/

// 列出所有已通过的主播 + 当前绑定的 productId 列表
const handleAdminAnchorsList = async () => {
  const me = await getUserRole();
  if (!['owner', 'admin'].includes(me.role)) {
    throw new Error('ADMIN_ONLY');
  }

  const usersColl = db.collection('users');
  const mapColl = db.collection('anchor_product_map');

  const { data: anchors } = await usersColl
    .where({ role: 'anchor', status: 'approved' })
    .orderBy('createdAt', 'asc')
    .get();

  if (!anchors.length) return { list: [] };

  const anchorIds = anchors.map((a) => a.anchorId).filter(Boolean);

  let bindMap = {};
  if (anchorIds.length) {
    const { data: binds } = await mapColl
      .where({ anchorId: _.in(anchorIds) })
      .get();

    bindMap = binds.reduce((acc, row) => {
      if (!row.anchorId || !row.productId) return acc;
      const aid = row.anchorId;
      const pid = String(row.productId).trim();
      if (!pid) return acc;
      if (!acc[aid]) acc[aid] = new Set();
      acc[aid].add(pid);
      return acc;
    }, {});
  }

  const list = anchors.map((a) => {
    const set = bindMap[a.anchorId] || new Set();
    const ids = Array.from(set);
    return {
      ...a,
      productIds: ids,
      productIdsStr: ids.join(','),
    };
  });

  return { list };
};

// 保存主播的 PID 绑定（整替）
const handleAdminAnchorSetProducts = async (event = {}) => {
  const { anchorId, productIds } = event;
  if (!anchorId) throw new Error('MISSING_ANCHOR_ID');

  const me = await getUserRole();
  if (!['owner', 'admin'].includes(me.role)) {
    throw new Error('ADMIN_ONLY');
  }

  const coll = db.collection('anchor_product_map');
  const now = Date.now();

  const ids = (Array.isArray(productIds) ? productIds : [])
    .map((s) => String(s || '').trim())
    .filter(Boolean);

  // 清掉旧的
  await coll.where({ anchorId }).remove();

  // 插入新的
  for (const pid of ids) {
    await coll.add({
      data: {
        productId: pid,
        productName: '',
        anchorId,
        anchorName: '',
        commissionRate: 0,
        visibleToAnchors: true,
        priority: 1,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  return { ok: true, count: ids.length };
};

// 工具：一次性拉取全部 anchor_product_map
const fetchAllAnchorMap = async () => {
  const coll = db.collection('anchor_product_map');
  const MAX_LIMIT = 100;

  const countRes = await coll.count();
  const total = countRes.total || 0;
  if (!total) return [];

  const batchTimes = Math.ceil(total / MAX_LIMIT);
  const tasks = [];

  for (let i = 0; i < batchTimes; i++) {
    tasks.push(
      coll
        .skip(i * MAX_LIMIT)
        .limit(MAX_LIMIT)
        .get()
    );
  }

  const results = await Promise.all(tasks);
  let all = [];
  results.forEach((res) => {
    all = all.concat(res.data || []);
  });
  return all;
};

/* ---------- 工具：一次性拉取 orders_slim ---------- */

const fetchAllOrdersSlim = async (where = {}) => {
  const coll = db.collection('orders_slim');
  const MAX_LIMIT = 100;

  const countRes = await coll.where(where).count();
  const total = countRes.total || 0;
  if (!total) return [];

  const batchTimes = Math.ceil(total / MAX_LIMIT);
  const tasks = [];

  for (let i = 0; i < batchTimes; i++) {
    tasks.push(
      coll
        .where(where)
        .skip(i * MAX_LIMIT)
        .limit(MAX_LIMIT)
        .get()
    );
  }

  const results = await Promise.all(tasks);
  let all = [];
  results.forEach((res) => {
    all = all.concat(res.data || []);
  });

  return all;
};

/* ---------- A. 全量重建：按 map 重算所有订单的 anchorIdList ---------- */

const handleAdminOrdersRebuildAnchorsFromMap = async () => {
  const me = await getUserRole();
  if (!['owner', 'admin'].includes(me.role)) {
    throw new Error('ADMIN_ONLY');
  }

  const mapRows = await fetchAllAnchorMap();
  const prodToAnchors = new Map(); // pid -> Set(anchorId)

  mapRows.forEach((row) => {
    const pid = String(row.productId || '').trim();
    const aid = String(row.anchorId || '').trim();
    if (!pid || !aid) return;
    if (!prodToAnchors.has(pid)) {
      prodToAnchors.set(pid, new Set());
    }
    prodToAnchors.get(pid).add(aid);
  });

  const coll = db.collection('orders_slim');
  const MAX_LIMIT = 50;
  const countRes = await coll.count();
  const total = countRes.total || 0;
  if (!total) return { total: 0, updated: 0 };

  const batchTimes = Math.ceil(total / MAX_LIMIT);
  let updated = 0;

  for (let i = 0; i < batchTimes; i++) {
    const { data: orders } = await coll
      .skip(i * MAX_LIMIT)
      .limit(MAX_LIMIT)
      .get();

    const tasks = (orders || []).map((order) => {
      const pidList = order.pidList || [];
      const anchorSet = new Set();

      (pidList || []).forEach((pid) => {
        const p = String(pid || '').trim();
        const set = prodToAnchors.get(p);
        if (set) {
          set.forEach((aid) => anchorSet.add(aid));
        }
      });

      const newAnchorList = Array.from(anchorSet);
      const visibleToAnchors = newAnchorList.length > 0;

      updated += 1;

      return coll.doc(order._id).update({
        data: {
          anchorIdList: newAnchorList,
          visibleToAnchors,
        },
      });
    });

    await Promise.all(tasks);
  }

  return { total, updated };
};

/* ---------- B. 单个主播：基于 map 回填历史订单（针对该主播） ---------- */

const handleAdminAnchorBackfillOrders = async (event = {}) => {
  const { anchorId } = event;
  if (!anchorId) throw new Error('MISSING_ANCHOR_ID');

  const me = await getUserRole();
  if (!['owner', 'admin'].includes(me.role)) {
    throw new Error('ADMIN_ONLY');
  }

  const mapColl = db.collection('anchor_product_map');
  const ordersColl = db.collection('orders_slim');

  const { data: binds } = await mapColl.where({ anchorId }).get();
  const pidList = (binds || [])
    .map((b) => String(b.productId || '').trim())
    .filter(Boolean);

  if (!pidList.length) {
    return { updated: 0, total: 0, msg: 'NO_PID_BOUND_TO_ANCHOR' };
  }

  const countRes = await ordersColl
    .where({ pidList: _.in(pidList) })
    .count();
  const total = countRes.total || 0;
  if (!total) return { updated: 0, total };

  const MAX_LIMIT = 100;
  const batchTimes = Math.ceil(total / MAX_LIMIT);

  let updated = 0;

  for (let i = 0; i < batchTimes; i++) {
    const { data: orders } = await ordersColl
      .where({ pidList: _.in(pidList) })
      .skip(i * MAX_LIMIT)
      .limit(MAX_LIMIT)
      .get();

    for (const order of orders) {
      const oldList = Array.isArray(order.anchorIdList)
        ? order.anchorIdList
        : [];

      if (oldList.includes(anchorId)) continue;

      const newList = Array.from(new Set([...oldList, anchorId]));

      await ordersColl.doc(order._id).update({
        data: {
          anchorIdList: newList,
          visibleToAnchors: true,
        },
      });

      updated += 1;
    }
  }

  return { updated, total };
};

/* =========================================================
 * 二、订单列表 / 详情
 * =======================================================*/

const handleOrdersList = async (event = {}) => {
  const {
    page = 1,
    pageSize = 20,
    status,
    dateRange,
    keyword = '',
    searchType = 'auto',
    anchorId: filterAnchorId,
    channelType,
  } = event;

  const { role, anchorId } = await getUserRole();
  const coll = db.collection('orders_slim');
  const where = {};

  // 1) 状态过滤
  switch (status) {
    case 'unshipped':
      where.shippingStatus = 'unshipped';
      where.paymentStatus = 'paid';
      break;
    case 'paid':
      where.paymentStatus = 'paid';
      break;
    case 'unpaid':
      where.paymentStatus = _.neq('paid');
      break;
    case 'shipped':
      where.shippingStatus = 'shipped';
      break;
    case 'pending':
      where.paymentStatus = 'paid';
      where.shippingStatus = 'unshipped';
      break;
    default:
      break;
  }

  // 2) 时间区间
  if (dateRange && dateRange.start && dateRange.end) {
    where.orderCreatedAt = _.gte(dateRange.start).and(_.lte(dateRange.end));
  }

  // 3) 关键字搜索
  const kw = (keyword || '').trim();
  if (kw) {
    let t = searchType;
    if (t === 'auto') {
      if (kw.includes('@')) t = 'email';
      else if (/^[0-9]+$/.test(kw)) t = 'oid';
      else t = 'pid';
    }

    if (t === 'oid') {
      where.oid = kw;
    } else if (t === 'email') {
      if (role !== 'admin') {
        throw new Error('ANCHOR_CANNOT_SEARCH_EMAIL');
      }
      where.customerEmail = _.regex({
        regexp: kw,
        options: 'i',
      });
    } else if (t === 'pid') {
      where.pidList = _.elemMatch(_.eq(kw));
    } else if (t === 'country') {
      where.customerCountry = kw;
    }
  }

  // 4) 角色控制
  if (role === 'anchor') {
    if (!anchorId) {
      return { list: [], page, pageSize, role };
    }
    where.anchorIdList = _.elemMatch(_.eq(anchorId));
    where.visibleToAnchors = true;
  } else if (role === 'admin') {
    if (filterAnchorId) {
      where.anchorIdList = _.elemMatch(_.eq(filterAnchorId));
    }
    if (channelType) {
      where.channelType = channelType;
    }
  }

  const skip = (page - 1) * pageSize;
  const { data } = await coll
    .where(where)
    .field({
      items: false,
      adminNote: false,
      customerNote: false,
      paySerialNumber: false,
      shippingAddress: false,
    })
    .orderBy('orderCreatedAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  const safeList =
    role === 'admin'
      ? data
      : data.map((it) => ({
          ...it,
          customerEmail: maskEmail(it.customerEmail || ''),
          customerCountry: it.customerCountry || '',
          customerIp: it.customerIp ? maskIp(it.customerIp) : '',
        }));

  return { list: safeList, page, pageSize, role };
};

// 订单详情
const handleOrdersDetail = async (event = {}) => {
  let rawOid = event.oid;

  if (rawOid && typeof rawOid === 'object') {
    rawOid =
      rawOid.oid ||
      rawOid.OId ||
      rawOid.id ||
      rawOid._id ||
      '';
  }

  const oid = String(rawOid || '').trim();
  if (!oid) return null;

  const { role } = await getUserRole();
  const coll = db.collection('orders_slim');

  const { data } = await coll
    .where(_.or([{ oid }, { _id: oid }]))
    .limit(1)
    .get();

  log({
    level: LEVEL.INFO,
    action: 'orders.detail.debug',
    message: 'db_result',
    data: { query_oid: oid, hit: data.length },
    openid: getOpenId(),
  });

  if (!data.length) return null;

  const order = data[0];
  if (role === 'admin') return order;

  return {
    ...order,
    customerEmail: maskEmail(order.customerEmail || ''),
    customerCountry: order.customerCountry || '',
    customerIp: order.customerIp ? maskIp(order.customerIp) : '',
    shippingAddress: '（仅管理员可见）',
  };
};

/* =========================================================
 * 三、首页概况 / 高级统计
 * =======================================================*/

const handleDashboardSummary = async (event) => {
  const { role, anchorId } = await getUserRole();

  const now = new Date();
  const startOfDay = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000,
  );

  const where = { orderCreatedAt: _.gte(startOfDay),
    paymentStatus: 'paid',};

  if (role === 'anchor') {
    where.anchorIdList = _.elemMatch(_.eq(anchorId));
    where.visibleToAnchors = true;
  } else if (role === 'admin') {
    if (event && event.anchorId) {
      where.anchorIdList = _.elemMatch(_.eq(event.anchorId));
    }
    if (event && event.channelType) {
      where.channelType = event.channelType;
    }
  }

  const { data } = await db.collection('orders_slim').where(where).get();

  const summary = data.reduce(
    (acc, o) => {
      acc.orderCount += 1;
      acc.gmv += Number(o.orderTotalPrice || 0);
      if (o.shippingStatus === 'unshipped' && o.paymentStatus === 'paid') {
        acc.toShipCount += 1;
      }
      return acc;
    },
    { orderCount: 0, gmv: 0, toShipCount: 0 },
  );

  return { ...summary, role };
};

const handleDashboardMetrics = async (event) => {
  const { role, anchorId } = await getUserRole();
  if (!['owner', 'admin', 'anchor'].includes(role)) {
    throw new Error('NO_PERMISSION');
  }

  const {
    dateRange = {},
    groupBy = 'day', // 'day' | 'anchor'
  } = event || {};

  const where = {};

  if (dateRange.startSec && dateRange.endSec) {
    where.orderCreatedAt = _.gte(dateRange.startSec).and(_.lte(dateRange.endSec));
  }

  where.paymentStatus = 'paid';

  if (role === 'anchor') {
    where.anchorIdList = _.elemMatch(_.eq(anchorId));
    where.visibleToAnchors = true;
  }

  const data = await fetchAllOrdersSlim(where);

  if (groupBy === 'anchor') {
    if (role === 'anchor') {
      throw new Error('ANCHOR_CANNOT_VIEW_ANCHOR_RANKING');
    }

    const anchorStatsMap = new Map();
    data.forEach((o) => {
      const anchors = o.anchorIdList || [];
      const amt = Number(o.orderTotalPrice || 0);
      const commission = Number(o.anchorCommissionAmount || 0);

      if (!anchors.length) {
        const prev = anchorStatsMap.get('organic') || {
          anchorId: 'organic',
          orderCount: 0,
          gmv: 0,
          commission: 0,
        };
        prev.orderCount += 1;
        prev.gmv += amt;
        anchorStatsMap.set('organic', prev);
      } else {
        anchors.forEach((aid) => {
          const prev = anchorStatsMap.get(aid) || {
            anchorId: aid,
            orderCount: 0,
            gmv: 0,
            commission: 0,
          };
          prev.orderCount += 1;
          prev.gmv += amt;
          prev.commission += commission / anchors.length;
          anchorStatsMap.set(aid, prev);
        });
      }
    });

    const anchorStats = Array.from(anchorStatsMap.values());
    return { groupBy: 'anchor', anchorStats };
  }

  const dayStatsMap = new Map();
  data.forEach((o) => {
    const day = o.orderDate || 'unknown';
    const prev = dayStatsMap.get(day) || {
      day,
      orderCount: 0,
      gmv: 0,
      commission: 0,
    };
    prev.orderCount += 1;
    prev.gmv += Number(o.orderTotalPrice || 0);
    prev.commission += Number(o.anchorCommissionAmount || 0);
    dayStatsMap.set(day, prev);
  });

  const dayStats = Array.from(dayStatsMap.values()).sort((a, b) =>
    a.day.localeCompare(b.day),
  );

  return { groupBy: 'day', dayStats };
};

/* =========================================================
 * 四、用户：me / register / login / 审核
 * =======================================================*/

const handleUsersMe = async () => {
  const openid = getOpenId();
  const doc = await getUserByOpenId(openid);

  if (!doc) {
    return {
      loggedIn: false,
      status: 'unregistered',
      role: 'guest',
      openid,
    };
  }

  return {
    loggedIn: true,
    ...toSafeUser(doc),
  };
};

const handleUsersRegister = async (event = {}) => {
  const {
    role = 'anchor',
    realName = '',
    displayName = '',
    loginAccount = '',
    password = '',
    phone = '',
    email = '',
    platform = '',
    accountId = '',
    remark = '',
  } = event || {};

  if (!loginAccount || !password) {
    throw new Error('登录账号和密码不能为空');
  }
  if (!realName) {
    throw new Error('请填写姓名');
  }

  const now = Math.floor(Date.now() / 1000);
  const usersColl = db.collection(USERS_COLL);

  const existByAccount = await getUserByLoginAccount(loginAccount);
  const openid = getOpenId();

  const salt = generateSalt();

  const baseDoc = {
    openid,
    loginAccount,
    passwordSalt: salt,
    passwordHash: hashPassword(password, salt),
    requestedRole: role,
    role: role === 'admin' ? 'admin' : 'anchor',
    status: 'pending',

    realName,
    displayName: displayName || realName,
    phone,
    email,
    platform,
    accountId,
    remark,

    updatedAt: now,
  };

  if (!existByAccount) {
    await usersColl.add({
      data: {
        ...baseDoc,
        createdAt: now,
      },
    });
  } else {
    await usersColl.doc(existByAccount._id).update({
      data: baseDoc,
    });
  }

  return { ok: true };
};

const handleUsersLogin = async (event = {}) => {
  const { loginAccount = '', password = '' } = event || {};
  if (!loginAccount || !password) {
    throw new Error('请输入账号和密码');
  }

  const user = await getUserByLoginAccount(loginAccount);
  if (!user) {
    throw new Error('账号不存在');
  }

  let inputHash;
  if (user.passwordSalt) {
    inputHash = hashPassword(password, user.passwordSalt);
  } else {
    inputHash = hashPasswordLegacy(password);
  }

  if (user.passwordHash !== inputHash) {
    throw new Error('密码错误');
  }

  const openid = getOpenId();
  const now = Math.floor(Date.now() / 1000);

  await db
    .collection(USERS_COLL)
    .doc(user._id)
    .update({
      data: { openid, updatedAt: now },
    });

  const refreshed = { ...user, openid };

  return {
    loggedIn: true,
    ...toSafeUser(refreshed),
  };
};

const handleUsersListPending = async () => {
  const me = await getUserRole();

  if (!['owner', 'admin'].includes(me.role)) {
    throw new Error('ADMIN_ONLY');
  }

  const where = { status: 'pending' };

  if (me.role === 'admin') {
    where.requestedRole = 'anchor';
  }

  const { data } = await db
    .collection('users')
    .where(where)
    .orderBy('createdAt', 'asc')
    .get();

  return { list: data };
};

const handleUsersApprove = async (event = {}) => {
  const { userId, approve, role, anchorId } = event || {};
  if (!userId) throw new Error('MISSING_USER_ID');

  const me = await getUserRole();
  if (!['owner', 'admin'].includes(me.role)) {
    throw new Error('ADMIN_ONLY');
  }

  if (role === 'admin' && me.role !== 'owner') {
    throw new Error('ONLY_OWNER_CAN_APPROVE_ADMIN');
  }
  if (role === 'anchor' && !['owner', 'admin'].includes(me.role)) {
    throw new Error('NO_PERMISSION_FOR_ANCHOR');
  }

  const now = Math.floor(Date.now() / 1000);
  const usersColl = db.collection('users');

  const updateData = {
    status: approve ? 'approved' : 'rejected',
    approvedBy: me.openid,
    approvedAt: now,
  };

  if (approve) {
    if (role) {
      updateData.role = role;
    }
    if (role === 'anchor' && anchorId) {
      updateData.anchorId = anchorId;
    }
  }

  await usersColl.doc(userId).update({ data: updateData });

  return { ok: true };
};

/* =========================================================
 * 五、主入口
 * =======================================================*/

exports.main = async (event, context) => {
  const action = (event && event.action) || '';
  const openid = getOpenId();

  try {
    const noThrottleActions = [
      'orders.list',
      'orders.detail',
      'dashboard.summary',
      'users.me',
      'dashboard.metrics',
    ];

    const needThrottle = !noThrottleActions.includes(action);

    if (needThrottle) {
      const pass = await checkThrottle(`${openid}:${action}`, 1000);
      if (!pass) {
        log({
          level: LEVEL.WARN,
          action,
          message: 'THROTTLED',
          data: {},
          openid,
        });
        return { code: 429, msg: '请求过于频繁，请稍后再试' };
      }
    }

    let data;

    switch (action) {
      case 'orders.list':
        data = await handleOrdersList(event);
        break;
      case 'orders.detail':
        data = await handleOrdersDetail(event);
        break;
      case 'dashboard.summary':
        data = await handleDashboardSummary(event);
        break;
      case 'dashboard.metrics':
        data = await handleDashboardMetrics(event);
        break;

      case 'users.me':
        data = await handleUsersMe();
        break;
      case 'users.login':
        data = await handleUsersLogin(event);
        break;
      case 'users.register':
        data = await handleUsersRegister(event);
        break;
      case 'users.listPending':
        data = await handleUsersListPending(event);
        break;
      case 'users.approve':
        data = await handleUsersApprove(event);
        break;

      case 'admin.anchors.list':
        data = await handleAdminAnchorsList();
        break;
      case 'admin.anchor.setProducts':
        data = await handleAdminAnchorSetProducts(event);
        break;
      case 'admin.anchor.backfillOrders':
        data = await handleAdminAnchorBackfillOrders(event);
        break;
      case 'admin.orders.rebuildAnchorsFromMap':
        data = await handleAdminOrdersRebuildAnchorsFromMap();
        break;

      default:
        throw new Error(`UNKNOWN_ACTION:${action}`);
    }

    log({
      level: LEVEL.INFO,
      action,
      message: 'OK',
      data: { action },
      openid,
    });

    return { code: 0, msg: 'ok', data };
  } catch (err) {
    log({
      level: LEVEL.ERROR,
      action,
      message: err.message || 'ERROR',
      data: { stack: err.stack },
      openid,
    });
    return { code: -1, msg: err.message || 'server error' };
  }
};
