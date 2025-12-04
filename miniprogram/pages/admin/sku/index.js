// pages/admin/sku/index.js
//（现在已变成 PID → 主播绑定）
// call('skuAdmin', ...) 改成 call('skuAdmin', {action: 'pidMap.xxx'})

const { callSkuAdmin } = require('../../../utils/request');

Page({
  data: {
    list: [],
    showForm: false,
    editing: null, 
  },

  onLoad() {
    this.loadList();
  },

  loadList() {
    callSkuAdmin('pidMap.list', {})
      .then((res) => {
        this.setData({ list: res.list });
      });
  },

  // 新增表单
  onAdd() {
    this.setData({
      showForm: true,
      editing: {
        productId: '',
        productName: '',
        anchorId: '',
        anchorName: '',
        commissionRate: 0,
        visibleToAnchors: true,
        priority: 1,
      },
    });
  },

  // 编辑
  onEdit(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({ showForm: true, editing: item });
  },

  // 删除
  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除确认',
      content: '确定删除此 PID 绑定？',
      success: (res) => {
        if (res.confirm) {
          callSkuAdmin('pidMap.delete', { _id: id })
            .then(() => {
              wx.showToast({ title: '已删除' });
              this.loadList();
            });
        }
      },
    });
  },

  // 表单输入
  onInput(e) {
    const { field } = e.currentTarget.dataset;
    const v = e.detail.value;
    this.setData({
      editing: { ...this.data.editing, [field]: v },
    });
  },

  // 保存提交
  onSubmit() {
    const item = this.data.editing;
    callSkuAdmin('pidMap.save', item).then(() => {
      wx.showToast({ title: '已保存' });
      this.setData({ showForm: false });
      this.loadList();
    });
  },

  onCancel() {
    this.setData({ showForm: false });
  }
});
