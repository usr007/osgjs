import utils from 'osg/utils';
import InputSource from 'osgViewer/input/source/InputSource';

/**
 * Standard Mouse Event handled directly on the canvas.
 * @param canvas
 * @constructor
 */
var InputSourceMouse = function(canvas) {
    InputSource.call(this, canvas);
    this._supportedEvents = [
        'click',
        'contextmenu',
        'dblclick',
        'mousedown',
        'mouseenter',
        'mouseleave',
        'mousemove',
        'mouseover',
        'mouseout',
        'mouseup',
        'DOMMouseScroll',
        'mousewheel',
        'MozMousePixelScroll'
    ];
};
utils.createPrototypeObject(
    InputSourceMouse,
    utils.objectInherit(InputSource.prototype, {

        getName: function () {
            return 'Mouse';
        },

        setEnable: function(name, callback, enable) {
            // here we could parse the name of th event.
            // if the name is for example 'click left', only dispatch the event if the left button has ben clicked.
            // This would remove a lot of boiler plate from client code.

            if (enable) {
                this._target.addEventListener(name, callback);
            } else {
                this._target.removeEventListener(name, callback);
            }
        },

        populateEvent(ev, customEvent) {
            // desktop - mouse
            customEvent.canvasX = ev.offsetX === undefined ? ev.layerX : ev.offsetX;
            customEvent.canvasY = ev.offsetY === undefined ? ev.layerY : ev.offsetY;

            // x, y coordinates in the gl viewport
            // This should handle the pixelRatio. I need to find a way to do that.
            customEvent.glX = customEvent.canvasX;
            customEvent.glY = this._target.clientHeight - customEvent.canvasY;

            customEvent.clientX = ev.clientX;
            customEvent.clientY = ev.clientY;
            customEvent.screenX = ev.screenX;
            customEvent.screenX = ev.screenX;
            customEvent.pageX = ev.pageX;
            customEvent.pageY = ev.pageY;

            // modifiers
            customEvent.ctrlKey = ev.ctrlKey;
            customEvent.shiftKey = ev.shiftKey;
            customEvent.altKey = ev.altKey;
            customEvent.metaKey = ev.metaKey;

            //buttons
            customEvent.button = ev.button;
            customEvent.buttons = ev.buttons;

            if (this._isMouseWheelEvent(ev)) {
                customEvent.wheelDelta = ev.wheelDelta === undefined ? -ev.detail : ev.wheelDelta;
            }
        },

        _isMouseWheelEvent(ev) {
            return (
                ev.type === 'DOMMouseScroll' ||
                ev.type === 'mousewheel' ||
                ev.type === 'MozMousePixelScroll'
            );
        }
    }),
    'osgViewer',
    'InputSourceMouse'
);

export default InputSourceMouse;
