
# OpenBazaar Connector

A small library providing access to Open Bazaar web sockets

## Usage

    var connector = require('openbazaar-connector')(hostname, port);
    
    connector.send(cmd,params);