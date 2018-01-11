
//

module.exports = function(RED) {
    "use strict";

    var request = require('request');

    function FuturehomeLoginNode(n) {
        RED.nodes.createNode(this,n);
        this.displayName = n.displayName;
        var node = this;

        node.getRefreshToken(function(err){
            node.log("Problem with getting refresh token: " + err)
        });
    }

    RED.nodes.registerType("futurehome-login",FuturehomeLoginNode,{
        credentials: {
           username: {type:"text"},
           password: {type:"password"},
           access_token: {type:"password"},
           refresh_token: {type:"password"},
           site_id: {type:"text"},
           base_uri: {type:"text"},
           client_id: {type:"password"},
           client_secret: {type:"password"},
           expires_in: {type:"text"},
           expire_time: {type: "text"}
       }
    });

    FuturehomeLoginNode.prototype.getRefreshToken = function(cb) {
        var credentials = this.credentials;
        var node = this;
        if (!credentials.refresh_token) {
            node.error("No refresh token to use for new token!");
            return;
        }
        if (credentials.expire_time < (Date.now() / 1000) +3700){
            //console.log("Refresh token is about to expire!");
            //console.log("Expires on: " + credentials.expire_time + " time now: " + (Date.now() / 1000) +3700)
        
            request.post({
                url: "https://" + credentials.base_uri + "v1/oauth/access_token",
                json: true,
                form: {
                    grant_type: "refresh_token",
                    client_id: credentials.client_id,
                    client_secret: credentials.client_secret,
                    refresh_token: credentials.refresh_token
                },
            }, function(err, result, data) {
                if (err) {
                    node.log("Problem requesting refresh token: " + JSON.stringify(err));
                    return;
                }
                if (data.error) {
                    node.log(JSON.stringify(data.error));
                    return;
                }
            credentials.access_token = data.access_token;
            credentials.refresh_token = data.refresh_token;
            credentials.expires_in = data.expires_in;
            credentials.expire_time = (Date.now() / 1000) + data.expires_in;
            RED.nodes.addCredentials(node.id, credentials);
            node.log("Updated token and refresh token!");
            });
        } else {
            node.log("Do not need a new refresh token!");
            return;
        }
    };

    RED.httpAdmin.post('/futurehome-login/set_site', function(req, res){
        if (!req.query.id || !req.query.site_id) {
            res.sendStatus(400);
            return;
        }
        var node_id = req.query.id;
        var credentials = RED.nodes.getCredentials(node_id);
        credentials.site_id = req.query.site_id;
        RED.nodes.addCredentials(node_id, credentials);

        res.sendStatus(200)

    });

    RED.httpAdmin.get('/futurehome-login/sites', function(req, res){
        if (!req.query.id) {
            res.sendStatus(400);
            return;
        }
        var node_id = req.query.id;
        var credentials = RED.nodes.getCredentials(node_id);

        request.get({
            url: "https://" + credentials.base_uri + "api/v2/sites/",
            json: true,
            headers: {
                "Authorization": "Bearer " + credentials.access_token
            },
        }, function(err, result, data) {
            if (err) {
                node.log("Problem getting sites: " + JSON.stringify(err));
                return;
            }
            if (data.error) {
                node.log(JSON.stringify(data.error));
                return;
            }
            if (!data._embedded.sites) {
                node.log("Missing site in response.");
                res.send(data);
            } else {
                //console.log("Sending sites: ")
                //console.log(data._embedded.sites);
                res.send(data._embedded.sites);
            }

        });
    });

    RED.httpAdmin.get('/futurehome-login/auth', function(req, res){
        if (!req.query.userName || !req.query.password || !req.query.base_uri || !req.query.id) {
            res.sendStatus(400);
            return;
        }
        var node_id = req.query.id;
        var node = RED.nodes.getNode(node_id);
        var credentials = {
            username: req.query.userName,
            password: req.query.password,
            base_uri: req.query.base_uri,
            client_id: "G8SliLCuGgHBqOn7",
            client_secret: "1fdUB4mtydYEOTRrdfY24YySRfEOFzxe"
        };

        request.post({
            url: "https://" + credentials.base_uri + "v1/oauth/access_token",
            json: true,
            form: {
                grant_type: "password",
                client_id: credentials.client_id,
                client_secret: credentials.client_secret,
                username: credentials.username,
                password: credentials.password
            },
        }, function(err, result, data) {
            if (err) {
                node.log("Problem authenticating: " + JSON.stringify(err));
                res.sendStatus(400);
                return;
            }
            if (data.error) {
                node.log(JSON.stringify(data.error));
                res.sendStatus(401);
                return;
            }
            //console.log(data);
            credentials.access_token = data.access_token;
            credentials.refresh_token = data.refresh_token;
            credentials.expires_in = data.expires_in;
            credentials.expire_time = (Date.now() / 1000) + data.expires_in;
            credentials.base_uri = req.query.base_uri;
            RED.nodes.addCredentials(node_id, credentials);
            node.log("Received auth token.");
            res.send(data);

        });
    });

    RED.httpAdmin.get('/futurehome-login/user-info', function(req, res){
        if (!req.query.id) {
            res.sendStatus(400);
            return;
        }
        var node_id = req.query.id;
        //var node = RED.nodes.getNode(node_id);
        var credentials = RED.nodes.getCredentials(node_id);

        request.get({
            url: "https://" + credentials.base_uri + "v1/auth/check",
            headers: {
                "Authorization": "Bearer "+credentials.access_token
                },
            form: {},
        }, function(err, result, data) {
            if (err) {
                node.log("Problem getting user information: " + JSON.stringify(err));
                return;
            }
            if (data.error) {
                node.log(JSON.stringify(data.error));
                return;
            }
            var dataDecode = decodeURIComponent(data);
            var dataJson = JSON.parse(dataDecode);
            if (!dataJson.user.firstname) {
                res.send(dataJson);
            } else {
                res.send(dataJson.user);
            }
            
        });

    });

};