import { now } from '../../../core/time.js';
import { ObjectPool } from '../../../core/object-pool.js';

import { Vec3 } from '../../../core/math/vec3.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { PhysicsComponent } from './component.js';
import { PhysicsComponentData } from './data.js';
import { AmmoPhysicsSystemBackend } from './backends/ammo/backend.js';
import { ContactPoint, ContactResult, SingleContactResult } from './types.js';

const _schema = ['enabled'];

/**
 * The PhysicsComponentSystem maintains the dynamics world for simulating physics, it also
 * controls global values for the world such as gravity. Note: The PhysicsComponentSystem is only
 * valid if 3D Physics is enabled in your application. You can enable this in the application
 * settings for your project.
 *
 * @augments ComponentSystem
 * @category Physics
 */
class PhysicsComponentSystem extends ComponentSystem {
    /**
     * The world space vector representing global gravity in the physics simulation. Defaults to
     * [0, -9.81, 0] which is an approximation of the gravitational force on Earth.
     *
     * @type {Vec3}
     */
    gravity = new Vec3(0, -9.81, 0);

    /**
     * @type {PhysicsComponent[]}
     * @private
     */
    _dynamic = [];

    /**
     * @type {PhysicsComponent[]}
     * @private
     */
    _kinematic = [];

    /**
     * @type {PhysicsComponent[]}
     * @private
     */
    _triggers = [];

    /**
     * @type {import('../collision/component.js').CollisionComponent[]}
     * @private
     */
    _compounds = [];

    /**
     * @type {import('./backends/interface.js').PhysicsSystemBackend}
     * @private
     */
    _backend = /** @type {import('./backends/interface.js').PhysicsSystemBackend} */ (/** @type {unknown} */ (null));

    /**
     * Create a new PhysicsComponentSystem.
     *
     * @param {import('../../app-base.js').AppBase} app - The Application.
     * @hideconstructor
     */
    constructor(app) {
        super(app);

        this.id = 'physics';
        this._stats = app.stats.frame;

        this.ComponentType = PhysicsComponent;
        this.DataType = PhysicsComponentData;

        this.contactPointPool = new ObjectPool(ContactPoint, 1);
        this.contactResultPool = new ObjectPool(ContactResult, 1);
        this.singleContactResultPool = new ObjectPool(SingleContactResult, 1);

        this.schema = _schema;

        this.collisions = {};
        this.frameCollisions = {};

        this.on('beforeremove', this.onBeforeRemove, this);
        this.on('remove', this.onRemove, this);
    }

    set backend(backend) {
        this._backend = backend;
        this._setupBackend();
    }

    get backend() {
        return this._backend;
    }

    _setupBackend() {
        this._backend.init();
        this.ComponentType = this._backend.Component;
    }

    /**
     * @ignore
     */
    onLibraryLoaded() {
        try {
            if (this._backend === null)
                this._backend = /** @type {import('./backends/interface.js').PhysicsSystemBackend} */ (/** @type {unknown} */ (new AmmoPhysicsSystemBackend(this)));

            this._setupBackend();

            this.app.systems.on('update', this.onUpdate, this);
        } catch (x) {
            console.error("physics not initialized");
            console.error(x);
        }
    }

    /**
     * Fired when a contact occurs between two bodies.
     *
     * @event PhysicsComponentSystem#contact
     * @param {SingleContactResult} result - Details of the contact between the two bodies.
     */

    initializeComponentData(component, data, properties) {
        const props = [
            'mass',
            'linearDamping',
            'angularDamping',
            'linearFactor',
            'angularFactor',
            'friction',
            'restitution',
            'rollingFriction',
            'spinningFriction',
            'contactDamping',
            'contactStiffness',
            'type',
            'group',
            'mask'
        ];

        for (const property of props) {
            if (data.hasOwnProperty(property)) {
                const value = data[property];
                if (Array.isArray(value)) {
                    component[property] = new Vec3(value[0], value[1], value[2]);
                } else {
                    component[property] = value;
                }
            }
        }

        super.initializeComponentData(component, data, ['enabled']);
    }

    cloneComponent(entity, clone) {
        // create new data block for clone
        const physics = entity.physics;
        const data = {
            enabled: physics.enabled,
            mass: physics.mass,
            linearDamping: physics.linearDamping,
            angularDamping: physics.angularDamping,
            linearFactor: [physics.linearFactor.x, physics.linearFactor.y, physics.linearFactor.z],
            angularFactor: [physics.angularFactor.x, physics.angularFactor.y, physics.angularFactor.z],
            friction: physics.friction,
            restitution: physics.restitution,
            rollingFriction: physics.rollingFriction,
            spinningFriction: physics.spinningFriction,
            contactDamping: physics.contactDamping,
            contactStiffness: physics.contactStiffness,
            type: physics.type,
            group: physics.group,
            mask: physics.mask
        };

        return this.addComponent(clone, data);
    }

    onBeforeRemove(entity, component) {
        if (component.enabled) {
            component.enabled = false;
        }
    }

    /**
     * Removes a {@link PhysicsComponent} from an entity.
     *
     * @param {import('../../entity').Entity} entity - The entity to remove
     * @param {PhysicsComponent} component - The {@link PhysicsComponent} to remove from the entity
     */
    onRemove(entity, component) {
        this._backend.onRemove(entity, component);
    }

    /**
     * Raycast the world and return the first entity the ray hits. Fire a ray into the world from
     * start to end, if the ray hits an entity with a collision component, it returns a
     * {@link RaycastResult}, otherwise returns null.
     *
     * @param {Vec3} start - The world space point where the ray starts.
     * @param {Vec3} end - The world space point where the ray ends.
     * @param {object} [options] - The additional options for the raycasting.
     * @param {number} [options.filterCollisionGroup] - Collision group to apply to the raycast.
     * @param {number} [options.filterCollisionMask] - Collision mask to apply to the raycast.
     * @param {any[]} [options.filterTags] - Tags filters. Defined the same way as a {@link Tags#has}
     * query but within an array.
     * @param {Function} [options.filterCallback] - Custom function to use to filter entities.
     * Must return true to proceed with result. Takes one argument: the entity to evaluate.
     *
     * @returns {import('./types.js').RaycastResult|null} The result of the raycasting or null if there was no hit.
     */
    raycastFirst(start, end, options = {}) {
        return this.backend.raycastFirst(start, end, options);
    }

    /**
     * Raycast the world and return all entities the ray hits. It returns an array of
     * {@link RaycastResult}, one for each hit. If no hits are detected, the returned array will be
     * of length 0. Results are sorted by distance with closest first.
     *
     * @param {Vec3} start - The world space point where the ray starts.
     * @param {Vec3} end - The world space point where the ray ends.
     * @param {object} [options] - The additional options for the raycasting.
     * @param {boolean} [options.sort] - Whether to sort raycast results based on distance with closest
     * first. Defaults to false.
     * @param {number} [options.filterCollisionGroup] - Collision group to apply to the raycast.
     * @param {number} [options.filterCollisionMask] - Collision mask to apply to the raycast.
     * @param {any[]} [options.filterTags] - Tags filters. Defined the same way as a {@link Tags#has}
     * query but within an array.
     * @param {Function} [options.filterCallback] - Custom function to use to filter entities.
     * Must return true to proceed with result. Takes the entity to evaluate as argument.
     *
     * @returns {import('./types.js').RaycastResult[]} An array of raycast hit results (0 length if there were no hits).
     *
     * @example
     * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
     * const hits = this.app.systems.physics.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2));
     * @example
     * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
     * // where hit entity is tagged with `bird` OR `mammal`
     * const hits = this.app.systems.physics.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2), {
     *     filterTags: [ "bird", "mammal" ]
     * });
     * @example
     * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
     * // where hit entity has a `camera` component
     * const hits = this.app.systems.physics.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2), {
     *     filterCallback: (entity) => entity && entity.camera
     * });
     * @example
     * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
     * // where hit entity is tagged with (`carnivore` AND `mammal`) OR (`carnivore` AND `reptile`)
     * // and the entity has an `anim` component
     * const hits = this.app.systems.physics.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2), {
     *     filterTags: [
     *         [ "carnivore", "mammal" ],
     *         [ "carnivore", "reptile" ]
     *     ],
     *     filterCallback: (entity) => entity && entity.anim
     * });
     */
    raycastAll(start, end, options = {}) {
        return this._backend.raycastAll(start, end, options);
    }

    onUpdate(dt) {
        let i, len;

        // #if _PROFILER
        this._stats.physicsStart = now();
        // #endif

        this._backend.update(dt);

        const triggers = this._triggers;
        for (i = 0, len = triggers.length; i < len; i++) {
            triggers[i].updateTransform();
        }

        const compounds = this._compounds;
        for (i = 0, len = compounds.length; i < len; i++) {
            compounds[i]._updateCompound();
        }

        // Update all kinematic bodies based on their current entity transform
        const kinematic = this._kinematic;
        for (i = 0, len = kinematic.length; i < len; i++) {
            kinematic[i]._updateKinematic();
        }

        // Update the transforms of all entities referencing a dynamic body
        const dynamic = this._dynamic;
        for (i = 0, len = dynamic.length; i < len; i++) {
            dynamic[i]._updateDynamic();
        }

        this._backend.updateAfterMotion(dt);

        // #if _PROFILER
        this._stats.physicsTime = now() - this._stats.physicsStart;
        // #endif
    }

    destroy() {
        super.destroy();

        this.app.systems.off('update', this.onUpdate, this);

        this._backend.destroy();
    }
}

Component._buildAccessors(PhysicsComponent.prototype, _schema);

export { PhysicsComponentSystem };
