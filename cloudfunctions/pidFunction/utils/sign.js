// cloudfunctions/pidFunction/utils/sign.js

const crypto = require('crypto');
const { SECRET } = require('./config');

function strCode(data, fn = (s) => String(s).trim()) {
  if (data == null) return data;
  if (Array.isArray(data)) return data.map((v) => strCode(v, fn));
  if (typeof data === 'object') {
    const out = {};
    Object.keys(data).forEach((k) => {
      out[k] = strCode(data[k], fn);
    });
    return out;
  }
  return fn(data);
}

function makeSign(signData, secret) {
  const data = strCode(signData);
  const keys = Object.keys(data).sort();

  let str = '';
  for (const k of keys) {
    const v = data[k];
    if (k === 'sign' || k === 'Sign') continue;
    if (v === '' || v === undefined || v === null) continue;
    str += `${k}=${v}&`;
  }

  return crypto
    .createHash('md5')
    .update(str + 'key=' + secret, 'utf8')
    .digest('hex');
}

module.exports = { makeSign };
