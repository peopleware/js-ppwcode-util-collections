/*
Copyright 2012 - $Date $ by PeopleWare n.v.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

define(["dojo/_base/declare", "ppwcode-util-contracts/_Mixin",
        "dojo/store/util/QueryResults", "dojo/store/util/SimpleQueryEngine",
        "dojo/_base/lang", "ppwcode-util-oddsAndEnds/log/logger!" /*=====, "./api/Store" =====*/],
  function(declare, _ContractsMixin,
           QueryResults, SimpleQueryEngine,
           lang, logger) {

    var ERROR_ALREADY_IN_STORE = new Error("Object already exists in this store");

    var DataWrapper = declare([], {

      id: null,

      // data: Stateful
      data: null,

      constructor: function(id, /*Stateful*/ data) {
        this.id = id;
        this.data = data;
      },

      toString: function() {
        return this.data.toString();
      }

    });

    var StoreOfStateful = declare([_ContractsMixin], {
      // summary:
      //		An in-memory Observable object store like dojo/store/Memory wrapped in dojo/store/Observable,
      //    but with the following differences:
      //    1) We don't change the objects that are kept in the store. If you are not very
      //       careful, dojo/store/Memory inserts an "id" property for its own benefit,
      //       whose behavior depends on chance (random).
      //    2) We are aware of Stateful.
      //       If an element changes, we also send changed events. You do not have
      //       to re-put.
      //    3) removeAll, loadAll
      //    4) You need to inject a getIdentity function. It must work on all objects
      //       that ever were in the store or will be in the store, independent of the store.
      //    5) If the data provided at construction has an `observe` method (i.e., it is
      //       a QueryResult from an Observable), we watch that changing too.
      // description:
      //    On development we immediately need constructor, put, removeAll, loadAll, and query.
      //    getIdentity is needed for Observable.
      //    get and remove are optional.
      //    Query needs an array to be supplied. It therefor is wasteful to keep an index, which
      //    only helps with get and remove.
      //    idProperty is wasteful and stupid. We kill it.
      //    We wrap the real objects in a helper object, to keep track of the watchers of
      //    Stateful objects.
      //    If getIdentity changes, all bets are off.
      //
      //    Before you throw away the store, you must call removeAll, so that
      //    we can clean up listeners. Otherwise, you will have a memory leak.
      //
      //    The result is intended to be wrapped in dojo/store/Observable. We cannot do that
      //    for you: the inheritance chain would be broken.
      //
      //    Based on dojo/store/Memory

      _c_invar: [
      ],

      // _data: Array
      //   The internal representation of the data
      _data: null,

      // idPropertyDerivation: Function
      //    Stateful --> String
      //    Derives a unique id from a Stateful object as argument.
      getIdentity: null,

      // queryEngine: Function
      //		Defines the query engine to use for querying the data store
      queryEngine: SimpleQueryEngine,

      _wrap: function(/*Stateful*/ s) {
        this._c_pre(function() {return this.isOperational();});

        var thisStore = this;

        function addWatcher(wrapper) {
          var watcher = function(name, oldValue, newValue) {
            // on change, see if the id has changed
            // if it has, signal removal, and a new addition
            // if is has not, signal change

            logger.trace("store: " + thisStore + " - got event from changed element: ('" + name + "', " + oldValue + ", " + newValue + ")");
            var oldId = wrapper.id;
            var newId = thisStore.getIdentity(wrapper.data);
            if (oldId != newId) {
              logger.trace("id changed; updating id; store will notify removal and addition");
              logger.error("IDENTITY OF AN OBJECT IN A STOREOFSTATEFUL CHANGED. This gets Observable of its rockers. It should not happen. (" +
                "propertyName: " + name + ", oldValue: " + oldValue + ", newValue: " + newValue + ", oldId: " + oldId + ", newId: " + newId + ", data: " +
                wrapper.data + ")");
              // TODO replace this branch with an exception if it truly never occurs
              wrapper.id = newId;
              if (thisStore.notify) {
                thisStore.notify(null, oldId);
                thisStore.notify(wrapper.data, null);
              }
            }
            else {
              logger.trace("id did not change; store will notify of change in element");
              if (thisStore.notify) {
                thisStore.notify(wrapper.data, oldId);
              }
            }
          };
          //noinspection JSCheckFunctionSignatures
          wrapper.watcher = wrapper.data.watch(watcher);
        }

        var result = new DataWrapper(thisStore.getIdentity(s), s);
        addWatcher(result);
        return result;
      },

      constructor: function(options) {
        // summary:
        //		Creates a store of stateful objects.
        // options: dojo/store/Memory
        //		This provides any configuration information that will be mixed into the store.
        //		This should generally include the data property to provide the starting set of data.

        var thisStore = this;
        if (options) {
          Object.keys(options).
            filter(function(key) {return key !== "data";}).
            forEach(function(key) {thisStore[key] = options[key];});
        }
        if (options && options.data) {
          thisStore._data = options.data.reduce(
            function(acc, element) {
              acc.push(thisStore._wrap(element));
              return acc;
            },
            []
          );
          if (options.data.observe) {
            options.data.observe(
              function(element, removedFrom, insertedInto) {
                if (insertedInto === -1) { // removed
                  thisStore.remove(thisStore.getIdentity(element));
                }
                else if (removedFrom === -1) { // added
                  thisStore.add(element);
                }
                // else, the notification is for a change;
                //   but, first of all, we would not get that (false below)
                //   and second, we are already listening to the object directly,
                //   and send events from there
              },
              false
            );
          }
        }
        else {
          thisStore._data = [];
        }
      },

      isOperational: function() {
        return this.getIdentity && lang.isFunction(this.getIdentity) &&
          this.queryEngine && lang.isFunction(this.queryEngine);// &&
          //this.notify && lang.isFunction(this.notify);
      },

      contains: function(object){
        // summary:
        //		Is the object in this store?
        // object: Object
        //		The object to check membership for. We compare ===.
        // returns: Boolean
        this._c_pre(function() {return this.isOperational();});

        var filterResult = this._data.filter(function(wrapper) {
          return wrapper.data === object;
        });
        if (filterResult.length > 1) {
          throw "ERROR: object in store more then once (object: " + object + ", store: " + this + ")";
        }
        else {
          return filterResult.length === 1;
        }
      },

      get: function(id){
        // summary:
        //		Retrieves an object by its identity
        // id: Number
        //		The identity to use to lookup the object
        // returns: Object
        //		The object in the store that matches the given id.

        var filterResult = this._data.filter(function(wrapper) {
          return wrapper.id === id;
        });
        if (filterResult.length > 1) {
          throw "ERROR: duplicate id in store (id: " + id + ", store: " + this + ")";
        }
        else if (filterResult.length === 0) {
          return null;
        }
        else {
          return filterResult[0].data;
        }
      },

      put: function(object) {
        // summary:
        //		Stores an object. Options are ignored.
        //    Observable wrapper will send events, replacing the object with the same identity.
        // object: Object
        //		The object to store.
        // returns: Number
        this._c_pre(function() {return this.isOperational();});

        var id = this.getIdentity(object);
        var existing = this.get(id);
        if (existing && existing !== object) {
          // we have an object with this identity already, and it is not the same object; remove the old object
          this.remove(id);
        }
        if (!existing || existing !== object) {
          // we did not have an object, or we just removed it; add the new object
          this.add(object); // exception not possible (!existing or removed)
        }
        // else, do nothing; object with id did exist, and was the same; events are sent already via watch
      },

      add: function(object){
        // summary:
        //		Creates an object, throws an error if the object already exists
        //		Options are ignored..
        //    Observable wrapper will send events.
        // object: Object
        //		The object to store.
        // returns: Number
        this._c_pre(function() {return this.isOperational();});

        if (this.get(this.getIdentity(object))) { // we have this object already
          throw ERROR_ALREADY_IN_STORE;
        }
        var wrapper = this._wrap(object);
        this._data.push(wrapper); // Store spec doesn't say what we should return. We return nothing.
      },

      remove: function(id){
        // summary:
        //		Deletes an object by its identity
        //    Observable wrapper will send events.
        // id: Number
        //		The identity to use to delete the object
        // returns: Boolean
        //		Returns true if an object was removed, falsy (undefined) if no object matched the id

        var thisStore = this;
        var foundAtIndex = this._data.reduce(
          function(acc, wrapper, index) {
            if (wrapper.id === id) {
              if (acc > -1) {
                throw "ERROR: duplicate id in store (id: " + id + ", store: " + thisStore + ")";
              }
              else {
                wrapper.watcher.remove();
                return index;
              }
            }
            else {
              return acc;
            }
          },
          -1
        );
        if (foundAtIndex > -1) {
          thisStore._data.splice(foundAtIndex, 1);
        }
        // Store spec doesn't say what we should return. We return nothing.
      },

      query: function(query, options){
        // summary:
        //		Queries the store for objects.
        // query: Object
        //		The query to use for retrieving objects from the store.
        // options: dojo/store/api/Store.QueryOptions?
        //		The optional arguments to apply to the resultset.
        // returns: dojo/store/api/Store.QueryResults
        //		The results of the query, extended with iterative methods.
        //
        // example:
        //		Given the following store:
        //
        // 	|	var store = new Memory({
        // 	|		data: [
        // 	|			{id: 1, name: "one", prime: false },
        //	|			{id: 2, name: "two", even: true, prime: true},
        //	|			{id: 3, name: "three", prime: true},
        //	|			{id: 4, name: "four", even: true, prime: false},
        //	|			{id: 5, name: "five", prime: true}
        //	|		]
        //	|	});
        //
        //	...find all items where "prime" is true:
        //
        //	|	var results = store.query({ prime: true });
        //
        //	...or find all items where "even" is true:
        //
        //	|	var results = store.query({ even: true });
        this._c_pre(function() {return this.isOperational();});

        return QueryResults(this.queryEngine(query, options)(this.getCurrentData()));
      },

      getCurrentData: function() {
        return this._data.map(function(wrapper) {
          return wrapper.data;
        });
      },

      loadAll: function(data) {
        // summary:
        //   replaces current data with new data; common objects
        //   are not signalled as removed and added again;
        //   returns array of removed elements
        this._c_pre(function() {return this.isOperational();});

        var thisStore = this;
        var inData = data.slice(0);
        var removed = [];
        thisStore._data = thisStore._data.reduce(
          function (acc, wrapper) {
            var indexInData = inData.indexOf(wrapper.data);
            if (indexInData < 0) {
              // not in inData; don't add to acc, signal removal
              wrapper.watcher.remove();
              if (thisStore.notify) {
                thisStore.notify(null, wrapper.id);
              }
              removed.push(wrapper.data);
            }
            else {
              // keep the element (add to acc), and note handled.
              inData.splice(indexInData, 1);
              acc.push(wrapper);
            }
            return acc;
          },
          []
        );
        // what is left in inData needs to be added
        inData.forEach(function(newElement) {
          thisStore.put(newElement);
        });
        return removed;
      },

      removeAll: function() {
        var thisStore = this;

        var oldData = thisStore._data;
        thisStore._data = [];
        oldData.forEach(function(wrapper) {
          wrapper.watcher.remove();
          if (thisStore.notify) {
            thisStore.notify(null, wrapper.id);
          }
        });
      },

      getLength: function() {
        return this._data.length;
      },

      toString: function() {
        return "[" + this._data.length + "[" + this._data + "]]";
      }

    });

//    var OurObservableStore = function(options) {
//      return Observable(new OurStore(options));
//    };

    return StoreOfStateful;

  });
