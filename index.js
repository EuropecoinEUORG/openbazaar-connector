'use strict';
var websocket = require('websocket-stream');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var inject = require('reconnect-core');
var functions = require('./functions');
var forward = require('forward-emitter');
var debug = require('debug')('openbazaar:connector');
var debugData = require('debug')('openbazaar:connector:data');

// Generates a new 'reconnect' instance. This will automatically
// reconnect to the host when it receives a 'close' event.
var socketReconnector = inject(function(host, port) {
  var socket_uri = 'ws:' + host + ':' + port + '/ws';
  debug('Connecting to websocket at', socket_uri);
  return websocket(socket_uri);
});

// We expect a wrapper around the Adapter. This uses reconnect-core
// to keep a connection open to the underlying socket and queue up
// commands while disconnected.
module.exports = function Wrapper(host, port) {
  // So it can be called without `new`
  if (!this instanceof Wrapper) return new Wrapper(host, port);

  var adapter = this.adapter = new OpenBazaarAdapter();

  adapter.emitter = socketReconnector({}, function onWSConnect(stream) {
    debug('Connected.');
    // This called every time we reconnect, so we need to reassign to the adapter.
    adapter._connected(stream);
  })
  .on('disconnect', function() {
    debug('Disconnected.');
    adapter.stream.removeAllListeners();
    // Remove stream from adapter so requests will queue up transparently
    adapter.stream = null;
  })
  .connect(host, port);

  // Forwards 'disconnect', 'reconnect', 'connect', 'error'
  forward(adapter.emitter, adapter);

  return adapter;
};

/**
 * The return value of the exports. This is an object that essentially does RPC
 * to the Python server.
 */
function OpenBazaarAdapter() {
  EventEmitter.call(this);
  this.sendQueue = [];
  this.cbs = {};
  this.staticCbs = {};
}
util.inherits(OpenBazaarAdapter, EventEmitter);

/**
 * On connection, assign the stream to this adapter and empty the queue.
 * @param  {Stream} stream Underlying websocket stream.
 */
OpenBazaarAdapter.prototype._connected = function(stream) {
  var me = this;
  this.stream = stream;

  // Empty out any queued requests.
  this.sendQueue.forEach(function(args) {
    me.sendCommand.apply(me, args);
  });
  this.sendQueue = [];

  // On data, parse and find a cb to call.
  stream.on('data', function(datum) {
    try {
      datum = JSON.parse(datum.toString());
    } catch(e) {
      return stream.emit('error', e);
    }

    debugData('Got data: %j', datum);
    // Emit a 'data' event directly so users can get raw data.
    me.emit('data', datum);

    // We need to uniquely identify the data coming back for this request.
    // There is a `type` value sent back we can use.
    var type = datum.result.type;

    // If a callback is set up, call it.
    // Sometimes we can get data we didn't even ask for. Ignore that data.
    if (me.cbs[type] && me.cbs[type].length) {
      me.cbs[type].shift()(datum);
    }
    // Subscriptions
    if (me.staticCbs[type]) {
      me.staticCbs[type].forEach(function(fn) { fn(datum); });
    }
  });
};

/**
 * Send a command to OB.
 * @param  {String}   cmd      Command to send.
 * @param  {Object}   [params] Params to send.
 * @param  {Function} [cb]     Callback.
 */
OpenBazaarAdapter.prototype.sendCommand = function(cmd, params, cb) {
  if (!this.stream) return this.sendQueue.push([cmd, params, cb]);
  // Support (cmd, cb) arity
  if (typeof params === 'function') {
    cb = params;
    params = {};
  }

  var request = {
    // Just as fast as `| 0` and easier to read
    'id': Math.floor(Date.now() / 1000),
    'command': cmd,
    'params': params || {}
  };
  this.stream.write(JSON.stringify(request));

  // Bail out early if no cb was provided.
  if (!cb) return this;

  // Create or append to callback array.
  // Type must be converted because the python server sometimes sends back
  // datagrams with a `type` that doesn't exactly match the `cmd`.
  var type = stripType(cmd);
  if (this.cbs[type]) {
    this.cbs[type].push(cb);
  } else {
    this.cbs[type] = [cb];
  }

  // Chainable
  return this;
};

// Bind all the supported functions to the connector so they can be called
// directory. For example: client.query_order(params);
functions.forEach(function(fn) {
  OpenBazaarAdapter.prototype[fn] = function(params) {
    return this.sendCommand(fn, params);
  };
});

/**
 * Same as `sendCommand`, but the cb can be called multiple times.
 * Useful for e.g. `peers`.
 * @param  {String}   cmd      Command to send.
 * @param  {Object}   [params] Params to send.
 * @param  {Function} cb       Callback (can be called multiple times).
 */
OpenBazaarAdapter.prototype.subscribe = function(cmd, params, cb) {
  var me = this;
  // Add the callback to staticCbs, where it will be called every time data
  // comes back. See the note about stripType in sendCommand().
  me.staticCbs[stripType(cmd)] = cb;
  this.sendCommand(cmd, params);

  // Chainable
  return this;
};

var stripTypeRegex = /^(?:check_)/;
function stripType(type) {
  return type.replace(stripTypeRegex, '');
}
