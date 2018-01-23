var DEFAULT_PRIORITY = 10;
var MODIFIERS = ['shift', 'alt', 'ctrl', 'meta'];

/**
 * InputGroup
 * @constructor
 */
var InputGroup = function(inputManager, name) {
    // true when this group is enabled
    this._enabled = true;

    // the name of the group
    this._name = name;

    //mask attribute when a "parent" group is disabled.
    this._mask = [];

    // Map of for custom event names to events instances
    // { 'customEventName' : [event1, event2 ...]}
    // there is one instance of event for each customEvent / nativeEvent combination
    this._events = {};

    // Map for native event names to events instances.
    this._mappings = {};

    // reference to the inputManager
    this._inputManager = inputManager;

    // the callback to collect native events bound to this instance
    this._boundCallback = this._collectNativeEvents.bind(this);
};

InputGroup.prototype = {
    _collectNativeEvents: function(nativeEvent) {
        if (!this._enabled || this._mask.length) {
            return;
        }
        nativeEvent.preventDefault();
        var events = this._mappings[nativeEvent.type];
        if (!events) {
            return;
        }
        for (var i = 0; i < events.length; i++) {
            var event = events[i];
            if (event._source.matches && !event._source.matches(nativeEvent, event._parsedEvent)) {
                continue;
            }
            event._source.populateEvent(nativeEvent, event);
            if (!event._nativeEvents) {
                event._nativeEvents = [];
            }
            if (!event._nativeEvents.length) {
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
        if (!eventList) {
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
            if (this._enabled) {
                source.setEnable(nativeEvent.name, this._boundCallback, true);
            }
            event._source = source;
        }
    },

    addMappings: function(mappings, listener) {
        for (var key in mappings) {
            mappings[this._name + ':' + key] = mappings[key];
            delete mappings[key];
        }

        this._inputManager.addMappings(mappings, listener);
    },

    _setEnable: function(enable) {
        this._enabled = enable;
        // adding / removing native events
        for (var nativeEvent in this._mappings) {
            var events = this._mappings[nativeEvent];
            for (var i = 0; i < events.length; i++) {
                var evt = events[i];
                evt._source.setEnable(nativeEvent, this._boundCallback, enable);
            }
        }
    }
};

/**
 * InputManager
 */
var InputManager = function() {
    // Contains all created input groups
    this._groups = {};

    // Contains all registered input sources.
    this._sources = [];

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

    // Custom parameters
    this._params = {};
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
        this._sources.push(source);
        source.setInputManager(this);
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

    _parseNativeEvent: function(event) {
        var tokens = event.split(' ');
        var parsedEvent = {};
        parsedEvent.name = tokens[0];
        var i;
        for (i = 1; i < tokens.length; i++) {
            var token = tokens[i];
            if (MODIFIERS.indexOf(token) >= 0) {
                parsedEvent[token] = true;
            } else {
                parsedEvent.action = token.toLowerCase();
            }
        }

        if (parsedEvent.action) {
            // user may have used ShiftRight or ShiftLeft to specify which shift key he wants to trigger the event.
            // in that case adding the shift modifier as the browser will report it like that.
            for (i = 0; i < MODIFIERS.length; i++) {
                var mod = MODIFIERS[i];
                if (parsedEvent.action.indexOf(mod) === 0) {
                    parsedEvent[mod] = true;
                }
            }
        }

        if (!parsedEvent.action && tokens.length > 1) {
            // user wants one of the modifier keys to be the action
            // we take the lase one
            parsedEvent.action = tokens[tokens.length - 1];
        }

        return parsedEvent;
    },

    group: function(name) {
        return this._getOrCreateGroup(name);
    },

    _getOrCreateGroup: function(name) {
        var group = this._groups[name];
        if (!group) {
            group = new InputGroup(this, name);
            this._groups[name] = group;
        }
        return group;
    },

    setEnable: function(groupName, enable) {
        var group = this._groups[groupName];
        if (group) {
            group._setEnable(enable);
            return;
        }

        var index;
        //check for partial groups.
        for (var key in this._groups) {
            group = this._groups[key];

            if (enable) {
                // remove the group name from the mask
                index = group._mask.indexOf(groupName);
                if (index >= 0) {
                    group._mask.splice(index, 1);
                }
            } else {
                // add the group to the mask
                index = group._name.indexOf(groupName);
                if (index === 0 && group._name[index + groupName.length] === '.') {
                    group._mask.push(groupName);
                }
            }
        }
        if (!enable) {
            //discard all queued event emitted from this group
            for (var i = 0; i < this._queues.length; i++) {
                var queue = this._queues[i];
                if (!queue) {
                    continue;
                }
                for (var j = queue.length - 1; j >= 0; j--) {
                    var evt = queue[j];
                    if (evt.type.indexOf(groupName) >= 0) {
                        queue.splice(j, 1);
                        evt._nativeEvents.length = 0;
                    }
                }
            }
        }
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

        var group = this._groups[groupEvent[0]];
        if (!group) {
            console.warn("Couldn't find input group named " + groupEvent[0]);
            return;
        }
        if (priority < 0) {
            throw 'priority must be a positive number';
        }
        var event, eventList, i;
        if (groupEvent[1]) {
            // setPriority on a specific event
            eventList = group._events[groupEvent[1]];
            for (i = 0; i < eventList.length; i++) {
                event = eventList[i];
                event._priority = priority;
            }
        } else {
            // set Priority on a group, setting priority on all group's events.
            for (var key in group._events) {
                eventList = group._events[key];
                for (i = 0; i < eventList.length; i++) {
                    event = eventList[i];
                    event._priority = priority;
                }
            }
        }
    },

    getHigherPriority: function(groupName) {
        var priority = DEFAULT_PRIORITY;
        for (var key in this._groups) {
            var group = this._groups[key];
            if (group._name.indexOf(groupName) >= 0) {
                if (group._priority < priority) {
                    priority = group._priority;
                }
            }
        }
        return priority > 0 ? priority - 1 : 0;
    },

    update: function() {
        var i;
        //polling sources if relevant
        for (i = 0; i < this._sources.length; i++) {
            var source = this._sources[i];
            if (source.poll) {
                source.poll();
            }
        }

        //dispatch all queued events by priority order
        for (i = 0; i < this._queues.length; i++) {
            var queue = this._queues[i];
            if (!queue) {
                continue;
            }
            for (var j = 0; j < queue.length; j++) {
                var event = queue[j];
                this._callbacks[event.type](event);
                //window.dispatchEvent(event);
                event._nativeEvents.length = 0;
            }
            //flush the queue
            queue.length = 0;
        }
    },

    _getSource: function(triggerName) {
        for (var i = 0; i < this._sources.length; i++) {
            var source = this._sources[i];
            if (source.supportsEvent(triggerName)) {
                return source;
            }
        }
    },

    getParam: function(name) {
        return this._params[name];
    },

    setParam: function(name, value) {
        this._params[name] = value;
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
                    eventList[events[0]._priority] = list;
                }
                list.push(events[0]);
            }
        }
        console.log(eventList);
    }
};

export default InputManager;
