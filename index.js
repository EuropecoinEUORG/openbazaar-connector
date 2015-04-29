module.exports = function(host, port){
  var module = {};

  module.send = function (cmd, params) {
    var socket_uri = "ws:"+host+":"+port+"/ws";
    var ws = new WebSocket(socket_uri);
    console.log('Started WebSocket:', socket_uri);

    ws.onopen = function (event) {
      var request = {
        "id": Date.now() / 1000 | 0,
        "command": cmd,
        "params": params
      };

      console.log('WebSocket Sent: ', request);

      if(ws.readyState == WebSocket.OPEN){
        ws.send(JSON.stringify(request));
      }
    };

    ws.onclose = function (event) {
      console.log('WebSocket closed unexpectedly: ', event);
      console.log('Refreshing...');
      window.location.reload();
    };

    ws.onerror = function (event) {
      console.error('WebSocket Error: ', event);
    };

    ws.onmessage = function (event) {
      console.log('WebSocket Received: ', JSON.parse(event.data));

      return event.data;
    };
  };

  return module;
};