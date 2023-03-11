import { ObservableSet } from '../../../core/observable-set.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Picker } from '../../graphics/picker.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { InputComponent } from './component.js';
import { InputComponentData } from './data.js';
import { KeyInputEvent, MouseButtonInputEvent, MouseInputEvent, MouseMoveInputEvent, MouseWheelInputEvent } from './events.js';

const _schema = [
    { name: 'enabled', type: 'boolean' },
    { name: 'focused', type: 'boolean' }
];

/** @type {(keyof HTMLElementEventMap)[]} */
const DOM_events = [
    'click', 'contextmenu', 'dblclick',
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
     * @type {Picker|null}
     */
    _picker = null;

    /**
     * @private
     * @type {import('../../entity').Entity|null}
     */
    _mouseCamera = null;

    /**
     * @private
     * @type {import('../../../scene/scene').Scene|null}
     */
    _mouseScene = null;

    /**
     * @private
     * @type {import('../../../scene/layer').Layer[]|null}
     */
    _mouseLayers = null;

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
     * @type {import('../../entity').Entity|undefined}
     */
    _drag_target = undefined;

    /**
     * @private
     * @type {ObservableSet<import('../../../scene/graph-node').GraphNode>}
     */
    _focused = new ObservableSet();

    /**
     * @private
     * @type {boolean}
     */
    _enabled = false;

    /**
     * The {@link Picker} for identifying {@link GraphNode}s from screen coordinates
     *
     * @type {Picker}
     */
    set picker(value) {
        this._picker = value;
    }

    get picker() {
        return this._picker;
    }

    /**
     * The entity with the camera to use for targeting mouse input events.
     * If null, the first active camera in the app will be used.
     *
     * @default null
     * @type {import('../../entity').Entity|null}
     */
    set mouseCamera(entity) {
        this._mouseCamera = entity;
    }

    get mouseCamera() {
        return this._mouseCamera;
    }

    /**
     * The scene to use for targeting mouse input events.
     * If null, the active scene on the app will be used.
     *
     * @default null
     * @type {import('../../../scene/scene').Scene|null}
     */
    set mouseScene(scene) {
        this._mouseScene = scene;
    }

    get mouseScene() {
        return this._mouseScene;
    }

    /**
     * The layers to use for targeting mouse input events.
     * If null, all layers will be used.
     *
     * @default null
     * @type {import('../../../scene/layer').Layer[]|null}
     */
    set mouseLayers(layers) {
        this._mouseLayers = layers;
    }

    get mouseLayers() {
        return this._mouseLayers;
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
     * This event is fired before firing the regular event though it's viewed
     * as if the target graph node handled it.
     *
     * @event InputComponent#capture:click
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse is double clicked while over a graph node.
     *
     * This event is fired before firing the regular event though it's viewed
     * as if the target graph node handled it.
     *
     * @event InputComponent#capture:dblclick
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse is context menu clicked while over a graph node.
     *
     * This event is fired before firing the regular event though it's viewed
     * as if the target graph node handled it.
     *
     * @event InputComponent#capture:contextmenu
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever a button is pressed on the mouse while over a graph node.
     *
     * This event is fired before firing the regular event though it's viewed
     * as if the target graph node handled it.
     *
     * @event InputComponent#capture:mousedown
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever a button is released on the mouse while over a graph node.
     *
     * This event is fired before firing the regular event though it's viewed
     * as if the target graph node handled it.
     *
     * @event InputComponent#capture:mouseup
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse moves while over a graph node.
     *
     * This event is fired before firing the regular event though it's viewed
     * as if the target graph node handled it.
     *
     * @event InputComponent#capture:mousemove
     * @param {import('./events').MouseMoveInputEvent} event - The mouse move event
     */

    /**
     * Fired whenever the mouse enters being over a graph node.
     *
     * This event is fired before firing the regular event though it's viewed
     * as if the target graph node handled it.
     *
     * @event InputComponent#capture:mouseenter
     * @param {import('./events').MouseInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse leaves being over a graph node.
     *
     * This event is fired before firing the regular event though it's viewed
     * as if the target graph node handled it.
     *
     * @event InputComponent#capture:mouseleave
     * @param {import('./events').MouseInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse wheels while over a graph node
     * or the graph node is focused.
     *
     * This event is fired before firing the regular event though it's viewed
     * as if the target graph node handled it.
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
     * This event is fired before firing the regular event though it's viewed
     * as if the target graph node handled it.
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
     * This event is fired before firing the regular event though it's viewed
     * as if the target graph node handled it.
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
     * This event is fired before firing the regular event though it's viewed
     * as if the target graph node handled it.
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
     * This event is fired before firing the regular event though it's viewed
     * as if the target graph node handled it.
     *
     * @event InputComponent#capture:keydown
     * @param {import('./events').KeyInputEvent} event - The keydown event
     */

    /**
     * Fired whenever a key is released while the mouse is over a graph node
     * or the graph node is focused.
     *
     * This event is fired before firing the regular event though it's viewed
     * as if the target graph node handled it.
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

        this._picker ??= new Picker(this.app, this.app.graphicsDevice.width, this.app.graphicsDevice.height);
        this._picker_prepare();

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
    _picker_prepare() {
        this._picker.prepare(
            this._mouseCamera?.camera ?? this.app.systems.camera.cameras[0],
            this._mouseScene ?? this.app.scene,
            this._mouseLayers
        );

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
            this._picker_prepare();
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
            node: (meshes.length > 0) ? meshes[0].node : undefined,
            p,
            button: e.button,
            buttons: e.buttons,
            modifiers: this._modifiers(e)
        };
    }

    /**
     * Fires click event
     *
     * @private
     * @param {MouseEvent} e - The DOM mouse event
     */
    _onclick(e) {
        const { node, p, button, buttons, modifiers } = this._onMouseEvent(e);
        const event = new MouseButtonInputEvent("click", node, p, button, buttons, modifiers);
        this._bubbleEvent(event);
        this._position_last.mousemove = p;
    }

    /**
     * Fires dblclick event
     *
     * @private
     * @param {MouseEvent} e - The DOM mouse event
     */
    _ondblclick(e) {
        const { node, p, button, buttons, modifiers } = this._onMouseEvent(e);
        const event = new MouseButtonInputEvent("dblclick", node, p, button, buttons, modifiers);
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
        const event = new MouseButtonInputEvent("contextmenu", node, p, button, buttons, modifiers);
        this._bubbleEvent(event);
        this._position_last.mousemove = p;
    }

    /**
     * Fires mousedown event
     *
     * @private
     * @param {MouseEvent} e - The DOM mouse event
     */
    _onmousedown(e) {
        const { node, p, button, buttons, modifiers } = this._onMouseEvent(e);
        const event_mousedown = new MouseButtonInputEvent("mousedown", node, p, button, buttons, modifiers);
        this._bubbleEvent(event_mousedown);
        this._position_last.mousemove = p;

        const event_dragstart = new MouseButtonInputEvent("dragstart", node, p, button, buttons, modifiers);
        this._drag_target = this._bubbleEvent(event_dragstart);
    }

    /**
     * Fires mouseup event
     *
     * @private
     * @param {MouseEvent} e - The DOM mouse event
     */
    _onmouseup(e) {
        const { node, p, button, buttons, modifiers } = this._onMouseEvent(e);
        const event_mouseup = new MouseButtonInputEvent("mouseup", node, p, button, buttons, modifiers);
        this._bubbleEvent(event_mouseup);
        // this._position_last.mousemove = p;
        if (this._drag_target) {
            const event_dragend = new MouseButtonInputEvent(
                "dragend",
                // @ts-ignore
                this._drag_target,
                p,
                button,
                buttons,
                modifiers
            );
            this._bubbleEvent(event_dragend);
            this._drag_target = null;
        }
    }

    /**
     * Fires mousemove event
     *
     * @private
     * @param {MouseEvent} e - The DOM mouse event
     */
    _onmousemove(e) {
        const { node, p, buttons, modifiers } = this._onMouseEvent(e);

        if (this._position_last.over !== node) {
            if (this._position_last.over) {
                const event_leave = new MouseInputEvent("mouseleave", this._position_last.over, p, buttons, modifiers);
                this._bubbleEvent(event_leave);
                this._position_last.over = null;
            }

            const event_enter = new MouseInputEvent("mouseenter", node, p, buttons, modifiers);
            this._bubbleEvent(event_enter);
            this._position_last.over = node;
        }

        const delta = this._position_last.mousemove ? new Vec2().sub2(p, this._position_last.mousemove) : Vec2.ZERO;
        this._position_last.mousemove = p;

        const event_move = new MouseMoveInputEvent("mousemove", node, p, delta, buttons, modifiers);
        this._bubbleEvent(event_move);

        if (this._drag_target) {
            /** @type {import('../../../scene/graph-node').GraphNode} */
            const dragTarget = this._drag_target;

            const event_drag = new MouseMoveInputEvent(
                "drag",
                dragTarget,
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
     * Fires mouseenter event
     *
     * @private
     * @param {MouseEvent} e - The DOM mouse event
     */
    _onmouseenter(e) {
        const { node, p, buttons, modifiers } = this._onMouseEvent(e);

        if (this._position_last.over !== node) {
            if (this._position_last.over) {
                const event_leave = new MouseInputEvent("mouseleave", this._position_last.over, p, buttons, modifiers);
                this._bubbleEvent(event_leave);
                this._position_last.over = null;
            }

            const event_enter = new MouseInputEvent("mouseenter", node, p, buttons, modifiers);
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
            const event_enter = new MouseInputEvent("mouseleave", this._position_last.over, p, buttons, modifiers);
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
                const event = new KeyInputEvent("keydown", node, e.key, e.code, e.location, modifiers, e.isComposing, e.repeat);
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
                const event = new KeyInputEvent("keyup", node, e.key, e.code, e.location, modifiers, e.isComposing, e.repeat);
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
            this.fire(`capture:${event.type}`, event);
            if (event.handled) {
                skip?.add(target);
                return this.app.root;
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
        const component = entity.input;
        if (component && component.enabled && !skip.has(entity)) {
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
