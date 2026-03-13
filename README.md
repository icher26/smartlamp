# 智能路灯管理系统 (SmartLamp)

基于 HBuilder X 5+ App 框架开发的移动端路灯管理应用，支持 Android 与 iOS 平台。

## 技术栈

| 技术 | 说明 |
|------|------|
| HBuilder X | 开发 IDE，5+ App 运行时 |
| MUI v3.x | 移动端 UI 框架 |
| ECharts 2.x | 数据可视化图表 |
| HTML5 Plus | 原生扩展 API（plus.*） |

## 服务器配置

| 环境 | 地址 |
|------|------|
| 局域网 | http://172.20.25.66:8880 |
| 公网1 | http://121.40.170.217:8880 |
| 公网2（当前） | http://8.137.33.218:8880 |

> 端口为 **8880**，配置文件：`js/config.js`

## 项目结构

```
smartlamp/
├── js/
│   ├── config.js          # API 地址与端点配置
│   ├── app.js             # 登录 / 注册 / 注销逻辑
│   ├── mui.min.js         # MUI 框架核心
│   └── mui.picker.min.js  # 日期选择器
├── css/
│   ├── app.css            # 业务样式
│   └── mui.min.css        # MUI 样式
├── libs/
│   └── echarts-all.js     # ECharts 图表库
├── fonts/
│   └── mui.ttf            # MUI 图标字体
├── manifest.json          # 应用配置清单
├── icon.png               # 应用图标
└── [23 个 HTML 页面]
```

## 页面导航

```
guide.html              启动引导页
└── login_main.html     登录主页
    ├── login_login.html     登录
    └── login_register.html  注册
        └── index.html       主框架（TabBar）
            ├── overview.html       总览（ECharts 柱状图）
            ├── lamp.html           路灯列表
            └── management.html     管理中心
```

## 功能模块

| 模块 | 主要页面 |
|------|---------|
| 用户认证 | login_login / login_register |
| 数据总览 | overview（路灯总数 + 区域分布图） |
| 路灯管理 | lamp / lamp_details / add_lamp / lamp_manage_list |
| 故障管理 | submit_failure / to_be_process / handled_fault / failure_details |
| 建议管理 | pending_advice / processed_advice / advice_details |
| 维修人员 | repair_person_list / repair_person_detail / add_person / repair_detail |

## 快速开始

### 环境要求

- HBuilder X 3.x 及以上
- Android 设备或模拟器（开启开发者模式）

### 运行步骤

1. 用 HBuilder X 打开项目目录
2. 连接 Android 设备（USB 调试）
3. 菜单：**运行 → 运行到手机或模拟器 → 选择设备**
4. 查看控制台日志输出

### 真机调试

```
1. 手机开启「USB 调试」与「开发者模式」
2. HBuilder X 运行到 Android 设备
3. Chrome 浏览器访问 chrome://inspect 查看 Console / Network
```

## API 接口

所有接口基于 `http://8.137.33.218:8880`，由 `js/config.js` 统一管理。

| 接口 | 方法 | 说明 |
|------|------|------|
| /login | POST | 用户登录 |
| /register | POST | 用户注册 |
| /lamps/lampstotal | POST | 获取路灯总数及区域分布 |
| /lamps/findAllByPage/:page | GET | 分页查询路灯列表 |
| /lamps/selectone | POST | 查询单条路灯信息 |
| /lamps/updateall | POST | 更新路灯信息 |
| /lamps/delete | POST | 删除路灯 |
| /lamps/add | POST | 添加路灯 |
| /fault/select | POST | 查询故障列表 |
| /fault/addinfo | POST | 提交故障 |
| /advice/select | POST | 查询建议列表 |
| /repair/findAllByPage | POST | 分页查询维修人员 |

## 推送至 GitHub

```bash
# 开启 Clash 代理（规则模式）后配置 Git 代理
git config --global http.proxy http://127.0.0.1:7897
git config --global https.proxy http://127.0.0.1:7897

git push origin main

# 推送完成后清除代理
git config --global --unset http.proxy
git config --global --unset https.proxy
```

## 注意事项

- 服务器端口为 **8880**（不是 8080）
- 运行时读取 `unpackage/resources/H54765B43/www/` 目录
- `unpackage/` 已加入 `.gitignore`，不纳入版本控制
- ECharts 使用 2.x 版本，配置项使用 `x/y` 而非 `left/top`
