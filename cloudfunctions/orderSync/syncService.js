// cloudfunctions/orderSync/syncService.js
//
// 真正的订单同步逻辑：按 updated_time 做「增量 + 幂等」
// - 使用 sync_state 集合记录游标：{ job: 'orders', lastSyncSec, lastSuccessAt, lastError }
// - 每轮从 (lastSyncSec - SAFETY_BACK_SEC) 开始拉，防止边界漏单
// - 依靠 doc(oid).set + sourceUpdatedAt 做幂等 upsert
//
const { callUeeApi } = require('./utils/apiClient'); 
const { buildSlimOrder } = require('./utils/buildSlimOrder');
const { calcAnchorInfoForOrder } = require('./utils/anchorMapping');

const ORDERS_COLL = 'orders_slim';
const STATE_COLL = 'sync_state';

// 安全回退窗口：避免边界漏单（300 秒 = 5 分钟）
const SAFETY_BACK_SEC = 300;

/**
 * 调 Ueeshop 的同步接口：按 UpdateStartTime / UpdateEndTime + 分页获取订单
 * 对应文档里的 Action = sync_get_orders
 */
async function fetchOrdersByUpdatedRange(fromSec, toSec, page = 1) {
    const payload = {
      UpdateStartTime: String(fromSec),    // 文档里的 UpdateStartTime
      UpdateEndTime: String(toSec),       // 文档里的 UpdateEndTime
      OrderStatus: 'all',                 // all/unpaid/paid（默认 paid），你可以按需调整
      Count: 100,                         // 每页数量，默认 100，最大 100
      Page: page,
    };
  
    const json = await callUeeApi(payload, 'sync_get_orders', '');
  
    // ✅ 文档结构：msg 是数组，TotalPage 是整数
    const list = Array.isArray(json.msg) ? json.msg : [];
    const totalPage = Number(json.TotalPage || 1);
    const hasMore = page < totalPage;
  
    return { list, hasMore };
  }


/**
 * 读取同步状态
 * 文档结构：
 *  {
 *    job: 'orders',
 *    lastSyncSec: 1700000000,
 *    lastSuccessAt: 1700000100,
 *    lastError: ''
 *  }
 */
async function readState(db) {
  const { data } = await db
    .collection(STATE_COLL)
    .where({ job: 'orders' })
    .limit(1)
    .get();

  if (!data.length) {
    return {
      _id: null,
      lastSyncSec: 0,
      lastSuccessAt: null,
      lastError: '',
    };
  }

  const doc = data[0];
  return {
    _id: doc._id,
    lastSyncSec: doc.lastSyncSec || 0,
    lastSuccessAt: doc.lastSuccessAt || null,
    lastError: doc.lastError || '',
  };
}

/**
 * 写入同步状态（成功）
 */
async function writeStateSuccess(db, stateId, toSec) {
  const coll = db.collection(STATE_COLL);
  const nowSec = Math.floor(Date.now() / 1000);

  const data = {
    job: 'orders',
    lastSyncSec: toSec,
    lastSuccessAt: nowSec,
    lastError: '',
  };

  if (stateId) {
    await coll.doc(stateId).update({ data });
  } else {
    await coll.add({ data: { ...data } });
  }
}

/**
 * 写入同步状态（失败）
 */
async function writeStateError(db, stateId, errMsg) {
  const coll = db.collection(STATE_COLL);
  const nowSec = Math.floor(Date.now() / 1000);

  const data = {
    job: 'orders',
    lastError: errMsg || 'sync failed',
    lastSuccessAt: null,
  };

  if (stateId) {
    await coll.doc(stateId).update({ data });
  } else {
    await coll.add({ data: { ...data, lastSyncSec: 0 } });
  }
}

/**
 * 幂等 upsert（避免重复 + 不漏）
 */
;

async function upsertOne(db, uOrder) {
  const coll = db.collection(ORDERS_COLL);

  const slim = buildSlimOrder(uOrder);
  const oid = slim.oid;
  const updatedSec = slim.sourceUpdatedAt || 0;

  let existing = null;
  try {
    const res = await coll.doc(oid).get();
    existing = res.data;
  } catch (e) {
    existing = null;
  }

  if (existing && (existing.sourceUpdatedAt || 0) >= updatedSec) {
    return;
  }

  const { anchorIdList, visibleToAnchors, channelType } =
    await calcAnchorInfoForOrder(db, slim.pidList || []);

  const doc = {
    ...slim,
    anchorIdList,
    visibleToAnchors,
    channelType,
  };

  // ⭐ 防御：无论哪里不小心带了 _id，这里都彻底干掉
  delete doc._id;

  // 用 oid 当文档主键：_id 会被自动设成 oid
  await coll.doc(oid).set({ data: doc });
}



/**
 * 核心同步函数
 * 参数：
 *  - event.forceFromTime: 可选，强制从某个时间点开始（秒）
 */
async function runSync({ db, _, event }) {
  const state = await readState(db);
  const forceFrom = event && event.forceFromTime;

  let baseFromSec = 0;
  if (forceFrom) {
    baseFromSec = forceFrom;
  } else {
    baseFromSec = state.lastSyncSec || 0;
  }

  // 安全回退窗口（避免边界漏单）
  const fromSec = Math.max(0, baseFromSec - SAFETY_BACK_SEC);
  const toSec = Math.floor(Date.now() / 1000);

  let totalCount = 0;
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore) {
      // 关键：按更新时间范围 + 分页 查询 Ueeshop
      const { list, hasMore: more } = await fetchOrdersByUpdatedRange(
        fromSec,
        toSec,
        page,
      );

      for (const uOrder of list) {
        await upsertOne(db, uOrder);
        totalCount += 1;
      }

      hasMore = more;
      page += 1;
    }

    // ✅ 全部处理完后，才更新游标为本次的 toSec
    await writeStateSuccess(db, state._id, toSec);

    return {
      ok: true,
      synced: totalCount,
      fromSec,
      toSec,
      lastSyncSecBefore: state.lastSyncSec || 0,
    };
  } catch (err) {
    // 记录错误，但继续抛给上层 index.js
    await writeStateError(db, state._id, err.message || 'sync failed');
    throw err;
  }
}

module.exports = {
  runSync,
};
