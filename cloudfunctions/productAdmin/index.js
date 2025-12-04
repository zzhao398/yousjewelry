// cloudfunctions/productAdmin/index.js
//
// productID(PID) → 主播绑定管理
// 只有管理员可以调用
//

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const { initLogger, log, LEVEL } = require('./utils/logger');
initLogger(db);

const getOpenId = () => cloud.getWXContext().OPENID;

const getUserRole = async () => {
  const openid = getOpenId();
  const { data } = await db.collection('users').where({ openid }).limit(1).get();
  if (!data.length) return { role: 'anchor', openid };
  return data[0];
};

// 统一检查管理员权限
const assertAdmin = async () => {
  const user = await getUserRole();
  if (user.role !== 'admin' && user.role !== 'owner') {
    throw new Error('ADMIN_ONLY');
  }
};

// ------- handlers ---------

// 列表：分页查看 productID → 主播 绑定关系
const handleList = async (event) => {
  const { page = 1, pageSize = 50 } = event || {};
  const skip = (page - 1) * pageSize;

  const { data } = await db
    .collection('anchor_product_map')  // ★ 新集合名，专门给 PID 用
    .orderBy('updatedAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  return { list: data, page, pageSize };
};

// 新增 / 修改绑定
const handleSave = async (event) => {
  const {
    productId,        // ★ 必填：商品的 productID / PID
    productName = '', // 选填：方便前端展示用
    anchorId,         // 主播 ID（你在 users 表里给每个主播的 anchorId）
    anchorName = '',  // 主播昵称，用于展示
    commissionRate = 0,      // 佣金比例，例如 0.1 = 10%
    visibleToAnchors = true, // 这条绑定生成的订单是否对主播可见
    priority = 1,            // 优先级（预留，有多条规则时可以用）
    _id,                     // 有 _id = 更新，没有 _id = 新增
  } = event || {};

  if (!productId || !anchorId) {
    throw new Error('MISSING_FIELD');
  }

  const now = Date.now();
  const doc = {
    productId,
    productName,
    anchorId,
    anchorName,
    commissionRate,
    visibleToAnchors,
    priority,
    updatedAt: now,
  };

  const coll = db.collection('anchor_product_map');

  if (_id) {
    // 更新
    await coll.doc(_id).update({ data: doc });
    return { updated: true };
  } else {
    // 新增
    doc.createdAt = now;
    await coll.add({ data: doc });
    return { created: true };
  }
};

// 删除绑定
const handleDelete = async (event) => {
  const { _id } = event || {};
  if (!_id) throw new Error('MISSING_ID');

  await db.collection('anchor_product_map').doc(_id).remove();
  return { deleted: true };
};

// ------- main ---------

exports.main = async (event, context) => {
  const action = event && event.action;

  try {
    await assertAdmin();

    let data;
    switch (action) {
      case 'pidMap.list':    // ★ 新 action 名
        data = await handleList(event);
        break;
      case 'pidMap.save':
        data = await handleSave(event);
        break;
      case 'pidMap.delete':
        data = await handleDelete(event);
        break;
      default:
        throw new Error(`UNKNOWN_ACTION:${action}`);
    }

    log({ level: LEVEL.INFO, action, message: 'OK', data });

    return { code: 0, msg: 'ok', data };
  } catch (err) {
    log({
      level: LEVEL.ERROR,
      action,
      message: err.message || 'ERROR',
    });
    return { code: -1, msg: err.message || 'server error' };
  }
};
