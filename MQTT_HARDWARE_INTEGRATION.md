# 智能路灯管理系统 - 硬件端MQTT联调交接文档

> **文档版本**: v1.0
> **创建时间**: 2026-03-28
> **适用对象**: 硬件开发团队、嵌入式开发者
> **前端状态**: ✅ MQTT接口已就绪，等待硬件端对接

---

## 📋 文档概述

本文档面向硬件开发团队，说明智能路灯APP端已预留的MQTT接口规范。硬件端需按照本文档实现相应的MQTT通信功能，完成与APP端的双向数据联通。

---

## 🏗️ 系统通信架构

```
┌─────────────────────────────────────────────────────────────┐
│                        MQTT Broker                           │
│                   (需部署: EMQX/Mosquitto)                   │
│                  WebSocket端口: 8083 (ws)                    │
│                  TCP端口: 1883 (mqtt)                        │
│                  管理端口: 18083                              │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
┌──────────────────────┐      ┌──────────────────────┐
│     APP移动端         │      │     路灯硬件端        │
│  (已实现 MQTT客户端)  │      │   (待实现 MQTT客户端)  │
│                      │      │                      │
│  - 状态订阅          │◄────►│  - 状态上报          │
│  - 命令发布          │      │  - 命令接收执行       │
│  - 故障监听          │      │  - 故障告警发送       │
│  - 心跳检测          │      │  - 心跳响应          │
└──────────────────────┘      └──────────────────────┘
```

---

## 📡 MQTT Broker配置要求

### 推荐Broker
| Broker | 说明 | 推荐场景 |
|--------|------|----------|
| **EMQX** | 企业级MQTT Broker，支持大规模设备连接 | 生产环境（推荐） |
| Mosquitto | 轻量级开源Broker | 开发测试环境 |
| RabbitMQ MQTT插件 | 需配合RabbitMQ使用 | 已有RabbitMQ环境 |

### 端口配置
| 端口 | 协议 | 用途 |
|------|------|------|
| 1883 | MQTT (TCP) | 硬件设备连接 |
| 8083 | WebSocket (ws) | APP/Web端连接 |
| 8084 | WebSocket (wss) | 安全连接（生产环境推荐） |
| 18083 | HTTP | 管理面板（EMQX Dashboard） |

### Docker部署示例（EMQX）
```bash
docker run -d --name emqx \
  -p 1883:1883 \
  -p 8083:8083 \
  -p 8084:8084 \
  -p 18083:18083 \
  emqx/emqx:latest

# 访问管理面板: http://服务器IP:18083
# 默认账号: admin / public
```

### 认证配置
MQTT Broker需要配置以下认证信息：

| 客户端类型 | 用户名 | 密码 | ClientID前缀 |
|------------|--------|------|--------------|
| APP移动端 | `smartlamp_mobile` | `secure_password` | `smartlamp_mobile_` |
| 硬件设备端 | `smartlamp_device` | `device_password` | `smartlamp_device_` |
| 管理后台 | `smartlamp_admin` | `admin_password` | `smartlamp_admin_` |

---

## 📡 MQTT主题规范

### 主题命名规则
- 前缀: `smartlamp/`
- 通配符: `+` (单层匹配), `#` (多层匹配)
- 设备ID替换: 主题中的 `{deviceId}` 或 `+` 需替换为实际路灯物理编号（如 `LAMP001`）

### 主题分类

#### 1️⃣ 设备状态上报主题（硬件 → APP）

| 主题模式 | QoS | 说明 | 消息方向 |
|----------|-----|------|----------|
| `smartlamp/status/{deviceId}/report` | 1 | 定期状态上报 | 设备发布，APP订阅 |
| `smartlamp/status/{deviceId}/online` | 1 | 设备上线通知 | 设备发布，APP订阅 |
| `smartlamp/status/{deviceId}/offline` | 1 | 设备离线通知（遗嘱消息） | Broker发布（设备预设） |
| `smartlamp/heartbeat/{deviceId}/ping` | 0 | 心跳消息 | 设备发布，APP订阅 |
| `smartlamp/fault/{deviceId}/alert` | 1 | 故障告警 | 设备发布，APP订阅 |

**APP端订阅模式:**
```javascript
// APP订阅所有设备状态
mqttClient.subscribe('smartlamp/status/+/report', handler);
mqttClient.subscribe('smartlamp/status/+/online', handler);
mqttClient.subscribe('smartlamp/fault/+/alert', handler);
```

#### 2️⃣ 控制命令主题（APP → 硬件）

| 主题模式 | QoS | 说明 | 消息方向 |
|----------|-----|------|----------|
| `smartlamp/control/{deviceId}/turn_on` | 1 | 开灯命令 | APP发布，设备订阅 |
| `smartlamp/control/{deviceId}/turn_off` | 1 | 关灯命令 | APP发布，设备订阅 |
| `smartlamp/control/{deviceId}/set_brightness` | 1 | 设置亮度 | APP发布，设备订阅 |
| `smartlamp/control/{deviceId}/set_angle` | 1 | 设置角度 | APP发布，设备订阅 |
| `smartlamp/control/{deviceId}/auto_mode` | 1 | 切换自动模式 | APP发布，设备订阅 |
| `smartlamp/control/{deviceId}/manual_mode` | 1 | 切换手动模式 | APP发布，设备订阅 |
| `smartlamp/control/{deviceId}/status_request` | 1 | 状态查询请求 | APP发布，设备订阅 |

**硬件端订阅模式:**
```c
// 硬件端订阅所有控制命令
mqtt_subscribe("smartlamp/control/{deviceId}/#");
```

#### 3️⃣ 响应反馈主题（硬件 → APP）

| 主题模式 | QoS | 说明 | 消息方向 |
|----------|-----|------|----------|
| `smartlamp/response/{deviceId}/{commandId}` | 1 | 命令执行结果反馈 | 设备发布，APP订阅 |

#### 4️⃣ 群组控制主题（APP → 多设备）

| 主题模式 | QoS | 说明 | 消息方向 |
|----------|-----|------|----------|
| `smartlamp/group/{areaId}/turn_on` | 1 | 区域群组开灯 | APP发布，该区域设备订阅 |
| `smartlamp/group/{areaId}/turn_off` | 1 | 区域群组关灯 | APP发布，该区域设备订阅 |
| `smartlamp/group/{areaId}/set_brightness` | 1 | 区域群组亮度 | APP发布，该区域设备订阅 |

---

## 📋 消息格式规范

### 1️⃣ 状态上报消息（设备 → APP）

**主题:** `smartlamp/status/{deviceId}/report`

**消息体 (JSON):**
```json
{
  "deviceId": "LAMP001",
  "timestamp": 1711612800000,
  "type": "status_report",
  "data": {
    "status": 1,
    "lampStatus": 1,
    "mode": 0,
    "brightness": 80,
    "area": "A区",
    "byname": "A区主路灯1",
    "lightId": "LAMP001",
    "longitude": 116.3975,
    "latitude": 39.9075,
    "batteryVoltage": 3.6,
    "batteryLevel": 85,
    "panelAngle": 45.5,
    "panelDirection": 120.0,
    "temperature": 25.5,
    "lightTime": "18:00-06:00",
    "uptime": 72,
    "errorCount": 0
  },
  "metadata": {
    "version": "1.0",
    "source": "device"
  }
}
```

**字段说明:**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `deviceId` | String | ✅ | 设备物理编号 |
| `timestamp` | Long | ✅ | 消息时间戳（毫秒） |
| `type` | String | ✅ | 消息类型：`status_report` |
| `data.status` | Integer | ✅ | 设备状态：0停止/1正常/2故障 |
| `data.lampStatus` | Integer | ✅ | 灯状态：0关闭/1开启 |
| `data.mode` | Integer | ✅ | 运行模式：0手动/1自动 |
| `data.brightness` | Integer | ⬜ | 当前亮度（0-100） |
| `data.area` | String | ⬜ | 所属区域 |
| `data.batteryVoltage` | Float | ⬜ | 电池电压(V) |
| `data.batteryLevel` | Integer | ⬜ | 电池电量百分比 |
| `data.temperature` | Float | ⬜ | 设备温度(℃) |

---

### 2️⃣ 控制命令消息（APP → 设备）

**主题示例:** `smartlamp/control/LAMP001/turn_on`

**开灯命令:**
```json
{
  "commandId": "cmd_1711612800001",
  "timestamp": 1711612800001,
  "type": "control_command",
  "target": {
    "type": "single",
    "id": "LAMP001"
  },
  "action": {
    "type": "turn_on",
    "operation": "turn_on",
    "params": {
      "lampStatus": 1
    }
  },
  "requester": "APP_USER",
  "priority": 2
}
```

**关灯命令:**
```json
{
  "commandId": "cmd_1711612800002",
  "timestamp": 1711612800002,
  "type": "control_command",
  "target": {
    "type": "single",
    "id": "LAMP001"
  },
  "action": {
    "type": "turn_off",
    "operation": "turn_off",
    "params": {
      "lampStatus": 0
    }
  },
  "requester": "APP_USER",
  "priority": 2
}
```

**设置亮度命令:**
```json
{
  "commandId": "cmd_1711612800003",
  "timestamp": 1711612800003,
  "type": "control_command",
  "target": {
    "type": "single",
    "id": "LAMP001"
  },
  "action": {
    "type": "set_brightness",
    "operation": "set_brightness",
    "params": {
      "brightness": 75
    }
  },
  "requester": "APP_USER",
  "priority": 2
}
```

**设置角度命令:**
```json
{
  "commandId": "cmd_1711612800004",
  "timestamp": 1711612800004,
  "type": "control_command",
  "target": {
    "type": "single",
    "id": "LAMP001"
  },
  "action": {
    "type": "set_angle",
    "operation": "set_angle",
    "params": {
      "highAngle": 60.0,
      "directionAngle": 135.0
    }
  },
  "requester": "APP_USER",
  "priority": 2
}
```

**切换模式命令:**
```json
{
  "commandId": "cmd_1711612800005",
  "timestamp": 1711612800005,
  "type": "control_command",
  "target": {
    "type": "single",
    "id": "LAMP001"
  },
  "action": {
    "type": "auto_mode",
    "operation": "auto_mode",
    "params": {
      "mode": 1
    }
  },
  "requester": "APP_USER",
  "priority": 2
}
```

**状态查询请求:**
```json
{
  "requestId": "req_1711612800006",
  "timestamp": 1711612800006,
  "type": "status_request",
  "target": {
    "type": "single",
    "id": "LAMP001"
  }
}
```

---

### 3️⃣ 命令执行响应（设备 → APP）

**主题:** `smartlamp/response/{deviceId}/{commandId}`

**成功响应:**
```json
{
  "responseId": "resp_1711612801001",
  "originalCommandId": "cmd_1711612800001",
  "timestamp": 1711612801001,
  "type": "command_response",
  "status": "success",
  "result": {
    "code": 200,
    "message": "开灯成功"
  },
  "data": {
    "previousStatus": 0,
    "currentStatus": 1
  }
}
```

**失败响应:**
```json
{
  "responseId": "resp_1711612801002",
  "originalCommandId": "cmd_1711612800002",
  "timestamp": 1711612801002,
  "type": "command_response",
  "status": "error",
  "result": {
    "code": 500,
    "message": "执行失败：电池电量不足"
  }
}
```

---

### 4️⃣ 故障告警消息（设备 → APP）

**主题:** `smartlamp/fault/{deviceId}/alert`

```json
{
  "deviceId": "LAMP001",
  "timestamp": 1711612800007,
  "type": "fault_alert",
  "severity": "high",
  "fault": {
    "code": "FAULT_001",
    "type": "battery_low",
    "message": "电池电量低于20%",
    "details": {
      "batteryLevel": 15,
      "batteryVoltage": 2.8,
      "threshold": 20
    }
  },
  "suggestion": "请及时更换电池或检查充电系统"
}
```

**故障类型定义:**
| 故障代码 | 类型 | 说明 | 严重程度 |
|----------|------|------|----------|
| `FAULT_001` | `battery_low` | 电池电量低 | high |
| `FAULT_002` | `battery_fault` | 电池故障 | critical |
| `FAULT_003` | `panel_fault` | 太阳能板故障 | high |
| `FAULT_004` | `led_fault` | LED灯珠故障 | medium |
| `FAULT_005` | `controller_fault` | 控制器故障 | critical |
| `FAULT_006` | `temperature_high` | 温度过高 | medium |
| `FAULT_007` | `communication_fault` | 通信故障 | high |

---

### 5️⃣ 心跳消息（设备 → APP）

**主题:** `smartlamp/heartbeat/{deviceId}/ping`

```json
{
  "deviceId": "LAMP001",
  "timestamp": 1711612800008,
  "type": "heartbeat",
  "status": "alive",
  "uptime": 3600
}
```

**心跳频率:** 建议30秒-60秒发送一次

---

### 6️⃣ 设备上线/离线消息

**上线消息主题:** `smartlamp/status/{deviceId}/online`
```json
{
  "deviceId": "LAMP001",
  "timestamp": 1711612800009,
  "type": "device_online",
  "reason": "power_on"
}
```

**离线消息主题:** `smartlamp/status/{deviceId}/offline`
- 配置为MQTT遗嘱消息（Last Will），设备异常断开时由Broker自动发布

---

## 🔧 硬件端实现要求

### 1️⃣ MQTT客户端功能清单

| 功能 | 优先级 | 说明 |
|------|--------|------|
| MQTT连接建立 | P0 | 连接到Broker，支持认证 |
| 心跳保持 | P0 | 保持连接活跃，防止断开 |
| 主题订阅 | P0 | 订阅控制命令主题 |
| 消息发布 | P0 | 发布状态上报消息 |
| 命令解析执行 | P0 | 解析JSON命令并执行 |
| 响应反馈 | P0 | 执行完成后发布响应消息 |
| 故障检测上报 | P1 | 检测异常并主动上报 |
| 断线重连 | P1 | 网络恢复后自动重连 |
| 遗嘱消息配置 | P1 | 配置离线通知 |
| 数据缓存 | P2 | 断线时缓存待发送数据 |

### 2️⃣ 推荐嵌入式MQTT库

| 平台 | 推荐库 | 说明 |
|------|--------|------|
| **ESP32/ESP8266** | `PubSubClient` | Arduino生态，简单易用 |
| **STM32** | `Paho MQTT C` | 官方嵌入式库 |
| **Arduino** | `PubSubClient` | 兼容Arduino平台 |
| **FreeRTOS** | `AWS IoT SDK` | 或使用Paho C |
| **RT-Thread** | `RT-Thread MQTT组件` | 内置支持 |
| **华为LiteOS** | `LiteOS MQTT组件` | 内置支持 |

### 3️⃣ ESP32示例代码框架

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// WiFi配置
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT配置
const char* mqtt_server = "8.137.33.218";
const int mqtt_port = 1883;
const char* mqtt_user = "smartlamp_device";
const char* mqtt_password = "device_password";
const char* device_id = "LAMP001";

WiFiClient espClient;
PubSubClient mqttClient(espClient);

void setup() {
    // 初始化硬件
    initLampHardware();

    // 连接WiFi
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
    }

    // 配置MQTT
    mqttClient.setServer(mqtt_server, mqtt_port);
    mqttClient.setCallback(mqttCallback);

    // 连接MQTT
    connectMQTT();
}

void loop() {
    if (!mqttClient.connected()) {
        connectMQTT();
    }
    mqttClient.loop();

    // 定期上报状态（60秒）
    static unsigned long lastReport = 0;
    if (millis() - lastReport > 60000) {
        publishStatus();
        lastReport = millis();
    }

    // 发送心跳（30秒）
    static unsigned long lastHeartbeat = 0;
    if (millis() - lastHeartbeat > 30000) {
        publishHeartbeat();
        lastHeartbeat = millis();
    }
}

// MQTT连接
void connectMQTT() {
    String clientId = "smartlamp_device_" + device_id;

    // 配置遗嘱消息
    String willTopic = "smartlamp/status/" + device_id + "/offline";
    String willMessage = createOfflineMessage();

    while (!mqttClient.connected()) {
        if (mqttClient.connect(clientId.c_str(), mqtt_user, mqtt_password,
                               willTopic.c_str(), 1, false, willMessage.c_str())) {
            // 订阅控制命令主题
            String controlTopic = "smartlamp/control/" + device_id + "/#";
            mqttClient.subscribe(controlTopic.c_str(), 1);

            // 发布上线消息
            publishOnline();
        } else {
            delay(5000);
        }
    }
}

// MQTT消息回调
void mqttCallback(char* topic, byte* payload, unsigned int length) {
    // 解析JSON消息
    DynamicJsonDocument doc(512);
    deserializeJson(doc, payload, length);

    String commandId = doc["commandId"];
    String actionType = doc["action"]["type"];

    // 执行命令
    bool success = false;
    if (actionType == "turn_on") {
        success = turnOnLamp();
    } else if (actionType == "turn_off") {
        success = turnOffLamp();
    } else if (actionType == "set_brightness") {
        int brightness = doc["action"]["params"]["brightness"];
        success = setBrightness(brightness);
    } else if (actionType == "status_request") {
        publishStatus();
        success = true;
    }

    // 发送响应
    publishResponse(commandId, success);
}

// 发布状态上报
void publishStatus() {
    String topic = "smartlamp/status/" + device_id + "/report";

    DynamicJsonDocument doc(512);
    doc["deviceId"] = device_id;
    doc["timestamp"] = millis();
    doc["type"] = "status_report";

    JsonObject data = doc.createNestedObject("data");
    data["status"] = getDeviceStatus();
    data["lampStatus"] = getLampStatus();
    data["mode"] = getMode();
    data["brightness"] = getBrightness();
    data["batteryVoltage"] = getBatteryVoltage();
    data["batteryLevel"] = getBatteryLevel();

    String message;
    serializeJson(doc, message);
    mqttClient.publish(topic.c_str(), message.c_str(), 1);
}
```

---

## 🧪 联调测试流程

### 测试环境准备

1. **部署MQTT Broker**
   ```bash
   # 使用Docker部署EMQX
   docker run -d --name emqx-test \
     -p 1883:1883 \
     -p 8083:8083 \
     -p 18083:18083 \
     emqx/emqx:latest
   ```

2. **配置认证信息**
   - 登录EMQX管理面板: `http://IP:18083`
   - 创建用户: `smartlamp_device` / `device_password`
   - 创建用户: `smartlamp_mobile` / `secure_password`

3. **APP端准备**
   - 打开 `mqtt_control_panel.html`
   - 配置Broker地址

### 联调测试步骤

| 步骤 | 测试内容 | 验证方法 |
|------|----------|----------|
| 1 | 硬件连接Broker | EMQX面板查看设备连接数 |
| 2 | APP连接Broker | MQTT控制面板显示"已连接" |
| 3 | 状态上报测试 | APP收到状态消息，日志显示 |
| 4 | 开灯命令测试 | APP发送命令，硬件执行并响应 |
| 5 | 关灯命令测试 | 同上 |
| 6 | 亮度调节测试 | APP设置亮度，硬件响应 |
| 7 | 故障告警测试 | 硬件模拟故障，APP收到告警 |
| 8 | 断线重连测试 | 断开网络，观察重连行为 |
| 9 | 离线通知测试 | 设备断电，APP收到离线消息 |

---

## 🔌 APP端接口调用示例

### 连接MQTT
```javascript
const mqttClient = new SmartLampMQTT.MQTTClient();
mqttClient.connect(
    () => console.log('MQTT连接成功'),
    (error) => console.error('MQTT连接失败:', error)
);
```

### 订阅设备状态
```javascript
mqttClient.subscribeToLampStatus('LAMP001', (lampId, data) => {
    console.log(`收到路灯${lampId}状态:`, data);
    // 更新界面显示
});
```

### 发送开灯命令
```javascript
const lampController = new SmartLampMQTT.LampController(mqttClient);
lampController.turnOnLight('LAMP001');
```

### 发送关灯命令
```javascript
lampController.turnOffLight('LAMP001');
```

### 设置亮度
```javascript
lampController.setBrightness('LAMP001', 75);
```

### 设置角度
```javascript
lampController.setAngle('LAMP001', {
    highAngle: 60.0,
    directionAngle: 135.0
});
```

### 请求状态
```javascript
mqttClient.requestLampStatus('LAMP001');
```

---

## 📂 APP端相关文件

| 文件 | 说明 |
|------|------|
| `js/mqtt-client.js` | MQTT客户端核心模块 |
| `libs/paho-mqtt.js` | Paho MQTT库 |
| `mqtt_control_panel.html` | MQTT调试控制面板 |
| `MQTT_INTEGRATION.md` | MQTT集成设计文档 |
| `MQTT_INTEGRATION_PLAN.md` | MQTT集成实施计划 |

---

## 🚨 注意事项

### 安全建议
1. ⚠️ 生产环境必须使用TLS加密（端口8084/wss）
2. ⚠️ 每个设备使用唯一ClientID
3. ⚠️ 配置主题权限，设备只能发布自己的主题

### 性能建议
1. 状态上报频率不宜过高（建议60秒）
2. 心跳间隔建议30-60秒
3. QoS级别：控制命令使用QoS 1，心跳使用QoS 0

### 可靠性建议
1. 硬件端实现断线重连
2. 配置遗嘱消息
3. 关键命令需要响应确认

---

## 📞 技术对接联系方式

| 角色 | 联系方式 |
|------|----------|
| 前端开发 | [待填写] |
| 硬件开发 | [待填写] |
| 后端运维 | [待填写] |

---

**文档版本**: v1.0
**创建时间**: 2026-03-28
**状态**: 等待硬件端对接