// cloudfunctions/monitorSync/monitorService.js
//
// 功能：
//   - 检查订单同步是否延迟过久（sync_meta.lastUpdateTime 与当前时间差）
//   - 统计最近 N 条 orderSync 日志的错误率
//   - 将监控结果写入 monitor_stats 集合
//   - 在出现异常时输出告警日志（后续可以加微信/邮件告警）
//
// 维护要点：
//   - 想增加更多监控项（例如 sign 错误次数、UEE_API_ERROR 频率），在这里扩展即可
//

const cloud = require('wx-server-sdk'); // 可以复用 index.js init 的环境
const { initLogger, log, LEVEL } = require('./utils/logger');

const ADMIN_OPENIDS = [
  // TODO: 把你自己和核心运营的 openid 填进来
  // 'o_xxxxxxxx',
];

/** 示例的告警推送（微信订阅消息），你可以用企业微信替换 */
const sendAdminAlert = async (issues) => {
  if (!ADMIN_OPENIDS.length) {
    return; // 没配管理员就只记日志
  }

  const content = issues.join('；').slice(0, 20); // 模板消息字段一般有长度限制

  for (const openid of ADMIN_OPENIDS) {
    try {
      // ⚠️ 需要在小程序后台配置对应的订阅消息模板
      await cloud.openapi.subscribeMessage.send({
        touser: openid,
        templateId: 'YOUR_TEMPLATE_ID', // TODO: 替换为你的
        page: 'pages/home/index',       // 用户点开后的页面
        data: {
          thing1: { value: 'Ueeshop同步告警' },
          thing2: { value: content || '监控异常，请查看后台' },
        },
      });
    } catch (e) {
      console.error('[sendAdminAlert error]', e);
    }
  }
};

const runMonitor = async ({ db, _ }) => {
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  // 1) 同步延迟
  const { data: metaList } = await db
  .collection('sync_state')
  .where({ job: 'orders' })
  .limit(1)
  .get();

let delaySec = null;
if (metaList.length) {
  const lastUpdateTime = metaList[0].lastSyncSec || 0;
  delaySec = nowSec - lastUpdateTime;
}


  // 2) 最近 50 条 orderSync 错误率
  const { data: recentLogs } = await db
    .collection('logs')
    .where({ action: 'orderSync' })
    .orderBy('timestamp', 'desc')
    .limit(50)
    .get();

  const total = recentLogs.length || 1;
  const errors = recentLogs.filter((l) => l.level === 'error').length;
  const errorRate = errors / total;

  const issues = [];

  if (delaySec != null && delaySec > 10 * 60) {
    issues.push(`订单同步延迟 ${delaySec}s (>600s)`);
  }

  if (errorRate > 0.5 && errors >= 5) {
    issues.push(`orderSync 错误率 ${errors}/${total}`);
  }

  if (issues.length) {
    log({
      level: LEVEL.WARN,
      action: 'monitorSync',
      message: 'ISSUES_DETECTED',
      data: { issues, delaySec, errorRate },
    });

    // C: 触发告警推送
    await sendAdminAlert(issues);
  }

  await db.collection('monitor_stats').add({
    data: {
      type: 'orderSync',
      timestamp: nowMs,
      delaySec,
      errorRate,
      issues,
    },
  });

  return { delaySec, errorRate, issues };
};

module.exports = { runMonitor };