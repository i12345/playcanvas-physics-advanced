import { ObservableSet } from '../../../core/observable-set.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Picker } from '../../graphics/picker.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { InputComponent } from './component.js';
import { InputComponentData } from './data.js';
import {
    EVENT_INPUT_CLICK,
    EVENT_INPUT_CONTEXTMENU,
    EVENT_INPUT_DBLCLICK,
    EVENT_INPUT_DRAG,
    EVENT_INPUT_DRAG_START, EVENT_INPUT_DRAG_END,
    EVENT_INPUT_MOUSE_DOWN, EVENT_INPUT_MOUSE_UP,
    EVENT_INPUT_MOUSE_MOVE,
    EVENT_INPUT_MOUSE_ENTER, EVENT_INPUT_MOUSE_LEAVE,
    EVENT_INPUT_KEY_DOWN, EVENT_INPUT_KEY_UP,
    MouseInputEvent,
    MouseButtonInputEvent,
    MouseMoveInputEvent,
    MouseWheelInputEvent,
    KeyInputEvent
} from './events.js';

const _schema = [
    { name: 'enabled', type: 'boolean' },
    { name: 'focused', type: 'boolean' }
];

/** @type {(keyof HTMLElementEventMap)[]} */
const DOM_events = [
    // 'click',
    'contextmenu', 'dblclick',
    'mousedown', 'mouseup',
    'mousemove', 'wheel',
    'mouseenter', 'mouseleave', // should mouseout be used instead?
    // 'dragstart', 'dragend',
    // 'drag',
    'keydown', 'keyup'
];

/**
 * Manages creation of {@link InputComponent}s.
 *
 * @augments ComponentSystem
 */
export class InputComponentSystem extends ComponentSystem {
    // id: 'input'
    // ComponentType: typeof InputComponent
    // DataType: typeof InputComponentData

    /**
     * @private
     * @type {Picker[]}
     */
    _pickers = [];

    /**
     * @private
     * @type {number}
     */
    _update_fps = 2;

    /**
     * @private
     */
    _elapsed_dt_since_update = 0;

    /**
     * @private
     */
    _position_last = {
        /** @type {Vec2|null} */
        mousemove: null,

        /** @type {import('../../../scene/graph-node').GraphNode|null} */
        over: null
    };

    /**
     * @private
     */
    _target = {
        /** @type {import('../../../scene/graph-node').GraphNode|null} */
        drag: null,

        /** @type {import('../../../scene/graph-node').GraphNode|null} */
        click: null
    };

    /**
     * @private
     * @type {ObservableSet<import('../../../scene/graph-node').GraphNode>}
     */
    _focused = new ObservableSet();

    /**
     * @private
     * @type {Map<import('../../../scene/graph-node').GraphNode, () => void>}
     */
    _focused_remove_handlers = new Map();

    /**
     * @private
     * @type {boolean}
     */
    _enabled = false;

    /**
     * The {@link Picker}s for identifying {@link GraphNode}s from screen coordinates
     *
     * By default, a default {@link Picker} is created.
     *
     * @type {Picker}
     */
    set pickers(value) {
        this._pickers = value;
    }

    get pickers() {
        return this._pickers;
    }

    /**
     * The frame rate for updating the entity-selection-by-pixel buffer.
     *
     * @default 2
     * @type {number}
     */
    set updateFPS(value) {
        this._update_fps = value;
    }

    get updateFPS() {
        return this._update_fps;
    }

    /**
     * The graph nodes that currently have focus
     *
     * @type {ObservableSet<import('../../../scene/graph-node').GraphNode>}
     */
    get focused() {
        return this._focused;
    }

    /**
     * Whether this InputComponentSystem is enabled.
     * Since it intercepts all mouse and keyboard events, it is disabled by default.
     *
     * @default false
     * @type {boolean}
     */
    set enabled(value) {
        const old = this._enabled;
        this._enabled = value;
        if (old && !value)
            this.fire('disable');
        else if (!old && value)
            this.fire('enable');
    }

    get enabled() {
        return this._enabled;
    }

    /**
     * @event InputComponentSystem#focus
     * @param {import('../../../scene/graph-node').GraphNode} value - The graph node that gained focus.
     */

    /**
     * @event InputComponentSystem#blur
     * @param {import('../../../scene/graph-node').GraphNode} value - The graph node that lost focus.
     */

    /**
     * Create a new InputComponentSystem.
     *
     * @param {import('../../app-base.js').AppBase} app - The application.
     * @hideconstructor
     */
    constructor(app) {
        super(app);

        this.id = 'input';

        this.ComponentType = InputComponent;
        this.DataType = InputComponentData;

        this.schema = _schema;

        this.on('beforeremove', this._onRemoveComponent, this);

        this._focused.on('add', this._onFocused_add, this);
        this._focused.on('delete', this._onFocused_delete, this);

        this.on('enable', this._onEnable, this);
        this.on('disable', this._onDisable, this);

        for (const event of DOM_events) {
            /** @type {(e: Event) => void} */
            const handler = this[`_on${event}`];
            this[`_on${event}`] = handler.bind(this);
        }
    }

    /**
     * Fired whenever the mouse is clicked while over a graph node.
     *
     * This event is fired before firing the regular event and is viewed as if
     * the root graph node handled it.
     *
     * @event InputComponent#capture:click
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse is double clicked while over a graph node.
     *
     * This event is fired before firing the regular event and is viewed as if
     * the root graph node handled it.
     *
     * @event InputComponent#capture:dblclick
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse is context menu clicked while over a graph node.
     *
     * This event is fired before firing the regular event and is viewed as if
     * the root graph node handled it.
     *
     * @event InputComponent#capture:contextmenu
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever a button is pressed on the mouse while over a graph node.
     *
     * This event is fired before firing the regular event and is viewed as if
     * the root graph node handled it.
     *
     * @event InputComponent#capture:mousedown
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever a button is released on the mouse while over a graph node.
     *
     * This event is fired before firing the regular event and is viewed as if
     * the root graph node handled it.
     *
     * @event InputComponent#capture:mouseup
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse moves while over a graph node.
     *
     * This event is fired before firing the regular event and is viewed as if
     * the root graph node handled it.
     *
     * @event InputComponent#capture:mousemove
     * @param {import('./events').MouseMoveInputEvent} event - The mouse move event
     */

    /**
     * Fired whenever the mouse enters being over a graph node.
     *
     * This event is fired before firing the regular event and is viewed as if
     * the root graph node handled it.
     *
     * @event InputComponent#capture:mouseenter
     * @param {import('./events').MouseInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse leaves being over a graph node.
     *
     * This event is fired before firing the regular event and is viewed as if
     * the root graph node handled it.
     *
     * @event InputComponent#capture:mouseleave
     * @param {import('./events').MouseInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse wheels while over a graph node
     * or the graph node is focused.
     *
     * This event is fired before firing the regular event and is viewed as if
     * the root graph node handled it.
     *
     * @event InputComponent#capture:mousewheel
     * @param {import('./events').MouseWheelInputEvent} event - The mouse scroll event
     */

    /**
     * Fired whenever the mouse starts dragging an entity.
     *
     * Call {@link event.preventDefault()} to claim this drag operation so
     * subsequent drag and dragend events will be directed only to the target
     * entity.
     *
     * This event is fired before firing the regular event and is viewed as if
     * the root graph node handled it.
     *
     * @event InputComponent#capture:dragstart
     * @param {import('./events').MouseButtonInputEvent} event - The dragstart event
     */

    /**
     * Fired whenever the mouse ends dragging an entity.
     *
     * The {@link event.preventDefault()} method must have been called when the
     * {@link dragstart} event was raised for an entity in order for it to
     * receive drag and dragend events for that drag operation.
     *
     * If {@link event.preventDefault()} is not called during the dragend event
     * handler, then a click event will be fired.
     *
     * This event is fired before firing the regular event and is viewed as if
     * the root graph node handled it.
     *
     * @event InputComponent#capture:dragend
     * @param {import('./events').MouseButtonInputEvent} event - The dragend event
     */

    /**
     * Fired whenever the mouse drags an entity.
     *
     * The {@link event.preventDefault()} method must have been called when the
     * {@link dragstart} event was raised for an entity in order for it to
     * receive drag and dragend events for that drag operation.
     *
     * This event is fired before firing the regular event and is viewed as if
     * the root graph node handled it.
     *
     * @event InputComponent#capture:drag
     * @param {import('./events').MouseMoveInputEvent} event - The drag event
     */

    /**
     * Fired whenever a key is pressed while the mouse is over a graph node
     * or the graph node is focused.
     *
     * This event may be fired repeatedly with {@link KeyInputEvent.repeat}
     * set to true.
     *
     * This event is fired before firing the regular event and is viewed as if
     * the root graph node handled it.
     *
     * @event InputComponent#capture:keydown
     * @param {import('./events').KeyInputEvent} event - The keydown event
     */

    /**
     * Fired whenever a key is released while the mouse is over a graph node
     * or the graph node is focused.
     *
     * This event is fired before firing the regular event and is viewed as if
     * the root graph node handled it.
     *
     * @event InputComponent#capture:keyup
     * @param {import('./events').KeyInputEvent} event - The keyup event
     */

    /**
     * Fired whenever the mouse is clicked while over a graph node.
     *
     * This event is fired if it was not handled by any entity in the hierarchy
     * from the target node up.
     *
     * @event InputComponent#unhandled:click
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse is double clicked while over a graph node.
     *
     * This event is fired if it was not handled by any entity in the hierarchy
     * from the target node up.
     *
     * @event InputComponent#unhandled:dblclick
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse is context menu clicked while over a graph node.
     *
     * This event is fired if it was not handled by any entity in the hierarchy
     * from the target node up.
     *
     * @event InputComponent#unhandled:contextmenu
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever a button is pressed on the mouse while over a graph node.
     *
     * This event is fired if it was not handled by any entity in the hierarchy
     * from the target node up.
     *
     * @event InputComponent#unhandled:mousedown
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever a button is released on the mouse while over a graph node.
     *
     * This event is fired if it was not handled by any entity in the hierarchy
     * from the target node up.
     *
     * @event InputComponent#unhandled:mouseup
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse moves while over a graph node.
     *
     * This event is fired if it was not handled by any entity in the hierarchy
     * from the target node up.
     *
     * @event InputComponent#unhandled:mousemove
     * @param {import('./events').MouseMoveInputEvent} event - The mouse move event
     */

    /**
     * Fired whenever the mouse enters being over a graph node.
     *
     * This event is fired if it was not handled by any entity in the hierarchy
     * from the target node up.
     *
     * @event InputComponent#unhandled:mouseenter
     * @param {import('./events').MouseInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse leaves being over a graph node.
     *
     * This event is fired if it was not handled by any entity in the hierarchy
     * from the target node up.
     *
     * @event InputComponent#unhandled:mouseleave
     * @param {import('./events').MouseInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse wheels while over a graph node
     * or the graph node is focused.
     *
     * This event is fired if it was not handled by any entity in the hierarchy
     * from the target node up.
     *
     * @event InputComponent#unhandled:mousewheel
     * @param {import('./events').MouseWheelInputEvent} event - The mouse scroll event
     */

    /**
     * Fired whenever the mouse starts dragging an entity.
     *
     * Call {@link event.preventDefault()} to claim this drag operation so
     * subsequent drag and dragend events will be directed only to the target
     * entity.
     *
     * This event is fired if it was not handled by any entity in the hierarchy
     * from the target node up.
     *
     * @event InputComponent#unhandled:dragstart
     * @param {import('./events').MouseButtonInputEvent} event - The dragstart event
     */

    /**
     * Fired whenever the mouse ends dragging an entity.
     *
     * The {@link event.preventDefault()} method must have been called when the
     * {@link dragstart} event was raised for an entity in order for it to
     * receive drag and dragend events for that drag operation.
     *
     * If {@link event.preventDefault()} is not called during the dragend event
     * handler, then a click event will be fired.
     *
     * This event is fired if it was not handled by any entity in the hierarchy
     * from the target node up.
     *
     * @event InputComponent#unhandled:dragend
     * @param {import('./events').MouseButtonInputEvent} event - The dragend event
     */

    /**
     * Fired whenever the mouse drags an entity.
     *
     * The {@link event.preventDefault()} method must have been called when the
     * {@link dragstart} event was raised for an entity in order for it to
     * receive drag and dragend events for that drag operation.
     *
     * This event is fired if it was not handled by any entity in the hierarchy
     * from the target node up.
     *
     * @event InputComponent#unhandled:drag
     * @param {import('./events').MouseMoveInputEvent} event - The drag event
     */

    /**
     * Fired whenever a key is pressed while the mouse is over a graph node
     * or the graph node is focused.
     *
     * This event may be fired repeatedly with {@link KeyInputEvent.repeat}
     * set to true.
     *
     * This event is fired if it was not handled by any entity in the hierarchy
     * from the target node up.
     *
     * @event InputComponent#unhandled:keydown
     * @param {import('./events').KeyInputEvent} event - The keydown event
     */

    /**
     * Fired whenever a key is released while the mouse is over a graph node
     * or the graph node is focused.
     *
     * This event is fired if it was not handled by any entity in the hierarchy
     * from the target node up.
     *
     * @event InputComponent#unhandled:keyup
     * @param {import('./events').KeyInputEvent} event - The keyup event
     */

    /**
     * @private
     * @param {import('../../../scene/graph-node').GraphNode} node - The graph node added to this.focused
     */
    _onFocused_add(node) {
        /** @type {import('../../entity').Entity} */
        const entity = node;
        const focused = this.focused;

        const remove_handler = () => focused.delete(node);
        this._focused_remove_handlers.set(node, remove_handler);
        node.on('remove', remove_handler);

        if (entity.input)
            entity.input.focused = true;
        this.fire('focus', node);
    }

    /**
     * @private
     * @param {import('../../../scene/graph-node').GraphNode} node - The graph node removed from this.focused
     */
    _onFocused_delete(node) {
        /** @type {import('../../entity').Entity} */
        const entity = node;

        const remove_handler = this._focused_remove_handlers.get(node);
        this._focused_remove_handlers.delete(node);
        node.off('remove', remove_handler);

        if (entity.input)
            entity.input.focused = false;
        this.fire('blur', node);
    }

    /**
     * Initializes a component
     *
     * @param {InputComponent} component - The component to initialize
     * @param {InputComponentData} data - The data to initialize the component
     * @param {*} properties - ?
     */
    initializeComponentData(component, data, properties) {
        super.initializeComponentData(component, data, _schema);
    }

    /**
     * @private
     * @param {import('../../entity').Entity} entity - The entity to remove the InputComponent from
     * @param {InputComponent} component - The InputComponent to remove
     */
    _onRemoveComponent(entity, component) {
        component.onRemove();
    }

    /**
     * @private
     */
    _onEnable() {
        this.app.systems.on('update', this._onUpdate, this);

        if (this._pickers.length === 0)
            this._pickers.push(new Picker(this.app, this.app.graphicsDevice.width, this.app.graphicsDevice.height));
        this._pickers_prepare();

        // this.app.graphicsDevice.canvas.draggable = true;
        // https://stackoverflow.com/a/16492878
        this.app.graphicsDevice.canvas.tabIndex = 10000;
        this.app.graphicsDevice.canvas.style.outline = 'none';
        for (const event of DOM_events) {
            this.app.graphicsDevice.canvas.addEventListener(event, this[`_on${event}`]);
        }
    }

    /**
     * @private
     */
    _onDisable() {
        this.app.systems.off('update', this._onUpdate, this);

        if (this._picker) {
            this._picker.releaseRenderTarget();
            this._picker = null;
        }

        for (const event of DOM_events) {
            this.app.graphicsDevice.canvas.removeEventListener(event, this[`_on${event}`]);
        }
    }

    /**
     * @private
     */
    _pickers_prepare() {
        for (const picker of this._pickers) {
            picker.prepare(
                this._mouseCamera?.camera ?? this.app.systems.camera.cameras[0],
                this._mouseScene ?? this.app.scene,
                this._mouseLayers
            );
        }

        this._elapsed_dt_since_update = 0;
    }

    /**
     * Update handler
     *
     * @private
     * @param {number} dt - Elapsed time
     */
    _onUpdate(dt) {
        this._elapsed_dt_since_update += dt;
        if (this._elapsed_dt_since_update >= (1 / this._update_fps))
            this._pickers_prepare();
    }

    /**
     * Gets modifiers for an event
     *
     * @param {MouseEvent|KeyboardEvent} e - The DOM mouse or keyboard event
     * @returns {import('./events.js').Modifiers} - The modifiers during this event
     */
    _modifiers(e) {
        return {
            ctrl: e.ctrlKey,
            alt: e.altKey,
            shift: e.shiftKey,
            meta: e.metaKey
        };
    }

    /**
     * Handles a mouse event
     *
     * @private
     * @param {MouseEvent} e - The DOM mouse event
     * @returns {{
     *  node: import('../../../scene/graph-node').GraphNode
     *  p: Vec2
     *  button: MouseButtonInputEvent["button"]
     *  buttons: import('./events').MouseInputEvent["buttons"]
     *  modifiers: import('./events').MouseInputEvent["modifiers"]
     * }} - The element mouse is over and vector for mouse position
     */
    _onMouseEvent(e) {
        const meshes = this._picker.getSelection(e.clientX, e.clientY);
        const p = new Vec2(e.clientX, e.clientY);

        return {
            node: (meshes.length > 0) ? meshes[0].node : this.app.root,
            p,
            button: e.button,
            buttons: e.buttons,
            modifiers: this._modifiers(e)
        };
    }

    // /**
    //  * Fires click event
    //  *
    //  * @private
    //  * @param {MouseEvent} e - The DOM mouse event
    //  */
    // _onclick(e) {
    //     const { node, p, button, buttons, modifiers } = this._onMouseEvent(e);
    //     const event = new MouseButtonInputEvent(EVENT_INPUT_CLICK, node, p, button, buttons, modifiers);
    //     this._bubbleEvent(event);
    //     this._position_last.mousemove = p;
    // }

    /**
     * Fires dblclick event
     *
     * @private
     * @param {MouseEvent} e - The DOM mouse event
     */
    _ondblclick(e) {
        const { node, p, button, buttons, modifiers } = this._onMouseEvent(e);
        const event = new MouseButtonInputEvent(EVENT_INPUT_DBLCLICK, node, p, button, buttons, modifiers);
        this._bubbleEvent(event);
        this._position_last.mousemove = p;
    }

    /**
     * Fires contextmenu event
     *
     * @private
     * @param {MouseEvent} e - The DOM mouse event
     */
    _oncontextmenu(e) {
        const { node, p, button, buttons, modifiers } = this._onMouseEvent(e);
        const event = new MouseButtonInputEvent(EVENT_INPUT_CONTEXTMENU, node, p, button, buttons, modifiers);
        this._bubbleEvent(event);
        this._position_last.mousemove = p;
        if (event.handled) e.preventDefault();
    }

    /**
     * Fires mousedown and dragstart events
     *
     * @private
     * @param {MouseEvent} e - The DOM mouse event
     */
    _onmousedown(e) {
        const { node, p, button, buttons, modifiers } = this._onMouseEvent(e);
        const event_mousedown = new MouseButtonInputEvent(EVENT_INPUT_MOUSE_DOWN, node, p, button, buttons, modifiers);
        this._bubbleEvent(event_mousedown);
        this._position_last.mousemove = p;
        this._position_last.over = node;
        this._target.click = node;

        const event_dragstart = new MouseButtonInputEvent(EVENT_INPUT_DRAG_START, node, p, button, buttons, modifiers);
        const drag_target = this._bubbleEvent(event_dragstart);
        if (event_dragstart.handled)
            this._target.drag = drag_target;
        else this._target.drag = null;
    }

    /**
     * Fires mouseup, dragend, and click events
     *
     * @private
     * @param {MouseEvent} e - The DOM mouse event
     */
    _onmouseup(e) {
        const { node, p, button, buttons, modifiers } = this._onMouseEvent(e);
        const event_mouseup = new MouseButtonInputEvent(EVENT_INPUT_MOUSE_UP, node, p, button, buttons, modifiers);
        this._bubbleEvent(event_mouseup);

        let wasDragging = false;
        if (this._target.drag) {
            const event_dragend = new MouseButtonInputEvent(
                EVENT_INPUT_DRAG_END,
                this._target.drag,
                p,
                button,
                buttons,
                modifiers
            );
            this._bubbleEvent(event_dragend);
            this._target.drag = null;
            wasDragging = event_dragend.handled;
        }

        if (!wasDragging) {
            if (this._target.click === node) {
                const event = new MouseButtonInputEvent(EVENT_INPUT_CLICK, node, p, button, buttons, modifiers);
                this._bubbleEvent(event);
            }
            this._target.click = null;
        }
    }

    /**
     * Fires mousemove, mouseenter, mouseleave, and drag events
     *
     * @private
     * @param {MouseEvent} e - The DOM mouse event
     */
    _onmousemove(e) {
        const { node, p, buttons, modifiers } = this._onMouseEvent(e);

        if (buttons === 0)
            this._target.click = null;

        if (this._position_last.over !== node) {
            if (this._position_last.over) {
                const event_leave = new MouseInputEvent(EVENT_INPUT_MOUSE_LEAVE, this._position_last.over, p, buttons, modifiers);
                this._bubbleEvent(event_leave);
                this._position_last.over = null;
            }

            const event_enter = new MouseInputEvent(EVENT_INPUT_MOUSE_ENTER, node, p, buttons, modifiers);
            this._bubbleEvent(event_enter);
            this._position_last.over = node;
        }

        const delta = this._position_last.mousemove ? new Vec2().sub2(p, this._position_last.mousemove) : Vec2.ZERO;
        this._position_last.mousemove = p;

        const event_move = new MouseMoveInputEvent(EVENT_INPUT_MOUSE_MOVE, node, p, delta, buttons, modifiers);
        this._bubbleEvent(event_move);

        if (this._target.drag) {
            const event_drag = new MouseMoveInputEvent(
                EVENT_INPUT_DRAG,
                this._target.drag,
                p,
                delta,
                buttons,
                modifiers
            );
            this._bubbleEvent(event_drag);
        }
    }

    /**
     * Fires mousewheel event
     *
     * @private
     * @param {WheelEvent} e - The DOM mouse event
     */
    _onwheel(e) {
        const { node, p, buttons, modifiers } = this._onMouseEvent(e);
        // TODO: support X and Y wheel (research Z wheel)
        /** @type {-1|1} */
        // @ts-ignore
        const direction = Math.sign(e.deltaY);
        /** @type {Set<import('../../../scene/graph-node').GraphNode>} */
        const skipSet = new Set();

        const event = new MouseWheelInputEvent(node, p, direction, buttons, modifiers);
        this._bubbleEvent(event, node, skipSet);

        for (const node of [...this.focused, this._position_last.over]) {
            if (node) {
                const event = new MouseWheelInputEvent(node, p, direction, buttons, modifiers);
                this._bubbleEvent(event, node, skipSet);
            }
        }
    }

    /**
     * Fires mouseenter and mouseleave events
     *
     * @private
     * @param {MouseEvent} e - The DOM mouse event
     */
    _onmouseenter(e) {
        const { node, p, buttons, modifiers } = this._onMouseEvent(e);

        if (this._position_last.over !== node) {
            if (this._position_last.over) {
                const event_leave = new MouseInputEvent(EVENT_INPUT_MOUSE_LEAVE, this._position_last.over, p, buttons, modifiers);
                this._bubbleEvent(event_leave);
                this._position_last.over = null;
            }

            const event_enter = new MouseInputEvent(EVENT_INPUT_MOUSE_ENTER, node, p, buttons, modifiers);
            this._bubbleEvent(event_enter);
            this._position_last.over = node;
        }
    }

    /**
     * Fires mouseleave event
     *
     * @private
     * @param {MouseEvent} e - The DOM mouse event
     */
    _onmouseleave(e) {
        const { p, buttons, modifiers } = this._onMouseEvent(e);

        if (this._position_last.over) {
            const event_enter = new MouseInputEvent(EVENT_INPUT_MOUSE_LEAVE, this._position_last.over, p, buttons, modifiers);
            this._bubbleEvent(event_enter);
            this._position_last.over = null;
        }
    }

    // /**
    //  * Fires dragstart event
    //  *
    //  * @private
    //  * @param {DragEvent} e - The DOM drag event
    //  */
    // _ondragstart(e) {
    //     const { node, p, button, buttons, modifiers } = this._onMouseEvent(e);
    //     const event = new MouseButtonInputEvent("dragstart", node, p, button, buttons, modifiers);

    //     this._drag_target = this._bubbleEvent(event);
    //     this._position_last.drag = p;

    //     e.stopPropagation();
    //     e.dataTransfer.effectAllowed = 'none';
    // }

    // /**
    //  * Fires dragend event
    //  *
    //  * @private
    //  * @param {DragEvent} e - The DOM drag event
    //  */
    // _ondragend(e) {
    //     const { node, p, button, buttons, modifiers } = this._onMouseEvent(e);
    //     const event = new MouseButtonInputEvent("dragend", node, p, button, buttons, modifiers);
    //     this._drag_target?.fire(event.type, event);
    //     // this._position_last.drag = p;
    //     e.stopPropagation();
    // }

    // /**
    //  * Fires drag event
    //  *
    //  * @private
    //  * @param {DragEvent} e - The DOM drag event
    //  */
    // _ondrag(e) {
    //     const { node, p, buttons, modifiers } = this._onMouseEvent(e);
    //     const delta = this._position_last.drag ? new Vec2().sub2(p, this._position_last.drag) : Vec2.ZERO;
    //     const event = new MouseMoveInputEvent("drag", node, p, delta, buttons, modifiers);
    //     this._drag_target?.fire(event.type, event);
    //     this._position_last.drag = p;
    //     e.stopPropagation();
    // }

    /**
     * Fires keydown event
     *
     * @private
     * @param {KeyboardEvent} e - The DOM keyboard event
     */
    _onkeydown(e) {
        const modifiers = this._modifiers(e);
        /** @type {Set<import('../../../scene/graph-node').GraphNode>} */
        const skipSet = new Set();
        let handled = false;
        for (const node of [...this.focused, this._position_last.over]) {
            if (node) {
                const event = new KeyInputEvent(EVENT_INPUT_KEY_DOWN, node, e.key, e.code, e.location, modifiers, e.isComposing, e.repeat);
                if (this._bubbleEvent(event, node, skipSet) !== undefined)
                    handled = true;
            }
        }
        if (handled)
            e.stopPropagation();
    }

    /**
     * Fires keyup event
     *
     * @private
     * @param {KeyboardEvent} e - The DOM keyboard event
     */
    _onkeyup(e) {
        const modifiers = this._modifiers(e);
        /** @type {Set<import('../../../scene/graph-node').GraphNode>} */
        const skipSet = new Set();
        let handled = false;
        for (const node of [...this.focused, this._position_last.over]) {
            if (node) {
                const event = new KeyInputEvent(EVENT_INPUT_KEY_UP, node, e.key, e.code, e.location, modifiers, e.isComposing, e.repeat);
                if (this._bubbleEvent(event, node, skipSet) !== undefined)
                    handled = true;
            }
        }
        if (handled)
            e.stopPropagation();
    }

    /**
     * Bubbles an event upward starting at the target node until handled.
     *
     * @param {import('./events').InputEvent} event - The event to fire until handled
     * @param {import('../../../scene/graph-node').GraphNode} [target=event.target] - The node to fire the event at
     * @param {Set<import('../../entity').Entity>} [skip] - The entities to skip firing at. If an entity handles this event, it will be added to the skip set
     * @param {number} [depth=0] - The depth of current bubbling attempts
     * @returns {import('../../entity').Entity|undefined} - The node that handled the event (undefined if none handled it)
     */
    _bubbleEvent(event, target = event.target, skip = undefined, depth = 0) {
        if (depth > 32) return undefined;
        if (depth === 0) {
            // null is used for the capture: event
            if (!skip || !skip.has(null)) {
                this.fire(`capture:${event.type}`, event);
                if (event.handled) {
                    skip?.add(target);
                    return this.app.root;
                }

                skip?.add(null);
            }
        }

        if (target === undefined || target === target.root) {
            if (skip === undefined || !skip.has(this.app.root)) {
                this.fire(`unhandled:${event.type}`, event);

                if (event.handled) {
                    skip?.add(this.app.root);
                    return this.app.root;
                }
            }

            return undefined;
        }

        /** @type {import('../../entity').Entity} */
        // @ts-ignore
        const entity = target;
        if (skip && skip.has(entity))
            return undefined;

        const component = entity.input;
        if (component && component.enabled && (!skip || !skip.has(entity))) {
            component.fire(event.type, event);
            if (event.handled) {
                skip?.add(entity);
                return entity;
            }
        }

        return this._bubbleEvent(event, target.parent, skip, depth + 1);
    }
}

Component._buildAccessors(InputComponent.prototype, _schema);
