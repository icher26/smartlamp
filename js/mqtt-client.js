/**
 * MQTT客户端管理模块
 * 用于智能路灯管理系统与MQTT Broker的通信
 *
 * @version 1.0.0
 * @update 2026-03-28
 * @description MQTT接口预留，等待硬件端联调
 */

(function(window) {
    // MQTT客户端配置
    const MQTT_CONFIG = {
        // 使用WebSocket连接（推荐在移动端使用wss协议）
        brokerUrl: 'ws://8.137.33.218:8083', // MQTT Broker WebSocket端口
        username: 'smartlamp_mobile',
        password: 'secure_password',
        clientId: 'smartlamp_mobile_' + Date.now(),
        // 连接选项
        connectOptions: {
            timeout: 10,
            keepAliveInterval: 60,
            cleanSession: true,
            useSSL: false // 生产环境建议使用wss
        }
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
            });
        }

        /**
         * 匹配主题模式
         */
        matchTopic(pattern, topic) {
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
                const parts = topic.split('/');
                const lampId = parts[2];
                if (callback) callback(lampId, data);
            });
        }

        /**
         * 订阅路灯故障告警
         */
        subscribeToFaultAlerts(callback) {
            const topic = 'smartlamp/fault/+/alert';
            return this.subscribe(topic, (topic, data) => {
                const parts = topic.split('/');
                const lampId = parts[2];
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
            this.lampStatusMap = new Map();
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
        controlLamp(lampId, operation, params = {}) {
            return this.mqttClient.sendLampCommand(lampId, operation, params);
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
                this.mqttClient.requestLampStatus(lampId);
                return null;
            }
            return status;
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
        MQTT_CONFIG
    };

    console.log('SmartLamp MQTT模块已加载 (v1.0.0) - 等待硬件联调');
})(window);