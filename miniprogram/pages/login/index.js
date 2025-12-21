// pages/login/index.js
//
// 功能：
//  - 用户名 + 密码登录
//  - 下面两个按钮：注册为主播 / 注册为管理员
//  - 如果当前微信 openid 已绑定用户且已登录，则自动跳首页

const { login, getMe } = require('../../utils/busiApi');
const i18n = require('../../utils/i18n');
const app = getApp();

Page({
  data: {
    loginAccount: '',
    password: '',
    loading: false,

        // 多语言
    lang: i18n.getCurrentLang(),
    tCommon: i18n.getDict().common,
    tLogin: i18n.getDict().login,
    langMenuVisible: false,
  },


  onLoad() {
    this.refreshI18n();
  },

  onShow() {
    // 自动登录：如果当前 openid 已绑用户，直接跳首页
    getMe()
      .then((me) => {
        if (me.loggedIn && me.status !== 'unregistered') {
          // 直接切到首页 tab
          wx.switchTab({
            url: '/pages/home/index',
          });
        }
      })
      .catch(() => {});
  },


  // ===== 多语言：刷新当前页面文案 =====
  refreshI18n() {
    const dict = i18n.getDict();
    this.setData({
      lang: i18n.getCurrentLang(),
      tCommon: dict.common,
      tLogin: dict.login,
    });
  },

  // 右上角按钮：展开/收起语言菜单
  onLangButtonTap() {
    this.setData({
      langMenuVisible: !this.data.langMenuVisible,
    });
  },

  // 选择具体语言（全局）
  onSelectLang(e) {
    const lang = e.currentTarget.dataset.lang; // 'zh' or 'en'

    if (app && typeof app.switchLang === 'function') {
      app.switchLang(lang); // 改全局语言 + tabBar
    } else {
      i18n.setCurrentLang(lang); // 兜底
    }

    this.refreshI18n();
    this.setData({ langMenuVisible: false });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onLoginTap() {
    if (this.data.loading) return;

    const { loginAccount, password } = this.data;
    if (!loginAccount || !password) {
      wx.showToast({
        title: this.data.tLogin.toast_need_account,
        icon: 'none',
      });
      return;
    }

    this.setData({ loading: true });

    login(loginAccount, password)
      .then((me) => {
        const t = this.data.tLogin;

        if (me.status === 'approved') {
          wx.showToast({ title: t.toast_login_success, icon: 'success' });
        } else if (me.status === 'pending') {
          wx.showToast({ title: t.toast_pending, icon: 'none' });
        } else if (me.status === 'rejected') {
          wx.showToast({ title: t.toast_rejected, icon: 'none' });
        }

        // 登录成功后统一跳到首页
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/home/index',
          });
        }, 500);
      })
      .catch((err) => {
        console.error('login error', err);
        // 具体错误提示已经在 request.js 里 toast 了
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },


  // 注册为主播
  onRegisterAnchor() {
    wx.navigateTo({
      url: '/pages/register/index?role=anchor',
    });
  },

  // 注册为管理员
  onRegisterAdmin() {
    wx.navigateTo({
      url: '/pages/register/index?role=admin',
    });
  },
});
