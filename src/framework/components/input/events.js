/**
 * @typedef {{ ctrl: boolean, alt: boolean, shift: boolean, meta: boolean }} Modifiers
 */

/**
 * An input event
 */
export class InputEvent {
    /**
     * Set this to true to stop the event from bubbling up the graph
     */
    handled = false;

    /**
     * The type of event
     *
     * @type {string}
     */
    type;

    /**
     * The original target of the event
     *
     * @type {import('../../../scene/graph-node').GraphNode}
     */
    target;

    /**
     * The native DOM event.
     *
     * @type {Event}
     */
    event;

    /**
     * Initializes an input event
     *
     * @param {string} type - The type of event
     * @param {import('../../../scene/graph-node').GraphNode} target - The original target of the event
     * @param {Event} event - The native DOM event
     */
    constructor(type, target, event) {
        this.type = type;
        this.target = target;
        this.event = event;
    }

    /**
     * Stops this event from propagating up the scene graph
     *
     * @param {boolean} [stopPropagationInDOM] - Whether or not to stop the DOM
     * event from propagating. Defaults to `true`. If `false`, then the DOM
     * event may bubble up the document hierarchy.
     */
    handle(stopPropagationInDOM = true) {
        this.handled = true;

        if (stopPropagationInDOM) {
            this.event.stopPropagation();
        }
    }
}

export const EVENT_INPUT_CLICK = "click";
export const EVENT_INPUT_DBLCLICK = "dblclick";
export const EVENT_INPUT_CONTEXTMENU = "contextmenu";

export const EVENT_INPUT_MOUSE_DOWN = "mousedown";
export const EVENT_INPUT_MOUSE_UP = "mouseup";
export const EVENT_INPUT_MOUSE_MOVE = "mousemove";
export const EVENT_INPUT_MOUSE_WHEEL = "mousewheel";
export const EVENT_INPUT_MOUSE_ENTER = "mouseenter";
export const EVENT_INPUT_MOUSE_LEAVE = "mouseleave";

// TODO: support drag & drop
export const EVENT_INPUT_DRAG_START = "dragstart";
export const EVENT_INPUT_DRAG_END = "dragend";
export const EVENT_INPUT_DRAG = "drag";

// TODO: make input events more abstract to support XR and touch input in the future
// TODO: integrate PointerEvent
// https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent
// When a dragstart event bubbles through the graph, the first node to handle it
// will receive future drag events
// some could be with mouse coordinates, others could be 3D coordinates

/**
 * A mouse input event
 *
 * @property {typeof EVENT_INPUT_CLICK |
 *  typeof EVENT_INPUT_DBLCLICK |
 *  typeof EVENT_INPUT_CONTEXTMENU |
 *  typeof EVENT_INPUT_MOUSE_DOWN | typeof EVENT_INPUT_MOUSE_UP |
 *  typeof EVENT_INPUT_MOUSE_MOVE | typeof EVENT_INPUT_MOUSE_WHEEL |
 *  typeof EVENT_INPUT_MOUSE_ENTER | typeof EVENT_INPUT_MOUSE_LEAVE |
 *  typeof EVENT_INPUT_DRAG_START | typeof EVENT_INPUT_DRAG_END |
 *  typeof EVENT_INPUT_DRAG
 * } type - The type of event
 *
 * @property {MouseEvent} event - The native DOM event
 *
 * @augments InputEvent
 */
export class MouseInputEvent extends InputEvent {
    /**
     * The position of the mouse (in client coordinates)
     *
     * @type {import('../../../core/math/vec2').Vec2}
     */
    p;

    /**
     * The buttons pressed during this event (not necessarily causing it)
     *
     * @type {number}
     */
    buttons;

    /**
     * The modifier keys pressed during this event (not necessarily causing it)
     *
     * @type {Modifiers}
     */
    modifiers;

    /**
     * Initializes a mouse input event.
     *
     * @param {typeof EVENT_INPUT_CLICK |
     *  typeof EVENT_INPUT_DBLCLICK |
     *  typeof EVENT_INPUT_CONTEXTMENU |
     *  typeof EVENT_INPUT_MOUSE_DOWN | typeof EVENT_INPUT_MOUSE_UP |
     *  typeof EVENT_INPUT_MOUSE_MOVE | typeof EVENT_INPUT_MOUSE_WHEEL |
     *  typeof EVENT_INPUT_MOUSE_ENTER | typeof EVENT_INPUT_MOUSE_LEAVE |
     *  typeof EVENT_INPUT_DRAG_START | typeof EVENT_INPUT_DRAG_END |
     *  typeof EVENT_INPUT_DRAG
     * } type - The type of event
     * @param {import('../../../scene/graph-node').GraphNode} target - The original target of the event
     * @param {MouseEvent} event - The native DOM event
     * @param {import('../../../core/math/vec2').Vec2} p - The position of the mouse (in client coordinates)
     * @param {number} buttons - The buttons pressed during this event (not necessarily causing it)
     * @param {Modifiers} modifiers - The modifier keys pressed during this event (not necessarily causing it)
     */
    constructor(
        type,
        target,
        event,
        p,
        buttons,
        modifiers
    ) {
        super(type, target, event);

        this.type = type;
        this.p = p;
        this.buttons = buttons;
        this.modifiers = modifiers;
    }
}

/**
 * A mouse button input event
 *
 * @property {typeof EVENT_INPUT_CLICK |
 *  typeof EVENT_INPUT_DBLCLICK |
 *  typeof EVENT_INPUT_CONTEXTMENU |
 *  typeof EVENT_INPUT_MOUSE_DOWN | typeof EVENT_INPUT_MOUSE_UP |
 *  typeof EVENT_INPUT_DRAG_START | typeof EVENT_INPUT_DRAG_END
 * } type - The type of event
 *
 * @property {MouseEvent} event - The native DOM event
 *
 * @augments MouseInputEvent
 */
export class MouseButtonInputEvent extends MouseInputEvent {
    /**
     * The button causing this event
     *
     * @type {number}
     */
    button;

    /**
     * @type {'pressed' | 'released' | undefined}
     */
    get action() {
        switch (this.type) {
            case EVENT_INPUT_MOUSE_DOWN:
            case EVENT_INPUT_DRAG_START:
                return 'pressed';

            case EVENT_INPUT_MOUSE_UP:
            case EVENT_INPUT_DRAG_END:
                return 'released';

            default:
                return undefined;
        }
    }

    /**
     * Initializes a mouse button input event.
     *
     * @param {typeof EVENT_INPUT_CLICK |
     *  typeof EVENT_INPUT_DBLCLICK |
     *  typeof EVENT_INPUT_CONTEXTMENU |
     *  typeof EVENT_INPUT_MOUSE_DOWN | typeof EVENT_INPUT_MOUSE_UP |
     *  typeof EVENT_INPUT_DRAG_START | typeof EVENT_INPUT_DRAG_END
     * } type - The type of event
     * @param {import('../../../scene/graph-node').GraphNode} target - The original target of the event
     * @param {MouseEvent} event - The native DOM event
     * @param {import('../../../core/math/vec2').Vec2} p - The position of the mouse (in client coordinates)
     * @param {number} button - The button causing this event
     * @param {number} buttons - The buttons pressed during this event (not necessarily causing it)
     * @param {Modifiers} modifiers - The modifier keys pressed during this event (not necessarily causing it)
     */
    constructor(
        type,
        target,
        event,
        p,
        button,
        buttons,
        modifiers
    ) {
        super(type, target, event, p, buttons, modifiers);

        this.button = button;
    }
}

/**
 * A mouse move input event
 *
 * @property {typeof EVENT_INPUT_MOUSE_MOVE |
 *  typeof EVENT_INPUT_DRAG
 * } type - The type of event
 *
 * @property {MouseEvent} event - The native DOM event
 *
 * @augments MouseInputEvent
 */
export class MouseMoveInputEvent extends MouseInputEvent {
    /**
     * The change in mouse position (in client coordinates)
     *
     * @type {import('../../../core/math/vec2').Vec2}
     */
    delta;

    /**
     * Initializes a mouse move input event.
     *
     * @param {typeof EVENT_INPUT_MOUSE_MOVE |
     *  typeof EVENT_INPUT_DRAG
     * } type - The type of event
     * @param {import('../../../scene/graph-node').GraphNode} target - The original target of the event
     * @param {MouseEvent} event - The native DOM event
     * @param {import('../../../core/math/vec2').Vec2} p - The position of the mouse (in client coordinates)
     * @param {import('../../../core/math/vec2').Vec2} delta - The change in mouse position (in client coordinates)
     * @param {number} buttons - The buttons pressed during this event (not necessarily causing it)
     * @param {Modifiers} modifiers - The modifier keys pressed during this event (not necessarily causing it)
     */
    constructor(
        type,
        target,
        event,
        p,
        delta,
        buttons,
        modifiers
    ) {
        super(
            type,
            target,
            event,
            p,
            buttons,
            modifiers
        );

        this.delta = delta;
    }
}

/**
 * @property {WheelEvent} event - The native DOM event
 */
export class MouseWheelInputEvent extends MouseInputEvent {
    /**
     * The mouse wheel direction
     *
     * @type {1|-1}
     */
    direction;

    /**
     * Initializes a mouse scroll input event.
     *
     * @param {import('../../../scene/graph-node').GraphNode} target - The original target of the event
     * @param {WheelEvent} event - The native DOM event
     * @param {import('../../../core/math/vec2').Vec2} p - The position of the mouse (in client coordinates)
     * @param {1|-1} direction - The mouse wheel direction
     * @param {number} buttons - The buttons pressed during this event (not necessarily causing it)
     * @param {Modifiers} modifiers - The modifier keys pressed during this event (not necessarily causing it)
     */
    constructor(
        target,
        event,
        p,
        direction,
        buttons,
        modifiers
    ) {
        super(
            EVENT_INPUT_MOUSE_WHEEL,
            target,
            event,
            p,
            buttons,
            modifiers
        );

        this.direction = direction;
    }
}

export const EVENT_INPUT_KEY_DOWN = "keydown";
export const EVENT_INPUT_KEY_UP = "keyup";

/**
 * A key input event
 *
 * @property {typeof EVENT_INPUT_KEY_DOWN | typeof EVENT_INPUT_KEY_UP} type - The type of event
 *
 * @property {KeyboardEvent} event - The native DOM event
 *
 * @augments InputEvent
 */
export class KeyInputEvent extends InputEvent {
    /**
     * This property is "the value of the key pressed by the user, taking into
     * consideration the state of modifier keys such as Shift as well as the
     * keyboard locale and layout." ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key))
     *
     * @type {KeyboardEvent["key"]}
     * @see https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
     */
    key;

    /**
     * This property "represents a physical key on the keyboard (as opposed to
     * the character generated by pressing the key). In other words, this
     * property returns a value that isn't altered by keyboard layout or the
     * state of the modifier keys.
     *
     * ...
     *
     * This property is useful when you want to handle keys based on their
     * physical positions on the input device rather than the characters
     * associated with those keys; this is especially common when writing code
     * to handle input for games that simulate a gamepad-like environment using
     * keys on the keyboard. Be aware, however, that you can't use the value
     * reported [here] to determine the character generated by the keystroke,
     * because the keycode's name may not match the actual character that's
     * printed on the key or that's generated by the computer when the key is
     * pressed." ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code))
     *
     * @type {KeyboardEvent["code"]}
     * @see https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values
     */
    code;

    /**
     * Represents the location of the key on the keyboard.
     *
     * @type {number}
     * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/location
     */
    location;

    /**
     * The modifier keys pressed during this event (not necessarily causing it)
     *
     * @type {Modifiers}
     */
    modifiers;

    /**
     * @type {boolean}
     * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing
     */
    isComposing;

    /**
     * "true if the given key is being held down such that it is automatically repeating."
     * ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat))
     *
     * @type {boolean}
     */
    repeat;

    /**
     * Initializes a key input event
     *
     * @param {typeof EVENT_INPUT_KEY_DOWN | typeof EVENT_INPUT_KEY_UP} type - The type of event
     * @param {import('../../../scene/graph-node').GraphNode} target - The original target of the event
     * @param {KeyboardEvent} event - The native DOM event
     * @param {KeyInputEvent["key"]} key - (see property details)
     * @param {KeyInputEvent["code"]} code - (see property details)
     * @param {KeyInputEvent["location"]} location - (see property details)
     * @param {KeyInputEvent["modifiers"]} modifiers - (see property details)
     * @param {KeyInputEvent["isComposing"]} isComposing - (see property details)
     * @param {KeyInputEvent["repeat"]} repeat - (see property details)
     */
    constructor(
        type,
        target,
        event,
        key,
        code,
        location,
        modifiers,
        isComposing,
        repeat
    ) {
        super(type, target, event);

        this.key = key;
        this.code = code;
        this.location = location;
        this.modifiers = modifiers;
        this.isComposing = isComposing;
        this.repeat = repeat;
    }
}
