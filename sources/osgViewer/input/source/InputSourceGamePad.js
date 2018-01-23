import utils from 'osg/utils';
import InputSource from 'osgViewer/input/source/InputSource';

var POLL_INTERVAL = 3000;

/**
 * Game Pads input handling
 * @constructor
 */
var InputSourceGamePad = function() {
    InputSource.call(this);
    this._target = window;
    this._supportedEvents = [
        'buttonPressed',
        'axischanged',
        'gamepadconnected',
        'gamepaddisconnected'
    ];
    this._callbacks = {};
    this._events = {};
    for (var i = 0; i < this._supportedEvents.length; i++) {
        var eventName = this._supportedEvents[i];
        var event = new Event(eventName);
        this._events[eventName] = event;
    }
    this._nbCallbacks = 0;
    this._gamePad;
};
utils.createPrototypeObject(
    InputSourceGamePad,
    utils.objectInherit(InputSource.prototype, {
        getName: function() {
            return 'GamePad';
        },

        setEnable: function(name, callback, enable) {
            var callbacks = this._callbacks[name];
            if (!callbacks) {
                callbacks = [];
                this._callbacks[name] = callbacks;
            }
            if (enable) {
                callbacks.push(callback);
                this._nbCallbacks++;
            } else {
                var removed = callbacks.splice(callbacks.indexof(callback), 1);
                if (removed) this._nbCallbacks--;
            }
        },

        _gamepadPoll: function() {
            if (!navigator.getGamepads) return null;

            setInterval(function() {
                var gamepads = navigator.getGamepads();
                var gamepad = gamepads[this._gamepadIndex];
                if (gamepad) {
                    this._gamePad = gamepad;
                    return;
                }

                //selecting the first gamepad in the list as the current gamepad.
                for (var i = 0, nb = gamepads.length; i < nb; ++i) {
                    var gm = gamepads[i];
                    // https://code.google.com/p/chromium/issues/detail?id=413805
                    if (gm && gm.id && gm.id.indexOf('Unknown Gamepad') === -1) {
                        this._gamepadIndex = i;
                        this._onConnectionStateChange(gm, 'ongamepadconnected');
                        this._gamePad = gm;
                        return;
                    }
                }
                if (this._gamepadIndex >= 0) {
                    this._onConnectionStateChange(this._gamePad, 'ongamepaddisconnected');
                    this._gamepadIndex = -1;
                }
                return null;
            }, POLL_INTERVAL);
        },

        _onConnectionStateChange: function(gamepad, state) {
            var callback = this._callbacks[state];
            if (!callback) {
                return;
            }
            var event = this._events[state];
            event.gamepad = gamepad;
            callback(gamepad);
        },

        populateEvent: function(ev, customEvent) {
            if (ev.button) {
                customEvent.button = ev.button;
                customEvent.value = ev.value;
            }

            if (ev.axis) {
                customEvent.axis = ev.axis;
                customEvent.value = ev.value;
            }
        },

        poll: function() {
            var gamepad = this._gamePad;
            if (!gamepad) return;

            var buttonPressedCallbacks = this._callbacks['buttonpressed'];
            if (!buttonPressedCallbacks) {
                return;
            }
            var event;
            for (var i = 0; i < gamepad.buttons.length; i++) {
                var button = gamepad.buttons[i];
                if (button.pressed || button.value > 0) {
                    event = this._events['buttonpressed'];
                    event.button = i;
                    event.value = button.value;
                    for (var j = 0; j < buttonPressedCallbacks.length; j++) {
                        var cb = buttonPressedCallbacks[j];
                        cb(event);
                    }
                }
            }

            var axisChangedCallback = this._callbacks['axischanged'];
            if (!axisChangedCallback) {
                return;
            }

            for (i = 0; i < gamepad.axes.length; i++) {
                var axis = gamepad.axes[i];
                //firing the event on each frame... maybe we could check for changes.
                event = this._events['axischanged'];
                event.axis = i;
                event.value = axis;
                for (j = 0; j < axisChangedCallback.length; j++) {
                    cb = axisChangedCallback[j];
                    cb(event);
                }
            }
        }
    }),
    'osgViewer',
    'InputSourceGamePad'
);

export default InputSourceGamePad;
