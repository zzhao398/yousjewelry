# YOUJEWLRY 订单与主播管理小程序

一个基于微信云开发的业务小程序，面向主播与管理员提供订单同步、审核与管理能力。前端位于 `miniprogram/`，云函数位于 `cloudfunctions/`。

## 项目亮点
- 业务闭环：登录/注册 -> 审核 -> 订单同步 -> 订单查看与管理
- 角色分层：管理员与主播权限隔离，关键数据按角色控制
- 可扩展：订单同步、PID 绑定、监控均以云函数拆分
- i18n：中英双语文案与 TabBar 动态切换

## 功能概览
- 登录/注册（管理员、主播）
- 首页概况：今日订单数、GMV、待发货
- 订单列表/详情：搜索、分页、权限控制
- 主播管理：审核、主播列表、PID 绑定、历史订单回填
- 订单同步与监控（云函数）
- 运行态缓存：首页概况与订单列表/详情缓存优化

## 演示截图
> 将截图放在 `docs/images/` 目录，并按以下文件名命名，README 会自动显示。

- 首页概况：`docs/images/01-home.png`
- 我的/管理入口：`docs/images/02-mine.png.png`
- 订单列表：`docs/images/03-orders.png.png`
- 登录页：`docs/images/04-login.png`

<table>
  <tr>
    <td><img src="docs/images/01-home.png" width="240" alt="首页概况" /></td>
    <td><img src="docs/images/02-mine.png.png" width="240" alt="我的/管理入口" /></td>
  </tr>
  <tr>
    <td><img src="docs/images/03-orders.png.png" width="240" alt="订单列表" /></td>
    <td><img src="docs/images/04-login.png" width="240" alt="登录页" /></td>
  </tr>
</table>

## 技术栈
- 微信小程序原生开发
- 微信云开发（云函数 + 数据库）
- Node.js（云函数运行时）

## 目录结构
- `miniprogram/` 小程序前端
- `cloudfunctions/` 云函数
  - `backendFunction/` 业务聚合接口（订单、用户、审核等）
  - `orderSync/` 订单同步
  - `monitorSync/` 同步监控
  - `pidFunction/` PID 相关能力
  - `productAdmin/` 产品后台相关

## 快速开始
1. 使用微信开发者工具导入项目（根目录 `project.config.json`）
2. 配置云环境：
   - 在云开发控制台创建环境
   - 修改 `miniprogram/app.js` 中 `globalData.env` 为你的环境 ID
3. 部署云函数：在开发者工具中进入 `cloudfunctions/`，逐个上传并部署（如有依赖需先安装）
4. 运行小程序（编译启动）

## 外部接口配置（必做）
`orderSync` 与 `pidFunction` 通过配置文件接入外部接口，默认走 Mock。
请在以下目录新增 `config.local.js`（本地私密配置，不提交 Git）：
- `cloudfunctions/orderSync/utils/config.local.js`
- `cloudfunctions/pidFunction/utils/config.local.js`

示例：

```js
module.exports = {
  IS_MOCK: true,
  ACCESS_NUMBER: 'YOUR_NUMBER',
  SECRET: 'YOUR_SECRET',
  BASE_URL_MOCK: 'https://youjewelry.free.beeceptor.com/gateway/',
  BASE_URL_PROD: 'https://www.yousjewelry.com/gateway/',
  API_FROM: 'your_source',
};
```

说明：
- `IS_MOCK` 为 true 时走 Mock 地址
- `ACCESS_NUMBER` 与 `SECRET` 为接口凭证
- `API_FROM` 仅 `pidFunction` 使用，可留空

## 角色与权限
- 主播：仅可查看与自己绑定的订单数据
- 管理员：可访问主播审核列表、主播列表、PID 绑定、订单回填等管理页面

## 关键页面
- 首页：展示订单数/GMV/待发货概况
- 订单列表：支持搜索与状态筛选
- 订单详情：订单基础信息、配送与备注
- 管理端：主播审核、PID 绑定、历史订单回填

## 参考
- 微信云开发文档：https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html


