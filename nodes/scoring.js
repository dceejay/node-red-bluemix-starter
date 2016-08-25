/**
 * Copyright 2016 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    var cfenv = require('cfenv');
    var services = cfenv.getAppEnv().services;
    var bkey;
    var url = 'https://palblyp.pmservice.ibmcloud.com/pm/v1/';
    var service;
    for (var i in services) {
        if (i.match(/^(pm-20)/i)) {
            service = services[i][0];
        }
    }

    if (service) {
        url = service.credentials.url;
        bkey = service.credentials.access_key;
    }

    RED.httpAdmin.get('/spss/vcap', function(req, res) {
        res.json(service ? {bound_service: true} : null);
    });

    function SpssNode(config) {
        RED.nodes.createNode(this,config);
        var cid = config.cid;
        var node = this;

        this.on('input', function(msg) {
            var key = bkey || this.credentials.key;
            if (!cid || !key) {
                var message = 'Missing Predictive Analytics service credentials';
                node.error(message, msg);
                return;
            }

            var request = require('request');
            if (typeof msg.payload !== "string") { msg.payload = JSON.stringify(msg.payload); }
            node.status({fill:"blue", shape:"dot", text:"requesting"});
            request({url:url + "/score/" + cid, qs:{accesskey:key}, body:msg.payload, method:"POST", headers:{"Content-Type":'application/json'}}, function(error, response, body) {
                node.status({});
                if (error) {
                    node.error('Predictive Analytics service call failed with error HTTP response.', msg);
                } else if (response.statusCode === 401) {
                    node.error('Predictive Analytics service call failure due to authentication failure.', msg);
                } else if (response.statusCode === 404) {
                    node.error('Predictive Analytics service call failed due to HTTP 404 response to API call.', msg);
                } else if (response.statusCode !== 200) {
                    node.error('Predictive Analytics service call failed due to non-200 HTTP response to API call, '+response.statusCode, msg);
                } else {
                    msg.payload = JSON.parse(body);
                    if (msg.payload.hasOwnProperty("flag") && (msg.payload.flag === false)) {
                        var m = msg.payload.message.split(":")[0];
                        node.error(m,msg.payload);
                    }
                    else {
                        node.send(msg);
                    }
                }
            });
        });
    }

    RED.nodes.registerType("predictive_analytics",SpssNode, {
        credentials: {
            key: {type:"password"}
        }
    });
};
