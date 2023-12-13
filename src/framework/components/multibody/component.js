import { Component } from "../component.js";

/**
 * The multibody component, when combined with a {@link PhysicsComponent}, allows your entities
 * to compose articulated multibodies using bullet physics. This can give much greater precision
 * and control for many entities with joints.
 *
 * The multibody component must be manually enabled at the root entity, and when using multibody
 * components, the joint componentA/entityA should be the child entity and componentB/entityB should
 * be the parent entity. The root entity for a multibody will be the componentB/entityB of at least
 * one joint.
 *
 * You should never need to use the MultiBodyComponent constructor. To add a MultiBodyComponent to
 * a {@link Entity}, use {@link Entity#addComponent}:
 *
 * To create a multibody chain, do:
 *
 * ```javascript
 * //TODO
 * ```
 *
 * Relevant 'Engine-only' examples:
 *
 * - Joint (not in official playcanvas; see physics > joint example in custom build)
 *
 * @augments Component
 * @category Physics
 */
class MultiBodyComponent extends Component {
    /**
     * Create a new MultiBodyComponent instance.
     *
     * @param {import('./system.js').MultiBodyComponentSystem} system - The ComponentSystem that
     * created this component.
     * @param {import('../../entity.js').Entity} entity - The entity this component is attached to.
     */
    constructor(system, entity) { // eslint-disable-line no-useless-constructor
        super(system, entity);

        /**
         * @type {import('ammojs3').default.btMultiBody|null}
         * @private
         */
        this._multibody = null;

        /**
         * @type {import('ammojs3').default.btMultibodyLink|null}
         * @private
        */
        this._link = null;

        /**
         * @type {number|null}
         * @private
         */
        this._linkIndex = null;

        /**
         * @type {MultiBodyComponent|null}
         * @private
         */
        this._base = null;

        /**
         * @type {boolean}
         * @private
         */
        this._isBuildingMultibody = false;
    }

    set multibody(multibody) {
        this._multibody = multibody;
    }

    /** @type {import('ammojs3').default.btMultiBody|null} */
    get multibody() {
        return this._multibody;
    }

    set link(link) {
        this._link = link;
    }

    /** @type {import('ammojs3').default.btMultibodyLink|null} */
    get link() {
        return this._link;
    }

    set linkIndex(linkIndex) {
        this._linkIndex = linkIndex;
    }

    /** @type {number|null} */
    get linkIndex() {
        return this._linkIndex;
    }

    /**
     * The base multibody component. This is automatically made to be
     * the parent closest to root with enabled multibody component.
     *
     * @type {MultiBodyComponent|null}
     */
    get base() {
        return this._base;
    }

    get isBaseLink() {
        return this._base === this;
    }

    get isInMultibody() {
        return typeof this._linkIndex === 'number';
    }

    get couldBeInMultibody() {
        return this._base !== null;
    }

    /**
     * Fired when an entity has the option to become the base or descendant of
     * a multibody.
     *
     * For the base, a multibody link will be made regardless of the response
     * to this event.
     *
     * @event PhysicsComponent#beforeSetup
     * @param {import('./system.js').MultiBodySetup} setup - Information to prepare to make the multibody
     */

    /**
     * Fired when an entity becomes the base or descendant of a multibody.
     *
     * @event PhysicsComponent#setup
     * @param {import('./system.js').MultiBodySetup} setup - Information to make the multibody
     */

    /**
     * Fired after an entity becomes the base or descendant of a multibody.
     *
     * @event PhysicsComponent#afterSetup
     * @param {import('./system.js').MultiBodySetup} setup - Information used to make the multibody
     */

    /**
     * Fired when an entity is removed from a multibody.
     *
     * @event PhysicsComponent#unsetup
     * @param {import('./system.js').MultiBodySetup} unsetup - Information used to make the multibody
     */

    /** Fired when this component is enabled */
    onEnable() {
        this._findBase();
        if (this._base && !this._base._isBuildingMultibody) {
            this.system.offerLinkMembership(this._base.entity, this.entity);
        }
    }

    /** Fired when this component is disabled */
    onDisable() {
        if (this.isInMultibody) {
            this.base?.createBody();
        }
    }

    _findBase() {
        this._base = null;
        let node = this.entity.parent;
        while (node) {
            if ((/** @type {import('../../entity.js').Entity} */ (/** @type {unknown} */ (node))).multibody?.enabled) {
                this._base = (/** @type {import('../../entity.js').Entity} */ (/** @type {unknown} */ (node))).multibody;
                break;
            }

            node = node.parent;
        }
    }

    /**
     * @private
     * @param {import('./system.js').MultiBodySetup} setup - The setup information
     */
    setup(setup) {
        const index = this._linkIndex = setup.indexOf(this.entity);
        if (index >= 0) {
            this._link = this.base.multibody.getLink(index);
        } else if (index !== -1) {
            // no link was set up for this entity
            // -1 would be the base link
            this._link = null;
            this._linkIndex = null;
        }

        if (this.isInMultibody) {
            this.fire('setup', setup);
        }

        for (const child of this.entity.children) {
            if (child.multibody && child.multibody._base === this._base) {
                child.multibody.setup(setup);
            }
        }
    }

    /**
     * @private
     * @param {import('./system.js').MultiBodySetup} setup - The setup information
     */
    beforeSetup(setup) {
        if (this.enabled)
            this.fire('beforeSetup', setup);

        for (const child of this.entity.children) {
            if (child.findComponent) {
                if (!child.multibody) {
                    child.addComponent('multibody');
                    child.multibody.enabled = true;
                }
                if (child.multibody._base === this._base) {
                    child.multibody.beforeSetup(setup);
                }
            }
        }
    }

    /**
     * @private
     * @param {import('./system.js').MultiBodySetup} setup - The setup information
     */
    afterSetup(setup) {
        if (this.isInMultibody) {
            this.fire('afterSetup', setup);
        }

        if (this.isInMultibody) {
            this.entity.physics.disableSimulation();
            this.entity.physics.createBody();
            if (this.entity.enabled && this.entity.physics.enabled) {
                this.entity.physics.enableSimulation();
            }
        }

        for (const child of this.entity.children) {
            if (child.multibody && child.multibody._base === this._base) {
                child.multibody.afterSetup(setup);
            }
        }
    }

    /**
     * @private
     * @param {import('./system.js').MultiBodySetup} setup - The setup information
     */
    unsetup(setup) {
        if (this._link || this._multibody) {
            this._link = null;
            this._linkIndex = null;
            this.entity.physics.disableSimulation();
            this.entity.physics.createBody();
            if (this.entity.enabled && this.entity.physics.enabled) {
                this.entity.physics.enableSimulation();
            }

            this.fire('unsetup', setup);
        }

        for (const child of this.entity.children) {
            if (child.multibody && child.multibody._base === this._base) {
                child.multibody.unsetup(setup);
            }
        }
    }

    /**
     * Creates or re-creates the multibody this component may be part of.
     */
    createBody() {
        if (this._base === this) {
            if (this.multibody) {
                this.system.destroyMultiBody(this.entity);
            }

            this.system.createMultiBody(this.entity);
        } else if (this._base) {
            this._base.createBody();
        } else {
            throw new Error("Cannot create body when there is no base");
        }
    }

    makeBase() {
        if (this.multibody)
            throw new Error("Cannot make this entity base when it already is base.");

        this._prepareChildren(this);
        this.createBody();
    }

    /**
     * Prepares child nodes for a new base to a multibody.
     *
     * @private
     * @param {MultiBodyComponent} newBase - The new base multibody component
     * @returns {void}
     */
    _prepareChildren(newBase) {
        if (this._multibody)
            return;

        if (this._base)
            throw new Error("Cannot overwrite existing base.");

        this._base = newBase;
        for (const child of this.entity.children) {
            if (child.multibody) {
                child.multibody._prepareChildren(newBase);
            }
        }
    }
}

export { MultiBodyComponent };
