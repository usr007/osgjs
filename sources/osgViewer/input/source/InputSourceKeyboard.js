import utils from 'osg/utils';
import InputSource from 'osgViewer/input/source/InputSource';

/**
 * Standard Keyboard Event handled directly on the canvas.
 * @param canvas
 * @constructor
 */
var InputSourceKeyboard = function(canvas) {
    InputSource.call(this, canvas);
    this._supportedEvents = [
        'keydown',
        'keyup',
        'keypress'
    ];
};
utils.createPrototypeObject(
    InputSourceKeyboard,
    utils.objectInherit(InputSource.prototype, {

        getName: function () {
            return 'Keyboard';
        },

        setEnable: function(name, callback, enable) {
            if (enable) {
                this._target.addEventListener(name, callback);
            } else {
                this._target.removeEventListener(name, callback);
            }
        },

        populateEvent(ev, customEvent){
            customEvent.key = ev.key;
            customEvent.code = ev.code;
            customEvent.location = ev.location;
            customEvent.repeat = ev.repeat;

            // modifiers
            customEvent.ctrlKey = ev.ctrlKey;
            customEvent.shiftKey = ev.shiftKey;
            customEvent.altKey = ev.altKey;
            customEvent.metaKey = ev.metaKey;
        },

    }),
    'osgViewer',
    'InputSourceKeyboard'
);

export default InputSourceKeyboard;
