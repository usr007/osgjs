var DEFAULT_PRIORITY = 3;
var MODIFIERS = ['shift', 'alt', 'ctrl', 'meta'];

/**
 * InputGroup
 * @constructor
 */
var InputGroup = function(inputManager, name) {

    // the name of the group
    this._name = name;

    // true when this group is enabled
    this._isEnabled = true;

    // reference to the inputManager
    this._inputManager = inputManager;

    // Map of for custom event names to events instances
    // { 'customEventName' : [event1, event2 ...]}
    // there is one instance of event for each customEvent / nativeEvent combination
    this._events = {};

    // Map for native event names to events instances.
    this._mappings = {};

    // input sources that have to be polled on each frame. (not event based)
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
            if(event._source.matches && !event._source.matches(nativeEvent, event._parsedEvent)){
                continue;
            }
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

        // creating an event instance for each eventName / nativeEvent combination.
        var event = new Event(this._name + ':' + eventName);
        event._parsedEvent = nativeEvent;
        event._priority = DEFAULT_PRIORITY;

        // adding the new event to the events map
        var eventList = this._events[eventName];
        if(!eventList){
            eventList = [];
        }
        eventList.push(event);
        this._events[eventName] = eventList;

        // adding the new event to the mappings map
        var events = this._mappings[nativeEvent.name];
        if (!events) {
            events = [];
            this._mappings[nativeEvent.name] = events;
        }
        events.push(event);

        // finding the source of the native event and enable the dispatch
        var source = this._inputManager._getSource(nativeEvent.name);
        if (source) {
            this._enableEventOnSource(nativeEvent.name, source);
            event._source = source;
        }

    },

    _enableEventOnSource: function(nativeEvent, source) {
        if (source.poll) {
            //pollable source
            this._pollableSources.push(source);
        }
        source.setEnable(nativeEvent, this._collectNativeEvents.bind(this), true);
    },

    _poll: function() {
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
var InputManager = function() {
    // Contains all registered input sources.
    this._sources = {};

    // Contains all created input groups
    this._groups = {};

    // Event queues filled each frame with all the events to dispatch
    // queues[0] = [event1, event2]
    // queues[1] = [event3, event4]
    // ...
    // 0 is the top priority queue the higher the index the lowest the priority.
    this._queues = [];

    // initializing the default priority queue
    this._queues[DEFAULT_PRIORITY] = [];

    // the map af callbacks
    this._callbacks = {};
};

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
        for (var key in mappings) {
            var nativeEvents = mappings[key];
            var groupEvent = key.split(':');
            if (groupEvent.length !== 2) {
                throw "Mapping should be of the form 'group:methodName': ['nativeevent1’, 'nativeevent2',...] ";
            }
            var group = this._getOrCreateGroup(groupEvent[0]);

            var callback;
            var eventName = groupEvent[1];
            if (listener) {
                if (typeof listener === 'object') {
                    callback = listener[eventName];
                    if (!callback || typeof callback !== 'function') {
                        throw 'Cannot find method ' + eventName + ' on ' + listener;
                    }
                    callback = callback.bind(listener);
                } else if (typeof listener === 'function') {
                    callback = listener;
                } else {
                    throw 'Invalid listener ' + listener;
                }
            }
            var parsedEvent;
            if (typeof nativeEvents === 'string') {
                parsedEvent = this._parseNativeEvent(nativeEvents);
                group._addEvent(parsedEvent, eventName);
            } else {
                for (var i = 0; i < nativeEvents.length; i++) {
                    var nativeEvent = nativeEvents[i];
                    parsedEvent = this._parseNativeEvent(nativeEvent);
                    group._addEvent(parsedEvent, eventName);
                }
            }

            // registering the callback for the new event
            this._callbacks[group._name + ':' + eventName] = callback;
        }
    },

    _parseNativeEvent: function(event){
        var tokens = event.split(' ');
        var parsedEvent = {};
        parsedEvent.name = tokens[0];
        var i;
        for (i = 1; i < tokens.length; i++) {
            var token = tokens[i]
            if(MODIFIERS.indexOf(token) >= 0){
                parsedEvent[token] = true;
            } else {
                parsedEvent.action = token.toLowerCase();
            }
        }

        if(parsedEvent.action){
            // user may have used ShiftRight or ShiftLeft to specify which shift key he wants to trigger the event.
            // in that case adding the shift modifier as the browser will report it like that.
            for (i = 0; i < MODIFIERS.length; i++) {
                var mod = MODIFIERS[i]
                if(parsedEvent.action.indexOf(mod) === 0){
                    parsedEvent[mod] = true;
                }
            }
        }

        if(!parsedEvent.action && tokens.length > 1){
            // user wants one of the modifier keys to be the action
            // we take the lase one
            parsedEvent.action = tokens[tokens.length -1];
        }

        return parsedEvent;
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
        var event, eventList, i;
        if (groupEvent[1]) {
            // setPriority on a specific event
            eventList = group._events[groupEvent[1]];
            for (i = 0; i < eventList.length; i++) {
                event = eventList[i]
                event._priority = priority;
            }
        } else {
            // set Priority on a group, setting priority on all group's events.
            for (var key in group._events) {
                eventList = group._events[key];
                for (i = 0; i < eventList.length; i++) {
                    event = eventList[i]
                    event._priority = priority;
                }
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
                this._callbacks[event.type](event);
                //window.dispatchEvent(event);
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
    },

    dumpGroups: function() {
        console.log(this._groups);
    },

    dumpEventSequence: function() {
        var eventList = [];
        for (var groupKey in this._groups) {
            var group = this._groups[groupKey];
            for (var eventKey in group._events) {
                var events = group._events[eventKey];
                var list = eventList[events[0]._priority];
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
