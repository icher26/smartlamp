/**
 * 应用配置文件
 * 统一管理API地址和应用配置
 * 根据后端联调文档v1.0更新 (2026-03-12)
 */
(function(window) {
	window.appConfig = {
		// API配置
		api: {
			// 可用的服务器地址列表
			servers: {
				// 局域网地址（内网访问,速度快）- WiFi网络
				local: 'http://172.20.25.66:8880',

				// 公网地址（外网访问,任何地方可用）
				public: 'http://121.40.170.217:8880',

				// 新的公网地址
				public2: 'http://8.137.33.218:8880'
			},

			// 当前使用的服务器（可选: 'local', 'public', 'public2'）
			currentServer: 'public2',

			// 服务器基础地址（自动根据currentServer选择）
			get baseUrl() {
				return this.servers[this.currentServer] || this.servers.public2;
			},

			// 是否启用Mock模式（当服务器不可用时使用）
			useMock: false,

			// API超时时间（毫秒）
			timeout: 10000,

			// API端点
			endpoints: {
				login: '/login',
				register: '/register',
				lampsTotal: '/lamps/lampstotal',
				lampsFindAll: '/lamps/findAllByPage',
				lampsSelectOne: '/lamps/selectone',
				lampsUpdate: '/lamps/updateall',
				lampsDelete: '/lamps/delete',
				lampsAdd: '/lamps/add',
				lampsFindRecent: '/lamps/findRecent',
				faultSelect: '/fault/select',
				faultSelectOne: '/fault/selectone',
				faultCheck: '/fault/check',
				faultAdd: '/fault/addinfo',
				adviceSelect: '/advice/select',
				adviceSelectOne: '/advice/selectone',
				adviceCheck: '/advice/check',
				repairFindAll: '/repair/findAllByPage',
				repairSelectOne: '/repair/selectone',
				repairAddPerson: '/repair/addperson',
				repairDelete: '/repair/delete',
				repairEditor: '/repair/editor'
			}
		},

		// 应用配置
		app: {
			name: '智能路灯管理系统',
			version: '1.0.0',
			// 分页配置
			pageSize: 10
		},

		// 获取完整API地址
		getApiUrl: function(endpoint) {
			var url = this.api.baseUrl + endpoint;
			console.log('API URL:', url, '| Mock模式:', this.api.useMock);
			return url;
		}
	};

	console.log('配置文件加载完成! 服务器:', window.appConfig.api.baseUrl);
})(window);
