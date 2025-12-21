// cloudfunctions/pidFunction/utils/apiClient.js

const https = require('https');
const qs = require('querystring');
const { API_NAME, ACCESS_NUMBER, SECRET, API_FROM, getBaseUrl } = require('./config');
const { makeSign } = require('./sign');

function callUeeApi(bizParams, action) {
  const ts = Math.floor(Date.now() / 1000);

  const base = {
    ApiName: API_NAME,
    Number: ACCESS_NUMBER,
    Action: action,
    timestamp: ts,
  };

  if (API_FROM) base.ApiFrom = API_FROM;

  const sign = makeSign({ ...base, ...bizParams }, SECRET);
  const postData = qs.stringify({ ...base, ...bizParams, Sign: sign });

  const urlStr = getBaseUrl();
  const url = new URL(urlStr);

  const options = {
    method: 'POST',
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname, // /gateway/
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

          // 按文档：ret=1 成功
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
