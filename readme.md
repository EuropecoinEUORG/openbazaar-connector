
# OpenBazaar Connector

SDK for connecting to the OpenBazaar websocket.

## Usage

```javascript
var connector = require('openbazaar-connector')(hostname, port);

// You can also use any supported function directly. See functions.js.
connector.check_inbox_count(function(data) {
  // Inbox data here
});

// Some requests return multiple datagrams, like `peers`, which returns each
// peer as the DHT returns it (which can take a lot of time).
// Subscribe to a stream and the callback will be called each time data
// comes back.
connector.subscribe('peers', function(data) {
  // Peer data here
});

// Bind to raw data (this is the firehose)
connector.on('data', onData)

// Catch errors
connector.on('error', onError)

// Catch 'connect', 'reconnect', and 'disconnect' events.
connector.on('connect', onConnect)
connector.on('reconnect', onReconnect)
connector.on('disconnect', onDisconnect)
```

## Trying it out

Start OpenBazaar and take note of the port. It will be passed to the sample
connector.

```bash
git clone git@github.com:STRML/openbazaar-connector.git
cd openbazaar-connector
npm install
node sample_usage.js $PORT
```
