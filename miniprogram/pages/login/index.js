// pages/login/index.js
//
// 功能：
//  - 用户名 + 密码登录
//  - 下面两个按钮：注册为主播 / 注册为管理员
//  - 如果当前微信 openid 已绑定用户且已登录，则自动跳首页

const { login, getMe } = require('../../utils/ueeApi');

Page({
  data: {
    loginAccount: '',
    password: '',
    loading: false,
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

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onLoginTap() {
    if (this.data.loading) return;

    const { loginAccount, password } = this.data;
    if (!loginAccount || !password) {
      wx.showToast({ title: '请输入账号和密码', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    login(loginAccount, password)
      .then((me) => {
        // me.status: pending / approved / rejected
        if (me.status === 'approved') {
          wx.showToast({ title: '登录成功', icon: 'success' });
        } else if (me.status === 'pending') {
          wx.showToast({
            title: '已登录，等待管理员审核',
            icon: 'none',
          });
        } else if (me.status === 'rejected') {
          wx.showToast({
            title: '审核未通过，请修改资料后重新提交',
            icon: 'none',
          });
        }

        // 登录成功后统一跳到首页（订单页根据 status 控制是否显示数据）
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
