// pages/register/index.js
//
// 功能：
//  - 根据 URL 参数 role=anchor/admin 区分注册类型
//  - 填写登录账号 + 密码 + 基本信息
//  - 提交后进入 pending，弹出提示联系管理员

const { registerUser } = require('../../utils/ueeApi');

Page({
  data: {
    role: 'anchor', // anchor | admin
    realName: '',
    displayName: '',
    loginAccount: '',
    password: '',
    confirmPassword: '',
    phone: '',
    email: '',
    platform: '',
    accountId: '',
    remark: '',
    submitting: false,
  },

  onLoad(options) {
    const role = options.role === 'admin' ? 'admin' : 'anchor';
    this.setData({ role });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onSubmit() {
    if (this.data.submitting) return;

    const {
      role,
      realName,
      displayName,
      loginAccount,
      password,
      confirmPassword,
      phone,
      email,
      platform,
      accountId,
      remark,
    } = this.data;

    if (!realName) {
      wx.showToast({ title: '请填写姓名', icon: 'none' });
      return;
    }
    if (!loginAccount) {
      wx.showToast({ title: '请填写登录账号', icon: 'none' });
      return;
    }
    if (!password) {
      wx.showToast({ title: '请设置密码', icon: 'none' });
      return;
    }
    if (password !== confirmPassword) {
      wx.showToast({ title: '两次密码不一致', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    registerUser({
      role,
      realName,
      displayName,
      loginAccount,
      password,
      phone,
      email,
      platform,
      accountId,
      remark,
    })
      .then(() => {
        const roleLabel = role === 'admin' ? '管理员' : '主播';
        wx.showModal({
          title: '提交成功',
          content:
            `你已提交${roleLabel}注册申请。\n请联系管理员完成审核，通过后即可登录并查看订单。`,
          showCancel: false,
          success: () => {
            wx.navigateBack();
          },
        });
      })
      .catch((err) => {
        console.error('register error', err);
      })
      .finally(() => {
        this.setData({ submitting: false });
      });
  },
});
