import { Component } from '../component';

/**
 * @class InputComponent
 *
 * @property {boolean} focused - Whether this entity is focused.
 * If it is focused, it will receive all key events.
 *
 * @augments Component
 */
export class InputComponent extends Component {
    /**
     * Fired whenever the mouse is clicked while over this entity
     *
     * @event InputComponent#click
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse is double clicked while over this entity
     *
     * @event InputComponent#dblclick
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse is context menu clicked while over this entity
     *
     * @event InputComponent#contextmenu
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever a button is pressed on the mouse while over this entity
     *
     * @event InputComponent#mousedown
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever a button is released on the mouse while over this entity
     *
     * @event InputComponent#mouseup
     * @param {import('./events').MouseButtonInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse moves while over this entity
     *
     * @event InputComponent#mousemove
     * @param {import('./events').MouseMoveInputEvent} event - The mouse move event
     */

    /**
     * Fired whenever the mouse enters being over this entity
     *
     * @event InputComponent#mouseenter
     * @param {import('./events').MouseInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse leaves being over this entity
     *
     * @event InputComponent#mouseleave
     * @param {import('./events').MouseInputEvent} event - The mouse event
     */

    /**
     * Fired whenever the mouse wheels while over this entity or
     * {@link focused} is true.
     *
     * @event InputComponent#mousewheel
     * @param {import('./events').MouseWheelInputEvent} event - The mouse scroll event
     */

    /**
     * Fired whenever the mouse starts dragging this entity.
     *
     * Call {@link event.preventDefault()} to claim this drag operation so
     * subsequent drag and dragend events will be directed only to this
     * component.
     *
     * @event InputComponent#dragstart
     * @param {import('./events').MouseButtonInputEvent} event - The dragstart event
     */

    /**
     * Fired whenever the mouse ends dragging this entity.
     *
     * The {@link event.preventDefault()} method must have been called when the
     * {@link dragstart} event was raised for this entity in order for it to
     * receive drag and dragend events for that drag operation.
     *
     * @event InputComponent#dragend
     * @param {import('./events').MouseButtonInputEvent} event - The dragend event
     */

    /**
     * Fired whenever the mouse drags this entity.
     *
     * The {@link event.preventDefault()} method must have been called when the
     * {@link dragstart} event was raised for this entity in order for it to
     * receive drag and dragend events for that drag operation.
     *
     * @event InputComponent#drag
     * @param {import('./events').MouseMoveInputEvent} event - The drag event
     */

    /**
     * Fired whenever a key is pressed while the mouse is over this entity or
     * {@link focused} is true.
     *
     * This event may be fired repeatedly with {@link KeyInputEvent.repeat}
     * set to true.
     *
     * @event InputComponent#keydown
     * @param {import('./events').KeyInputEvent} event - The keydown event
     */

    /**
     * Fired whenever a key is released while the mouse is over this entity or
     * {@link focused} is true.
     *
     * @event InputComponent#keyup
     * @param {import('./events').KeyInputEvent} event - The keyup event
     */

    /**
     * Fired whenever the focus changes.
     *
     * @event InputComponent#set:focus
     * @param {boolean} value - The current focus state.
     */

    /**
     * Fired whenever this entity gains focus.
     *
     * @event InputComponent#focus
     */

    /**
     * Fired whenever this entity loses focus.
     *
     * @event InputComponent#blur
     */

    // /**
    //  * Whether this entity is focused.
    //  * If it is focused, it will receive all key events.
    //  *
    //  * @type {boolean}
    //  */
    // focused;

    /**
     * Create a new InputComponent.
     *
     * @param {import('./system').InputComponentSystem} system - The ComponentSystem that created this Component.
     * @param {import('../../entity').Entity} entity - The Entity that this Component is attached to.
     */
    // eslint-disable-next-line no-useless-constructor
    constructor(system, entity) {
        super(system, entity);

        this.on('set_focused', this._onSetFocused, this);
    }

    /**
     * @private
     * @param {'focus'} name -
     * @param {boolean} oldValue -
     * @param {boolean} newValue -
     */
    // @ts-ignore
    _onSetFocused(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            /** @type {import('./system').InputComponentSystem} */
            // @ts-ignore
            const system = this.system;

            this.fire('set:focus', this.focused);
            if (newValue) {
                system.focused.add(this.entity);
                this.fire('focus');
            } else {
                system.focused.delete(this.entity);
                this.fire('blur');
            }
        }
    }

    focus() {
        this.focused = true;
    }

    blur() {
        this.focused = false;
    }

    onRemove() {
        this.off('set_focused', this._onSetFocused, this);
    }
}
