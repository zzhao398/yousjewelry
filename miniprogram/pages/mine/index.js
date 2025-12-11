// miniprogram/pages/mine/index.js

const { getMe } = require('../../utils/ueeApi');
const i18n = require('../../utils/i18n');

Page({
  data: {
    loading: true,
    user: null, // 后端返回的用户信息

    // 多语言
    lang: i18n.getCurrentLang(),
    tMine: i18n.getDict().mine,
  },

  // 刷新当前页面文案
  refreshI18n() {
    const dict = i18n.getDict();
    this.setData({
      lang: i18n.getCurrentLang(),
      tMine: dict.mine,
    });
  },

  onShow() {
    this.refreshI18n();
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
        wx.showToast({
          title: this.data.tMine.toast_load_failed,
          icon: 'none',
        });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  // 退出登录：本地清理 + 返回登录页
  onLogout() {
    const t = this.data.tMine;

    wx.showModal({
      title: t.logout_title,
      content: t.logout_content,
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
