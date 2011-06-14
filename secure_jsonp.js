(function($){
    $(document).ready(function() {
        // ### Start variables to configure ###
        // a separate domain or subdomain whose security we do not care about (e.g. no user cookie)
        // from which to make the jsonp calls
        var DIFFERENT_DOMAIN = 'http://127.0.0.1';
        var PATH_TO_IFRAME_HTML = '/secure_jsonp_iframe.html';
        // ### End variables to configure ###
        
        // the namespace/prefix to use on our iframe id(s)
        var IFRAME_ID_PREFIX = "secure_jsonp_";
        var POSTMESSAGE_AVAILABLE = 'postMessage' in window;
        // used to delineate discreate pieces of information in the request message
        var MESSAGE_SEPARATOR = "!:!";
        // message sent from child in indicate loading complete
        var IFRAME_LOADED_MESSAGE = "loaded";
        
        if(POSTMESSAGE_AVAILABLE) {
            
            // there is no easy way to detect if the cross-domain child iframe
            // has loaded so we need to poll by sending postmessages on page load.
            // when we receive back our first response we know the child is ready
            // to handle requests.
            var iframeLoaded = false;
            // keep a list of all requests that happen before we receive the loaded
            // message from the child
            var requestsBeforeIframeLoaded = [];

            var iframe = $('<iframe></iframe>');
            iframe.attr("src", DIFFERENT_DOMAIN + PATH_TO_IFRAME_HTML);
            iframe.css("display", "none");
            iframe.appendTo($('body'));
            
            var nextRequestId = 0;
            
            // a map of request ids to associated callback functions
            var requestIdToCallback = {};
            
            var makeSecureJsonpRequest = function(url, callback, options) {
                requestIdToCallback[nextRequestId.toString()] = callback;
                options = JSON.stringify(options || "{}");
                
                var request = nextRequestId + MESSAGE_SEPARATOR + options + MESSAGE_SEPARATOR + url;
                
                // to find when the iframe is loaded we are going to wait for a postmessage
                // that the child sends us when finished loading. The .load() and .ready() functions
                // do not function properly and trigger before loading is complete,
                // resulting in lost messages. They may not be able to detect
                // loading completion because the iframe is on a separate domain.
                if(iframeLoaded) {
                    iframe[0].contentWindow.postMessage(request, DIFFERENT_DOMAIN);            
                } else {
                    requestsBeforeIframeLoaded.push(request);
                }
                nextRequestId += 1;
            };
            
            var receiveMessage = function(event)
            {
                if (event.origin !== DIFFERENT_DOMAIN) {
                    return;
                }
                
                if(!iframeLoaded && event.data === "loaded") {
                    iframeLoaded = true;
                    $.each(requestsBeforeIframeLoaded, function(i) {
                        iframe[0].contentWindow.postMessage(requestsBeforeIframeLoaded[i], DIFFERENT_DOMAIN);
                    });
                    return;
                }
                
                var result = JSON.parse(event.data);
                var requestId = result[0];
                var data = result[1];
                requestIdToCallback[requestId](data);
                
                // cleanup
                delete requestIdToCallback[requestId];
            }
            

            if (window.addEventListener) {
                window.addEventListener("message", receiveMessage, false);
            }
            else if (window.attachEvent) {
                window.attachEvent("onmessage", receiveMessage);
            }

            
        } else { // postmessage not available
            // the function that is called when the child iframe returns back
            // if postmessage is not available
            var secureJsonpIframeOnload = function(iframeId, callback){
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
                result = JSON.parse(result);
                callback(result);
                
                // now remove the iframe and delete the reference to the callback
                iframe.parentNode.removeChild(iframe);
                delete $._secureJsonpCallbacks[iframeId];
            };
            
            // a wrapper around the iframeOnload function to preserve the
            // iframeId through closure
            var makeOnloadFunction = function(iframeId, callback) {
                return function() {
                    secureJsonpIframeOnload(iframeId, callback);
                }
            }

            // a globally accessible place to store the callback functions
            $._secureJsonpCallbacks = {};
            
            // the unique id to assign to the next iframe request
            var nextIframeId = 0;
            var makeSecureJsonpRequest = function(url, callback, options) {
                options = JSON.stringify(options || "{}");
                
                var request = encodeURIComponent(options + MESSAGE_SEPARATOR + url);
                var url = DIFFERENT_DOMAIN + PATH_TO_IFRAME_HTML + '#' + request;
                
                // first we need to make callback globally accessible for IE 7
                $._secureJsonpCallbacks[nextIframeId] = makeOnloadFunction(nextIframeId,
                                                                           callback);
                
                
                // must set the onload function here for IE to work correctly.
                // and this onload function must be globally accessible to be reached.
                // it does not work to directly attaching the onload function
                
                // NB: get rid of clicks (that occur whenever an iframe's location changes) 
                // in IE by detaching iframe from main document.
                // see: http://grack.com/blog/2009/07/28/a-quieter-window-name-transport-for-ie/
                var iframe = $('<iframe id="' + IFRAME_ID_PREFIX + nextIframeId + '" onload="$._secureJsonpCallbacks[' + nextIframeId + ']()" style="display:none;"/>').attr('src', url);
                
                iframe.appendTo('body');
                nextIframeId += 1;
            }
            
        }

        // attach to the jquery namespace
        $.makeSecureJsonpRequest = makeSecureJsonpRequest;

    });
})(jQuery);