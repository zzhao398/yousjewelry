// miniprogram/pages/mine/index.js

const { call } = require('../../utils/request');
const { getMe } = require('../../utils/ueeApi');
Page({
  data: {
    loading: true,
    user: null,   // 后端返回的用户信息
  },

  onShow() {
    this.fetchMe();
  },

  fetchMe() {
    this.setData({ loading: true });

    getMe()
      .then((u) => {
        if (!u || u.loggedIn === false || u.status === 'unregistered') {
          wx.reLaunch({ url: '/pages/login/index' });
          return;
        }

        this.setData({
          user: u,
        });
      })
      .catch((err) => {
        console.error('getMe error', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  // 退出登录：本地清理 + 返回登录页
  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: (res) => {
        if (!res.confirm) return;

        // 目前我们没有后端 session，就清掉本地缓存就行
        try {
          wx.removeStorageSync('userInfo');
        } catch (e) {
          console.error('removeStorageSync error', e);
        }

        wx.reLaunch({
          url: '/pages/login/index',
        });
      },
    });
  },

  // 管理员点击进入“主播审核列表”
  onGoAnchorApproval() {
    wx.navigateTo({
      url: '/pages/admin/anchor-approve/index',
    });
  },

  // 管理员点击进入“主播信息管理”
  onGoAnchorList() {
    wx.navigateTo({
      url: '/pages/admin/anchor-list/index',
    });
  },
});
