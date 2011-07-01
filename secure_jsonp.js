(function($){
    $(document).ready(function() {
        var
        // ### Start configuration defaults ###
        // a separate domain or subdomain whose security we do not care about (e.g. no user cookie)
        // from which to make the jsonp calls
        DIFFERENT_DOMAIN = 'http://127.0.0.1',
        PATH_TO_IFRAME_HTML = '/secure_jsonp_iframe.html',
        // ### End configuration defaults ###
        
        // the namespace/prefix to use on our iframe id(s)
        IFRAME_ID_PREFIX = "secure_jsonp_",
        // if postmessage is available in this browser
        POSTMESSAGE_AVAILABLE = 'postMessage' in window,
        // used to delineate discreate pieces of information in the request message
        MESSAGE_SEPARATOR = "!:!",
        // message sent from child in indicate loading complete
        IFRAME_LOADED_MESSAGE = "loaded";
        
        // the largest number of iframes that any implementation
        // should open concurrently
        MAXIMUM_CHILD_IFRAMES = 2;
        
        var BaseImplementation = function() {};
        BaseImplementation.prototype = 
            {
                initialize: function() {
                    throw "initialize must be implemented";
                },
                makeRequest: function() {
                    throw "makeRequest must be implemented";
                }
            }

        var PostMessageImplementation = function() {
            // is our child iframe ready to receive messages
            this.iframeLoaded = false;

            // a map of request ids to associated callback functions
            this.requestIdToCallback = {};

            // keep a list of all requests that happen before we receive the loaded
            // message from the child
            this.requestsBeforeIframeLoaded = [];

            // the iframe we'll use to send requests
            this.iframe = null;

            // the next request id sent to the child iframe
            this.nextRequestId = 0;
        };
        PostMessageImplementation.prototype = new BaseImplementation();
        $.extend(PostMessageImplementation.prototype, {
            _attachPostmessageListener : function(receiveCallback) {
                if (window.addEventListener) {
                    window.addEventListener("message", receiveCallback, false);
                }
                else if (window.attachEvent) {
                    window.attachEvent("onmessage", receiveCallback);
                }
            },
            _createIframe: function(iframeSource) {
                var iframe = $('<iframe></iframe>');
                iframe.attr("src", iframeSource);
                iframe.css("display", "none");
                iframe.appendTo($('body'));
                return iframe;
            },
            _receiveMessage: function(event)
            {
                if (event.origin !== DIFFERENT_DOMAIN) {
                    throw ("Message received from " + event.origin + " but only " + 
                           DIFFERENT_DOMAIN + " is approved");
                }
                
                if(!this.iframeLoaded && event.data === IFRAME_LOADED_MESSAGE) {
                    this.iframeLoaded = true;
                    this._sendPendingRequests(this.iframe[0]);
                    return;
                }
                
                var result = event.data ? JSON.parse(event.data) : "";
                var requestId = result[0];
                var data = result[1];
                this.requestIdToCallback[requestId](data);
                
                // cleanup
                delete this.requestIdToCallback[requestId];
            },
            _sendPendingRequests: function(iframe) {
                var that = this;
                $.each(this.requestsBeforeIframeLoaded, function(i) {
                    iframe.contentWindow.postMessage(that.requestsBeforeIframeLoaded[i], DIFFERENT_DOMAIN);
                });
                // reset pending requests
                this.requestsBeforeIframeLoaded = [];
            },
            initialize: function() {
                var that = this;
                this.iframe = this._createIframe(DIFFERENT_DOMAIN + PATH_TO_IFRAME_HTML);
                this._attachPostmessageListener(function(event){that._receiveMessage(event)});
            },
            makeRequest: function(url, callback, options) {
                this.requestIdToCallback[this.nextRequestId.toString()] = callback;
                options = JSON.stringify(options || "{}");
                
                var request = (this.nextRequestId + MESSAGE_SEPARATOR + options + MESSAGE_SEPARATOR + url);
                
                
                // to find when the iframe is loaded we are going to wait for a postmessage
                // that the child sends us when finished loading. The .load() and .ready() functions
                // do not function properly and trigger before loading is complete,
                // resulting in lost messages. They may not be able to detect
                // loading completion because the iframe is on a separate domain.
                if(this.iframeLoaded) {
                    this.iframe[0].contentWindow.postMessage(request, DIFFERENT_DOMAIN);            
                } else {
                    this.requestsBeforeIframeLoaded.push(request);
                }
                this.nextRequestId += 1;
            }
        });

        
        
        var WindowNameImplementation = function() {
            // the unique id to assign to the next iframe request
            this.nextIframeId = 0;

            // the unique id assigned to the next request
            this.nextRequestId = 0;

            // we reuse iframes because older browsers can't support large
            // numbers of iframes, and it's expensive to create new iframes
            // requests waiting on a spare iframe to become available because
            // we're past our limit. This method of reusing iframes is markedly
            // faster on older browsers despite reducing concurrency
            // enqueuedRequests holds a list of URLs we are waiting to visit
            this.enqueuedRequests = [];
            
            // references to the iframes we're using for our requests
            this.iframes = [];
            // iframes not currently being used for a request
            this.idleIframes = [];

            // a hashmap of requestIds to corresponding callback functions
            this.callbacks = {}

        }
        WindowNameImplementation.prototype = new BaseImplementation();
        $.extend(WindowNameImplementation.prototype, {
            _createIframe: function(url) {
                // must set the onload function here for IE to work correctly.
                // and this onload function must be globally accessible to be reached.
                // it does not work to directly attaching the onload function
                
                // NB: get rid of clicks (that occur whenever an iframe's location changes) 
                // in IE by detaching iframe from main document.
                // see: http://grack.com/blog/2009/07/28/a-quieter-window-name-transport-for-ie/
                var iframe = $('<iframe id="' + IFRAME_ID_PREFIX + this.nextIframeId + 
                               '" onload="$.secureJsonpWindowNameCallback(' + this.nextIframeId  + ')" style="display:none;"/>');
                
                // add the iframe to the DOM before setting its source so
                // it doesn't hang older browsers
                iframe.appendTo('body');
                iframe.attr('src', url);
                this.nextIframeId += 1;
                return iframe;
            },
            // the function that is called when the child iframe returns back
            // if postmessage is not available
            _iframeOnload: function(iframeId){
                var iframe = document.getElementById(IFRAME_ID_PREFIX + iframeId);
                // on the initial iframe load, it will be on a different
                // domain (to make the jsonp call) and we won't have the
                // result, so this onload function should return silently
                // without doing anything.
                // TODO: this is not unexpected so don't raise an exception
                try {
                    var result = iframe.contentWindow.name;
                } catch(e) {
                    // we errored out because the iframe loaded on a domain we don't control
                    // so we couldn't check the name property.
                    return;
                }

                var splitData = result.split(MESSAGE_SEPARATOR);
                var requestId = splitData[0];
                var data = splitData[1];
                if(data) {
                    data = JSON.parse(data);
                }
                this.callbacks[requestId](data);
                
                // see if we have requests enqueued waiting for a spare iframe
                // and set them off if so
                if(this.enqueuedRequests.length > 0) {
                    var url = this.enqueuedRequests.shift();
                    this._beginRequestWithIframe(iframe, url);
                } else {
                    this.idleIframes.push(iframe);
                }
            },
            _beginRequestWithIframe: function(iframe, url) {
                $(iframe).attr('src', url);
            },
            initialize: function() {
                var that = this;

                // need to attach our onload function to the global namespace
                // so IE7 can find and call the onload function
                $.secureJsonpWindowNameCallback = function(iframeId) {
                    that._iframeOnload(iframeId);
                }
            },
            makeRequest: function(url, callback, options) {
                options = JSON.stringify(options || "{}");
                
                var request = encodeURIComponent(this.nextRequestId + MESSAGE_SEPARATOR + 
                                                 options + MESSAGE_SEPARATOR + url);
                var url = DIFFERENT_DOMAIN + PATH_TO_IFRAME_HTML + '#' + request;
                
                this.callbacks[this.nextRequestId] = callback;
                this.nextRequestId += 1;

                // if we have an idle iframe, use the idle iframe to make another request
                // otherwise if we are below our limit create a new iframe
                // otherwise enqueue the request to wait for iframe destruction
                if(this.idleIframes.length > 0) {
                    var iframe = this.idleIframes.shift();
                    this._beginRequestWithIframe(iframe, url);
                } else if (this.iframes.length < MAXIMUM_CHILD_IFRAMES) {
                    var iframe = this._createIframe(url);
                    this.iframes.push(iframe);
                    this._beginRequestWithIframe(iframe, url);
                } else {
                    // there should not be a race condition here
                    // between adding to and removing from the queue
                    // because only one thread executes concurrently
                    this.enqueuedRequests.push(url);
                }
            }
        });
        
        var SecureJsonp = function() {
            var implementation,
            // have we run initialize yet
            initialized = false;

            if(POSTMESSAGE_AVAILABLE) {
                implementation = new PostMessageImplementation();
            } else {
                implementation = new WindowNameImplementation();
            }
            
            return {
                initialize: function(configuration) {
                    DIFFERENT_DOMAIN = configuration.differentDomain || DIFFERENT_DOMAIN;
                    PATH_TO_IFRAME_HTML = configuration.pathToIframeHtml || PATH_TO_IFRAME_HTML;
                    
                    implementation.initialize();
                    initialized = true;
                },
                makeRequest: function(url, callback, options) {
                    if(!initialized) {
                        throw "You must call initialize before makeRequest";
                    }
                    implementation.makeRequest(url, callback, options);
                }
            }
        }
        
        // attach to the global namespace
        $.secureJsonp = new SecureJsonp();
        
    });
})(window.jQuery || window.$);
