/**
 * MQTT客户端管理模块
 * 用于智能路灯管理系统与MQTT Broker的通信
 *
 * @version 1.1.0
 * @update 2026-03-28
 * @description 完善接口定义，添加模拟测试模式
 */

(function(window) {
    // MQTT客户端配置
    const MQTT_CONFIG = {
        // 使用WebSocket连接（推荐在移动端使用wss协议）
        brokerUrl: 'ws://8.137.33.218:8083', // MQTT Broker WebSocket端口通常是8083
        username: 'smartlamp_mobile',
        password: 'secure_password',
        clientId: 'smartlamp_mobile_' + Date.now(),
        // 连接选项
        connectOptions: {
            timeout: 10,
            keepAliveInterval: 60,
            cleanSession: true,
            useSSL: false // 生产环境建议使用wss
        },
        // 模拟模式配置（用于无硬件环境测试）
        mockMode: false,
        mockStatusInterval: 30000 // 模拟状态上报间隔（毫秒）
    };

    // MQTT主题定义
    const TOPICS = {
        // 路灯状态上报主题（设备向服务器上报）
        STATUS_REPORT: 'smartlamp/status/+',

        // 控制命令主题（服务器向设备下发）
        CONTROL_COMMAND: 'smartlamp/control/',

        // 群组控制主题
        GROUP_CONTROL: 'smartlamp/group/',

        // 故障报警主题
        FAULT_ALARM: 'smartlamp/fault/',

        // 心跳主题
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

        /**
         * 重新连接
         */
        attemptReconnect() {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

                setTimeout(() => {
                    this.connect(
                        () => console.log('重连成功'),
                        () => console.log('重连失败')
                    );
                }, 2000 * this.reconnectAttempts); // 递增延迟重连
            }
        }

        /**
         * 连接丢失回调
         */
        onConnectionLost(responseObject) {
            if (responseObject.errorCode !== 0) {
                console.log('MQTT连接丢失:', responseObject.errorMessage);
                this.isConnected = false;

                // 尝试重连
                this.attemptReconnect();
            }
        }

        /**
         * 消息到达回调
         */
        onMessageArrived(message) {
            const topic = message.destinationName;
            const payload = message.payloadString;

            console.log('收到MQTT消息:', topic, payload);

            try {
                const data = JSON.parse(payload);

                // 查找对应的处理器
                for (let [pattern, handler] of this.messageHandlers) {
                    if (this.matchTopic(pattern, topic)) {
                        handler(topic, data, message);
                        break;
                    }
                }
            } catch (error) {
                console.error('解析MQTT消息失败:', error, payload);
            }
        }

        /**
         * 订阅主题
         */
        subscribe(topic, handler, qos = 0) {
            if (!this.isConnected) {
                console.warn('MQTT未连接，无法订阅');
                return false;
            }

            try {
                this.client.subscribe(topic, { qos: qos });
                this.subscribedTopics.add(topic);
                this.messageHandlers.set(topic, handler);

                console.log('成功订阅主题:', topic);
                return true;
            } catch (error) {
                console.error('订阅主题失败:', error);
                return false;
            }
        }

        /**
         * 取消订阅
         */
        unsubscribe(topic) {
            if (!this.isConnected) {
                console.warn('MQTT未连接，无法取消订阅');
                return false;
            }

            try {
                this.client.unsubscribe(topic);
                this.subscribedTopics.delete(topic);
                this.messageHandlers.delete(topic);

                console.log('成功取消订阅:', topic);
                return true;
            } catch (error) {
                console.error('取消订阅失败:', error);
                return false;
            }
        }

        /**
         * 发布消息
         */
        publish(topic, data, qos = 0, retain = false) {
            if (!this.isConnected) {
                console.warn('MQTT未连接，无法发布消息');
                return false;
            }

            try {
                const message = new Paho.MQTT.Message(JSON.stringify(data));
                message.destinationName = topic;
                message.qos = qos;
                message.retained = retain;

                this.client.send(message);
                console.log('消息已发布:', topic, data);
                return true;
            } catch (error) {
                console.error('发布消息失败:', error);
                return false;
            }
        }

        /**
         * 恢复之前的订阅
         */
        restoreSubscriptions() {
            // 重新订阅之前订阅的主题
            this.subscribedTopics.forEach(topic => {
                console.log('恢复订阅:', topic);
                // 这里可以根据需要重新注册处理器
            });
        }

        /**
         * 匹配主题模式
         */
        matchTopic(pattern, topic) {
            // 简单的通配符匹配
            const regexPattern = pattern
                .replace(/\+/g, '[^/]+')  // 单层通配符
                .replace(/#/g, '.*');     // 多层通配符

            const regex = new RegExp('^' + regexPattern + '$');
            return regex.test(topic);
        }

        /**
         * 断开连接
         */
        disconnect() {
            if (this.client && this.isConnected) {
                this.client.disconnect();
                this.isConnected = false;
                console.log('MQTT连接已断开');
            }
        }

        /**
         * 获取连接状态
         */
        getConnectionStatus() {
            return {
                isConnected: this.isConnected,
                reconnectAttempts: this.reconnectAttempts,
                subscribedTopics: Array.from(this.subscribedTopics)
            };
        }

        /**
         * 订阅路灯状态更新
         */
        subscribeToLampStatus(lampId, callback) {
            const topic = `smartlamp/status/${lampId}/report`;
            return this.subscribe(topic, (topic, data) => {
                if (callback) callback(lampId, data);
            });
        }

        /**
         * 订阅所有路灯状态更新
         */
        subscribeToAllLampStatus(callback) {
            const topic = 'smartlamp/status/+/report';
            return this.subscribe(topic, (topic, data) => {
                // 从主题中提取路灯ID
                const parts = topic.split('/');
                const lampId = parts[2]; // smartlamp/status/{lampId}/report
                if (callback) callback(lampId, data);
            });
        }

        /**
         * 订阅路灯故障告警
         */
        subscribeToFaultAlerts(callback) {
            const topic = 'smartlamp/fault/+/alert';
            return this.subscribe(topic, (topic, data) => {
                // 从主题中提取路灯ID
                const parts = topic.split('/');
                const lampId = parts[2]; // smartlamp/fault/{lampId}/alert
                if (callback) callback(lampId, data);
            });
        }

        /**
         * 发送路灯控制命令
         */
        sendLampCommand(lampId, commandType, params) {
            const topic = `smartlamp/control/${lampId}/${commandType}`;
            const message = {
                commandId: 'cmd_' + Date.now(),
                timestamp: Date.now(),
                type: 'control_command',
                target: {
                    type: 'single',
                    id: lampId
                },
                action: {
                    type: commandType,
                    operation: commandType,
                    params: params
                },
                requester: 'APP_USER',
                priority: 2
            };

            return this.publish(topic, message);
        }

        /**
         * 发送群组控制命令
         */
        sendGroupCommand(groupId, commandType, params) {
            const topic = `smartlamp/group/${groupId}/control/${commandType}`;
            const message = {
                commandId: 'group_cmd_' + Date.now(),
                timestamp: Date.now(),
                type: 'control_command',
                target: {
                    type: 'group',
                    id: groupId
                },
                action: {
                    type: commandType,
                    operation: commandType,
                    params: params
                },
                requester: 'APP_USER',
                priority: 2
            };

            return this.publish(topic, message);
        }

        /**
         * 请求路灯状态
         */
        requestLampStatus(lampId) {
            const topic = `smartlamp/request/${lampId}/status`;
            const message = {
                requestId: 'req_' + Date.now(),
                timestamp: Date.now(),
                type: 'status_request',
                target: {
                    type: 'single',
                    id: lampId
                }
            };

            return this.publish(topic, message);
        }

        /**
         * 发送心跳消息
         */
        sendHeartbeat(clientId) {
            const topic = `smartlamp/heartbeat/${clientId}/ping`;
            const message = {
                timestamp: Date.now(),
                type: 'heartbeat',
                clientId: clientId
            };

            return this.publish(topic, message, 0, false);
        }
    }

    // 路灯控制管理器
    class LampController {
        constructor(mqttClient) {
            this.mqttClient = mqttClient;
            this.lampStatusMap = new Map(); // 存储路灯状态
        }

        /**
         * 订阅路灯状态更新
         */
        subscribeLampStatus(lampId, callback) {
            const topic = TOPICS.STATUS_REPORT.replace('+', lampId);
            return this.mqttClient.subscribe(topic, (topic, data) => {
                this.updateLampStatus(lampId, data);
                if (callback) callback(lampId, data);
            });
        }

        /**
         * 控制单个路灯
         */
        controlLamp(lampId, command) {
            const topic = TOPICS.CONTROL_COMMAND + lampId;
            const message = {
                ...command,
                timestamp: Date.now(),
                commandId: 'cmd_' + Date.now()
            };

            return this.mqttClient.publish(topic, message);
        }

        /**
         * 群组控制
         */
        groupControl(groupName, command) {
            const topic = TOPICS.GROUP_CONTROL + groupName;
            const message = {
                ...command,
                timestamp: Date.now(),
                commandId: 'group_cmd_' + Date.now()
            };

            return this.mqttClient.publish(topic, message);
        }

        /**
         * 更新路灯状态
         */
        updateLampStatus(lampId, statusData) {
            this.lampStatusMap.set(lampId, {
                ...statusData,
                updateTime: Date.now()
            });

            // 可以在这里添加状态变化的通知逻辑
            console.log(`路灯${lampId}状态已更新:`, statusData);
        }

        /**
         * 获取路灯状态
         */
        getLampStatus(lampId) {
            return this.lampStatusMap.get(lampId);
        }

        /**
         * 获取所有路灯状态
         */
        getAllLampStatuses() {
            return Object.fromEntries(this.lampStatusMap);
        }

        /**
         * 发送路灯控制命令
         */
        controlLamp(lampId, operation, params = {}) {
            const command = {
                type: 'light_control',
                operation: operation,
                params: params
            };

            return this.mqttClient.sendLampCommand(lampId, operation, params);
        }

        /**
         * 开灯操作
         */
        turnOnLight(lampId) {
            return this.controlLamp(lampId, 'turn_on', {lampStatus: 1});
        }

        /**
         * 关灯操作
         */
        turnOffLight(lampId) {
            return this.controlLamp(lampId, 'turn_off', {lampStatus: 0});
        }

        /**
         * 调节亮度
         */
        setBrightness(lampId, brightness) {
            return this.controlLamp(lampId, 'set_brightness', {brightness: brightness});
        }

        /**
         * 设置角度
         */
        setAngle(lampId, angle) {
            return this.controlLamp(lampId, 'set_angle', {angle: angle});
        }

        /**
         * 获取指定路灯的详细信息
         */
        getLampDetails(lampId) {
            const status = this.lampStatusMap.get(lampId);
            if (!status) {
                console.warn(`路灯 ${lampId} 的状态尚未获取到`);
                // 可以发送请求来获取路灯状态
                this.mqttClient.requestLampStatus(lampId);
                return null;
            }
            return status;
        }

        /**
         * 获取多个路灯的状态
         */
        getLampStatuses(lampIds) {
            const statuses = {};
            lampIds.forEach(id => {
                statuses[id] = this.getLampStatus(id);
            });
            return statuses;
        }

        /**
         * 获取所有路灯的基本状态（简化版）
         */
        getBasicLampStatuses() {
            const basicStatuses = {};
            for (let [lampId, statusData] of this.lampStatusMap) {
                basicStatuses[lampId] = {
                    lampStatus: statusData.data ? statusData.data.lampStatus : null,
                    status: statusData.data ? statusData.data.status : null,
                    byname: statusData.data ? statusData.data.byname : lampId,
                    area: statusData.data ? statusData.data.area : 'Unknown'
                };
            }
            return basicStatuses;
        }
    }

    // 导出模块
    window.SmartLampMQTT = {
        MQTTClient,
        LampController,
        TOPICS,
        MQTT_CONFIG,
        // 新增：模拟测试器
        MockDeviceSimulator: null // 将在下方定义
    };

    /**
     * 模拟设备测试器
     * 用于在没有真实硬件时模拟设备行为，验证前端MQTT逻辑
     */
    class MockDeviceSimulator {
        constructor(mqttClient) {
            this.mqttClient = mqttClient;
            this.simulatedDevices = new Map();
            this.statusInterval = null;
            this.heartbeatInterval = null;
            this.isEnabled = false;
        }

        /**
         * 启用模拟模式
         */
        enable(deviceList = ['LAMP001', 'LAMP002', 'LAMP003']) {
            this.isEnabled = true;
            this.simulatedDevices.clear();

            // 初始化模拟设备
            deviceList.forEach(deviceId => {
                this.simulatedDevices.set(deviceId, {
                    deviceId: deviceId,
                    status: 1,
                    lampStatus: Math.random() > 0.5 ? 1 : 0,
                    mode: Math.random() > 0.5 ? 1 : 0,
                    brightness: Math.floor(Math.random() * 100),
                    area: ['A区', 'B区', 'C区'][Math.floor(Math.random() * 3)],
                    byname: `模拟路灯${deviceId}`,
                    batteryLevel: Math.floor(Math.random() * 100),
                    batteryVoltage: 3.0 + Math.random() * 0.6,
                    temperature: 20 + Math.random() * 15
                });
            });

            console.log('模拟设备已启用，设备列表:', deviceList);
            this.startSimulation();
        }

        /**
         * 禁用模拟模式
         */
        disable() {
            this.isEnabled = false;
            this.stopSimulation();
            this.simulatedDevices.clear();
            console.log('模拟设备已禁用');
        }

        /**
         * 启动模拟定时器
         */
        startSimulation() {
            // 定期上报状态
            this.statusInterval = setInterval(() => {
                this.publishAllStatus();
            }, MQTT_CONFIG.mockStatusInterval);

            // 定期心跳
            this.heartbeatInterval = setInterval(() => {
                this.publishAllHeartbeats();
            }, 30000);

            // 立即发送一次状态
            this.publishAllStatus();
        }

        /**
         * 停止模拟定时器
         */
        stopSimulation() {
            if (this.statusInterval) {
                clearInterval(this.statusInterval);
                this.statusInterval = null;
            }
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
                this.heartbeatInterval = null;
            }
        }

        /**
         * 发布所有设备状态
         */
        publishAllStatus() {
            this.simulatedDevices.forEach((device, deviceId) => {
                this.publishDeviceStatus(deviceId);
            });
        }

        /**
         * 发布单个设备状态
         */
        publishDeviceStatus(deviceId) {
            const device = this.simulatedDevices.get(deviceId);
            if (!device) return;

            // 模拟状态变化
            if (device.mode === 1) { // 自动模式时随机变化
                device.lampStatus = Math.random() > 0.3 ? 1 : 0;
                device.batteryLevel = Math.max(10, device.batteryLevel - Math.random() * 2);
            }

            const statusMessage = {
                deviceId: deviceId,
                timestamp: Date.now(),
                type: 'status_report',
                data: {
                    status: device.status,
                    lampStatus: device.lampStatus,
                    mode: device.mode,
                    brightness: device.brightness,
                    area: device.area,
                    byname: device.byname,
                    lightId: deviceId,
                    batteryVoltage: device.batteryVoltage,
                    batteryLevel: Math.floor(device.batteryLevel),
                    temperature: device.temperature.toFixed(1)
                },
                metadata: {
                    version: '1.0',
                    source: 'mock_device'
                }
            };

            // 通过MQTT发布（或直接触发回调）
            const topic = `smartlamp/status/${deviceId}/report`;
            this.simulateMessageArrived(topic, statusMessage);
        }

        /**
         * 发布所有设备心跳
         */
        publishAllHeartbeats() {
            this.simulatedDevices.forEach((device, deviceId) => {
                this.publishHeartbeat(deviceId);
            });
        }

        /**
         * 发布心跳
         */
        publishHeartbeat(deviceId) {
            const heartbeatMessage = {
                deviceId: deviceId,
                timestamp: Date.now(),
                type: 'heartbeat',
                status: 'alive',
                uptime: Math.floor(Math.random() * 3600)
            };

            const topic = `smartlamp/heartbeat/${deviceId}/ping`;
            this.simulateMessageArrived(topic, heartbeatMessage);
        }

        /**
         * 模拟消息到达（触发订阅回调）
         */
        simulateMessageArrived(topic, message) {
            if (this.mqttClient && this.mqttClient.messageHandlers) {
                for (let [pattern, handler] of this.mqttClient.messageHandlers) {
                    if (this.mqttClient.matchTopic(pattern, topic)) {
                        handler(topic, message);
                        break;
                    }
                }
            }
            console.log('[模拟] 消息到达:', topic, message);
        }

        /**
         * 处理控制命令（模拟设备响应）
         */
        handleControlCommand(topic, command) {
            const parts = topic.split('/');
            const deviceId = parts[2];
            const commandType = parts[3];

            const device = this.simulatedDevices.get(deviceId);
            if (!device) {
                console.warn('[模拟] 未找到设备:', deviceId);
                return;
            }

            console.log('[模拟] 收到命令:', commandType, '设备:', deviceId);

            // 执行命令
            let success = true;
            let previousStatus = device.lampStatus;

            switch (commandType) {
                case 'turn_on':
                    device.lampStatus = 1;
                    break;
                case 'turn_off':
                    device.lampStatus = 0;
                    break;
                case 'set_brightness':
                    device.brightness = command.action.params.brightness || 50;
                    break;
                case 'set_angle':
                    // 模拟角度设置
                    console.log('[模拟] 设置角度:', command.action.params);
                    break;
                case 'auto_mode':
                    device.mode = 1;
                    break;
                case 'manual_mode':
                    device.mode = 0;
                    break;
                case 'status_request':
                    this.publishDeviceStatus(deviceId);
                    return;
                default:
                    console.warn('[模拟] 未知命令:', commandType);
                    success = false;
            }

            // 发送响应
            const responseTopic = `smartlamp/response/${deviceId}/${command.commandId}`;
            const responseMessage = {
                responseId: 'resp_' + Date.now(),
                originalCommandId: command.commandId,
                timestamp: Date.now(),
                type: 'command_response',
                status: success ? 'success' : 'error',
                result: {
                    code: success ? 200 : 400,
                    message: success ? '执行成功' : '执行失败'
                },
                data: {
                    previousStatus: previousStatus,
                    currentStatus: device.lampStatus
                }
            };

            this.simulateMessageArrived(responseTopic, responseMessage);

            // 状态变化后上报新状态
            this.publishDeviceStatus(deviceId);
        }

        /**
         * 模拟故障告警
         */
        simulateFaultAlert(deviceId, faultType = 'battery_low') {
            const faultMessages = {
                'battery_low': {
                    code: 'FAULT_001',
                    message: '电池电量低于20%',
                    severity: 'high'
                },
                'temperature_high': {
                    code: 'FAULT_006',
                    message: '设备温度过高',
                    severity: 'medium'
                },
                'communication_fault': {
                    code: 'FAULT_007',
                    message: '通信异常',
                    severity: 'high'
                }
            };

            const fault = faultMessages[faultType] || faultMessages['battery_low'];
            const alertMessage = {
                deviceId: deviceId,
                timestamp: Date.now(),
                type: 'fault_alert',
                severity: fault.severity,
                fault: {
                    code: fault.code,
                    type: faultType,
                    message: fault.message
                },
                suggestion: '请及时处理'
            };

            const topic = `smartlamp/fault/${deviceId}/alert`;
            this.simulateMessageArrived(topic, alertMessage);
        }

        /**
         * 获取模拟设备列表
         */
        getSimulatedDevices() {
            return Array.from(this.simulatedDevices.keys());
        }

        /**
         * 获取模拟设备状态
         */
        getSimulatedDeviceStatus(deviceId) {
            return this.simulatedDevices.get(deviceId);
        }
    }

    // 更新导出
    window.SmartLampMQTT.MockDeviceSimulator = MockDeviceSimulator;

    console.log('SmartLamp MQTT模块已加载 (v1.1.0 - 含模拟测试功能)');
})(window);