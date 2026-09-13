/*
 * socket-shim.js - raw-WebSocket shim that exposes a Socket.IO-like API.
 *
 * Why this exists:
 *   The quiz frontend (quizlogic.js, chat.js) was written against the
 *   Socket.IO client (`io()` from CDN) which speaks the engine.io protocol.
 *   The Go backend hub speaks plain JSON frames over raw WebSocket:
 *     client -> server: {"event": "join_quiz_session", "data": {...}}
 *     server -> client: {"event": "questionData", "data": {...}}
 *   We can't add a Socket.IO *server* to Go (offline build, dep not cached),
 *   so instead we give the frontend a drop-in that wraps a raw WebSocket and
 *   speaks the hub's frame format. chat.js already checks for
 *   `window.createCompatibleSocket` and prefers it over `io()`, so defining
 *   this global switches the whole quiz frontend to the Go hub at once.
 *
 * API surface covered (only what the frontend actually uses):
 *   .on(event, cb)            .emit(event, data)
 *   .disconnect()             .connect()
 *   .id   (client-generated)  .connected (bool)
 *   'connect' / 'disconnect' / 'reconnect' / 'connect_error' / 'error' events
 */
(function () {
  function getWsBase() {
    var proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + window.location.host;
  }

  function createCompatibleSocket(url, opts) {
    opts = opts || {};
    var wsUrl = (url ? getWsBase() : getWsBase()) + '/api/v1/quiz/ws';

    var listeners = {};        // event -> [cb]
    var connected = false;
    var explicitClose = false;
    var reconnectAttempts = 0;
    var maxReconnect = opts.reconnectionAttempts != null ? opts.reconnectionAttempts : 10;
    var reconnectDelay = opts.reconnectionDelay != null ? opts.reconnectionDelay : 2000;
    var reconnectDelayMax = opts.reconnectionDelayMax != null ? opts.reconnectionDelayMax : 10000;
    var reconnectTimer = null;
    var ws = null;

    // Stable client id (Socket.IO would assign one from the server).
    var id = 'ws_' + Math.random().toString(36).slice(2, 10);

    function emit(event, data) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: event, data: data }));
      } else {
        console.warn('[socket-shim] emit dropped, socket not open:', event);
      }
    }

    function on(event, cb) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    }

    function off(event, cb) {
      if (!listeners[event]) return;
      if (!cb) {
        delete listeners[event];
      } else {
        listeners[event] = listeners[event].filter(function (f) { return f !== cb; });
      }
    }

    function dispatch(event, data) {
      var cbs = listeners[event] || [];
      for (var i = 0; i < cbs.length; i++) {
        try { cbs[i](data); } catch (e) { console.error('[socket-shim] handler error for', event, e); }
      }
    }

    function clearReconnectTimer() {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    }

    function scheduleReconnect() {
      if (explicitClose || reconnectAttempts >= maxReconnect) return;
      var delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttempts), reconnectDelayMax);
      reconnectAttempts++;
      clearReconnectTimer();
      reconnectTimer = setTimeout(function () { tryConnect(); }, delay);
    }

    function tryConnect() {
      clearReconnectTimer();
      // If a previous socket is still open, close it first.
      if (ws) {
        try { ws.onclose = null; ws.close(); } catch (e) {}
      }
      ws = new WebSocket(wsUrl);

      ws.onopen = function () {
        connected = true;
        explicitClose = false;
        reconnectAttempts = 0;
        dispatch('connect');
      };

      ws.onmessage = function (evt) {
        var frame;
        try { frame = JSON.parse(evt.data); } catch (e) { return; }
        if (frame && typeof frame.event === 'string') {
          dispatch(frame.event, frame.data);
        }
      };

      ws.onerror = function (err) {
        dispatch('connect_error', err);
      };

      ws.onclose = function () {
        var wasConnected = connected;
        connected = false;
        dispatch('disconnect');
        if (wasConnected && !explicitClose && (opts.reconnection !== false)) {
          dispatch('reconnect', reconnectAttempts);
          scheduleReconnect();
        }
      };
    }

    function disconnect() {
      explicitClose = true;
      clearReconnectTimer();
      if (ws) { try { ws.close(); } catch (e) {} }
      connected = false;
    }

    function connect() {
      explicitClose = false;
      tryConnect();
    }

    // Auto-connect unless asked not to (matches Socket.IO's autoConnect default).
    if (opts.autoConnect !== false) {
      tryConnect();
    }

    var socket = {
      id: id,
      get connected() { return connected; },
      emit: emit,
      on: on,
      off: off,
      disconnect: disconnect,
      connect: connect,
      // quizlogic.js sets this flag to avoid double-binding listeners.
      _quizLogicListenersInitialized: false,
    };
    return socket;
  }

  // Expose globally. chat.js prefers this over io() when present.
  window.createCompatibleSocket = createCompatibleSocket;
})();
