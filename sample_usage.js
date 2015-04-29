'use strict';
var OpenBazaarConnector = require('./index');

var port = process.argv[2];
if (!port) {
  console.error("Usage: node sample_usage.js [port]");
  process.exit(1);
}

var connector = new OpenBazaarConnector('localhost', port);

connector.subscribe('peers', function(data) {
  console.log('Got peers data from subscription:', summarize(data));
});

connector.peers(function(data) {
  console.log('got peers data once', summarize(data));
});

connector.peers(function(data) {
  console.log('got peers data again', summarize(data));
});

connector.check_order_count(function(data) {
  console.log('got order data', summarize(data));
});

connector.check_inbox_count(function(data) {
  console.log('got inbox data', summarize(data));
});

connector.on('connect', function() {
  console.log('Socket connected.');
});

connector.on('reconnect', function() {
  console.log('Socket reconnected.');
});

connector.on('disconnect', function() {
  console.log('Socket disconnected.');
});

connector.on('error', function(e) {
  console.error('Got error', e);
});

function summarize(data) {
  return JSON.stringify(data).slice(0, 100) + '...';
}
