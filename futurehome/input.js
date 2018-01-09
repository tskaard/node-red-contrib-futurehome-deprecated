module.exports = function(RED) {

    "use strict";
    var request = require('request');
    var ws = require('ws');

    function FuturehomeSite(n) {
        RED.nodes.createNode(this,n);
        
        var node = this;
        node.fh_user;
        node.ping = null;
        node.closing = false;
        node.isServer = false;

        try {
            node.fh_user = RED.nodes.getNode(n.user);  
        } catch (err) {
            console.log("Error: " + err);
        }

        if (!node.fh_user || !node.fh_user.credentials.access_token || !node.fh_user.credentials.site_id) {
            this.warn("No access token!");
            return;
        }

        function startconn() {
            node.tout = null;
            var socket = new ws('wss://'+node.fh_user.credentials.base_uri+'api/v2/sites/'+node.fh_user.credentials.site_id+ '/stream?access_token=' + node.fh_user.credentials.access_token);
            node.fhws = socket;
            handleConnection(socket);
        }

        function heartbeat() {
            clearTimeout(node.ping);
            node.ping = setTimeout(function() {sendPing(node.fhws)}, 9000);
        }

        function handleConnection(/*socket*/socket) {
            socket.on('open',function() {
                node.status({fill:"green",shape:"dot",text:"connected"});
                node.emit('opened','');
            });
            socket.on('close',function() {
                node.status({fill:"red",shape:"ring",text:"disconnected"});
                node.emit('closed');
                if (!node.closing && !node.isServer) {
                    clearTimeout(node.tout);
                    node.tout = setTimeout(function() { startconn(); }, 3000); // try to reconnect every 3 secs... bit fast ?
                }
            });
            socket.on('message',function(data,flags) {
                //console.log(data);
                node.send({payload: data});
                clearTimeout(node.ping);
                node.ping = setTimeout(function() {sendPing(node.fhws)}, 9000);
            });
            socket.on('error', function(err) {
                node.status({fill:"red",shape:"ring",text:"error"});
                node.emit('erro');
                if (!node.closing && !node.isServer) {
                    clearTimeout(node.tout);
                    node.tout = setTimeout(function() { startconn(); }, 3000); // try to reconnect every 3 secs... bit fast ?
                }
            });
            socket.on('pong', heartbeat);
        }

        function sendPing(/*socket*/socket){
            node.ping = null;
            socket.ping('', false, true);
        }   

        // Start connection if we have a site
        if (node.fh_user.credentials.site_id) {
            node.closing = false;
            startconn();
        }


        this.on('close', function() {
            // This node has been deleted
            node.closing = true;
            node.fhws.close();
            if (node.tout) {
                clearTimeout(node.tout);
                node.tout = null;
            }
            if (node.ping){
                clearTimeout(node.ping);
                node.ping = null;
            }
        });
       
    }
    RED.nodes.registerType("site",FuturehomeSite);


    function FuturehomeDevice(n) {
        RED.nodes.createNode(this,n);
        
        var node = this;
        node.device_id = n.device_id;
        node.fh_user;
        node.ping = null;
        node.closing = false;
        node.isServer = false;

        try {
            node.fh_user = RED.nodes.getNode(n.user);  
        } catch (err) {
            console.log("Error: " + err);
        }
           
        
        if (!node.fh_user || !node.fh_user.credentials.access_token || !node.fh_user.credentials.site_id || !node.device_id) {
            this.warn("No access token!");
            return;
        }

        function startconn() {
            node.tout = null;
            var socket = new ws('wss://'+node.fh_user.credentials.base_uri+'api/v2/sites/'+node.fh_user.credentials.site_id+'/devices/'+ node.device_id + '/stream?access_token=' + node.fh_user.credentials.access_token);
            node.fhws = socket;
            handleConnection(socket);
        }

        function heartbeat() {
            clearTimeout(node.ping);
            node.ping = setTimeout(function() {sendPing(node.fhws)}, 9000);
        }

        function handleConnection(/*socket*/socket) {
            socket.on('open',function() {
                node.status({fill:"green",shape:"dot",text:"connected"});
                node.emit('opened','');
            });
            socket.on('close',function() {
                node.status({fill:"red",shape:"ring",text:"disconnected"});
                node.emit('closed');
                if (!node.closing && !node.isServer) {
                    clearTimeout(node.tout);
                    node.tout = setTimeout(function() { startconn(); }, 3000); // try to reconnect every 3 secs... bit fast ?
                }
            });
            socket.on('message',function(data,flags) {
                //console.log(data);
                node.send({payload: data});
                clearTimeout(node.ping);
                node.ping = setTimeout(function() {sendPing(node.fhws)}, 9000);
            });
            socket.on('error', function(err) {
                node.status({fill:"red",shape:"ring",text:"error"});
                node.emit('erro');
                if (!node.closing && !node.isServer) {
                    clearTimeout(node.tout);
                    node.tout = setTimeout(function() { startconn(); }, 3000); // try to reconnect every 3 secs... bit fast ?
                }
            });
            socket.on('pong', heartbeat);
        }        

        function sendPing(/*socket*/socket){
            node.ping = null;
            socket.ping('', false, true);
        }   

        // Start connection if we have a device id
        if (node.fh_user.credentials.site_id || node.device_id) {
            node.closing = false;
            startconn();
        }

        this.on('close', function() {
            // This node has been deleted
            node.closing = true;
            node.fhws.close();
            if (node.tout) {
                clearTimeout(node.tout);
                node.tout = null;
            }
            if (node.ping){
                clearTimeout(node.ping);
                node.ping = null;
            }
        });
    }
    RED.nodes.registerType("device",FuturehomeDevice);


    RED.httpAdmin.get('/input/devices', function(req, res){
        if (!req.query.id) {
            res.status(400);
            res.send("No node-id");
            return;
        }
        var node_id = req.query.id;
        var credentials = RED.nodes.getCredentials(node_id);
        if (!credentials) {
            res.status(400);
            res.send("Missing site information. Press Done, and try again.");
            return;
        }

        request.get({
            url: "https://" + credentials.base_uri + "api/v2/sites/" + credentials.site_id + "/devices", // + "/rooms"
            json: true,
            headers: {
                "Authorization": "Bearer " + credentials.access_token
            },
        }, function(err, result, data) {
            if (err) {
                console.log("request error:" + err);
                return;
            }
            if (data.error) {
                console.log("oauth error: " + data.error);
                res.status(400);
                res.send(data.error);
                return;
            }
            if (!data._embedded) {
                console.log("No devices!");
                res.status(400);
                res.send("No devices.");
            } else {
                //console.log("Sending devices: ")
                //console.log(data._embedded);
                res.send(data._embedded);
            }

        });
    });


}