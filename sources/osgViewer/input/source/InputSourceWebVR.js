import utils from 'osg/utils';
import InputSource from 'osgViewer/input/source/InputSource';
import notify from 'osg/notify';

/**
 * WebVR Hmd device input handling.
 * @param canvas
 * @constructor
 */
var InputSourceWebVR = function() {
    InputSource.call(this);
    this._supportedEvents = ['vrdisplayposechanged', 'vrdisplayconnected', 'vrdisplaydisconnected'];

    this._event = new Event('vrdisplayposechanged');
    this._callbacks = {};
    this._events = {};
    for (var i = 0; i < this._supportedEvents.length; i++) {
        var eventName = this._supportedEvents[i];
        var event = new Event(eventName);
        this._events[eventName] = event;
    }

    this._pollHeadset();
};
utils.createPrototypeObject(
    InputSourceWebVR,
    utils.objectInherit(InputSource.prototype, {
        getName: function() {
            return 'WebVR';
        },

        setEnable: function(name, callback, enable) {
            var callbacks = this._callbacks[name];
            if (!callbacks){
                callbacks = [];
                this._callbacks[name] = callbacks;
            }
            if (enable) {
                callbacks.push(callback);
            } else {
                callbacks.splice(callbacks.indexof(callback), 1);
            }
        },

        populateEvent(ev, customEvent) {
            customEvent.pose = ev.pose;
            customEvent.sitToStandMatrix = ev.sitToStandMatrix;
        },

        _pollHeadset: function() {
            if (!navigator.getVRDisplays) {
                this._hmd = undefined;
                this._frameData = undefined;
                return;
            }

            var self = this;
            navigator.getVRDisplays().then(function(displays) {
                if (displays.length > 0) {
                    notify.log('Found a VR display');
                    if (self._hmd !== displays[0]) {
                        //fire the disconnect event
                        var event = this._events['vrdisplaydisconnected'];
                        event.vrDisplay = this._hmd;
                        this._callbacks['vrdisplaydisconnected'](event);

                        //fire the connect event
                        event = this._events['vrdisplayconnected'];
                        event.vrDisplay = displays[0];
                        this._callbacks['vrdisplayconnected'](event);
                    }
                    self._hmd = displays[0];
                    self._frameData = new window.VRFrameData();
                    // the viewer will now listen for vrdisplayconnected
                    // self._viewer.setVRDisplay(self._hmd);
                }
            });
        },

        poll: function() {
            // this is asynchronous so it might not get an answer for this frame.
            // maybe schedule this every second or 2... or keep it only at load time.
            this._pollHeadset();

            if (!self._hmd) {
                return;
            }

            var callbacks = this._callbacks['vrdisplayposechanged'];
            if (!callbacks) {
                return;
            }

            //hmd movement
            this._hmd.getFrameData(this._frameData);

            var pose = this._frameData.pose;

            if (!pose) return;

            // WebVR up vector is Y
            // OSGJS up vector is Z

            var sitToStand =
                this._hmd.stageParameters && this._hmd.stageParameters.sittingToStandingTransform;

            var event = this._events['vrdisplayposechanged'];
            event.pose = pose;
            event.sitToStandMatrix = sitToStand;

            for (var i = 0; i < callbacks.length; i++) {
                var callback = callbacks[i]
                callback(event);
            }


            //This should be done in the adapter
            // var q = pose.orientation;
            //
            //
            // if (q) {
            //     if (sitToStand) {
            //         q = mat4.getRotation(tempQuat, sitToStand);
            //         quat.mul(q, q, pose.orientation);
            //     }
            //
            //     this._quat[0] = q[0];
            //     this._quat[1] = -q[2];
            //     this._quat[2] = q[1];
            //     this._quat[3] = q[3];
            // }
            //
            // var pos = pose.position;
            // if (pos) {
            //     if (sitToStand) {
            //         pos = vec3.transformMat4(tempPos, pos, sitToStand);
            //     }
            //     this._pos[0] = pos[0] * this._worldScale;
            //     this._pos[1] = -pos[2] * this._worldScale;
            //     this._pos[2] = pos[1] * this._worldScale;
            // }
            //
            // manipulatorAdapter.update(this._quat, this._pos);
        }
    }),
    'osgViewer',
    'InputSourceWebVR'
);

export default InputSourceWebVR;
