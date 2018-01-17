
var DEFAULT_PRIORITY = 3;

/**
 * InputGroup
 * @constructor
 */
var InputGroup = function(inputManager, name) {
    this._name = name;
    this._isEnabled = false;
    this._inputManager = inputManager;
    this._events = {};
    this._mappings = {};
    this._pollableSources = [];
};

InputGroup.prototype = {
    _collectNativeEvents: function(nativeEvent) {
        if (!this._isEnabled) {
            return;
        }
        nativeEvent.preventDefault();
        var events = this._mappings[nativeEvent.type];
        if (!events) {
            return;
        }
        for (var i = 0; i < events.length; i++) {
            var event = events[i];
            event._source.populateEvent(nativeEvent, event);
            if (!event._nativeEvents) {
                event._nativeEvents = [];
                //event must be queued
                var queue = this._inputManager._queues[event._priority];
                if (!queue) {
                    queue = [];
                    this._inputManager._queues[event._priority] = queue;
                }
                queue.push(event);
            }
            event._nativeEvents.push(nativeEvent);
        }
    },

    _addEvent: function(nativeEvent, eventName) {
        var event = this._events[eventName];
        if (!event) {
            event = new Event(this._name + ':' + eventName);
            event._priority = DEFAULT_PRIORITY;
            this._events[eventName] = event;
        }
        var events = this._mappings[nativeEvent];
        if (!events) {
            events = [];
            this._mappings[nativeEvent] = events;
            var source = this._inputManager._getSource(name);
            if (source) {
                this._enableEventOnSource(nativeEvent, source);
            }
        }
        events.push(event);
    },

    _enableEventOnSource: function(nativeEvent, source){
        if (source.poll) {
            //pollable source
            this._pollableSources.push(source);
        }
        event._inputSource = source;
        source.setEnable(nativeEvent, this._collectNativeEvents.bind(this), true);
    },

    _poll: function () {
        for (var i = 0; i < this._pollableSources.length; i++) {
            var source = this._pollableSources[i];
            //poll will generate appropriate events.
            source.poll();
        }
    }
};

/**
 * InputManager
 */
var InputManager = function () {
    this._sources = {};
    this._groups = {};
    this._queues = [];
    this._queues[DEFAULT_PRIORITY] = [];
}

InputManager.prototype = {


    /**
     * See osgViewer/input/InputSource.js
     * @param source
     */
    registerInputSource: function(source) {
        if (!source.setEnable || !source.supportsEvent || !source.getName) {
            throw 'Invalid input target ' + JSON.stringify(source);
        }
        this._sources[source.getName()] = source;
    },

    addMappings: function(mappings, listener) {
        for (var eventName in mappings) {
            var nativeEvents = mappings[eventName];
            var groupEvent = eventName.split(':');
            if (groupEvent.length !== 2) {
                throw "Mapping should be of the form 'group:methodName': ['nativeevent1’, 'nativeevent2',...] ";
            }

            if (listener) {
                window.addEventListener(eventName, listener[groupEvent[1]].bind(listener));
            }

            var group = this._getOrCreateGroup(groupEvent[0]);
            if (typeof nativeEvents === 'string') {
                group._addEvent(nativeEvents, groupEvent[1]);
            } else {
                for (var i = 0; i < nativeEvents.length; i++) {
                    var nativeEvent = nativeEvents[i];
                    group._addEvent(nativeEvent, groupEvent[1]);
                }
            }
        }
    },

    _getOrCreateGroup: function(name) {
        var group = this._groups[name];
        if (!group) {
            group = new InputGroup(this, name);
            this._groups[name] = group;
        }
        return group;
    },

    _getGroup: function(groupName) {
        var group = this._groups[groupName];
        if (!group) {
            console.warn("Couldn't find input group named " + groupName);
            return undefined;
        }
        return group;
    },

    setEnable: function(groupName, enable) {
        var group = this._getGroup(groupName);
        if (!group) return;
        group._isEnabled = enable;
    },

    /**
     * Sets an event or a group priority
     * The priority must be a positive number
     * 0 being the highest priority.
     *
     * @param eventName
     * @param priority
     */
    setPriority: function(eventName, priority) {
        var groupEvent = eventName.split(':');

        var group = this._getGroup(groupEvent[0]);
        if (!group) return;
        if (priority < 0) {
            throw 'priority must be a positive number';
        }
        var event;
        if (groupEvent[1]) {
            event = group._events[groupEvent[1]];
            event._priority = priority;
        } else {
            for (var key in group._events) {
                event = group._events[key];
                event._priority = priority;
            }
        }
    },

    update: function() {
        //Groups poll (in case of non event based input sources, they have to be polled to get information)
        for (var k = 0; k < this._groups.length; k++) {
            var group = this._groups[k];
            group._poll();
        }

        //dispatch all queued events by priority order
        for (var i = 0; i < this._queues.length; i++) {
            var queue = this._queues[i];
            if (!queue) {
                continue;
            }
            for (var j = 0; j < queue.length; j++) {
                var event = queue[j];
                window.dispatchEvent(event);
                event._nativeEvents = undefined;
            }
            //flush the queue
            queue.length = 0;
        }
    },

    _getSource: function(triggerName) {

        for (var sourceName in this._sources) {
            var source = this._sources[sourceName];
            if (source.supportsEvent(triggerName)) {
                return source;
            }
        }

        // for (var i = 1; i < this._sources.length; i++) {
        //     var source = this._sources[i];
        //     if (source.supportsEvent(triggerName)) {
        //         return source;
        //     }
        // }
        // //no target was found return the default one.
        // return this._sources[0];
    },

    dumpGroups: function() {
        console.log(this._groups);
    },

    dumpEventSequence: function() {
        var eventList = [];
        for (var groupKey in this._groups) {
            var group = this._groups[groupKey];
            for (var eventKey in group._events) {
                var event = group._events[eventKey];
                var list = eventList[event._priority];
                if (!list) {
                    list = [];
                    eventList[event._priority] = list;
                }
                list.push(event);
            }
        }
        console.log(eventList);
    }
};

export default InputManager;
