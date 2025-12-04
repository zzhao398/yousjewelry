// pages/admin/anchor-approve/index.js
const { listPendingUsers, approveUser } = require('../../../utils/ueeApi');

Page({
  data: {
    loading: false,
    list: [],  // 待审核的用户
  },

  onShow() {
    this.fetchList();
  },

  fetchList() {
    this.setData({ loading: true });
    return listPendingUsers()
      .then((res) => {
        this.setData({
          list: (res.list || []),
        });
      })
      .catch((err) => {
        console.error('listPendingUsers error', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  // 通过审核：给主播分配一个 anchorId
  onApproveTap(e) {
    const { id } = e.currentTarget.dataset;
    const user = this.data.list.find((u) => u._id === id);
    if (!user) return;

    const defaultAnchorId = user.anchorId || user.loginAccount || '';

    wx.showModal({
      title: '通过审核',
      content: '请为该主播设置一个「主播ID」(用于后续绑定商品)，可直接使用登录账号或自定义。',
      editable: true,
      placeholderText: defaultAnchorId,
      success: (res) => {
        if (!res.confirm) return;

        const anchorId = (res.content || defaultAnchorId || '').trim();
        if (!anchorId) {
          wx.showToast({ title: '主播ID不能为空', icon: 'none' });
          return;
        }

        approveUser({
          userId: id,
          approve: true,
          role: user.requestedRole || 'anchor',
          anchorId,
        })
          .then(() => {
            wx.showToast({ title: '已通过', icon: 'success' });
            this.fetchList();
          })
          .catch((err) => {
            console.error('approveUser error', err);
            wx.showToast({ title: '操作失败', icon: 'none' });
          });
      },
    });
  },

  // 拒绝审核
  onRejectTap(e) {
    const { id } = e.currentTarget.dataset;

    wx.showModal({
      title: '拒绝申请',
      content: '确定要拒绝该主播的认证申请吗？',
      success: (res) => {
        if (!res.confirm) return;

        approveUser({
          userId: id,
          approve: false,
        })
          .then(() => {
            wx.showToast({ title: '已拒绝', icon: 'success' });
            this.fetchList();
          })
          .catch((err) => {
            console.error('approveUser reject error', err);
            wx.showToast({ title: '操作失败', icon: 'none' });
          });
      },
    });
  },
});
