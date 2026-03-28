# 智能路灯管理系统 - MQTT集成文档

> **文档版本**: v1.0
> **最后更新**: 2026-03-28
> **集成状态**: ⏳ MQTT接口已预留，等待硬件端联调

---

## 📘 文档概述

本文档详细说明智能路灯管理系统与MQTT协议的集成方案，包括架构设计、API接口规范以及与现有系统的兼容性等内容。

### 集成目标

- 实现实时路灯状态监控与控制
- 提供双向通信能力，支持远程指令下发
- 保持与现有HTTP API的兼容性
- 支持大规模路灯设备的统一管理

---

## 🏗️ 架构设计

### 系统架构图

```
                     ┌─────────────────┐
                     │   MQTT Broker   │
                     │  (EMQX/RabbitMQ)│
                     └─────────┬───────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌────────▼────────┐   ┌──────▼─────────┐
│   路灯设备端    │   │  移动管理端     │   │  Web管理后台   │
│  (嵌入式设备)   │   │  (HBuilder X)   │   │   (Web应用)   │
│   ┌─────────┐  │   │   ┌─────────┐  │   │   ┌─────────┐  │
│   │ MQTT   │  │   │   │ MQTT   │  │   │   │ MQTT   │  │
│   │ Client │  │   │   │ Client │  │   │   │ Client │  │
│   └─────────┘  │   │   └─────────┘  │   │   └─────────┘  │
└────────────────┘   └────────────────┘   └────────────────┘
```

### 集成层次

```
┌─────────────────────────────────────────────────────────┐
│                    应用层                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │              移动应用业务逻辑                      │   │
│  │   灯具控制、状态显示、故障报警、图表渲染等           │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                    通信层                               │
│  ┌─────────────────┐ ┌──────────────────────────────┐  │
│  │    MQTT         │ │        HTTP API            │  │
│  │   协议栈         │ │      (向后兼容)            │  │
│  └─────────────────┘ └──────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                   传输层                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │              TCP/IP / WebSocket                 │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 📡 MQTT主题设计

### 设备状态上报主题 (Device → Server)

| 主题 | 说明 | QoS |
|------|------|-----|
| `smartlamp/status/+/report` | 设备定期状态上报 | 1 |
| `smartlamp/status/+/online` | 设备上线通知 | 1 |
| `smartlamp/status/+/offline` | 设备离线通知 | 1 |
| `smartlamp/fault/+/alert` | 故障告警消息 | 1 |
| `smartlamp/heartbeat/+/ping` | 心跳消息 | 0 |

### 服务控制指令主题 (Server → Device)

| 主题 | 说明 | QoS |
|------|------|-----|
| `smartlamp/control/+/light` | 灯光开关控制 | 1 |
| `smartlamp/control/+/brightness` | 亮度调节 | 1 |
| `smartlamp/control/+/angle` | 角度调节 | 1 |
| `smartlamp/control/+/power` | 电源控制 | 1 |
| `smartlamp/command/+/general` | 通用命令 | 1 |

### 群组控制主题 (Server → Devices)

| 主题 | 说明 | QoS |
|------|------|-----|
| `smartlamp/group/+/control/light` | 群组灯光控制 | 1 |
| `smartlamp/group/+/control/brightness` | 群组亮度控制 | 1 |
| `smartlamp/broadcast/all` | 广播消息 | 0 |

---

## 📋 消息格式规范

### 状态上报消息格式 (JSON)

```json
{
  "deviceId": "LAMP001",
  "timestamp": 1640995200000,
  "type": "status_report",
  "data": {
    "status": 1,                    // 状态: 0-停止, 1-正常, 2-故障
    "lampStatus": 1,               // 灯状态: 0-关闭, 1-开启
    "mode": 0,                     // 模式: 0-手动, 1-自动
    "area": "A区",
    "longitude": 116.3975,
    "latitude": 39.9075,
    "lightId": "LAMP001",
    "byname": "A区主路灯1",
    "battrayPackOneCharge": 3.6,
    "battrayPackTwoCharge": 3.5,
    "currentChargeBattray": "1",    // 充电电池组
    "currentComsumeBattray": "1",   // 耗电电池组
    "currentHighAngel": 45.5,       // 灯高度角
    "currentDirectionAngel": 120.0, // 灯方位角
    "threoyHighAngel": 60.0,        // 太阳高度角
    "threoyDirectionAngel": 135.0,  // 太阳方位角
    "locationTime": "2026-03-15 14:30:00",
    "duration": "72小时",
    "lightTime": "18:00-06:00",
    "count1": 0, "count2": 0, ..., "count24": 0 // 24小时点亮统计
  },
  "metadata": {
    "version": "1.0",
    "source": "device",
    "checksum": "abc123"
  }
}
```

### 控制指令消息格式 (JSON)

```json
{
  "commandId": "CMD001",
  "timestamp": 1640995200000,
  "type": "control_command",
  "target": {
    "type": "single",               // single/group/broadcast
    "id": "LAMP001"                // 目标ID或群组ID
  },
  "action": {
    "type": "light_control",        // 具体动作类型
    "operation": "toggle",          // 具体操作
    "params": {
      "lampStatus": 1               // 控制参数
    }
  },
  "requester": "ADMIN001",
  "priority": 1,                    // 优先级: 1-低, 2-中, 3-高
  "ttl": 30000,                     // 生存时间(ms)
  "metadata": {
    "version": "1.0",
    "source": "admin_app",
    "checksum": "def456"
  }
}
```

### 响应消息格式 (JSON)

```json
{
  "responseId": "RESP001",
  "originalCommandId": "CMD001",
  "timestamp": 1640995201000,
  "type": "command_response",
  "status": "success",              // success/error/timeout
  "result": {
    "code": 200,
    "message": "操作成功",
    "details": "灯光状态已更新为开启"
  },
  "data": {
    "previousStatus": 0,
    "currentStatus": 1
  },
  "metadata": {
    "version": "1.0",
    "source": "device",
    "checksum": "ghi789"
  }
}
```

---

## 🔧 客户端集成方案

### 移动端集成 (HBuilder X + HTML5 Plus)

在 `js/mqtt-client.js` 中实现MQTT客户端管理：

```javascript
/**
 * MQTT客户端管理模块
 * 用于智能路灯管理系统与MQTT Broker的通信
 */

(function(window) {
    // MQTT客户端配置
    const MQTT_CONFIG = {
        // 使用WebSocket连接
        brokerUrl: 'ws://8.137.33.218:8083', // MQTT Broker WebSocket端口
        username: 'smartlamp_mobile',
        password: 'secure_password',
        clientId: 'smartlamp_mobile_' + Date.now(),
        connectOptions: {
            timeout: 10,
            keepAliveInterval: 60,
            cleanSession: true,
            useSSL: false // 生产环境建议使用wss
        }
    };

    // MQTT主题定义
    const TOPICS = {
        STATUS_REPORT: 'smartlamp/status/+/report',
        CONTROL_COMMAND: 'smartlamp/control/',
        GROUP_CONTROL: 'smartlamp/group/',
        FAULT_ALERT: 'smartlamp/fault/',
        HEARTBEAT: 'smartlamp/heartbeat/'
    };

    // MQTT客户端类
    class MQTTClient {
        constructor() {
            this.client = null;
            this.isConnected = false;
            this.subscribedTopics = new Set();
            this.messageHandlers = new Map();
            this.reconnectAttempts = 0;
            this.maxReconnectAttempts = 10;

            // 初始化客户端
            this.init();
        }

        init() {
            try {
                // 创建MQTT客户端实例
                this.client = new Paho.MQTT.Client(
                    MQTT_CONFIG.brokerUrl,
                    MQTT_CONFIG.clientId
                );

                // 设置回调函数
                this.client.onConnectionLost = this.onConnectionLost.bind(this);
                this.client.onMessageArrived = this.onMessageArrived.bind(this);

                console.log('MQTT客户端初始化成功');
            } catch (error) {
                console.error('MQTT客户端初始化失败:', error);
            }
        }

        /**
         * 连接到MQTT Broker
         */
        connect(onSuccess, onError) {
            const connectOptions = {
                ...MQTT_CONFIG.connectOptions,
                userName: MQTT_CONFIG.username,
                password: MQTT_CONFIG.password,
                onSuccess: () => {
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    console.log('MQTT连接成功');

                    // 恢复之前的订阅
                    this.restoreSubscriptions();

                    if (onSuccess) onSuccess();
                },
                onFailure: (error) => {
                    this.isConnected = false;
                    console.error('MQTT连接失败:', error);

                    // 尝试重连
                    this.attemptReconnect();

                    if (onError) onError(error);
                }
            };

            try {
                this.client.connect(connectOptions);
            } catch (error) {
                console.error('MQTT连接异常:', error);
                if (onError) onError(error);
            }
        }

        // ... 其他方法实现（订阅、发布、重连等）
    }

    // 导出模块
    window.SmartLampMQTT = {
        MQTTClient,
        TOPICS,
        MQTT_CONFIG
    };
})(window);
```

### 设备端集成 (嵌入式)

设备端需要实现轻量级MQTT客户端，建议使用Paho嵌入式库或其他轻量级MQTT库，实现以下功能：

1. 状态定期上报
2. 控制指令接收与执行
3. 心跳维护
4. 故障告警发送

---

## 🔄 与现有系统的兼容性

### API网关桥接

为保持与现有HTTP API的兼容性，实现API网关桥接：

```
┌─────────────────┐    HTTP API     ┌─────────────────┐
│   移动应用      │ ←────────────── │   API网关       │
└─────────────────┘                 │ (HTTP ←→ MQTT)  │
                                    ├─────────────────┤
┌─────────────────┐    MQTT         │   MQTT Broker   │
│   路灯设备      │ ←────────────── │                 │
└─────────────────┘                 └─────────────────┘
```

### 数据映射表

| HTTP API | MQTT Topic | 说明 |
|----------|------------|------|
| `POST /lamps/updateall` | `smartlamp/control/+/general` | 灯具信息更新 |
| `POST /lamps/findOne` | `smartlamp/status/+/report` | 获取灯具状态 |
| `POST /fault/addinfo` | `smartlamp/fault/+/alert` | 故障上报 |
| `POST /repair/addperson` | `smartlamp/command/+/general` | 维修指令 |

---

## 🚀 部署指南

### MQTT Broker部署

1. **选择MQTT Broker**
   - EMQX (企业级，功能丰富)
   - Mosquitto (轻量级，资源占用少)
   - RabbitMQ (已有RabbitMQ环境时)

2. **资源配置**
   ```bash
   # EMQX部署示例
   docker run -d --name emqx \
     -p 1883:1883 \
     -p 8083:8083 \
     -p 8084:8084 \
     -p 18083:18083 \
     emqx/emqx:latest
   ```

3. **安全配置**
   - 启用用户名密码认证
   - 配置SSL/TLS加密
   - 设置访问权限控制

### 移动端配置

1. **添加依赖**
   ```html
   <!-- 在页面头部添加MQTT库 -->
   <script src="./libs/paho-mqtt.js"></script>
   <script src="./js/mqtt-client.js"></script>
   ```

2. **初始化客户端**
   ```javascript
   // 在应用初始化时建立MQTT连接
   document.addEventListener('plusready', function() {
       const mqttClient = new SmartLampMQTT.MQTTClient();
       mqttClient.connect(
           () => console.log('MQTT连接成功'),
           (error) => console.error('MQTT连接失败:', error)
       );
   });
   ```

---

## 🔍 安全考虑

### 认证授权

1. **设备认证**
   - 每个设备分配唯一clientID和凭证
   - 支持证书认证或用户名密码认证

2. **权限控制**
   - 设备只能发布自己的状态主题
   - 设备只能订阅分配给它的控制主题
   - 管理员账户可以发布群组控制消息

### 数据安全

1. **传输加密**
   - 生产环境使用TLS/SSL加密通信
   - 配置WSS协议用于WebSockets

2. **消息安全**
   - 消息体使用JSON格式，包含校验和
   - 敏感数据使用AES加密传输

---

## 📊 监控与运维

### 连接监控

1. **在线设备统计**
   - 实时统计在线设备数量
   - 监控连接质量指标

2. **消息流量监控**
   - 监控消息发送/接收速率
   - 统计消息成功率

### 告警机制

1. **连接异常告警**
   - 设备频繁掉线告警
   - 连接超时告警

2. **数据异常告警**
   - 消息格式错误告警
   - 数据缺失告警

---

## 🚀 未来扩展

### 功能扩展

1. **边缘计算支持**
   - 在设备端实现部分数据分析
   - 减少云端处理压力

2. **AI算法集成**
   - 智能调度算法
   - 故障预测模型

### 协议扩展

1. **CoAP协议支持**
   - 适用于资源受限设备
   - UDP传输降低网络负载

2. **LwM2M协议支持**
   - 专为物联网设备管理设计
   - 提供标准化的设备管理接口

---

## 📞 技术支持

- **开发团队**: SmartLamp开发小组
- **文档维护**: 2026年3月
- **技术支持**: [联系方式待填写]

---

## 📂 相关文档

| 文档 | 说明 |
|------|------|
| `MQTT_HARDWARE_INTEGRATION.md` | 硬件端联调交接文档 |
| `js/mqtt-client.js` | MQTT客户端核心代码 |
| `mqtt_control_panel.html` | MQTT调试控制面板 |

---

**文档版本**: v1.0
**最后更新**: 2026-03-28