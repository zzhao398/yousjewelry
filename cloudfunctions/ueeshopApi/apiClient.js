// cloudfunctions/ueeshopApi/apiClient.js
//
// 职责：
// - 拼接 Ueeshop 请求所需公共参数（ApiName、Number、ApiFrom、Action、timestamp）
// - 调用 makeSign 生成 sign
// - 用 x-www-form-urlencoded 形式 POST 到 /gateway/
// - 解析 JSON，检查 ret == 1，否则视为失败
// - 所有调用自动打日志（成功/失败都记录）
//
// 用法：
//   const { callUeeApi } = require('./apiClient');
//   const msg = await callUeeApi({ Page:1, PageSize:50 }, 'sync_get_orders', openid);
//   // msg 就是 Ueeshop 返回里的 msg 部分
//

const qs = require('querystring');
const https = require('https');
const http = require('http');
const { getBaseUrl, API_NAME, ACCESS_NUMBER, API_FROM, SECRET } = require('./config');
const { makeSign } = require('./utils/sign');


/**
 * 调用 Ueeshop API
 * @param {object} bizParams  业务参数（OrderStatus/UpdateStartTime/...）
 * @param {string} action     Action，如 'sync_get_orders' / 'sync_get_version'
 * @param {string} openid     当前用户 openid（这里只用来记 log，可以传空）
 * @returns {Promise<object>} 解析后的 JSON 对象（就是文档里的那个最外层）
 */
function callUeeApi(bizParams = {}, action, openid = '') {
    const baseUrl = getBaseUrl(); // e.g. https://youjewelry.free.beeceptor.com/gateway/
    const isHttps = baseUrl.startsWith('https://');
  
    return new Promise((resolve, reject) => {
      const timestamp = Math.floor(Date.now() / 1000);
  
      // 公共参数 + 业务参数
      const payload = {
        ApiName: API_NAME,          // 'openapi'
        ApiFrom: API_FROM || '',    // 'miniapp'
        Number: ACCESS_NUMBER,      // 接入码
        Action: action,             // sync_get_orders
        timestamp,
        ...bizParams,
      };
  
      // 生成 Sign（大写 S，和文档示例一致）
      const Sign = makeSign(payload, SECRET);
      payload.Sign = Sign;
  
      const body = qs.stringify(payload);
  
      // 解析 URL
      const url = new URL(baseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname || '/gateway/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      };
  
      const client = isHttps ? https : http;
  
      const req = client.request(options, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
  
            // 文档约定：ret = 1 成功，否则 msg 是错误信息（string）
            if (json.ret !== 1) {
              const msg = typeof json.msg === 'string' ? json.msg : 'UEE_API_ERROR';
              return reject(new Error(msg));
            }
  
            // ✅ 返回完整 json：{ ret, TotalPage, msg: [...] }
            resolve(json);
          } catch (e) {
            reject(new Error('UEE_API_PARSE_ERROR: ' + e.message));
          }
        });
      });
  
      req.on('error', (e) => {
        reject(new Error('UEE_API_HTTP_ERROR: ' + e.message));
      });
  
      req.write(body);
      req.end();
    });
  }
  
  module.exports = {
    callUeeApi,
  };