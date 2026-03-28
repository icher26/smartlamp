# Changelog

本项目的所有重要变更均记录于此，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

---

## [1.5.0] - 2026-03-28

### 修复

- **submit_failure.html** — 故障提交功能已正常工作
  - 后端 `/faults/addinfo` 接口修复完成
  - 故障数据提交包含完整字段（title、content、lightId、lightName、area等）
  - Token认证正常携带

### 测试验证

- ✅ 故障提交功能正常
- ✅ 故障列表查看正常
- ✅ 故障标记已处理功能正常
- ✅ 所有核心功能模块已验证通过

### 文档

- 更新 `README.md` 已知问题列表
- 更新 `PROJECT_PROGRESS.md` 项目状态
- 更新 `前后端联调交接文档.md` 测试清单

---

## [1.3.0] - 2026-03-18

### 修复

- **failure_details.html** — 重构故障详情页面，修复数据显示问题
  - 修复 HTML 结构错误（`</lebel>` 拼写错误、未闭合标签）
  - 优化内容区域布局，解决数据被遮挡问题
  - 添加备用数据获取逻辑（使用 `/faults/queryAll`）
- **handled_fault.html** — 向详情页传递完整故障数据
- **to_be_process.html** — 同上，优化数据传递
- **repair_detail.html** — 修复维修人员删除功能
  - API端点修正：`/repair/logicdelete` → `/repair/delete/{id}`
  - 使用路径参数方式传递ID
- **config.js** — 更新 `repairDelete` 端点配置

### 测试验证

- ✅ 故障详情页面数据显示正常
- ✅ 维修人员删除功能正常
- ✅ 路灯光亮状态（lampStatus）同步功能正常

### 已知问题

- ⚠️ 后端存在重复控制器（`/fault/*` 和 `/faults/*`），不影响功能使用

---

## [1.2.0] - 2026-03-16

### 修复

- **overview.html** — 修复 ECharts 2.x 柱状图不显示的问题
  - 使用顶级 `color` 数组配置颜色，确保柱子与图例颜色一致
  - 图例位置从左下角移至标题正下方居中
  - 禁用图例点击交互（`selectedMode: false`）
  - 增大 `grid.y2` 至 100，避免 x 轴旋转标签被遮挡
- **lamp.html** — 修复路灯列表分页数据解析
  - 兼容服务器返回 `{ records, total, pages, current }` 格式

### 优化

- 清理所有页面中的非专业注释，统一使用规范注释风格
  - 涉及文件：lamp.html、add_lamp.html、lamp_details.html、lamp_manage_list.html、management.html、offcanvas-drag-left-plus-menu.html

### 文档

- 新增 `README.md` 项目说明文档
- 新增 `CHANGELOG.md` 版本变更日志

---

## [1.0.0] - 2026-03-12

### 新增

- 初始化 Git 版本控制，添加 `.gitignore` 配置
- 创建 `PROJECT_PROGRESS.md` 项目进度文档

### 修复

- 修正服务器端口配置：由错误的 `8080` 改为正确的 `8880`
- 恢复 `js/app.js` 登录逻辑为原始版本
- 恢复 `overview.html` 与 `lamp.html` 数据加载逻辑
- 恢复 `lamp_details.html` 资源引用配置

### 优化

- 清理 7 个 `.bak` 备份文件
- 统一 API 配置至 `js/config.js`，通过 `appConfig` 全局对象管理

---

[1.5.0]: https://github.com/icher26/smartlamp/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/icher26/smartlamp/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/icher26/smartlamp/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/icher26/smartlamp/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/icher26/smartlamp/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/icher26/smartlamp/releases/tag/v1.0.0
