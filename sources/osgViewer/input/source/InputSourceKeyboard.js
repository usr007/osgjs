import utils from 'osg/utils';
import InputSource from 'osgViewer/input/source/InputSource';

/**
 * Standard Keyboard Event handled directly on the canvas.
 * @param canvas
 * @constructor
 */
var InputSourceKeyboard = function(canvas) {
    InputSource.call(this, canvas);
    this._supportedEvents = ['keydown', 'keyup', 'keypress'];
};
utils.createPrototypeObject(
    InputSourceKeyboard,
    utils.objectInherit(InputSource.prototype, {
        getName: function() {
            return 'Keyboard';
        },

        setEnable: function(name, callback, enable) {
            if (enable) {
                window.addEventListener(name, callback);
                //this._target
            } else {
                this._target.removeEventListener(name, callback);
            }
        },

        populateEvent: function(ev, customEvent) {
            customEvent.key = ev.key;
            customEvent.keyCode = ev.keyCode;
            customEvent.code = ev.code;
            customEvent.location = ev.location;
            customEvent.repeat = ev.repeat;

            // modifiers
            customEvent.ctrlKey = ev.ctrlKey;
            customEvent.shiftKey = ev.shiftKey;
            customEvent.altKey = ev.altKey;
            customEvent.metaKey = ev.metaKey;
        },

        matches: function(nativeEvent, parsedEvent) {
            if (!parsedEvent.action) {
                return true;
            }
            if (nativeEvent.key.toLowerCase() !== parsedEvent.action) {
                if (nativeEvent.code.toLowerCase() !== parsedEvent.action) {
                    //   console.log('no match', nativeEvent.key, nativeEvent.code, parsedEvent.action);
                    return false;
                }
            }
            if (nativeEvent.ctrlKey !== !!parsedEvent.ctrl) {
                //console.log('ctrl no match');
                return false;
            }
            if (nativeEvent.shiftKey !== !!parsedEvent.shift) {
                //console.log('shift no match');
                return false;
            }
            if (nativeEvent.altKey !== !!parsedEvent.alt) {
                //console.log('alt no match');
                return false;
            }
            if (nativeEvent.metaKey !== !!parsedEvent.meta) {
                //console.log('meta no match');
                return false;
            }

            return true;
        }
    }),
    'osgViewer',
    'InputSourceKeyboard'
);

export default InputSourceKeyboard;
