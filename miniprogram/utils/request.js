// miniprogram/utils/request.js
//
// 统一封装 wx.cloud.callFunction：
// - 所有前端接口调用都使用 call(action, data)
// - 自动处理 { code, msg, data } 的统一返回格式
// - 自动提示错误（toast）
// - 返回 Promise，方便链式调用

const call = (action, data = {}) => {
  return wx.cloud
    .callFunction({
      name: 'ueeshopApi',
      data: { action, ...data },
    })
    .then((res) => {
      const result = res.result || {};

      if (result.code !== 0) {
        const msg = result.msg || '服务器繁忙';
        wx.showToast({ title: msg, icon: 'none' });
        throw new Error(msg);
      }

      return result.data;
    });
};

// ⭐ 新增：专门用来调 skuAdmin 云函数
const callSkuAdmin = (action, data = {}) => {
  return wx.cloud
    .callFunction({
      name: 'skuAdmin',
      data: { action, ...data },
    })
    .then((res) => {
      const result = res.result || {};

      if (result.code !== 0) {
        const msg = result.msg || '服务器繁忙';
        wx.showToast({ title: msg, icon: 'none' });
        throw new Error(msg);
      }

      return result.data;
    });
};

module.exports = { call, callSkuAdmin };