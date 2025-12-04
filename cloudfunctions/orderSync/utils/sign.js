// cloudfunctions/ueeshopApi/utils/sign.js
//
// 负责生成 Ueeshop API 所需的 sign：
// - str_code($data, 'trim')：对所有字符串做 trim，数组/对象递归处理
// - ksort：按键名升序排序，区分大小写
// - 拼接为 "k=v&" 形式，跳过 key 为 sign/Sign，以及 value 为空字符串的键
// - 在末尾追加 "key=SECRET"，整体做 md5 得到 32 位小写
//
// 注意：这里是协议的关键部分，一旦写错，会出现验签失败。
//       后面如果 Ueeshop 文档更新，优先检查这里。
//

const crypto = require('crypto');
const { SECRET } = require('./config');

/**
 * 模拟 PHP 的 str_code($data, 'trim')
 * - data 为标量：直接 String(data).trim()
 * - data 为数组：对每个元素递归
 * - data 为对象：对每个 value 递归
 *
 * @param {*} data 任意结构
 * @param {Function} fn 文本处理函数，默认 trim
 */
function strCode(data, fn = (s) => String(s).trim()) {
    if (data == null) return data;
    if (Array.isArray(data)) {
      return data.map((v) => strCode(v, fn));
    }
    if (typeof data === 'object') {
      const out = {};
      Object.keys(data).forEach((k) => {
        out[k] = strCode(data[k], fn);
      });
      return out;
    }
    return fn(data);
  }

/**
 * 生成 Ueeshop 签名
 *
 * @param {Object} params 原始参数对象（包含公共参数 + 业务参数，不包含 sign）
 * @returns {string} 32 位小写 md5 签名
 */
function makeSign(signData, secret) {
    // 1) 文本处理（trim）
    const data = strCode(signData);
  
    // 2) 按 key 升序排序（区分大小写）
    const keys = Object.keys(data).sort();
  
    // 3) 拼接 k=v&
    let str = '';
    for (const k of keys) {
      const v = data[k];
      if (k === 'sign' || k === 'Sign') continue;
      if (v === '' || v === undefined || v === null) continue;
      str += `${k}=${v}&`;
    }
  
    // 4) md5(str + 'key=' + secret)
    return crypto
      .createHash('md5')
      .update(str + 'key=' + secret, 'utf8')
      .digest('hex');
  }
  
  module.exports = { makeSign };
