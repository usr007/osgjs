import utils from 'osg/utils';
import InputSource from 'osgViewer/input/source/InputSource';
import Hammer from 'hammer';

/**
 * Handles standard touch events and advanced touch events through Hammer.js
 * @param canvas
 * @param hammer
 * @constructor
 */
var InputSourceTouchScreen = function(canvas, hammer) {
    InputSource.call(this, canvas);
    this._hammer = hammer;

    this._hammerEvents = [
        'pan',
        'pinch',
        'press',
        'rotate',
        'swipe',
        'tap',
        'doubletap',
        'doubletap2fingers',
        'singletap'
    ];
    this._supportedEvents = ['touchstart', 'touchend', 'touchcancel'];

    hammer.add(
        new Hammer.Tap({
            event: 'doubletap',
            pointers: 1,
            taps: 2,
            time: 250, // def : 250.  Maximum press time in ms.
            interval: 450, // def : 300. Maximum time in ms between multiple taps.
            threshold: 5, // def : 2. While doing a tap some small movement is allowed.
            posThreshold: 50 // def : 30. The maximum position difference between multiple taps.
        })
    );

    hammer.add(
        new Hammer.Tap({
            event: 'doubletap2fingers',
            pointers: 2,
            taps: 2,
            time: 250,
            interval: 450,
            threshold: 5,
            posThreshold: 50
        })
    );

    hammer.add(
        new Hammer.Tap({
            event: 'singletap',
            pointers: 1,
            taps: 1,
            time: 250,
            interval: 450,
            threshold: 5,
            posThreshold: 20
        })
    );
};

utils.createPrototypeObject(
    InputSourceTouchScreen,
    utils.objectInherit(InputSource.prototype, {

        getName: function () {
            return 'TouchScreen';
        },

        setEnable: function(name, callback, enable) {
            if (enable) {
                this._target.addEventListener(name, callback);
            } else {
                this._target.removeEventListener(name, callback);
            }
        },

        populateEvent(ev, customEvent) {
            if (this._isNativeEvent(ev)) {
                //native event
                customEvent.canvasX = customEvent.canvasY = 0;
                var nbTouches = ev.touches.length;
                for (var i = 0; i < nbTouches; ++i) {
                    customEvent.canvasX += ev.touches[i].clientX / nbTouches;
                    customEvent.canvasY += ev.touches[i].clientY / nbTouches;
                }
                // modifiers
                customEvent.ctrlKey = ev.ctrlKey;
                customEvent.shiftKey = ev.shiftKey;
                customEvent.altKey = ev.altKey;
                customEvent.metaKey = ev.metaKey;
            } else {
                //hammer event
                customEvent.canvasX = ev.center.x;
                customEvent.canvasY = ev.center.y;
                customEvent.scale = ev.scale;
                customEvent.deltaX = ev.deltaX;
                customEvent.deltaY = ev.deltaY;
            }

            var offset = this._target.getBoundingClientRect();
            customEvent.canvasX += -offset.left;
            customEvent.canvasX += -offset.top;
        },

        _isNativeEvent: function(ev) {
            return ev.type === 'touchstart' || ev.type === 'touchend' || ev.type === 'touchcancel';
        },

        supportsEvent: function(eventName) {
            var result = InputSource.prototype.supportsEvent.call(this, eventName);
            if (result) {
                return result;
            }
            for (var i = 0; i < this._hammerEvents.length; i++) {
                var event = this._hammerEvents[i];
                if (eventName.indexOf(event) === 0) {
                    return true;
                }
            }
            return false;
        }
    }),
    'osgViewer',
    'InputSourceTouchScreen'
);

export default InputSourceTouchScreen;
