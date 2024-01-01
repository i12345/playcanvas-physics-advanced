import { now } from '../../../core/time.js';
import { ObjectPool } from '../../../core/object-pool.js';

import { Vec3 } from '../../../core/math/vec3.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { PhysicsComponent } from './component.js';
import { PhysicsComponentData } from './data.js';
import { AmmoPhysicsSystemBackend } from './backends/ammo/backend.js';

/**
 * Object holding the result of a successful raycast hit.
 *
 * @category Physics
 */
class RaycastResult {
    /**
     * Create a new RaycastResult instance.
     *
     * @param {import('../../entity.js').Entity} entity - The entity that was hit.
     * @param {Vec3} point - The point at which the ray hit the entity in world space.
     * @param {Vec3} normal - The normal vector of the surface where the ray hit in world space.
     * @param {number} hitFraction - The normalized distance (between 0 and 1) at which the ray hit
     * occurred from the starting point.
     * @hideconstructor
     */
    constructor(entity, point, normal, hitFraction) {
        /**
         * The entity that was hit.
         *
         * @type {import('../../entity.js').Entity}
         */
        this.entity = entity;

        /**
         * The point at which the ray hit the entity in world space.
         *
         * @type {Vec3}
         */
        this.point = point;

        /**
         * The normal vector of the surface where the ray hit in world space.
         *
         * @type {Vec3}
         */
        this.normal = normal;

        /**
         * The normalized distance (between 0 and 1) at which the ray hit occurred from the
         * starting point.
         *
         * @type {number}
         */
        this.hitFraction = hitFraction;
    }
}

/**
 * Object holding the result of a contact between two rigid bodies.
 *
 * @category Physics
 */
class SingleContactResult {
    /**
     * Create a new SingleContactResult instance.
     *
     * @param {import('../../entity.js').Entity} a - The first entity involved in the contact.
     * @param {import('../../entity.js').Entity} b - The second entity involved in the contact.
     * @param {ContactPoint} contactPoint - The contact point between the two entities.
     * @hideconstructor
     */
    constructor(a, b, contactPoint) {
        if (arguments.length === 0) {
            /**
             * The first entity involved in the contact.
             *
             * @type {import('../../entity.js').Entity}
             */
            this.a = null;

            /**
             * The second entity involved in the contact.
             *
             * @type {import('../../entity.js').Entity}
             */
            this.b = null;

            /**
             * The total accumulated impulse applied by the constraint solver during the last
             * sub-step. Describes how hard two bodies collided.
             *
             * @type {number}
             */
            this.impulse = 0;

            /**
             * The point on Entity A where the contact occurred, relative to A.
             *
             * @type {Vec3}
             */
            this.localPointA = new Vec3();

            /**
             * The point on Entity B where the contact occurred, relative to B.
             *
             * @type {Vec3}
             */
            this.localPointB = new Vec3();

            /**
             * The point on Entity A where the contact occurred, in world space.
             *
             * @type {Vec3}
             */
            this.pointA = new Vec3();

            /**
             * The point on Entity B where the contact occurred, in world space.
             *
             * @type {Vec3}
             */
            this.pointB = new Vec3();

            /**
             * The normal vector of the contact on Entity B, in world space.
             *
             * @type {Vec3}
             */
            this.normal = new Vec3();
        } else {
            this.a = a;
            this.b = b;
            this.impulse = contactPoint.impulse;
            this.localPointA = contactPoint.localPoint;
            this.localPointB = contactPoint.localPointOther;
            this.pointA = contactPoint.point;
            this.pointB = contactPoint.pointOther;
            this.normal = contactPoint.normal;
        }
    }
}

/**
 * Object holding the result of a contact between two Entities.
 *
 * @category Physics
 */
class ContactPoint {
    /**
     * Create a new ContactPoint instance.
     *
     * @param {Vec3} [localPoint] - The point on the entity where the contact occurred, relative to
     * the entity.
     * @param {Vec3} [localPointOther] - The point on the other entity where the contact occurred,
     * relative to the other entity.
     * @param {Vec3} [point] - The point on the entity where the contact occurred, in world space.
     * @param {Vec3} [pointOther] - The point on the other entity where the contact occurred, in
     * world space.
     * @param {Vec3} [normal] - The normal vector of the contact on the other entity, in world
     * space.
     * @param {number} [impulse] - The total accumulated impulse applied by the constraint solver
     * during the last sub-step. Describes how hard two objects collide. Defaults to 0.
     * @hideconstructor
     */
    constructor(localPoint = new Vec3(), localPointOther = new Vec3(), point = new Vec3(), pointOther = new Vec3(), normal = new Vec3(), impulse = 0) {
        /**
         * The point on the entity where the contact occurred, relative to the entity.
         *
         * @type {Vec3}
         */
        this.localPoint = localPoint;

        /**
         * The point on the other entity where the contact occurred, relative to the other entity.
         *
         * @type {Vec3}
         */
        this.localPointOther = localPointOther;

        /**
         * The point on the entity where the contact occurred, in world space.
         *
         * @type {Vec3}
         */
        this.point = point;

        /**
         * The point on the other entity where the contact occurred, in world space.
         *
         * @type {Vec3}
         */
        this.pointOther = pointOther;

        /**
         * The normal vector of the contact on the other entity, in world space.
         *
         * @type {Vec3}
         */
        this.normal = normal;

        /**
         * The total accumulated impulse applied by the constraint solver during the last sub-step.
         * Describes how hard two objects collide.
         *
         * @type {number}
         */
        this.impulse = impulse;
    }
}

/**
 * Object holding the result of a contact between two Entities.
 *
 * @category Physics
 */
class ContactResult {
    /**
     * Create a new ContactResult instance.
     *
     * @param {import('../../entity.js').Entity} other - The entity that was involved in the
     * contact with this entity.
     * @param {ContactPoint[]} contacts - An array of ContactPoints with the other entity.
     * @hideconstructor
     */
    constructor(other, contacts) {
        /**
         * The entity that was involved in the contact with this entity.
         *
         * @type {import('../../entity.js').Entity}
         */
        this.other = other;

        /**
         * An array of ContactPoints with the other entity.
         *
         * @type {ContactPoint[]}
         */
        this.contacts = contacts;
    }
}

const _schema = ['enabled'];

/**
 * The PhysicsComponentSystem maintains the dynamics world for simulating physics, it also
 * controls global values for the world such as gravity. Note: The PhysicsComponentSystem is only
 * valid if 3D Physics is enabled in your application. You can enable this in the application
 * settings for your project.
 *
 * @augments ComponentSystem
 * @category Physics
 *
 * @template {PhysicsComponent} [ComponentT=PhysicsComponent]
 * @template {import('./backends/interface.js').PhysicsSystemBackend} [Backend=import('./backends/interface.js').PhysicsSystemBackend<ComponentT>]
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
     * @type {ComponentT[]}
     * @private
     */
    _dynamic = [];

    /**
     * @type {ComponentT[]}
     * @private
     */
    _kinematic = [];

    /**
     * @type {ComponentT[]}
     * @private
     */
    _triggers = [];

    /**
     * @type {ComponentT[]}
     * @private
     */
    _compounds = [];

    /**
     * @type {Backend}
     * @private
     */
    _backend = /** @type {Backend} */ (/** @type {unknown} */ (null));

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
                this._backend = /** @type {Backend} */ (/** @type {unknown} */ (new AmmoPhysicsSystemBackend(this)));

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
     * @param {ComponentT} component - The {@link PhysicsComponent} to remove from the entity
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
     * @returns {RaycastResult|null} The result of the raycasting or null if there was no hit.
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
     * @returns {RaycastResult[]} An array of raycast hit results (0 length if there were no hits).
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

export { ContactPoint, ContactResult, RaycastResult, PhysicsComponentSystem, SingleContactResult };
