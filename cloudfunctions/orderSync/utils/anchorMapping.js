// cloudfunctions/orderSync/utils/anchorMapping.js

/**
 * 根据 pidList 计算 anchorIdList：
 *  - 查 anchor_product_map 中所有 productId in pidList 的记录
 *  - 去重 anchorId
 *  - 返回 { anchorIdList, visibleToAnchors, channelType }
 */
async function calcAnchorInfoForOrder(db, pidList) {
  if (!Array.isArray(pidList) || pidList.length === 0) {
    return {
      anchorIdList: [],
      visibleToAnchors: false,
      channelType: 'organic', // 未绑定主播的自然订单
    };
  }

  const _ = db.command;
  const { data } = await db
    .collection('anchor_product_map')
    .where({
      productId: _.in(pidList),
      visibleToAnchors: true,
    })
    .get();

  if (!data.length) {
    return {
      anchorIdList: [],
      visibleToAnchors: false,
      channelType: 'organic',
    };
  }

  const anchorIdSet = new Set();
  data.forEach((m) => {
    if (m.anchorId) anchorIdSet.add(m.anchorId);
  });

  const anchorIdList = Array.from(anchorIdSet);

  return {
    anchorIdList,
    visibleToAnchors: true,
    channelType: anchorIdList.length ? 'anchor' : 'organic',
  };
}

module.exports = { calcAnchorInfoForOrder };
