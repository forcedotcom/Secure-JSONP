# Secure JSONP Library

## Overview

This library allows you to make cross domain jsonp calls in a way that is secure. This is accomplished by making the actual jsonp call in an iframe on a different domain (so you will need to control two domains to set up this library). 

The reason that jsonp is not normally secure is that you are essentially including a script source from a third party domain, which in effect intentionally XSS's your website if the site you are making the request to becomes malicious (intentionally or by being compromised itself). With this implementation a compromised site would only be able to itself compromise a sandboxed domain, and not access e.g. the parent window's cookie.

Special care has been taken to work with older browsers that do not support postmessage (currently IE7+ is supported) by using the window.name property as a transport.

This library is currently a jQuery plugin, but could be easily modified to stand alone or work with another front-end library.

## How to Use

1) You must include jquery, json2.js, and secure_jsonp.js on your domain to be kept safe. You will then need to upload 'secure_jsonp_iframe.js' and 'secure_jsonp_iframe.html' to a separate domain that you control, and whose security you do not care about (this is important, this is the domain that will be vulnerable to XSS!). 

2) You then need to modify the links at the top of secure_jsonp_iframe.html to point to the correct locations on your webserver(s). Then you must configure the script (see configuration instructions below) or modify the default configuration constants at the top of secure_jsonp.js and secure_jsonp_iframe.js.

3) Once finished, you can use this library with a simple interface:

     $.secureJsonp.makeRequest(url, callback, [options])

        url - the url against which to make the JSONP request

        callback - a function that will be called back with a single argument containing the
          result of the jsonp call when results are available. The result will be in a javascript
          object. 

        options (optional) - an options in the style of jquery that can be passed to the ajax request made
          in the child iframe. See documentation regarding the formatting of ajax settings object here: 
          http://api.jquery.com/jQuery.ajax/. The request must still be a jsonp request, but you specify
          things such as "jsonp", "jsonpCallback", and "cache" as documented on that page. (only text options
          may be specified, i.e. not functions).

Example usage:

      $.secureJsonp.makeRequest('https://graph.facebook.com/evanbeard',
                                console.log
                               );

Move this project to be accessible at the root of a local webserver and view the test.html file in the testing folder to see this script functioning (the two domains used will be localhost and 127.0.0.1).

## Configuration Instructions

On the page including secure_jsonp.js:

   - differentDomain - the domain (whose security we don't care about) that will be opened in an iframe and making the jsonp request

For example:

      $.secureJsonp.configure({differentDomain:'http://127.0.0.1});

On the page including secure_jsonp_iframe.js:

   - originalDomain - the main domain that is making the request (to which to send the response)

   - pageToRedirectBackTo - the page to redirect the iframe back to if using an older browser that doesn't support postmessage

For example:

      $.secureJsonp.configure({originalDomain:'localhost',
                               pageToRedirectBackTo:'/blank_page.html'});


Note: You may wonder why the domains cannot be taken from document.location and passed between the iframes to minimize configuration. This is for two main reasons: security, and because we are using a postmessage from the child to the parent to indicate when the child is finished loading (see comments in code) so there is a chicken and egg problem.

## Implementation 

There are two main cases that this library handles: the situation that postmessage is supported by the client browser, and the situation where it's not.

### Postmessage available

If postmessage is available a single child iframe is created. When we want to make a jsonp request, a postmessage asking the child iframe to make the request is dispatched, and a postmessage is send back to the parent when the result is available.

### Postmessage not available

This is the harder case. Here we must make one child iframe per request. We pass the url that we want to request in the hashtag of the child iframe. The child makes the jsonp request, and on callback it sets its window.name property to the result of the request and redirects the page back (to any page on the original domain. We have included a blank_page.html file to include on the original domain, although an existing file, such as robots.txt, could be used). When the iframe is redirected back to the original domain this sets off the onload function of the iframe in the top parent window, which can retrieve the result and destroy the iframe.

## How this compares to existing libraries

This is the first open sourced library (that I can find through reasonable search effort) that solves the problem of making secure jsonp calls.

Other libraries abstract away postmessage so that it works in older browsers through an alternate transport mechanism, but most of these libraries ignore issues such as performance (they poll the window.location property) or the possibility of messages longer than 2k encoded characters. I could not find a library that address thosed issues, so no existing postmessage abstraction was used.

## Why the window.name transport was chosen

We could have chosen another transport for passing information between iframes (any shared state between the two frames could be used to transport our payloads). Some alternatives transports include using flash and using the window's location property. I did not use flash because it would have introduced an unacceptable dependency on flash where one might not have already existed. The location property is at first glance a solid transport, but upon inspection it has a few drawbacks. One of these is the 2000 character limit on urls in older versions of IE that would require sending 2000 encoded character fragments at a time and putting the fragments back together.  A larger issue with the location property is that it requires polling by the iframe receiving the message to check for a new message. Because you would not want the parent window to continually change it's location (this would certainly appear odd to the user), an iframe a third level deep would be needed that continually polled and called a js function on the same domain top level parent to send the message back. There is no built-in way to make sure messages are received -- by changing the location name on a message not received through polling we would overwrite an older message. This would necessitate the implementation of a queue and scheme for tracking receipt of messages. For these reasons, message integrity would probably need to be checked after reconstruction, introducing added complexity. These are all reasons that the location tranport was found unacceptable. With the window.name property it appears the maximum message size in older browsers is >=2MB, solving issues of length for virtually all use cases.

One drawback of the window.name transport is a security issue noted below. This issues does not affect the location transport (because locations can be read only by parent iframes, not by anyone as window.name can).

## Security Note

There is a race condition in which the jsonp response could be intercepted if postmessage is not available (in older browsers). This is because window.name is globally accessible in some older browsers (e.g. IE6/7, see http://code.google.com/p/browsersec/w/list). If you are passing sensitive data, it may be wise to implement a block cypher. The parent iframe would send a secret back to the child iframe through the location, and that key would be used to sign the data before placing it in window.name and then used again to decrypt the data from window.name by the parent.

There is a timing attack in which on older browsers not supporting postmessage an attacker could change the window.location property before it is read by the child iframe. This would cause the client's browser to make an erroneous request. The attacker would not receive back data, however, and could already make erroneous jsonp requests if you are on his page, so this is not considered a vulnerability.

## Authors
Evan A. Beard

## Contributions 
Contributions are welcome -- please send a pull request...and don't forget to add yourself to the authors list.

## License
BSD

Copyright (c) 2011, Salesforce Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

-Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.   
-Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.   

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.