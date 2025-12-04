// pages/admin/anchor-list/index.js

const { listAnchors } = require('../../../utils/ueeApi');

Page({
  data: {
    loading: false,
    list: [],   // { _id, anchorId, displayName, phone, loginAccount, ... }
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
        console.error('listAnchors error', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  // ⭐ 删除 onProductIdsBlur 相关代码 & WXML 里的输入框
});

