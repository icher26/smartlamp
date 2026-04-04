/**
 * 演示程序当前的 “注册/登录” 等操作，是基于 “本地存储” 完成的
 * 当您要参考这个演示程序进行相关 app 的开发时，
 * 请注意将相关方法调整成 “基于服务端Service” 的实现。
 **/
(function($, owner) {
	/**
	 * 用户登录
	 **/
	owner.login = function(loginInfo, callback) {
		callback = callback || $.noop;
		loginInfo = loginInfo || {};
		loginInfo.account = loginInfo.account || '';
		loginInfo.password = loginInfo.password || '';
		if (loginInfo.account.length < 5) {
			return callback('账号最短为 5 个字符');
		}
		if (loginInfo.password.length < 6) {
			return callback('密码最短为 6 个字符');
		}
		var loginUrl = window.appConfig ? window.appConfig.getApiUrl(window.appConfig.api.endpoints.login) : 'http://8.137.33.218:8880/login';
		mui.ajax(loginUrl,{
			data:{
				username:loginInfo.account,
				password:loginInfo.password
			},
			dataType:'json',//服务器返回json格式数据
			type:'post',//HTTP请求类型
			timeout:10000,//超时时间设置为10秒；
			headers:{'Content-Type':'application/json'},
			success:function(data){
				//服务器返回响应，根据响应结果，分析是否登录成功；
				if(data.code == 200){
					console.log('[登录] 登录成功');

					// 保存账号
					plus.storage.setItem('account', loginInfo.account);
					plus.navigator.setStatusBarBackground('#CBCCCC');

					// 获取当前登录页面
					var currentWebview = plus.webview.currentWebview();

					// 打开主页面
					mui.openWindow({
						url: 'index.html',
						id: 'index',
						show: {
							aniShow: 'pop-in',
							duration: 200
						}
					});

					// 延迟关闭登录页，确保主页面已显示
					setTimeout(function() {
						console.log('[登录] 关闭登录页');
						currentWebview.close('none');
					}, 400);
				}
				if(data.code == 500){
					return callback('用户名或密码错误');
				}
			},
			error:function(xhr,type,errorThrown){
				//异常处理；
				return callback('用户名或密码错误');
			}
		});
	};
	
	
	owner.logout = function(){
		plus.storage.clear();
	}

	owner.createState = function(name, callback) {
		var state = owner.getState();
		state.account = name;
		state.token = "token123456789";
		owner.setState(state);
		return callback();
	};

	/**
	 * 新用户注册
	 **/
	owner.reg = function(regInfo, callback) {
		callback = callback || $.noop;
		regInfo = regInfo || {};
		regInfo.account = regInfo.account || '';
		regInfo.password = regInfo.password || '';
		regInfo.phone = regInfo.phone || '';
		if (regInfo.account.length < 5) {
			return callback('用户名最短需要 5 个字符');
		}
		if (regInfo.password.length < 6) {
			return callback('密码最短需要 6 个字符');
		}
		var registerUrl = window.appConfig ? window.appConfig.getApiUrl(window.appConfig.api.endpoints.register) : 'http://8.137.33.218:8880/register';
		mui.ajax(registerUrl,{
			data:{
				username:regInfo.account,
				password:regInfo.password,
				phone:regInfo.phone
			},
			dataType:'json',//服务器返回json格式数据
			type:'post',//HTTP请求类型
			timeout:10000,//超时时间设置为10秒；
			headers:{'Content-Type':'application/json'},	              
			success:function(data){
				console.log(data.code)
				console.log(data.message)
				if(data.code == 200){
					plus.navigator.setStatusBarBackground('#CBCCCC');
					mui.openWindow({
						url: 'login_login.html'
					});
				}
				if(data.code == 500){
					return callback(data.message);
				}
			},
			error:function(xhr,type,errorThrown){
				//异常处理；
				return callback('注册失败');
			}
		});
		
	};

	/**
	 * 获取当前状态
	 **/
	owner.getState = function() {
		var stateText = localStorage.getItem('$state') || "{}";
		return JSON.parse(stateText);
	};

	/**
	 * 设置当前状态
	 **/
	owner.setState = function(state) {
		state = state || {};
		localStorage.setItem('$state', JSON.stringify(state));
		//var settings = owner.getSettings();
		//settings.gestures = '';
		//owner.setSettings(settings);
	};

	var checkEmail = function(email) {
		email = email || '';
		return (email.length > 3 && email.indexOf('@') > -1);
	};

	/**
	 * 找回密码
	 **/
	owner.forgetPassword = function(email, callback) {
		callback = callback || $.noop;
		if (!checkEmail(email)) {
			return callback('邮箱地址不合法');
		}
		return callback(null, '新的随机密码已经发送到您的邮箱，请查收邮件。');
	};

	/**
	 * 获取应用本地配置
	 **/
	owner.setSettings = function(settings) {
		settings = settings || {};
		localStorage.setItem('$settings', JSON.stringify(settings));
	}

	/**
	 * 设置应用本地配置
	 **/
	owner.getSettings = function() {
			var settingsText = localStorage.getItem('$settings') || "{}";
			return JSON.parse(settingsText);
		}
		/**
		 * 获取本地是否安装客户端
		 **/
	owner.isInstalled = function(id) {
		if (id === 'qihoo' && mui.os.plus) {
			return true;
		}
		if (mui.os.android) {
			var main = plus.android.runtimeMainActivity();
			var packageManager = main.getPackageManager();
			var PackageManager = plus.android.importClass(packageManager)
			var packageName = {
				"qq": "com.tencent.mobileqq",
				"weixin": "com.tencent.mm",
				"sinaweibo": "com.sina.weibo"
			}
			try {
				return packageManager.getPackageInfo(packageName[id], PackageManager.GET_ACTIVITIES);
			} catch (e) {}
		} else {
			switch (id) {
				case "qq":
					var TencentOAuth = plus.ios.import("TencentOAuth");
					return TencentOAuth.iphoneQQInstalled();
				case "weixin":
					var WXApi = plus.ios.import("WXApi");
					return WXApi.isWXAppInstalled()
				case "sinaweibo":
					var SinaAPI = plus.ios.import("WeiboSDK");
					return SinaAPI.isWeiboAppInstalled()
				default:
					break;
			}
		}
	}
}(mui, window.app = {}));