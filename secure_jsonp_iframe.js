(function(){
    // ### Start variables to configure ###
    var ORIGINAL_DOMAIN = "http://localhost";
    // the page on the original domain to redirect back to.
    // can be any existing page, such as robots.txt.
    var PAGE_TO_REDIRECT_BACK_TO = "/blank_page.html";
    // ### End variables to configure ###

    var POSTMESSAGE_AVAILABLE = "postMessage" in window;
    
    var mockJsonpRequest = function(url, callback) {
	setTimeout(function(){callback("testData")}, 1000);
    }

    var makeJsonpRequest = function(url, callback) {
	$.ajax({ url: url,
		 dataType: 'jsonp',
		 success: callback
               });
    }

    if(POSTMESSAGE_AVAILABLE) {
        
        var receiveMessage = function(event)
        {
    	    if (event.origin !== ORIGINAL_DOMAIN) {
    	        return;
            }

            var splitData = event.data.split("!:!");
            var requestId = splitData[0];
            var url = splitData[1];
            
            makeJsonpRequest(url, function(response) {
    	        event.source.postMessage('["' + requestId + '", ' + JSON.stringify(response) + "]", "*")                
            });
        }
        

        if (window.addEventListener) {
            window.addEventListener("message", receiveMessage, false);
        }
        else if (window.attachEvent) {
            window.attachEvent("onmessage", receiveMessage);
        }
        
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
	    var url = decodeURIComponent(hashtag.substr(1,
						        hashtag.length));
	    makeJsonpRequest(url, setWindowNameAndRedirect);
        }
        
    }
    

})();