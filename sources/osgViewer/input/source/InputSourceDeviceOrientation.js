import utils from 'osg/utils';
import InputSource from 'osgViewer/input/source/InputSource';

/**
 * Device Orientation input handling
 * @constructor
 */
var InputSourceDeviceOrientation = function() {
    InputSource.call(this);
    this._target = window;
    this._supportedEvents = ['deviceorientation', 'orientationchange'];
};
utils.createPrototypeObject(
    InputSourceDeviceOrientation,
    utils.objectInherit(InputSource.prototype, {
        getName: function() {
            return 'DeviceOrientation';
        },

        setEnable: function(name, callback, enable) {
            if (enable) {
                this._target.addEventListener(name, callback);
            } else {
                this._target.removeEventListener(name, callback);
            }
        },

        populateEvent(ev, customEvent) {
            if (ev.alpha !== null && ev.alpha !== undefined) {
                customEvent.absolute = ev.absolute;
                customEvent.alpha = ev.alpha;
                customEvent.beta = ev.beta;
                customEvent.gamma = ev.gamma;
            }

            if (window.orientation !== null && window.orientation !== undefined) {
                customEvent.screenOrientation = window.orientation;
            }
        }
    }),
    'osgViewer',
    'InputSourceDeviceOrientation'
);

export default InputSourceDeviceOrientation;
