import { ObservableSet } from '../../../core/observable-set.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Picker } from '../../graphics/picker.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { InputComponent } from './component.js';
import { InputComponentData } from './data.js';
import { KeyInputEvent, MouseButtonInputEvent, MouseMoveInputEvent, MouseWheelInputEvent } from './events.js';

const _schema = [
    { name: 'enabled', type: 'boolean' },
    { name: 'focused', type: 'boolean' }
];

/** @type {(keyof HTMLElementEventMap)[]} */
const DOM_events = [
    'click', 'contextmenu', 'dblclick',
    'mousedown', 'mouseup',
    'mousemove', 'wheel',
    'dragstart', 'dragend',
    'drag',
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
        /** @type {Vec2} */
        mousemove: undefined,

        /** @type {Vec2} */
        drag: undefined
    };

    /**
     * @private
     * @type {import('../../entity').Entity|undefined}
     */
    _drag_target = undefined;

    /**
     * @private
     * @type {ObservableSet<import('../../entity').Entity>}
     */
    _focused_entities = new ObservableSet();

    /**
     * @private
     * @type {boolean}
     */
    _enabled = false;

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
     * The entities that currently have focus
     *
     * @type {ObservableSet<import('../../entity').Entity>}
     */
    get focusedEntities() {
        return this._focused_entities;
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
     * @event InputComponentSystem#focusedEntities:add
     * @param {import('../../entity').Entity|null} value - The entity that gained focus.
     */

    /**
     * @event InputComponentSystem#focusedEntities:remove
     * @param {import('../../entity').Entity|null} value - The entity that lost focus.
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

        this._focused_entities.on('add', this._onFocusedEntities_add, this);
        this._focused_entities.on('delete', this._onFocusedEntities_delete, this);

        this.on('enable', this._onEnable, this);
        this.on('disable', this._onDisable, this);

        for (const event of DOM_events) {
            /** @type {(e: Event) => void} */
            const handler = this[`_on${event}`];
            this[`_on${event}`] = handler.bind(this);
        }
    }

    /**
     * @private
     * @param {import('../../entity').Entity} entity - The entity added to this.focusedEntities
     */
    _onFocusedEntities_add(entity) {
        entity.input.focused = true;
    }

    /**
     * @private
     * @param {import('../../entity').Entity} entity - The entity added to this.focusedEntities
     */
    _onFocusedEntities_delete(entity) {
        entity.input.focused = false;
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

        this._picker = new Picker(this.app, this.app.graphicsDevice.width, this.app.graphicsDevice.height);
        this._picker_prepare();

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
        console.log('onclick()');
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
        const event = new MouseButtonInputEvent("mousedown", node, p, button, buttons, modifiers);
        this._bubbleEvent(event);
        this._position_last.mousemove = p;
    }

    /**
     * Fires mouseup event
     *
     * @private
     * @param {MouseEvent} e - The DOM mouse event
     */
    _onmouseup(e) {
        const { node, p, button, buttons, modifiers } = this._onMouseEvent(e);
        const event = new MouseButtonInputEvent("mouseup", node, p, button, buttons, modifiers);
        this._bubbleEvent(event);
        // this._position_last.mousemove = p;
    }

    /**
     * Fires mousemove event
     *
     * @private
     * @param {MouseEvent} e - The DOM mouse event
     */
    _onmousemove(e) {
        const { node, p, buttons, modifiers } = this._onMouseEvent(e);
        const delta = this._position_last.mousemove ? new Vec2().sub2(p, this._position_last.mousemove) : Vec2.ZERO;
        const event = new MouseMoveInputEvent("mousemove", node, p, delta, buttons, modifiers);
        this._bubbleEvent(event);
        this._position_last.mousemove = p;
    }

    /**
     * Fires scroll event
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
        const event = new MouseWheelInputEvent(node, p, direction, buttons, modifiers);
        this._bubbleEvent(event);
    }

    /**
     * Fires dragstart event
     *
     * @private
     * @param {DragEvent} e - The DOM drag event
     */
    _ondragstart(e) {
        const { node, p, button, buttons, modifiers } = this._onMouseEvent(e);
        const event = new MouseButtonInputEvent("dragstart", node, p, button, buttons, modifiers);
        this._drag_target = this._bubbleEvent(event);
        this._position_last.drag = p;
    }

    /**
     * Fires dragend event
     *
     * @private
     * @param {DragEvent} e - The DOM drag event
     */
    _ondragend(e) {
        const { node, p, button, buttons, modifiers } = this._onMouseEvent(e);
        const event = new MouseButtonInputEvent("dragend", node, p, button, buttons, modifiers);
        this._drag_target?.fire(event.type, event);
        // this._position_last.drag = p;
    }

    /**
     * Fires drag event
     *
     * @private
     * @param {DragEvent} e - The DOM drag event
     */
    _ondrag(e) {
        const { node, p, buttons, modifiers } = this._onMouseEvent(e);
        const delta = this._position_last.drag ? new Vec2().sub2(p, this._position_last.drag) : Vec2.ZERO;
        const event = new MouseMoveInputEvent("drag", node, p, delta, buttons, modifiers);
        this._drag_target?.fire(event.type, event);
        this._position_last.drag = p;
    }

    /**
     * Fires keydown event
     *
     * @private
     * @param {KeyboardEvent} e - The DOM keyboard event
     */
    _onkeydown(e) {
        const modifiers = this._modifiers(e);
        /** @type {Set<import('../../entity').Entity>} */
        const skipSet = new Set();
        this.focusedEntities.forEach((entity) => {
            /** @type {import('../../../scene/graph-node').GraphNode} */
            // @ts-ignore
            const node = entity;
            const event = new KeyInputEvent("keydown", node, e.key, e.code, e.location, modifiers, e.isComposing, e.repeat);
            this._bubbleEvent(event, node, skipSet);
        });
    }

    /**
     * Fires keyup event
     *
     * @private
     * @param {KeyboardEvent} e - The DOM keyboard event
     */
    _onkeyup(e) {
        const modifiers = this._modifiers(e);
        /** @type {Set<import('../../entity').Entity>} */
        const skipSet = new Set();
        this.focusedEntities.forEach((entity) => {
            /** @type {import('../../../scene/graph-node').GraphNode} */
            // @ts-ignore
            const node = entity;
            const event = new KeyInputEvent("keyup", node, e.key, e.code, e.location, modifiers, e.isComposing, e.repeat);
            this._bubbleEvent(event, node, skipSet);
        });
    }

    /**
     * Bubbles an event upward starting at the target node until handled.
     *
     * @param {import('./events').InputEvent} event - The event to fire until handled
     * @param {import('../../../scene/graph-node').GraphNode} target - The node to fire the event at
     * @param {Set<import('../../entity').Entity>} skip - The entities to skip firing at. If an entity handles this event, it will be added to the skip set
     * @returns {import('../../entity').Entity|undefined} - The node that handled the event (undefined if none handled it)
     */
    _bubbleEvent(event, target = event.target, skip = new Set()) {
        if (target === undefined || target === target.root) {
            if (!skip.has(this.app.root)) {
                this.fire(event.type, event);

                if (event.handled) {
                    skip.add(this.app.root);
                    return this.app.root;
                }
            }

            return undefined;
        }

        /** @type {import('../../entity').Entity} */
        // @ts-ignore
        const entity = target;
        const component = entity.input;
        // @ts-ignore
        if (component && component.enabled && !skip.has(entity)) {
            component.fire(event.type, event);
            if (event.handled) {
                skip.add(entity);
                return entity;
            }
        }

        return this._bubbleEvent(event, target.parent);
    }
}

Component._buildAccessors(InputComponent.prototype, _schema);
