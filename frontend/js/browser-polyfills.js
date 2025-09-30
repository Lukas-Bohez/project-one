/*
 * Browser Compatibility Polyfills
 * Add support for modern JavaScript features in older browsers
 */

// Polyfill for Array.from() (IE support)
if (!Array.from) {
    Array.from = (function () {
        var toStr = Object.prototype.toString;
        var isCallable = function (fn) {
            return typeof fn === 'function' || toStr.call(fn) === '[object Function]';
        };
        var toInteger = function (value) {
            var number = Number(value);
            if (isNaN(number)) { return 0; }
            if (number === 0 || !isFinite(number)) { return number; }
            return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
        };
        var maxSafeInteger = Math.pow(2, 53) - 1;
        var toLength = function (value) {
            var len = toInteger(value);
            return Math.min(Math.max(len, 0), maxSafeInteger);
        };

        return function from(arrayLike/*, mapFn, thisArg */) {
            var C = this;
            var items = Object(arrayLike);
            if (arrayLike == null) {
                throw new TypeError('Array.from requires an array-like object - not null or undefined');
            }
            var mapFn = arguments.length > 1 ? arguments[1] : void undefined;
            var T;
            if (typeof mapFn !== 'undefined') {
                if (!isCallable(mapFn)) {
                    throw new TypeError('Array.from: when provided, the second argument must be a function');
                }
                if (arguments.length > 2) {
                    T = arguments[2];
                }
            }
            var len = toLength(items.length);
            var A = isCallable(C) ? Object(new C(len)) : new Array(len);
            var k = 0;
            var kValue;
            while (k < len) {
                kValue = items[k];
                if (mapFn) {
                    A[k] = typeof T === 'undefined' ? mapFn(kValue, k) : mapFn.call(T, kValue, k);
                } else {
                    A[k] = kValue;
                }
                k += 1;
            }
            A.length = len;
            return A;
        };
    }());
}

// Polyfill for Object.assign() (IE support)
if (typeof Object.assign !== 'function') {
    Object.defineProperty(Object, "assign", {
        value: function assign(target, varArgs) {
            'use strict';
            if (target == null) {
                throw new TypeError('Cannot convert undefined or null to object');
            }
            var to = Object(target);
            for (var index = 1; index < arguments.length; index++) {
                var nextSource = arguments[index];
                if (nextSource != null) {
                    for (var nextKey in nextSource) {
                        if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                            to[nextKey] = nextSource[nextKey];
                        }
                    }
                }
            }
            return to;
        },
        writable: true,
        configurable: true
    });
}

// Polyfill for String.includes() (IE support)
if (!String.prototype.includes) {
    String.prototype.includes = function(search, start) {
        'use strict';
        if (typeof start !== 'number') {
            start = 0;
        }
        if (start + search.length > this.length) {
            return false;
        } else {
            return this.indexOf(search, start) !== -1;
        }
    };
}

// Polyfill for Array.includes() (IE support)
if (!Array.prototype.includes) {
    Array.prototype.includes = function(valueToFind, fromIndex) {
        return this.indexOf(valueToFind, fromIndex) !== -1;
    };
}

// Polyfill for Promise (IE support)
if (typeof Promise === 'undefined') {
    window.Promise = function(executor) {
        var self = this;
        self.state = 'pending';
        self.value = undefined;
        self.handlers = [];
        
        function resolve(result) {
            if (self.state === 'pending') {
                self.state = 'fulfilled';
                self.value = result;
                self.handlers.forEach(handle);
                self.handlers = null;
            }
        }
        
        function reject(error) {
            if (self.state === 'pending') {
                self.state = 'rejected';
                self.value = error;
                self.handlers.forEach(handle);
                self.handlers = null;
            }
        }
        
        function handle(handler) {
            if (self.state === 'pending') {
                self.handlers.push(handler);
            } else {
                if (self.state === 'fulfilled' && typeof handler.onFulfilled === 'function') {
                    handler.onFulfilled(self.value);
                }
                if (self.state === 'rejected' && typeof handler.onRejected === 'function') {
                    handler.onRejected(self.value);
                }
            }
        }
        
        this.then = function(onFulfilled, onRejected) {
            return new Promise(function(resolve, reject) {
                handle({
                    onFulfilled: function(result) {
                        try {
                            resolve(onFulfilled ? onFulfilled(result) : result);
                        } catch (ex) {
                            reject(ex);
                        }
                    },
                    onRejected: function(error) {
                        try {
                            resolve(onRejected ? onRejected(error) : error);
                        } catch (ex) {
                            reject(ex);
                        }
                    }
                });
            });
        };
        
        executor(resolve, reject);
    };
}

// Polyfill for fetch API (IE support)
if (!window.fetch) {
    window.fetch = function(url, options) {
        return new Promise(function(resolve, reject) {
            var request = new XMLHttpRequest();
            var method = (options && options.method) || 'GET';
            var body = (options && options.body) || null;
            var headers = (options && options.headers) || {};
            
            request.open(method, url, true);
            
            for (var key in headers) {
                if (headers.hasOwnProperty(key)) {
                    request.setRequestHeader(key, headers[key]);
                }
            }
            
            request.onload = function() {
                resolve({
                    ok: request.status >= 200 && request.status < 300,
                    status: request.status,
                    statusText: request.statusText,
                    text: function() {
                        return Promise.resolve(request.responseText);
                    },
                    json: function() {
                        return Promise.resolve(JSON.parse(request.responseText));
                    }
                });
            };
            
            request.onerror = function() {
                reject(new Error('Network Error'));
            };
            
            request.send(body);
        });
    };
}

// Cross-browser addEventListener
function addEventListenerCompat(element, event, handler) {
    if (element.addEventListener) {
        element.addEventListener(event, handler, false);
    } else if (element.attachEvent) {
        element.attachEvent('on' + event, handler);
    } else {
        element['on' + event] = handler;
    }
}

// Cross-browser removeEventListener
function removeEventListenerCompat(element, event, handler) {
    if (element.removeEventListener) {
        element.removeEventListener(event, handler, false);
    } else if (element.detachEvent) {
        element.detachEvent('on' + event, handler);
    } else {
        element['on' + event] = null;
    }
}

// Cross-browser querySelector
function querySelectorCompat(selector) {
    if (document.querySelector) {
        return document.querySelector(selector);
    } else {
        // Fallback for IE7
        var element = null;
        if (selector.charAt(0) === '#') {
            element = document.getElementById(selector.slice(1));
        } else if (selector.charAt(0) === '.') {
            var elements = document.getElementsByTagName('*');
            var className = selector.slice(1);
            for (var i = 0; i < elements.length; i++) {
                if (elements[i].className && elements[i].className.indexOf(className) !== -1) {
                    element = elements[i];
                    break;
                }
            }
        }
        return element;
    }
}

// Cross-browser console.log
if (!window.console) {
    window.console = {
        log: function() {},
        error: function() {},
        warn: function() {},
        info: function() {}
    };
}

// Cross-browser localStorage check
function isLocalStorageSupported() {
    try {
        var test = 'test';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch(e) {
        return false;
    }
}

// LocalStorage fallback for older browsers
if (!isLocalStorageSupported()) {
    window.localStorage = {
        _data: {},
        setItem: function(key, value) {
            return this._data[key] = String(value);
        },
        getItem: function(key) {
            return this._data.hasOwnProperty(key) ? this._data[key] : null;
        },
        removeItem: function(key) {
            return delete this._data[key];
        },
        clear: function() {
            return this._data = {};
        }
    };
}

// Cross-browser DOMContentLoaded
function onDOMReady(callback) {
    if (document.readyState === 'loading') {
        if (document.addEventListener) {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            document.attachEvent('onreadystatechange', function() {
                if (document.readyState === 'complete') {
                    callback();
                }
            });
        }
    } else {
        callback();
    }
}

// Cross-browser JSON support
if (!window.JSON) {
    window.JSON = {
        parse: function(str) {
            return eval('(' + str + ')');
        },
        stringify: function(obj) {
            var t = typeof (obj);
            if (t !== "object" || obj === null) {
                if (t === "string") obj = '"' + obj + '"';
                return String(obj);
            } else {
                var n, v, json = [], arr = (obj && obj.constructor === Array);
                for (n in obj) {
                    v = obj[n];
                    t = typeof(v);
                    if (t === "string") v = '"' + v + '"';
                    else if (t === "object" && v !== null) v = JSON.stringify(v);
                    json.push((arr ? "" : '"' + n + '":') + String(v));
                }
                return (arr ? "[" : "{") + String(json) + (arr ? "]" : "}");
            }
        }
    };
}

// AudioContext cross-browser compatibility
window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;

// RequestAnimationFrame polyfill
(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] 
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }
 
    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
 
    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());

// Utility function to detect browser
function getBrowserInfo() {
    var ua = navigator.userAgent;
    var browser = {
        name: 'unknown',
        version: 0,
        isIE: false,
        isEdge: false,
        isChrome: false,
        isFirefox: false,
        isSafari: false
    };
    
    if (/MSIE|Trident/.test(ua)) {
        browser.name = 'ie';
        browser.isIE = true;
        browser.version = parseFloat(ua.match(/(?:MSIE |rv:)(\d+(\.\d+)?)/)[1]);
    } else if (/Edge/.test(ua)) {
        browser.name = 'edge';
        browser.isEdge = true;
        browser.version = parseFloat(ua.match(/Edge\/(\d+(\.\d+)?)/)[1]);
    } else if (/Chrome/.test(ua)) {
        browser.name = 'chrome';
        browser.isChrome = true;
        browser.version = parseFloat(ua.match(/Chrome\/(\d+(\.\d+)?)/)[1]);
    } else if (/Firefox/.test(ua)) {
        browser.name = 'firefox';
        browser.isFirefox = true;
        browser.version = parseFloat(ua.match(/Firefox\/(\d+(\.\d+)?)/)[1]);
    } else if (/Safari/.test(ua)) {
        browser.name = 'safari';
        browser.isSafari = true;
        browser.version = parseFloat(ua.match(/Version\/(\d+(\.\d+)?)/)[1]);
    }
    
    return browser;
}

// Make utilities globally available
window.browserCompat = {
    addEventListenerCompat: addEventListenerCompat,
    removeEventListenerCompat: removeEventListenerCompat,
    querySelectorCompat: querySelectorCompat,
    isLocalStorageSupported: isLocalStorageSupported,
    onDOMReady: onDOMReady,
    getBrowserInfo: getBrowserInfo
};