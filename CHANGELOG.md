# Changelog

本项目的所有重要变更均记录于此，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

---

## [1.1.0] - 2026-03-13

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

[1.1.0]: https://github.com/icher26/smartlamp/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/icher26/smartlamp/releases/tag/v1.0.0
