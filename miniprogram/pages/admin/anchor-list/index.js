// pages/admin/anchor-list/index.js
//
// 功能：
//  - 管理员查看所有已通过的主播
//  - 为每个主播配置绑定的 productId 列表
//  - 单个主播：回填历史订单（把当前绑定 PID 对应的订单打上该主播）
//  - 顶部按钮：一键按映射表重建所有订单的 anchorIdList

const { listAnchors, setAnchorProducts } = require('../../../utils/busiApi');
const { call } = require('../../../utils/request');

Page({
  data: {
    loading: false,
    list: [], // [{ _id, anchorId, productIdsStr, ... }]
  },

  onShow() {
    this.fetchList();
  },

  fetchList() {
    this.setData({ loading: true });
    return listAnchors()
      .then((res) => {
        const list = res.list || [];
        this.setData({ list });
      })
      .catch((err) => {
        console.error('anchor-list.fetchList error', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  // 输入时实时更新 data.list[index].productIdsStr
  onProductIdsInput(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;

    const list = this.data.list.slice();
    if (!list[index]) return;

    list[index].productIdsStr = value;
    this.setData({ list });
  },

  // 点“保存绑定”
  onSave(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.list[index];
    if (!item) return;

    const anchorId = item.anchorId;
    if (!anchorId) {
      wx.showToast({ title: '缺少主播ID', icon: 'none' });
      return;
    }

    const raw = item.productIdsStr || '';
    // 支持逗号 / 中文逗号 / 空格分隔
    const ids = raw
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    wx.showLoading({ title: '保存中...', mask: true });

    setAnchorProducts(anchorId, ids)
      .then(() => {
        wx.showToast({ title: '已保存', icon: 'success' });
      })
      .catch((err) => {
        console.error('anchor-list.save error', err);
        wx.showToast({ title: '保存失败', icon: 'none' });
      })
      .finally(() => {
        wx.hideLoading();
      });
  },

  // 单个主播：回填历史订单
  onBackfill(e) {
    const anchorId = e.currentTarget.dataset.anchorId;

    wx.showModal({
      title: '历史订单回填',
      content: `为主播 ${anchorId} 回填所有历史订单？`,
      success: (res) => {
        if (!res.confirm) return;

        wx.showLoading({ title: '回填中...', mask: true });

        call('admin.anchor.backfillOrders', { anchorId })
          .then((r) => {
            wx.hideLoading();
            wx.showToast({
              title: `更新 ${r.updated}/${r.total}`,
              icon: 'success',
              duration: 2500,
            });
          })
          .catch((err) => {
            wx.hideLoading();
            console.error('anchor-list.backfill error', err);
            wx.showToast({ title: err.message || '回填失败', icon: 'none' });
          });
      },
    });
  },

  // 顶部：一键重建所有订单的主播索引
  onRebuildAll() {
    wx.showModal({
      title: '一键重建订单索引',
      content:
        '将按当前【商品ID→主播】映射关系，重新计算所有订单的主播标记。\n' +
        '建议在修改完映射关系后执行一次。',
      success: (res) => {
        if (!res.confirm) return;

        wx.showLoading({ title: '重建中...', mask: true });

        call('admin.orders.rebuildAnchorsFromMap', {})
          .then((info) => {
            wx.hideLoading();
            wx.showToast({
              title: `完成：更新 ${info.updated}/${info.total}`,
              icon: 'success',
              duration: 2500,
            });
          })
          .catch((err) => {
            wx.hideLoading();
            console.error('anchor-list.rebuildAll error', err);
            wx.showToast({ title: err.message || '重建失败', icon: 'none' });
          });
      },
    });
  },
});
