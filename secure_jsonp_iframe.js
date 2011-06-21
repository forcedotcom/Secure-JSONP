(function($){
    // ### Start variables to configure ###
    var ORIGINAL_DOMAIN = "http://localhost";
    // the page on the original domain to redirect back to.
    // can be any existing page, such as robots.txt.
    var PAGE_TO_REDIRECT_BACK_TO = "/blank_page.html";
    // ### End variables to configure ###
    
    var POSTMESSAGE_AVAILABLE = "postMessage" in window;
    // should match the MESSAGE_SEPARATOR constant in secure_jsonp.js
    var MESSAGE_SEPARATOR = "!:!";
    var IFRAME_LOADED_MESSAGE = "loaded";
    
    var makeJsonpRequest = function(url, callback, options) {
        var options = $.extend(options,
                               { url: url,
                                 dataType: 'jsonp',
                                 success: callback
                               });
        $.ajax(options);
    }
    
    var setConfiguration = function(configuration) {
        PAGE_TO_REDIRECT_BACK_TO = configuration.different_domain || PAGE_TO_REDIRECT_BACK_TO;
        WHITELISTED_DOMAIN_REGEXS = configuration.whitelisted_domain_regexs || WHITELISTED_DOMAIN_REGEXS;
    }
    
    if(POSTMESSAGE_AVAILABLE) {
        
        var receiveMessage = function(event)
        {
            
            if (event.origin !== ORIGINAL_DOMAIN) {
                throw "Message received from unapproved domain";
            }
            var splitData = event.data.split(MESSAGE_SEPARATOR);
            var requestId = splitData[0];
            var options = JSON.parse(splitData[1]);
            var url = splitData[2];
            
            var callback = function(response) {
                event.source.postMessage('["' + requestId + '", ' + JSON.stringify(response) + "]", "*");   
            }
            makeJsonpRequest(url, callback, options);
        }
        
        
        if (window.addEventListener) {
            window.addEventListener("message", receiveMessage, false);
        }
        else if (window.attachEvent) {
            window.attachEvent("onmessage", receiveMessage);
        }
        
        // now tell the parent that we're loaded
        window.top.postMessage(IFRAME_LOADED_MESSAGE, ORIGINAL_DOMAIN);
        
    } else { // postmessage not available
        
        var setWindowNameAndRedirect = function(data) {
            window.name = JSON.stringify(data);
            // redirect back to a blank page on the parent's
            // same domain so we can read window.name.
            window.location = ORIGINAL_DOMAIN + PAGE_TO_REDIRECT_BACK_TO;
        }
        
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
            makeJsonpRequest(url, setWindowNameAndRedirect, options);
        }
        
    }

    // attach to the global namespace
    $.secureJsonp = {};
    $.secureJsonp.configure = setConfiguration;
        
    
})(jQuery);
