import Controller from 'osgGA/Controller';
import utils from 'osg/utils';
import osgMath from 'osg/math';
import OrbitManipulatorEnums from 'osgGA/orbitManipulatorEnums';

var OrbitManipulatorStandardMouseKeyboardController = function(manipulator) {
    Controller.call(this, manipulator);
    this.init();
};

utils.createPrototypeObject(
    OrbitManipulatorStandardMouseKeyboardController,
    utils.objectInherit(Controller.prototype, {
        init: function() {
            this._delay = 0.15;
            this._mode = undefined;
            this._inMotion = false;

            if (!this._manipulator.getInputManager()) {
                return;
            }

            var manager = this._manipulator.getInputManager();
            var setRotationMode = this.changeMode.bind(
                this,
                OrbitManipulatorEnums.ROTATE,
                this._manipulator.getRotateInterpolator()
            );
            var setPanMode = this.changeMode.bind(
                this,
                OrbitManipulatorEnums.PAN,
                this._manipulator.getPanInterpolator()
            );
            var setZoomMode = this.changeMode.bind(
                this,
                OrbitManipulatorEnums.ZOOM,
                this._manipulator.getZoomInterpolator()
            );

            manager.addMappings(
                {
                    'scene.manipulators.orbit:motion': 'mousemove',
                    'scene.manipulators.orbit:startPan': [
                        'mousedown shift 0',
                        'mousedown 1',
                        'mousedown 2'
                    ],
                    'scene.manipulators.orbit:startZoom': ['mousedown ctrl 0', 'mousedown ctrl 2'],
                    'scene.manipulators.orbit:startRotate': 'mousedown 0',
                    'scene.manipulators.orbit:stopMotion': [
                        'mouseup',
                        'mouseout',
                        'keyup a',
                        'keyup s',
                        'keyup d'
                    ],
                    'scene.manipulators.orbit:zoom': 'wheel',
                    'scene.manipulators.orbit:resetToHome': 'keydown space'
                },
                this
            );

            manager.addMappings(
                { 'scene.manipulators.orbit:setRotationMode': 'keydown a' },
                setRotationMode
            );
            manager.addMappings({ 'scene.manipulators.orbit:setPanMode': 'keydown d' }, setPanMode);
            manager.addMappings(
                { 'scene.manipulators.orbit:setZoomMode': 'keydown s' },
                setZoomMode
            );
        },

        // called to enable/disable controller
        setEnable: function(bool) {
            if (!bool) {
                // reset mode if we disable it
                this._mode = undefined;
            }
            Controller.prototype.setEnable.call(this, bool);
        },

        getMode: function() {
            return this._mode;
        },

        setMode: function(mode) {
            this._mode = mode;
        },

        setManipulator: function(manipulator) {
            this._manipulator = manipulator;
        },

        motion: function(ev) {
            if (this._inMotion === false) {
                return;
            }

            var posX = ev.glX;
            var posY = ev.glY;

            var manipulator = this._manipulator;
            if (osgMath.isNaN(posX) === false && osgMath.isNaN(posY) === false) {
                var mode = this.getMode();
                if (mode === OrbitManipulatorEnums.ROTATE) {
                    manipulator.getRotateInterpolator().setDelay(this._delay);
                    manipulator.getRotateInterpolator().setTarget(posX, posY);
                } else if (mode === OrbitManipulatorEnums.PAN) {
                    manipulator.getPanInterpolator().setTarget(posX, posY);
                } else if (mode === OrbitManipulatorEnums.ZOOM) {
                    var zoom = manipulator.getZoomInterpolator();
                    if (zoom.isReset()) {
                        zoom.setStart(posY);
                        zoom.set(0.0);
                    }
                    var dy = posY - zoom.getStart();
                    zoom.setStart(posY);
                    var v = zoom.getTarget()[0];
                    zoom.setTarget(v - dy / 20.0);
                }
            }
        },

        startPan: function(ev) {
            var pan = this._manipulator.getPanInterpolator();
            this.changeMode(OrbitManipulatorEnums.PAN, pan);
            pan.reset();
            pan.set(ev.glX, ev.glY);
        },

        startRotate: function(ev) {
            var rotate = this._manipulator.getRotateInterpolator();
            this.changeMode(OrbitManipulatorEnums.ROTATE, rotate);
            rotate.reset();
            rotate.set(ev.glX, ev.glY);
        },

        startZoom: function(ev) {
            var zoom = this._manipulator.getZoomInterpolator();
            this.changeMode(OrbitManipulatorEnums.ZOOM, zoom);
            zoom.setStart(ev.glY);
            zoom.set(0.0);
        },

        stopMotion: function() {
            this._inMotion = false;
            this.setMode(undefined);
        },

        zoom: function(ev) {
            var intDelta = -ev.deltaY / 40;
            var manipulator = this._manipulator;
            var zoomTarget = manipulator.getZoomInterpolator().getTarget()[0] - intDelta;
            manipulator.getZoomInterpolator().setTarget(zoomTarget);
        },

        resetToHome: function() {
            this._manipulator.computeHomePosition();
        },

        changeMode: function(mode, interpolator) {
            if (this.getMode() === mode) {
                return;
            }
            this.setMode(mode);
            interpolator.reset();
            this._inMotion = true;
        }
    })
);
export default OrbitManipulatorStandardMouseKeyboardController;
