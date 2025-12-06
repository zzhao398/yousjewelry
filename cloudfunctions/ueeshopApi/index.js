// cloudfunctions/ueeshopApi/index.js
//
// 职责：
//   - 作为小程序前端的统一 API 入口：前端只调用这个云函数
//   - 根据 event.action 分发到具体 handler
//   - 在这里做：
//       * 用户角色识别（管理员 / 主播）
//       * 5 秒节流
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
const SKU_ANCHOR_COLL = 'sku_anchor_map';

// 改成指向当前函数目录下的 utils/logger
const { initLogger, log, LEVEL } = require('./utils/logger');  // 根据实际相对路径


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
  // 69.62.163.81 -> 69.62.***.81
  const parts = String(ip).split('.');
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.***.${parts[3]}`;
};


initLogger(db);

const USERS_COLL = 'users';

// 生成随机盐：16 字节 → 32 位 hex 字符串
const generateSalt = () => crypto.randomBytes(16).toString('hex');

// 带盐的密码哈希：sha256(password + ':' + salt)
const hashPassword = (plain, salt) =>
  crypto
    .createHash('sha256')
    .update(String(plain) + ':' + String(salt))
    .digest('hex');

// 可选：为了兼容旧数据（如果你已经插入过无盐密码）
const hashPasswordLegacy = (plain) =>
  crypto.createHash('sha256').update(String(plain)).digest('hex');

// 统一把用户记录裁剪成前端可用的安全数据
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

const getOpenId = () => cloud.getWXContext().OPENID;


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

const handleAdminAnchorsList = async () => {
  const me = await getUserRole();
  if (!['owner', 'admin'].includes(me.role)) {
    throw new Error('ADMIN_ONLY');
  }

  const { data } = await db.collection('users')
    .where({
      role: 'anchor',
      status: 'approved',
    })
    .orderBy('createdAt', 'asc')
    .get();

  // 这里不再返回 productIds，绑定信息交给 anchor_product_map + skuAdmin 管
  return { list: data };
};

/** 订单列表（带字段裁剪） */
const handleOrdersList = async (event = {}) => {
  const {
    page = 1,
    pageSize = 20,
    status,          // all: 前端不会传；其它 tab: 'pending' / 'unshipped' / 'unpaid' / 'paid' / 'shipped'
    dateRange,
    keyword = '',
    searchType = 'auto',
    anchorId: filterAnchorId,
    channelType,
  } = event;

  const { role, anchorId } = await getUserRole();
  const coll = db.collection('orders_slim');
  const where = {};
  const _ = db.command;

  /** 1) 状态过滤 —— 只在有 status 的时候加条件 */
  switch (status) {
    case 'unshipped':
      // 未发货：已付款 + 未发货
      where.shippingStatus = 'unshipped';
      where.paymentStatus = 'paid';
      break;
    case 'paid':
      where.paymentStatus = 'paid';
      break;
    case 'unpaid':
      // 未付款：非 paid
      where.paymentStatus = _.neq('paid');
      break;
    case 'shipped':
      where.shippingStatus = 'shipped';
      break;
    case 'pending':
      // 待处理 = 已付款 + 未发货
      where.paymentStatus = 'paid';
      where.shippingStatus = 'unshipped';
      break;
    default:
      // ⭐ “所有” 情况，前端不传 status，这里就不要加任何状态条件
      break;
  }

  /** 2) 时间区间 */
  if (dateRange && dateRange.start && dateRange.end) {
    where.orderCreatedAt = _.gte(dateRange.start).and(_.lte(dateRange.end));
  }

  /** 3) 关键字搜索（保持你原来的逻辑不变） */
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

  /** 4) 角色控制 */
  if (role === 'anchor') {
    // 没有 anchorId 的主播，直接返回空列表，这样不会误查到所有订单
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
        // 如果以后有 phone / IP 也可以顺手掩码
        customerIp: it.customerIp ? maskIp(it.customerIp) : '',
      }));


  return { list: safeList, page, pageSize, role };
};

// 工具：把 orders_slim 指定 where 条件下的所有数据一次性拉完
// 注意：单次 get() 最多 100 条，因此用 skip+limit 分批
const fetchAllOrdersSlim = async (where = {}) => {
    const coll = db.collection('orders_slim');
    const MAX_LIMIT = 100;
  
    // 先 count 一下总数
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

// =========================
// 最终版 handleOrdersDetail
// 约定：前端传 event.oid = '字符串 OID'
// 仍然保留一层 object → string 的兜底，便于以后防错
// =========================
const handleOrdersDetail = async (event = {}) => {
    let rawOid = event.oid;
  
    // 防御式：万一前端又传了 { oid: 'xxx' }，这里帮忙解一层
    if (rawOid && typeof rawOid === 'object') {
      rawOid =
        rawOid.oid ||
        rawOid.OId ||
        rawOid.id ||
        rawOid._id ||
        '';
    }
  
    const oid = String(rawOid || '').trim();
    if (!oid) {
      return null;
    }
  
    const { role } = await getUserRole();
    const coll = db.collection('orders_slim');
    const _ = db.command;
  
    const { data } = await coll
      .where(_.or([{ oid }, { _id: oid }]))
      .limit(1)
      .get();
  
    // 保留一条关键日志，方便以后排查
    log({
      level: LEVEL.INFO,
      action: 'orders.detail.debug',
      message: 'db_result',
      data: {
        query_oid: oid,
        hit: data.length,
      },
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
  
  
  
  

/** 简单首页概况：今天 */
/** D+B: 管理员高级统计，用于图表/看板 */
const handleDashboardMetrics = async (event) => {
    const { role } = await getUserRole();
    if (!['owner', 'admin'].includes(role)) {
      throw new Error('ADMIN_ONLY');
    }
  
    const {
      dateRange = {},    // { startSec, endSec }
      groupBy = 'day',   // 'day' | 'anchor'
    } = event || {};
  
    const where = {};
  
    if (dateRange.startSec && dateRange.endSec) {
      where.orderCreatedAt = _.gte(dateRange.startSec).and(_.lte(dateRange.endSec));
    }
  
    // ⭐ 关键：一次性拉完所有满足条件的订单（突破 100 条的限制）
    const data = await fetchAllOrdersSlim(where);
  
    if (groupBy === 'anchor') {
      // 每主播统计：订单数 / GMV / 佣金
      const anchorStatsMap = new Map();
      data.forEach((o) => {
        const anchors = o.anchorIdList || [];
        const amt = Number(o.orderTotalPrice || 0);
        const commission = Number(o.anchorCommissionAmount || 0);
  
        if (!anchors.length) {
          // 非主播单归入 'organic'
          const prev = anchorStatsMap.get('organic') || {
            anchorId: 'organic',
            orderCount: 0,
            gmv: 0,
            commission: 0,
          };
          prev.orderCount += 1;
          prev.gmv += amt;
          prev.commission += 0;
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
            prev.commission += commission / anchors.length; // 均分佣金
            anchorStatsMap.set(aid, prev);
          });
        }
      });
  
      const anchorStats = Array.from(anchorStatsMap.values());
      return { groupBy: 'anchor', anchorStats };
    }
  
    // 默认 groupBy = 'day'：按日期聚合
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
  

  /** 简单首页概况：今天 */
const handleDashboardSummary = async (event) => {
    const { role, anchorId } = await getUserRole();
  
    const now = new Date();
    const startOfDay = Math.floor(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).getTime() / 1000,
    );
  
    const where = { orderCreatedAt: _.gte(startOfDay) };
  
    if (role === 'anchor') {
      // 主播：只看自己 + 仅对主播可见的订单
      where.anchorIdList = _.elemMatch(_.eq(anchorId));
      where.visibleToAnchors = true;
    } else if (role === 'admin') {
      // 管理员：可以按 anchorId / channelType 过滤
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
  

/** 订单搜索（支持 OID / 邮箱 / PID / 国家 + 时间区间 + 状态）
 *  参数约定：
 *   - searchType: 'oid' | 'email' | 'PID' | 'country' | 'auto'
 *   - keyword: 搜索关键字
 *   - status: 同 orders.list（'unshipped' | 'paid' | undefined）
 *   - dateRange: { start, end }   // 下单时间（秒）
 *   - page, pageSize
 */
const handleOrdersSearch = async (event) => {
  const {
    searchType = 'auto',
    keyword = '',
    status,
    dateRange,
    page = 1,
    pageSize = 20,
  } = event || {};

  const { role, anchorId } = await getUserRole();
  const coll = db.collection('orders_slim');
  const where = {};

  // 1) 状态过滤（保持不变）
  if (status === 'unshipped') {
    where.shippingStatus = 'unshipped';
    where.paymentStatus = 'paid';
  } else if (status === 'paid') {
    where.paymentStatus = 'paid';
  }

  // 2) 时间过滤（保持不变）
  if (dateRange && dateRange.start && dateRange.end) {
    where.orderCreatedAt = _.gte(dateRange.start).and(_.lte(dateRange.end));
  }

  // 3) 搜索字段逻辑
  const kw = (keyword || '').trim();
  if (kw) {
    let t = searchType;

    // ⭐ auto 模式：带 @ 当邮箱；全数字当订单号；其它默认当 PID
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
      // ⭐ 用 pidList 来查
      where.pidList = _.elemMatch(_.eq(kw));
    } else if (t === 'country') {
      where.customerCountry = kw;
    }
  }

  // 4) 角色控制（保持不变）
  if (role === 'anchor') {
    where.anchorIdList = _.elemMatch(_.eq(anchorId));
    where.visibleToAnchors = true;
  } else if (role === 'admin') {
    if (event.anchorId) {
      where.anchorIdList = _.elemMatch(_.eq(event.anchorId));
    }
    if (event.channelType) {
      where.channelType = event.channelType;
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
          customerEmail: '',
        }));

  return {
    list: safeList,
    page,
    pageSize,
    role,
  };
};

/** 获取当前微信 openid 对应的用户信息：
*  - 未注册：返回 status = 'unregistered'
*  - 已注册：根据 status 决定 pending / approved / rejected
*/

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

/** 注册 / 修改资料（主播 & 管理员）
 * 参数：
 *  role: 'anchor' | 'admin'
 *  realName, displayName
 *  loginAccount: 登录账号（手机号或邮箱）
 *  password: 明文密码
 *  phone, email, platform, accountId, remark
 */
const handleUsersRegister = async (event) => {
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

// 为当前账号生成一个随机盐
const salt = generateSalt();

const baseDoc = {
  openid, // 直接绑定当前 openid（比之前“可能空”的逻辑更简单）
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

/** 用户名+密码登录
 * 参数：
 *  loginAccount
 *  password
 */
const handleUsersLogin = async (event) => {
  const { loginAccount = '', password = '' } = event || {};
  if (!loginAccount || !password) {
    throw new Error('请输入账号和密码');
  }

  const user = await getUserByLoginAccount(loginAccount);
if (!user) {
  throw new Error('账号不存在');
}

// 优先使用带盐哈希，如果老数据没有 salt，则退回 legacy 比较
let inputHash;
if (user.passwordSalt) {
  inputHash = hashPassword(password, user.passwordSalt);
} else {
  inputHash = hashPasswordLegacy(password);
}

if (user.passwordHash !== inputHash) {
  throw new Error('密码错误');
}


  // 登录成功：绑定当前微信 openid
  const openid = getOpenId();
  const now = Math.floor(Date.now() / 1000);

  await db
    .collection(USERS_COLL)
    .doc(user._id)
    .update({
      data: {
        openid,
        updatedAt: now,
      },
    });

  const refreshed = {
    ...user,
    openid,
  };

  // 不强制要求 status=approved 才能登录，
  // 但前端根据 status 控制能否看到订单数据。
  return {
    loggedIn: true,
    ...toSafeUser(refreshed),
  };
};



/** 列出待审核用户（管理员后台用）
 *  仅 owner/admin 可用，其中 admin 只看申请 anchor 的
 */
const handleUsersListPending = async () => {
  const me = await getUserRole(); // 这里用你原来的函数：返回 { role, openid, ... }

  if (!['owner', 'admin'].includes(me.role)) {
    throw new Error('ADMIN_ONLY');
  }

  const where = { status: 'pending' };

  if (me.role === 'admin') {
    where.requestedRole = 'anchor';  // 普通管理员只处理主播
  }

  const { data } = await db.collection('users')
    .where(where)
    .orderBy('createdAt', 'asc')
    .get();

  return { list: data };
};


/** 审核用户
 *  参数：
 *    userId: 待审核用户 _id
 *    approve: true/false
 *    role: 'admin' | 'anchor'  （通过时指定最终角色）
 *    anchorId: 若角色为主播，可同时指定 anchorId
 */
const handleUsersApprove = async (event) => {
  const { userId, approve, role, anchorId } = event || {};
  if (!userId) throw new Error('MISSING_USER_ID');

  const me = await getUserRole();

  if (!['owner', 'admin'].includes(me.role)) {
    throw new Error('ADMIN_ONLY');
  }

  // 审批权限控制
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


exports.main = async (event, context) => {
    const action = (event && event.action) || '';
    const openid = getOpenId();
  
    try {
      // 不需要节流的 action：正常页面加载用
      const noThrottleActions = [
        'orders.list',
        'orders.detail',
        'dashboard.summary',
        'users.me',       // 首页也会调用
        'dashboard.metrics', // 若管理员主页需要
      ];
  
      const needThrottle = !noThrottleActions.includes(action);
  
      if (needThrottle) {
        const pass = await checkThrottle(`${openid}:${action}`, 1000); // 1 秒
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
        case 'orders.search':
          data = await handleOrdersSearch(event);
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
        case 'users.login':                // ⭐ 新增这段
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
  