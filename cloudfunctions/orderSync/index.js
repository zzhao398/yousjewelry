// cloudfunctions/orderSync/index.js
//
// 功能：
//   - 作为「订单同步」云函数的入口
//   - 一般由「定时触发器」每分钟调用一次
//   - 也可以在小程序/控制台手动触发，例如传入 forceFromTime 做重拉
//
// 维护要点：
//   - 同步逻辑全部放在 syncService.runSync 里，这里只做封装+日志
//   - 如果将来要增加「只同步某个时间范围」之类的功能，只改 event 参数的约定即可
//

const cloud = require('wx-server-sdk');

// 初始化云环境：使用当前环境（开发/预发布/正式）
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 获取数据库句柄
const db = cloud.database();
const _ = db.command;

// 引入公共日志模块和同步逻辑
const { initLogger, log, LEVEL } = require('./utils/logger');
const { runSync } = require('./syncService');

// 将 db 注入 logger，后续 log() 会把日志写到 logs 集合
initLogger(db);

/**
 * 云函数入口
 *
 * @param {Object} event  调用时传入的参数，例如 { forceFromTime: 1690000000 }
 * @param {Object} context 上下文（一般用不到）
 */
exports.main = async (event, context) => {
  try {
    // 调用核心同步逻辑
    const res = await runSync({ db, _, event, context });

    // 同步成功日志
    log({
      level: LEVEL.INFO,
      action: 'orderSync',
      message: 'SYNC_OK',
      data: res,
    });

    return { code: 0, msg: 'ok', data: res };
  } catch (err) {
    // 同步失败日志
    log({
      level: LEVEL.ERROR,
      action: 'orderSync',
      message: err.message || 'SYNC_FAILED',
      data: { stack: err.stack },
    });

    return { code: -1, msg: err.message || 'orderSync failed' };
  }
};
