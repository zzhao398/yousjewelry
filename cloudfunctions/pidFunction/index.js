// cloudfunctions/pidFunction/index.js
//
// 功能：产品 PID 同步
// - 只允许 admin/owner 调用
// - 每次全量拉取 Ueeshop 产品列表（分页）
// - 写入云数据库 product_pid_map（以 pid 作为 _id）
// - 同步删除：远端已不存在的 pid，从本地集合移除
//

const cloud = require('wx-server-sdk');
const { callUeeApi } = require('./utils/apiClient');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// 产品 PID 映射表集合
const COLL = 'product_pid_map';

// 只允许 admin/owner 调用（用你现有 users 表字段）
async function assertAdmin(openid) {
  const r = await db.collection('users').where({ openid }).limit(1).get();
  const u = r.data && r.data[0];
  if (!u) throw new Error('UNAUTHORIZED');
  if (!(u.role === 'admin' || u.role === 'owner')) throw new Error('FORBIDDEN');
  return u;
}

// 规整 Ueeshop 返回字段 → { pid, name }
function normalizeProduct(it) {
  // 文档示例：Name_en / ProId
  const pid = String(it.ProId || it.proid || it.pid || '').trim();
  const name = String(it.Name_cn || it.Name_en || it.Name || it.name || '').trim();
  return { pid, name };
}

// 分批写库：避免一次写太多
async function batchUpsert(list) {
  if (!list.length) return;

  const chunks = [];
  for (let i = 0; i < list.length; i += 100) {
    chunks.push(list.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const tasks = chunk.map((x) =>
      // ✅ 用 pid 当 docId → 文档 _id 就是 pid
      db.collection(COLL).doc(x.pid).set({
        data: {
          pid: x.pid,
          name: x.name,
          updatedAt: db.serverDate(),
        },
      }),
    );
    await Promise.all(tasks);
  }
}

/**
 * 同步删除：如果本地有的 pid 不在远端集合里，就删除本地那条
 * 由于我们写入时 doc(pid).set，所以本地文档 _id === pid
 */
async function removeMissing(remotePidSet) {
  const _ = db.command;

  const BATCH = 100;
  let lastId = null;

  // 要删除的 pid（即文档 _id）
  let toDeleteIds = [];

  while (true) {
    // ✅ 逐页扫描本地集合（按 _id 升序）
    let q = db.collection(COLL).orderBy('_id', 'asc').limit(BATCH);
    if (lastId) q = q.where({ _id: _.gt(lastId) });

    const r = await q.get();
    const rows = r.data || [];
    if (!rows.length) break;

    for (const row of rows) {
      // ✅ row._id 就是 pid
      const pid = String(row._id || '').trim();
      if (!pid) continue;

      if (!remotePidSet.has(pid)) {
        toDeleteIds.push(pid);
      }
    }

    lastId = rows[rows.length - 1]._id;

    // 分批删除（避免一次 remove 太大）
    if (toDeleteIds.length >= 200) {
      await deleteByIds(toDeleteIds.splice(0, toDeleteIds.length));
    }
  }

  if (toDeleteIds.length) {
    await deleteByIds(toDeleteIds);
  }
}

async function deleteByIds(ids) {
  if (!ids.length) return;
  const _ = db.command;

  const chunks = [];
  for (let i = 0; i < ids.length; i += 100) {
    chunks.push(ids.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    // where _id in [...]
    await db.collection(COLL).where({ _id: _.in(chunk) }).remove();
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    await assertAdmin(openid);

    const action = (event && event.action) || '';
    if (action !== 'pid.sync') {
      return { code: -1, msg: 'UNKNOWN_ACTION' };
    }

    // 1) 先拉第一页，得到 TotalPage
    const first = await callUeeApi(
      { Page: 1, Count: 100 },
      'sync_get_products_list',
    );

    const totalPage = Number(first.TotalPage || 0);
    const firstItems = Array.isArray(first.msg) ? first.msg : [];
    let all = firstItems.slice();

    // 2) 拉剩余页
    for (let p = 2; p <= totalPage; p += 1) {
      const res = await callUeeApi(
        { Page: p, Count: 100 },
        'sync_get_products_list',
      );
      const items = Array.isArray(res.msg) ? res.msg : [];
      all = all.concat(items);
    }

    // 3) 规整成 {pid,name}
    const mapped = all.map(normalizeProduct).filter((x) => x.pid && x.name);

    if (!mapped.length) {
      return { code: -1, msg: '没有相关的产品信息' };
    }

    // 4) 写库（新增/更新）
    await batchUpsert(mapped);

    // 5) 同步删除：远端没有的，本地删掉
    const remotePidSet = new Set(mapped.map((x) => x.pid));
    await removeMissing(remotePidSet);

    // 6) 返回给前端（排序一下更好看）
    mapped.sort((a, b) => a.pid.localeCompare(b.pid));

    return {
      code: 0,
      msg: 'ok',
      data: {
        total: mapped.length,
        list: mapped,
        totalPage,
      },
    };
  } catch (err) {
    console.error('[pidFunction error]', err);
    return {
      code: -1,
      msg: err.message || 'SERVER_ERROR',
    };
  }
};
