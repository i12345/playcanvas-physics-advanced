import { EventHandler } from "./event-handler";

/**
 * @class ObservableSet
 * @template T
 */
class ObservableSet extends EventHandler {
    /**
     * @private
     * @type {Set<T>}
     */
    _internal;

    /**
     * Constructs a new ObservableSet
     *
     * @param {Set<T>} [internal] - The internal set to use for this ObservableSet
     */
    constructor(internal = new Set()) {
        super();
        this._internal = internal;
    }

    /**
     * Fired whenever a new item is added to the set.
     *
     * @event ObservableSet#add
     * @param {T} value - The value added
     */

    /**
     * Fired whenever an existing item is deleted from the set.
     *
     * @event ObservableSet#delete
     * @param {T} value - The value deleted
     */

    /**
     * Appends a new element with a specified value to the end of the Set.
     *
     * @param {T} value - The value to add
     * @returns {this} - This ObservableSet
     */
    add(value) {
        const has = this.has(value);
        this._internal.add(value);
        if (!has)
            this.fire('add', value);
        return this;
    }

    /**
     * Removes a specified value from the Set.
     *
     * @param {T} value - The value to remove
     * @returns {boolean} Returns true if an element in the Set existed and has been removed, or false if the element does not exist.
     */
    delete(value) {
        const has = this._internal.delete(value);
        if (has)
            this.fire('delete', value);
        return has;
    }

    /**
     * Reports whether a value exists in this ObservableSet or not
     *
     * @param {T} value - The value to search for
     * @returns {boolean} a boolean indicating whether an element with the specified value exists in the Set or not.
     */
    has(value) {
        return this._internal.has(value);
    }

    /**
     * Executes a provided function once per each value in the Set object, in insertion order.
     *
     * @param {(value: T, key: T, set: Set) => void} callbackfn - The callback for each element
     * @param {*} thisArg - Value to use as this when executing callbackFn.
     * @returns {void}
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/forEach
     */
    forEach(callbackfn, thisArg) {
        this._internal.forEach(callbackfn, thisArg);
    }

    /**
     * @returns {void}
     */
    clear() {
        this._internal.clear();
    }

    /**
     * @returns {number} the number of (unique) elements in Set.
     */
    get size() {
        return this._internal.size;
    }
}

export { ObservableSet };
