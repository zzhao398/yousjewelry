// cloudfunctions/orderSync/utils/apiClient.js
//
// 只给 orderSync 用的 Ueeshop API 客户端（走 Beeceptor / 正式网关）

const https = require('https');
const qs = require('querystring');
const { API_NAME, ACCESS_NUMBER, SECRET, API_FROM, getBaseUrl } = require('./config');
const { makeSign } = require('./sign');

/**
 * 调 Ueeshop/Beeceptor 网关
 * @param {Object} bizParams 业务参数（例如 UpdateStartTime, UpdateEndTime, Count, Page 等）
 * @param {string} action    Action 字段，例如 'sync_get_orders'
 * @param {string} openid    可选，当前用户 openid（定时任务里传空字符串）
 */
function callUeeApi(bizParams, action, openid = '') {
  const ts = Math.floor(Date.now() / 1000);

  const base = {
    ApiName: API_NAME,
    Number: ACCESS_NUMBER,
    Action: action,
    timestamp: ts,
    ApiFrom: API_FROM,
  };

  const sign = makeSign({ ...base, ...bizParams }, SECRET);
  const postData = qs.stringify({ ...base, ...bizParams, Sign: sign });

  // ✅ 这里先拿到字符串，再打日志
  const urlStr = getBaseUrl();
  console.log('[orderSync.callUeeApi] url =', urlStr);

  const url = new URL(urlStr);

  const options = {
    method: 'POST',
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname, // '/gateway/'
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(raw || '{}');
          // 按接入文档：ret=1 表示成功
          if (json.ret !== 1) {
            return reject(new Error(json.msg || 'UEESHOP_API_ERROR'));
          }
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

module.exports = { callUeeApi };
