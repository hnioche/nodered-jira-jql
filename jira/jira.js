module.exports = function(RED) {


    function JiraIssueUpdateNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var server = RED.nodes.getNode(config.server);


        this.on('input', function(msg) {
            var issueKey = msg.topic;
            var updateParameters = msg.payload;
            this.trace(`Updating issue ${issueKey}`);

            if (!issueKey || !updateParameters) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "Invalid message received"
                });
            }

            var callback = function(errors, response, body) {
                if (errors) {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Update failed"
                    });

                    msg.errors = errors;

                    node.error(
                        "Error updating issue.",
                        msg
                    );
                } else if (response.statusCode === 204) {
                    node.status({});
                    node.send(msg);
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Update failed"
                    });

                    msg.statusCode = response.statusCode;
                    msg.payload = body;

                    node.error(
                        "Error updating issue.",
                        msg
                    );
                }

            };
    
            node.status({
                fill: "blue",
                shape: "dot",
                text: "Requesting..."
            });

            server.edit(issueKey, updateParameters, callback);
        });
    }

    function JiraSearchNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var server = RED.nodes.getNode(config.server);
        var maxIssues = 100;
        var defaultFields = [
            "key",
            "title",
            "summary",
            "labels",
            "status",
            "issuetype",
            "description",
            "reporter",
            "created",
            "environment",
            "priority",
            "comment",
            "project"
        ];


        this.on('input', function(msg) {
            var jql = msg.jql || config.jql;
            var fields = msg.fields || defaultFields;

            this.trace(`Performing search '${jql}'`);

            node.perform(jql, fields, function(result, error) {
                if (error) {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Error performing request"
                    });
    
                    msg.payload = result;
                    node.error(
                        error,
                        msg
                    );
                } else {
                    msg.topic = issue.key;
                    msg.result = issue;
                    node.send(msg);
                }
            });
        });

        this.perform = function(jql, fields, callback, startIndex = 0, results = []) {

            var toIndex = startIndex + maxIssues;
            var options = {
                "startAt": startIndex,
                "maxResults": maxIssues,
                "fields": fields
            };

            var rqcallback = function(errors, response, body) {
                if (errors) {
                    callback(errors, "Error while calling search API.");
                } else if (response.statusCode === 200) {
                    node.status({});

                    var issues = body;

                    if (issues) {
                        results = results.concat(issues.issues);
                    }

                    if (issues.total > toIndex) {
                        node.perform(jql, fields, callback, startIndex + maxIssues, results);
                    } else {
                        callback(results);
                    }

                } else {
                    callback(body, "Error while calling search API.");
                }
            };

            node.status({
                fill: "blue",
                shape: "dot",
                text: "Requesting..."
            });

            server.search(jql, options, rqcallback);
        }
    }

    function JiraServerNode(config) {
        RED.nodes.createNode(this, config);
        this.trace(config);
        var node = this;
        var url = config.url;
        var user = this.credentials.username;
        var password = this.credentials.password;
        var request = require("request");


        this.doRequest = function(options, callback) {
            options.auth = {
                'user': user,
                'pass': password
            };
            this.trace("DoRequest " + options);
            request(options, callback);
        }

        this.create_comment = function(issuekey,commentDefinition,callback){
          var options = {
              rejectUnauthorized: false,
              uri: decodeURIComponent(url + 'issue/'+issuekey+'/comment'),
              body: commentDefinition,
              method: 'POST',
              followAllRedirects: true,
              json: true
          };
          node.doRequest(options, callback);
        }

        this.update_comment = function(issuekey,commentDefinition,callback){
          var options = {
              rejectUnauthorized: false,
              uri: decodeURIComponent(url + 'issue/'+issuekey+'/comment'),
              body: commentDefinition,
              method: 'PUT',
              followAllRedirects: true,
              json: true
          };
          node.doRequest(options, callback);
        }

        this.create = function(issueDefinition, callback) {
            var options = {
                rejectUnauthorized: false,
                uri: decodeURIComponent(url + 'issue'),
                body: issueDefinition,
                method: 'POST',
                followAllRedirects: true,
                json: true
            };
            node.doRequest(options, callback);
        }

        this.get = function(issueKey, callback) {
            var options = {
                rejectUnauthorized: false,
                uri: decodeURIComponent(url + 'issue/' + issueKey),
                body: null,
                method: 'GET',
                followAllRedirects: true,
                json: true
            };
            node.doRequest(options, callback);
        }

        this.edit = function(issueKey, updateRequest, callback) {
            var options = {
                rejectUnauthorized: false,
                uri: decodeURIComponent(url + 'issue/' + issueKey),
                body: updateRequest,
                method: 'PUT',
                followAllRedirects: true,
                json: true
            };
            node.doRequest(options, callback);
        }

        this.search = function(jql, options, callback) {

            var options = {
                rejectUnauthorized: false,
                uri: decodeURIComponent(url + 'search'),
                method: 'POST',
                json: true,
                followAllRedirects: true,

                body: {
                    jql: jql,
                    startAt: options.startAt || 0,
                    maxResults: options.maxResults || 1000,
                    fields: options.fields || ["summary", "status", "key", "issuetype"],
                    expand: options.expand || ['schema', 'names']
                }
            };
            this.trace("Calling dorequest");
            this.doRequest(options, callback);
        }
    }

    function JiraIssueGetNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var server = RED.nodes.getNode(config.server);


        this.on('input', function(msg) {
            var issueKey = msg.topic;
            this.trace(`Retrieving issue ${issueKey}`);

            if (!issueKey) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "Invalid message received"
                });
            }

            var callback = function(errors, response, body) {
                if (errors) {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Error performing request"
                    });

                    msg.errors = errors;

                    node.error("Error processing search.", msg);
                } else if (response.statusCode === 200) {
                    node.status({});

                    msg.topic = response.body.key;
                    msg.payload = response.body

                    node.send(msg);
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Get failed"
                    });

                    msg.statusCode = response.statusCode;
                    msg.payload = body;

                    node.error("Error getting issue.", msg);
                }

            };
            node.status({
                fill: "blue",
                shape: "dot",
                text: "Requesting..."
            });
            server.get(issueKey, callback);
        });
    }


    function JiraIssueCreateNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var server = RED.nodes.getNode(config.server);

        this.on('input', function(msg) {

            var callback = function(errors, response, body) {
                if (errors) {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Error performing request"
                    });
                    msg.errors = errors;

                    node.error("Error creating issue.", msg);
                } else if (response.statusCode === 201) {
                    node.status({});
                    msg.topic = response.body.key;
                    node.send(msg);
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Create failed"
                    });

                    msg.statusCode = response.statusCode;
                    msg.payload = body;

                    node.error("Error creating issue.", response);
                }

            };
            server.create(msg.payload, callback);
        });
    }

    function JiraIssueCommentAddNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var server = RED.nodes.getNode(config.server);

        this.on('input', function(msg) {
            var callback = function(errors, response, body) {
                if (errors) {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Error performing request"
                    });

                    msg.errors = errors;

                    node.error("Error creating comment.", msg);
                } else if (response.statusCode === 201) {
                    node.status({});
                    msg.payload=body;
                    node.send(msg);
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Create comment failed"
                    });

                    msg.statusCode = response.statusCode;
                    msg.payload = body;

                    node.error("Error creating comment.", msg);
                }

            };
            server.create_comment(msg.topic,msg.payload, callback);
        });
    }

    function JiraIssueCommentEditNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var server = RED.nodes.getNode(config.server);

        this.on('input', function(msg) {
            var callback = function(errors, response, body) {
                if (errors) {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Error performing request"
                    });

                    msg.errors = errors;

                    node.error("Error editing comment.", msg);
                } else if (response.statusCode === 201) {
                    node.status({});
                    msg.payload=body;
                    node.send(msg);
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Edit comment failed"
                    });

                    msg.statusCode = response.statusCode;
                    msg.payload = body;

                    node.error("Error editing comment.", msg);
                }

            };
            server.update_comment(msg.topic,msg.payload, callback);
        });
    }


    RED.nodes.registerType("jira-server", JiraServerNode, {
        credentials: {
            username: {
                type: "text"
            },
            password: {
                type: "password"
            }
        }
    });

    RED.nodes.registerType("jira-search", JiraSearchNode);
    RED.nodes.registerType("jira-issue-update", JiraIssueUpdateNode);
    RED.nodes.registerType("jira-issue-get", JiraIssueGetNode);
    RED.nodes.registerType("jira-issue-create", JiraIssueCreateNode);
    RED.nodes.registerType("jira-issue-comment-add", JiraIssueCommentAddNode);
    RED.nodes.registerType("jira-issue-comment-update", JiraIssueCommentEditNode);
}
