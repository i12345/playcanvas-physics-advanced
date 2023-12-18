import { Component } from "../component.js";

/**
 * The multibody component, when combined with a {@link PhysicsComponent}, allows your entities
 * to compose articulated multibodies using bullet physics. This can give much greater precision
 * and control for many entities with joints.
 *
 * {@link JointComponent} will add {@link MultiBodyComponent}'s automatically.
 * If {@link JointComponent#enableMultiBodyComponents} is set to true (it is
 * false by default), then multibody components will also be enabled, letting
 * multibodies be formed by the joint.
 *
 * In a multibody joint system, the joint componentA/entityA should be the
 * child entity and componentB/entityB should be the parent entity. The root
 * entity for a multibody will be the componentB/entityB of at least one joint.
 *
 * You should never need to use the MultiBodyComponent constructor. To add a MultiBodyComponent to
 * a {@link Entity}, use {@link Entity#addComponent}:
 *
 * To create and enable a multibody component, do:
 *
 * ```javascript
 * entity.addComponent('multibody');
 * ```
 *
 * or
 *
 * ```javascript
 * jointEntity.addComponent('joint');
 * jointEntity.type = pc.JOINT_TYPE_HINGE;
 * jointEntity.motion.angular.x = pc.MOTION_FREE;
 * jointEntity.componentA = componentA;
 * jointEntity.componentB = componentB;
 * jointEntity.enableMultiBodyComponents = true;
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

        this.entity.on('remove', this._entityRemoved, this);
        this.entity.on('removehierarchy', this._entityRemoved, this);
        this.entity.on('insert', this._entityInserted, this);
        this.entity.on('inserthierarchy', this._entityInserted, this);
        this._findBase();
    }

    /** @type {import('ammojs3').default.btMultiBody|null} */
    get multibody() {
        return this.isBaseLink ? this._multibody : this.base.multibody;
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

    /**
     * Reports if this link can be part of a multibody.
     *
     * Equals {@link this.enabled}
     *
     * @type {boolean}
     */
    get couldBeInMultibody() {
        return this.enabled && (this._base !== null);
    }

    /**
     * Fired when an entity has the option to become the base or descendant of
     * a multibody.
     *
     * Only fired when this multibody component is enabled.
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
        let node = /** @type {import('../../../scene/graph-node.js').GraphNode|null} */ (/** @type {unknown} */ (this.entity));
        while (node) {
            if ((/** @type {import('../../entity.js').Entity} */ (/** @type {unknown} */ (node))).multibody?.enabled)
                this._base = (/** @type {import('../../entity.js').Entity} */ (/** @type {unknown} */ (node))).multibody;
            else break;

            node = node.parent;
        }

        const system = /** @type {import('./system.js').MultiBodyComponentSystem} */ (this.system);
        for (const descendantComponent of this.entity.findComponents('multibody')) {
            const descendantMBcomponent = /** @type {MultiBodyComponent} */ (descendantComponent);
            if (descendantMBcomponent._base !== this._base) {
                if (descendantMBcomponent.isInMultibody)
                    system.destroyMultiBody(descendantMBcomponent._base.entity);

                descendantMBcomponent._base = this._base;
            }
        }
    }

    /** @private */
    _entityRemoved() {
        const system = /** import('./system.js').MultiBodyComponentSystem */ (this.system);
        if (this.isInMultibody) {
            if (this._base === this) {
                const setup = system.destroyMultiBody(this.entity);
                for (const link of setup.links)
                    link.multibody._findBase();
                for (const link of setup.links)
                    if (!link.isInMultibody)
                        link.multibody.createBody();
            } else {
                this._base.createBody();
                this._base = null;
            }
        }
    }

    /** @private */
    _entityInserted() {
        this._findBase();
        if (this.enabled)
            this.createBody();
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
                if (!child.multibody)
                    child.addComponent('multibody', { enabled: false });

                if (child.multibody._base === this._base)
                    child.multibody.beforeSetup(setup);
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
        try {
            if (!this.enabled)
                return;
        } catch {
            // currently this happens when the component is being removed
            return;
        }

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
}

export { MultiBodyComponent };
