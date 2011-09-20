/**
* BSD License
* 
* Copyright (c) 2011, Salesforce Inc. All rights reserved.
* 
* Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
* 
*     -Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
*     -Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
* 
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
**/

(function($){
    // ### Start configuration defaults ###
    var 
    ORIGINAL_DOMAIN = "http://localhost",
    // the page on the original domain to redirect back to.
    // can be any existing page, such as robots.txt.
    PAGE_TO_REDIRECT_BACK_TO = "/blank_page.html",
    // ### End configuration defaults ###
    
    POSTMESSAGE_AVAILABLE = "postMessage" in window,
    // should match the MESSAGE_SEPARATOR constant in secure_jsonp.js
    MESSAGE_SEPARATOR = "!:!",
    // the message sent to inform the parent child is loaded
    IFRAME_LOADED_MESSAGE = "loaded";
    
    var BaseImplementation = function() {};
    BaseImplementation.prototype = {
        initialize: function() {
            throw "initialize must be implemented";
        },
        _makeJsonpRequest: function(url, callback, options) {
            var options = $.extend(options,
                                   { url: url,
                                     dataType: 'jsonp',
                                     success: callback
                                   });
            $.ajax(options);
        }
    }

    
    var PostMessageImplementation = function() {};
    PostMessageImplementation.prototype = new BaseImplementation();
    $.extend(PostMessageImplementation.prototype, {
        _receiveMessage: function(event)
        {
            if (event.origin !== ORIGINAL_DOMAIN) {
                throw ("Message received from " + event.origin + " but only " + 
                       DIFFERENT_DOMAIN + " is approved");
            }
            var splitData = event.data.split(MESSAGE_SEPARATOR);
            var requestId = splitData[0];
            var options = JSON.parse(splitData[1]);
            var url = splitData[2];
            
            var callback = function(response) {
                event.source.postMessage('["' + requestId + '", ' + JSON.stringify(response) + "]", "*");   
            }
            this._makeJsonpRequest(url, callback, options);
        },
        _attachPostmessageListener : function(receiveCallback) {
            if (window.addEventListener) {
                window.addEventListener("message", receiveCallback, false);
            }
            else if (window.attachEvent) {
                window.attachEvent("onmessage", receiveCallback);
            }
        },
        _informParentReady: function() {
            window.top.postMessage(IFRAME_LOADED_MESSAGE, ORIGINAL_DOMAIN);
        },
        initialize: function() {
            var that = this;
            this._attachPostmessageListener(function(event){ that._receiveMessage(event); });
            this._informParentReady();
        }
    });
    
    var WindowNameImplementation = function() {};
    WindowNameImplementation.prototype = new BaseImplementation();
    $.extend(WindowNameImplementation.prototype, {
        _setWindowNameAndRedirect: function(data) {
            window.name = JSON.stringify(data);
            // redirect back to a blank page on the parent's
            // same domain so we can read window.name.
            window.location = ORIGINAL_DOMAIN + PAGE_TO_REDIRECT_BACK_TO;
        },
        initialize: function() {
            // because postmessage is not available, each iframe
            // (such as the one we're in) will be used for only one
            // jsonp request, and we read the url for the request from
            // the hashtag.
            var hashtag = window.location.hash;
            if(hashtag) {
                // remove leading hash symbol
                var hash = decodeURIComponent(hashtag.substr(1,
                                                             hashtag.length));
                
                var splitData = hash.split(MESSAGE_SEPARATOR);
                var options = JSON.parse(splitData[0]);
                var url = splitData[1];
                this._makeJsonpRequest(url, this._setWindowNameAndRedirect, options);
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
                ORIGINAL_DOMAIN = configuration.originalDomain || ORIGINAL_DOMAIN;
                PAGE_TO_REDIRECT_BACK_TO = configuration.pageToRedirectBackTo || PAGE_TO_REDIRECT_BACK_TO;
                
                implementation.initialize();
                initialized = true;
            }
        }
    }
    
    // attach to the global namespace
    $.secureJsonp = new SecureJsonp();
    
})(window.jQuery || window.$);
