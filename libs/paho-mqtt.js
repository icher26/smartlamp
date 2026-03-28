/*
 * Copyright (c) 2015 IBM Corp.
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 */

/**
 * The Paho MQTT client library.
 *
 * This is adapted from the original Paho MQTT project.
 * @namespace Paho
 */
(function(root, factory) {
  if (typeof define === "function" && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    // CommonJS like environments that support module.exports
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.Paho = factory();
  }
}(typeof self !== "undefined" ? self : this, function() {

  var Paho = {};

  /**
   * @private
   */
  var ClientImpl = function(uri, clientId) {
    this._trace("Paho.ClientImpl", uri, clientId);

    this.hostIndex = 0;
    this.onConnected = null;
    this.onConnectionLost = null;
    this.onMessageDelivered = null;
    this.onMessageArrived = null;
    this.dockerRequest = null;
    this._binaryStore = [];
    this._buffered = [];
    this._sentMessages = {};
    this._receivedMessages = {};
    this._notify_msg_sent = {};
    this.doAutoReconnect = false;
    this.autoReconnectInterval = 30000;

    // Connection state
    this.connected = false;
    this.socket = null;
    this.connectOptions = null;
    this.host = uri.indexOf("://") !== -1 ? uri.split("://")[1].split(":")[0] : uri.split(":")[0];
    this.port = uri.indexOf("://") !== -1 ? parseInt(uri.split("://")[1].split(":")[1]) : parseInt(uri.split(":")[1]);
    this.path = "/mqtt";
    this.uri = uri;

    // Client ID
    this.clientId = clientId;

    // Properties
    this.noRetryreconnect = false;
    this.duplicate = false;
    this.willMessage = null;
    this.willOptions = null;
    this.wsTimestamps = new Date();
    this.wsCloseNotification = null;
  };

  /**
   * @private
   */
  ClientImpl.prototype._doConnect = function(connectOptions) {
    this.connectOptions = connectOptions;
    this._socket = new WebSocket(this.uri);
    this._socket.binaryType = 'arraybuffer';

    var wireMessage = new WireMessage(1, {
      clientId: this.clientId,
      willMessage: this.willMessage,
      userName: connectOptions.userName,
      password: connectOptions.password,
      keepAliveInterval: connectOptions.keepAliveInterval,
      cleanSession: connectOptions.cleanSession,
      useSSL: connectOptions.useSSL,
      invocationContext: connectOptions.invocationContext,
      onSuccess: connectOptions.onSuccess,
      onFailure: connectOptions.onFailure,
      reconnect: connectOptions.reconnect,
      quiet: connectOptions.quiet
    });

    this._socket.onopen = function(event) {
      this._connected(event);
    }.bind(this);

    this._socket.onmessage = function(event) {
      this._onMessageReceived(event);
    }.bind(this);

    this._socket.onerror = function(event) {
      this._handleConnectFailure(event);
    }.bind(this);

    this._socket.onclose = function(event) {
      this._disconnected(event);
    }.bind(this);

    this._sendWireMessage(wireMessage);
  };

  /**
   * @private
   */
  ClientImpl.prototype._connected = function(connack) {
    this.connected = true;
    if (this.connectOptions.onSuccess) {
      this.connectOptions.onSuccess({invocationContext:this.connectOptions.invocationContext});
    }
    this._trace("Client connected");
  };

  /**
   * @private
   */
  ClientImpl.prototype._disconnected = function(error) {
    this.connected = false;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    if (this.onConnectionLost) {
      this.onConnectionLost(error);
    }
  };

  /**
   * @private
   */
  ClientImpl.prototype._onMessageReceived = function(event) {
    var messages = this._deframeMessages(event.data);
    for (var i = 0; i < messages.length; i++) {
      var msg = new Paho.Message(messages[i]);
      if (this.onMessageArrived) {
        this.onMessageArrived(msg);
      }
    }
  };

  /**
   * @private
   */
  ClientImpl.prototype._send = function(traceable) {
    if (this._socket.readyState === WebSocket.OPEN) {
      this._socket.send(traceable.data);
      this._trace("Client._send", traceable);
    } else {
      this._trace("Client._send socket.readyState != OPEN");
      throw new Error(format(ERROR.STATE, ["INVALID_STATE", "WR", this._socket.readyState]));
    }
  };

  /**
   * @private
   */
  ClientImpl.prototype._sendWireMessage = function(wireMessage) {
    this._send(wireMessage);
  };

  /**
   * @private
   */
  ClientImpl.prototype._deframeMessages = function(data) {
    // Simplified deframing - in reality this would be more complex
    // This is just a placeholder implementation
    var messages = [];
    // For now, we'll assume each frame is a single message
    messages.push(data);
    return messages;
  };

  /**
   * @private
   */
  ClientImpl.prototype._trace = function() {
    // for debugging
    if (this.connectOptions && this.connectOptions.trace) {
      this.connectOptions.trace.apply(this, arguments);
    }
  };

  /**
   * @private
   */
  var WireMessage = function(type, payload) {
    this.type = type;
    this.payload = payload;
    this.data = JSON.stringify({type: type, payload: payload});
  };

  // MQTT protocol constants
  var MESSAGE_TYPE = {
    CONNECT: 1,
    CONNACK: 2,
    PUBLISH: 3,
    PUBACK: 4,
    PUBREC: 5,
    PUBREL: 6,
    PUBCOMP: 7,
    SUBSCRIBE: 8,
    SUBACK: 9,
    UNSUBSCRIBE: 10,
    UNSUBACK: 11,
    PINGREQ: 12,
    PINGRESP: 13,
    DISCONNECT: 14
  };

  /**
   * An application message, sent or received.
   * @typedef {Object} Message
   * @property {string} payloadStr The message's payload as a string or Buffer.
   * @property {string} destinationName The name of the destination to which the message is addressed.
   * @property {number} qos The quality of service used to deliver the message.
   * @property {Boolean} retained If true, the message was requested to be retained by the server.
   * @property {Boolean} duplicate If true, this message was received from the server as a duplicate of an earlier message.
   */
  var Message = function(newPayload) {
    if (typeof newPayload === "string" || newPayload instanceof ArrayBuffer || newPayload instanceof Buffer) {
      this.payloadBytes = newPayload;
    } else {
      this.payloadBytes = JSON.stringify(newPayload);
    }

    this.destinationName = undefined;
    this.qos = 0;
    this.retained = false;
    this.duplicate = false;
  };

  /**
   * The representation of an MQTT client.
   * @alias Paho.Client
   * @constructor
   * @param {string} host the address of the server to connect to
   * @param {number} port the port number to connect to
   * @param {string} path the path of the server to connect to
   * @param {string} clientId the clientId to use to connect with
   */
  Paho.Client = function(host, port, path, clientId) {
    var uri;

    if (typeof host !== "string") {
      clientId = port;
      uri = host;
    } else {
      if (arguments.length == 3) {
        clientId = path;
      }
    }

    var client = new ClientImpl(uri, clientId);
    this._getHost =  function() { return client.host; };
    this._setHost = function() { throw new Error("Not supported"); };

    this._getPort = function() { return client.port; };
    this._setPort = function() { throw new Error("Not supported"); };

    this._getPath = function() { return client.path; };
    this._setPath = function() { throw new Error("Not supported"); };

    this._getClientId = function() { return client.clientId; };

    this._getOnConnected = function() { return client.onConnected; };
    this._setOnConnected = function(newOnConnected) {
      if (typeof newOnConnected === "function" || newOnConnected === null) {
        client.onConnected = newOnConnected;
      } else {
        throw new Error("onConnected parameter must be a function or null");
      }
    };

    this._getOnConnectionLost = function() { return client.onConnectionLost; };
    this._setOnConnectionLost = function(newOnConnectionLost) {
      if (typeof newOnConnectionLost === "function" || newOnConnectionLost === null) {
        client.onConnectionLost = newOnConnectionLost;
      } else {
        throw new Error("onConnectionLost parameter must be a function or null");
      }
    };

    this._getOnMessageDelivered = function() { return client.onMessageDelivered; };
    this._setOnMessageDelivered = function(newOnMessageDelivered) {
      if (typeof newOnMessageDelivered === "function" || newOnMessageDelivered === null) {
        client.onMessageDelivered = newOnMessageDelivered;
      } else {
        throw new Error("onMessageDelivered parameter must be a function or null");
      }
    };

    this._getOnMessageArrived = function() { return client.onMessageArrived; };
    this._setOnMessageArrived = function(newOnMessageArrived) {
      if (typeof newOnMessageArrived === "function" || newOnMessageArrived === null) {
        client.onMessageArrived = newOnMessageArrived;
      } else {
        throw new Error("onMessageArrived parameter must be a function or null");
      }
    };

    this.connect = function(connectOptions) {
      connectOptions = connectOptions || {};
      var connectOptionsMasked = Object.assign({}, connectOptions);
      if (connectOptionsMasked.password) connectOptionsMasked.password = "***";
      client.connect(connectOptionsMasked);
    };

    this.subscribe = function(filter, subscribeOptions) {
      if (typeof filter !== "string") {
        throw new Error("Invalid argument:"+filter);
      }
      client.subscribe(filter, subscribeOptions);
    };

    this.unsubscribe = function(filter, unsubscribeOptions) {
      if (typeof filter !== "string") {
        throw new Error("Invalid argument:"+filter);
      }
      client.unsubscribe(filter, unsubscribeOptions);
    };

    this.send = function(message) {
      if (!(message instanceof Message)) {
        message = new Message(message);
      }

      if (typeof message.destinationName === "undefined") {
        throw new Error("Message has no destinationName");
      }

      client.send(message);
    };

    this.disconnect = function() {
      client.disconnect();
    };

    this.getTrace = function() {
      return client.traceFunction;
    };

    this.setTrace = function(trace) {
      client.traceFunction = trace;
    };

    this.isConnected = function() {
      return client.connected;
    };
  };

  /**
   * An application message, sent or received.
   * @alias Paho.Message
   * @constructor
   * @param {string|ArrayBuffer} payload The message data to send.
   */
  Paho.Message = Message;

  return Paho;
}));