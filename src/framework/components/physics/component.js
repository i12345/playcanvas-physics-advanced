import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';

import {
    BODYTYPE_STATIC, BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC,
    BODYGROUP_DYNAMIC, BODYGROUP_KINEMATIC, BODYGROUP_STATIC,
    BODYMASK_ALL, BODYMASK_NOT_STATIC
} from './constants.js';
import { Component } from '../component.js';

/**
 * The physics component, when combined with a {@link CollisionComponent}, allows your entities
 * to be simulated using realistic physics. A physics component will fall under gravity and
 * collide with other physics bodies. Using scripts, you can apply forces and impulses to physics
 * bodies.
 *
 * You should never need to use the PhysicsComponent constructor. To add a PhysicsComponent to
 * a {@link Entity}, use {@link Entity#addComponent}:
 *
 * ```javascript
 * // Create a static 1x1x1 box-shaped rigid body
 * const entity = pc.Entity();
 * entity.addComponent("physics"); // Without options, this defaults to a 'static' body
 * entity.addComponent("collision"); // Without options, this defaults to a 1x1x1 box shape
 * ```
 *
 * To create a dynamic sphere with mass of 10, do:
 *
 * ```javascript
 * const entity = pc.Entity();
 * entity.addComponent("physics", {
 *     type: pc.BODYTYPE_DYNAMIC,
 *     mass: 10
 * });
 * entity.addComponent("collision", {
 *     type: "sphere"
 * });
 * ```
 *
 * Relevant 'Engine-only' examples:
 *
 * - [Falling shapes](http://playcanvas.github.io/#physics/falling-shapes)
 * - [Vehicle physics](http://playcanvas.github.io/#physics/vehicle)
 *
 * @augments Component
 * @category Physics
 * @abstract
 */
class PhysicsComponent extends Component {
    /** @protected */
    _angularDamping = 0;

    /** @protected */
    _angularFactor = new Vec3(1, 1, 1);

    /** @protected */
    _friction = 0.5;

    /** @protected */
    _group = BODYGROUP_STATIC;

    /** @protected */
    _linearDamping = 0;

    /** @protected */
    _linearFactor = new Vec3(1, 1, 1);

    /** @protected */
    _mask = BODYMASK_NOT_STATIC;

    /** @protected */
    _mass = 1;

    /** @protected */
    _restitution = 0;

    /** @protected */
    _rollingFriction = 0;

    /** @protected */
    _spinningFriction = 0;

    /** @protected */
    _contactStiffness = 1e30; // BT_LARGE_FLOAT when double precision enabled

    /** @protected */
    _contactDamping = 0.1;

    /** @protected */
    _simulationEnabled = false;

    /** @protected */
    /** @type {import('./constants.js').PhysicsBodyType} */
    _type = BODYTYPE_STATIC;

    /**
     * Create a new PhysicsComponent instance.
     *
     * @param {import('./system.js').PhysicsComponentSystem} system - The ComponentSystem that
     * created this component.
     * @param {import('../../entity.js').Entity} entity - The entity this component is attached to.
     */
    constructor(system, entity) { // eslint-disable-line no-useless-constructor
        super(system, entity);
    }

    /**
     * Fired when a contact occurs between two physics bodies.
     *
     * @event PhysicsComponent#contact
     * @param {import('./system.js').ContactResult} result - Details of the contact between the two physics bodies.
     */

    /**
     * Fired when two physics bodies start touching.
     *
     * @event PhysicsComponent#collisionstart
     * @param {import('./system.js').ContactResult} result - Details of the contact between the two physics bodies.
     */

    /**
     * Fired when two physics bodies stop touching.
     *
     * @event PhysicsComponent#collisionend
     * @param {import('../../entity.js').Entity} other - The {@link Entity} that stopped touching this physics body.
     */

    /**
     * Fired when a physics body enters a trigger volume.
     *
     * @event PhysicsComponent#triggerenter
     * @param {import('../../entity.js').Entity} other - The {@link Entity} with trigger volume that this physics body entered.
     */

    /**
     * Fired when a physics body exits a trigger volume.
     *
     * @event PhysicsComponent#triggerleave
     * @param {import('../../entity.js').Entity} other - The {@link Entity} with trigger volume that this physics body exited.
     */

    /** @ignore */
    static onLibraryLoaded() {
        // Lazily create shared variable

        if (typeof Ammo !== 'undefined') {
            _ammoTransform = new Ammo.btTransform();
            _ammoVec1 = new Ammo.btVector3();
            _ammoVec2 = new Ammo.btVector3();
            _ammoQuat = new Ammo.btQuaternion();
        }
    }

    /**
     * Controls the rate at which a body loses angular velocity over time.
     *
     * @type {number}
     */
    set angularDamping(damping) {
        if (this._angularDamping !== damping) {
            this._angularDamping = damping;

            this._updateAngularDamping();
        }
    }

    get angularDamping() {
        return this._angularDamping;
    }

    /**
     * Scaling factor for angular movement of the body in each axis. Only valid for rigid bodies of
     * type {@link BODYTYPE_DYNAMIC}. Defaults to 1 in all axes (body can freely rotate).
     *
     * @type {Vec3}
     */
    set angularFactor(factor) {
        if (!this._angularFactor.equals(factor)) {
            this._angularFactor.copy(factor);

            if (this._type === BODYTYPE_DYNAMIC) {
                this._updateAngularFactor();
            }
        }
    }

    get angularFactor() {
        return this._angularFactor;
    }

    /**
     * Defines the rotational speed of the body around each world axis.
     *
     * @type {Vec3}
     * @abstract
     */
    set angularVelocity(velocity) {
        throw new Error("not implemented");
    }

    get angularVelocity() {
        return Vec3.ZERO;
    }

    /**
     * The friction value used when contacts occur between two bodies. A higher value indicates
     * more friction. Should be set in the range 0 to 1. Defaults to 0.5.
     *
     * @type {number}
     */
    set friction(friction) {
        if (this._friction !== friction) {
            this._friction = friction;

            this._updateFriction();
        }
    }

    get friction() {
        return this._friction;
    }

    /**
     * The collision group this body belongs to. Combine the group and the mask to prevent bodies
     * colliding with each other. Defaults to 1.
     *
     * @type {number}
     */
    set group(group) {
        if (this._group !== group) {
            this._group = group;

            // re-enabling simulation adds physics back into world with new masks
            if (this.enabled && this.entity.enabled) {
                this.disableSimulation();
                this.enableSimulation();
            }
        }
    }

    get group() {
        return this._group;
    }

    /**
     * Controls the rate at which a body loses linear velocity over time. Defaults to 0.
     *
     * @type {number}
     */
    set linearDamping(damping) {
        if (this._linearDamping !== damping) {
            this._linearDamping = damping;

            this._updateLinearDamping();
        }
    }

    get linearDamping() {
        return this._linearDamping;
    }

    /**
     * Scaling factor for linear movement of the body in each axis. Only valid for rigid bodies of
     * type {@link BODYTYPE_DYNAMIC}. Defaults to 1 in all axes (body can freely move).
     *
     * @type {Vec3}
     */
    set linearFactor(factor) {
        if (!this._linearFactor.equals(factor)) {
            this._linearFactor.copy(factor);

            if (this._type === BODYTYPE_DYNAMIC) {
                this._updateLinearFactor();
            }
        }
    }

    get linearFactor() {
        return this._linearFactor;
    }

    /**
     * Defines the speed of the body in a given direction.
     *
     * @type {Vec3}
     * @abstract
     */
    set linearVelocity(velocity) {
        throw new Error("not implemented");
    }

    get linearVelocity() {
        return Vec3.ZERO;
    }

    /**
     * The collision mask sets which groups this body collides with. It is a bitfield of 16 bits,
     * the first 8 bits are reserved for engine use. Defaults to 65535.
     *
     * @type {number}
     */
    set mask(mask) {
        if (this._mask !== mask) {
            this._mask = mask;

            // re-enabling simulation adds physics back into world with new masks
            if (this.enabled && this.entity.enabled) {
                this.disableSimulation();
                this.enableSimulation();
            }
        }
    }

    get mask() {
        return this._mask;
    }

    /**
     * The mass of the body. This is only relevant for {@link BODYTYPE_DYNAMIC} bodies, other types
     * have infinite mass. Defaults to 1.
     *
     * @type {number}
     */
    set mass(mass) {
        if (this._mass !== mass) {
            this._mass = mass;

            this._updateMass();
        }
    }

    get mass() {
        return this._mass;
    }

    /**
     * Influences the amount of energy lost when two physics bodies collide. The calculation
     * multiplies the restitution values for both colliding bodies. A multiplied value of 0 means
     * that all energy is lost in the collision while a value of 1 means that no energy is lost.
     * Should be set in the range 0 to 1. Defaults to 0.
     *
     * @type {number}
     */
    set restitution(restitution) {
        if (this._restitution !== restitution) {
            this._restitution = restitution;

            this._updateRestitution();
        }
    }

    get restitution() {
        return this._restitution;
    }

    /**
     * Sets a torsional friction orthogonal to the contact point. Defaults to 0.
     *
     * @type {number}
     */
    set rollingFriction(friction) {
        if (this._rollingFriction !== friction) {
            this._rollingFriction = friction;

            this._updateRollingFriction();
        }
    }

    get rollingFriction() {
        return this._rollingFriction;
    }

    /**
     * Sets a spinning friction orthogonal to the contact point. Defaults to 0.
     *
     * @type {number}
     */
    set spinningFriction(friction) {
        if (this._spinningFriction !== friction) {
            this._spinningFriction = friction;

            this._updateSpinningFriction();
        }
    }

    get spinningFriction() {
        return this._spinningFriction;
    }

    /**
     * Sets contact stiffness. Defaults to 0.
     *
     * @type {number}
     */
    set contactStiffness(stiffness) {
        if (this._contactStiffness !== stiffness) {
            this._contactStiffness = stiffness;

            this._updateContactStiffness();
        }
    }

    get contactStiffness() {
        return this._contactStiffness;
    }

    /**
     * Sets contact damping. Defaults to 0.
     *
     * @type {number}
     */
    set contactDamping(damping) {
        if (this._contactDamping !== damping) {
            this._contactDamping = damping;

            this._updateContactDamping();
        }
    }

    get contactDamping() {
        return this._contactDamping;
    }

    /**
     * @protected
     * @abstract
     */
    _updateAngularDamping() {
        throw new Error("not implemented");
    }

    /**
     * @protected
     * @abstract
     */
    _updateAngularFactor() {
        throw new Error("not implemented");
    }

    /**
     * @protected
     * @abstract
     */
    _updateFriction() {
        throw new Error("not implemented");
    }

    /**
     * @protected
     * @abstract
     */
    _updateLinearDamping() {
        throw new Error("not implemented");
    }

    /**
     * @protected
     * @abstract
     */
    _updateLinearFactor() {
        throw new Error("not implemented");
    }

    /**
     * @protected
     * @abstract
     */
    _updateMass() {
        throw new Error("not implemented");
    }

    /**
     * @protected
     * @abstract
     */
    _updateRestitution() {
        throw new Error("not implemented");
    }

    /**
     * @protected
     * @abstract
     */
    _updateRollingFriction() {
        throw new Error("not implemented");
    }

    /**
     * @protected
     * @abstract
     */
    _updateSpinningFriction() {
        throw new Error("not implemented");
    }

    /**
     * @protected
     * @abstract
     */
    _updateContactStiffness() {
        throw new Error("not implemented");
    }

    /**
     * @protected
     * @abstract
     */
    _updateContactDamping() {
        throw new Error("not implemented");
    }


    /**
     * The physics body type determines how the body is simulated. Can be:
     *
     * - {@link BODYTYPE_STATIC}: infinite mass and cannot move.
     * - {@link BODYTYPE_DYNAMIC}: simulated according to applied forces.
     * - {@link BODYTYPE_KINEMATIC}: infinite mass and does not respond to forces (can only be
     * moved by setting the position and rotation of component's {@link Entity}).
     *
     * Defaults to {@link BODYTYPE_STATIC}.
     *
     * @type {string}
     */
    set type(type) {
        if (this._type !== type) {
            this._type = type;

            this.disableSimulation();

            // set group and mask to defaults for type
            switch (type) {
                case BODYTYPE_DYNAMIC:
                    this._group = BODYGROUP_DYNAMIC;
                    this._mask = BODYMASK_ALL;
                    break;
                case BODYTYPE_KINEMATIC:
                    this._group = BODYGROUP_KINEMATIC;
                    this._mask = BODYMASK_ALL;
                    break;
                case BODYTYPE_STATIC:
                default:
                    this._group = BODYGROUP_STATIC;
                    this._mask = BODYMASK_NOT_STATIC;
                    break;
            }

            // Create a new body
            this.createBody();
        }
    }

    get type() {
        return this._type;
    }

    /**
     * Whether a body is made or not.
     *
     * @type {boolean}
     * @abstract
     */
    get hasBody() {
        return false;
    }

    /**
     * If the Entity has a Collision shape attached then create a physics body using this shape. This
     * method destroys the existing body.
     *
     * @abstract
     */
    createBody() {
        throw new Error("not implemented");
    }

    /**
     * Returns true if the physics body is currently actively being simulated. I.e. Not 'sleeping'.
     *
     * @returns {boolean} True if the body is active.
     * @abstract
     */
    isActive() {
        throw new Error("not implemented");
    }

    /**
     * Forcibly activate the physics body simulation. Only affects physics bodies of type
     * {@link BODYTYPE_DYNAMIC}.
     *
     * @abstract
     */
    activate() {
        throw new Error("not implemented");
    }

    /**
     * Add a body to the simulation.
     *
     * @ignore
     * @abstract
     */
    enableSimulation() {
        throw new Error("not implemented");
    }

    /**
     * Remove a body from the simulation.
     *
     * @ignore
     * @abstract
     */
    disableSimulation() {
        throw new Error("not implemented");
    }

    /**
     * Apply an force to the body at a point. By default, the force is applied at the origin of the
     * body. However, the force can be applied at an offset this point by specifying a world space
     * vector from the body's origin to the point of application. This function has two valid
     * signatures. You can either specify the force (and optional relative point) via 3D-vector or
     * numbers.
     *
     * @param {Vec3|number} x - A 3-dimensional vector representing the force in world-space or
     * the x-component of the force in world-space.
     * @param {Vec3|number} [y] - An optional 3-dimensional vector representing the relative point
     * at which to apply the impulse in world-space or the y-component of the force in world-space.
     * @param {number} [z] - The z-component of the force in world-space.
     * @param {number} [px] - The x-component of a world-space offset from the body's position
     * where the force is applied.
     * @param {number} [py] - The y-component of a world-space offset from the body's position
     * where the force is applied.
     * @param {number} [pz] - The z-component of a world-space offset from the body's position
     * where the force is applied.
     * @example
     * // Apply an approximation of gravity at the body's center
     * this.entity.physics.applyForce(0, -10, 0);
     * @example
     * // Apply an approximation of gravity at 1 unit down the world Z from the center of the body
     * this.entity.physics.applyForce(0, -10, 0, 0, 0, 1);
     * @example
     * // Apply a force at the body's center
     * // Calculate a force vector pointing in the world space direction of the entity
     * const force = this.entity.forward.clone().mulScalar(100);
     *
     * // Apply the force
     * this.entity.physics.applyForce(force);
     * @example
     * // Apply a force at some relative offset from the body's center
     * // Calculate a force vector pointing in the world space direction of the entity
     * const force = this.entity.forward.clone().mulScalar(100);
     *
     * // Calculate the world space relative offset
     * const relativePos = new pc.Vec3();
     * const childEntity = this.entity.findByName('Engine');
     * relativePos.sub2(childEntity.getPosition(), this.entity.getPosition());
     *
     * // Apply the force
     * this.entity.physics.applyForce(force, relativePos);
     *
     * @abstract
     */
    applyForce(x, y, z, px, py, pz) {
        throw new Error("not implemented");
    }

    /**
     * Apply torque (rotational force) to the body. This function has two valid signatures. You can
     * either specify the torque force with a 3D-vector or with 3 numbers.
     *
     * @param {Vec3|number} x - A 3-dimensional vector representing the torque force in world-space
     * or the x-component of the torque force in world-space.
     * @param {number} [y] - The y-component of the torque force in world-space.
     * @param {number} [z] - The z-component of the torque force in world-space.
     * @example
     * // Apply via vector
     * const torque = new pc.Vec3(0, 10, 0);
     * entity.physics.applyTorque(torque);
     * @example
     * // Apply via numbers
     * entity.physics.applyTorque(0, 10, 0);
     *
     * @abstract
     */
    applyTorque(x, y, z) {
        throw new Error("not implemented");
    }

    /**
     * Apply an impulse (instantaneous change of velocity) to the body at a point. This function
     * has two valid signatures. You can either specify the impulse (and optional relative point)
     * via 3D-vector or numbers.
     *
     * @param {Vec3|number} x - A 3-dimensional vector representing the impulse in world-space or
     * the x-component of the impulse in world-space.
     * @param {Vec3|number} [y] - An optional 3-dimensional vector representing the relative point
     * at which to apply the impulse in the local-space of the entity or the y-component of the
     * impulse to apply in world-space.
     * @param {number} [z] - The z-component of the impulse to apply in world-space.
     * @param {number} [px] - The x-component of the point at which to apply the impulse in the
     * local-space of the entity.
     * @param {number} [py] - The y-component of the point at which to apply the impulse in the
     * local-space of the entity.
     * @param {number} [pz] - The z-component of the point at which to apply the impulse in the
     * local-space of the entity.
     * @example
     * // Apply an impulse along the world-space positive y-axis at the entity's position.
     * const impulse = new pc.Vec3(0, 10, 0);
     * entity.physics.applyImpulse(impulse);
     * @example
     * // Apply an impulse along the world-space positive y-axis at 1 unit down the positive
     * // z-axis of the entity's local-space.
     * const impulse = new pc.Vec3(0, 10, 0);
     * const relativePoint = new pc.Vec3(0, 0, 1);
     * entity.physics.applyImpulse(impulse, relativePoint);
     * @example
     * // Apply an impulse along the world-space positive y-axis at the entity's position.
     * entity.physics.applyImpulse(0, 10, 0);
     * @example
     * // Apply an impulse along the world-space positive y-axis at 1 unit down the positive
     * // z-axis of the entity's local-space.
     * entity.physics.applyImpulse(0, 10, 0, 0, 0, 1);
     *
     * @abstract
     */
    applyImpulse(x, y, z, px, py, pz) {
        throw new Error("not implemented");
    }

    /**
     * Apply a torque impulse (rotational force applied instantaneously) to the body. This function
     * has two valid signatures. You can either specify the torque force with a 3D-vector or with 3
     * numbers.
     *
     * @param {Vec3|number} x - A 3-dimensional vector representing the torque impulse in
     * world-space or the x-component of the torque impulse in world-space.
     * @param {number} [y] - The y-component of the torque impulse in world-space.
     * @param {number} [z] - The z-component of the torque impulse in world-space.
     * @example
     * // Apply via vector
     * const torque = new pc.Vec3(0, 10, 0);
     * entity.physics.applyTorqueImpulse(torque);
     * @example
     * // Apply via numbers
     * entity.physics.applyTorqueImpulse(0, 10, 0);
     *
     * @abstract
     */
    applyTorqueImpulse(x, y, z) {
        throw new Error("not implemented");
    }

    /**
     * Returns true if the physics body is of type {@link BODYTYPE_STATIC}.
     *
     * @returns {boolean} True if static.
     */
    isStatic() {
        return (this._type === BODYTYPE_STATIC);
    }

    /**
     * Returns true if the physics body is of type {@link BODYTYPE_STATIC} or {@link BODYTYPE_KINEMATIC}.
     *
     * @returns {boolean} True if static or kinematic.
     */
    isStaticOrKinematic() {
        return (this._type === BODYTYPE_STATIC || this._type === BODYTYPE_KINEMATIC);
    }

    /**
     * Returns true if the physics body is of type {@link BODYTYPE_KINEMATIC}.
     *
     * @returns {boolean} True if kinematic.
     */
    isKinematic() {
        return (this._type === BODYTYPE_KINEMATIC);
    }

    /**
     * Set the rigid body transform to be the same as the Entity transform. This must be called
     * after any Entity transformation functions (e.g. {@link Entity#setPosition}) are called in
     * order to update the rigid body to match the Entity.
     *
     * @protected
     * @abstract
     */
    syncEntityToBody() {
        throw new Error("not implemented");
    }

    /**
     * Sets an entity's transform to match that of the world transformation matrix of a dynamic
     * physics body's motion state.
     *
     * @protected
     * @abstract
     */
    _updateDynamic() {
        throw new Error("not implemented");
    }

    /**
     * Writes the entity's world transformation matrix into the motion state of a kinematic body.
     *
     * @protected
     * @abstract
     */
    _updateKinematic() {
        throw new Error("not implemented");
    }

    /**
     * Teleport an entity to a new world-space position, optionally setting orientation. This
     * function should only be called for rigid bodies that are dynamic. This function has three
     * valid signatures. The first takes a 3-dimensional vector for the position and an optional
     * 3-dimensional vector for Euler rotation. The second takes a 3-dimensional vector for the
     * position and an optional quaternion for rotation. The third takes 3 numbers for the position
     * and an optional 3 numbers for Euler rotation.
     *
     * @param {Vec3|number} x - A 3-dimensional vector holding the new position or the new position
     * x-coordinate.
     * @param {Quat|Vec3|number} [y] - A 3-dimensional vector or quaternion holding the new
     * rotation or the new position y-coordinate.
     * @param {number} [z] - The new position z-coordinate.
     * @param {number} [rx] - The new Euler x-angle value.
     * @param {number} [ry] - The new Euler y-angle value.
     * @param {number} [rz] - The new Euler z-angle value.
     * @example
     * // Teleport the entity to the origin
     * entity.physics.teleport(pc.Vec3.ZERO);
     * @example
     * // Teleport the entity to the origin
     * entity.physics.teleport(0, 0, 0);
     * @example
     * // Teleport the entity to world-space coordinate [1, 2, 3] and reset orientation
     * const position = new pc.Vec3(1, 2, 3);
     * entity.physics.teleport(position, pc.Vec3.ZERO);
     * @example
     * // Teleport the entity to world-space coordinate [1, 2, 3] and reset orientation
     * entity.physics.teleport(1, 2, 3, 0, 0, 0);
     */
    teleport(x, y, z, rx, ry, rz) {
        if (x instanceof Vec3) {
            this.entity.setPosition(x);
        } else {
            this.entity.setPosition(x, y, z);
        }

        if (y instanceof Quat) {
            this.entity.setRotation(y);
        } else if (y instanceof Vec3) {
            this.entity.setEulerAngles(y);
        } else if (rx !== undefined) {
            this.entity.setEulerAngles(rx, ry, rz);
        }

        this.syncEntityToBody();
    }

    /** @ignore */
    onEnable() {
        if (!this.hasBody) {
            this.createBody();
        }

        this.enableSimulation();
    }

    /** @ignore */
    onDisable() {
        this.disableSimulation();
    }
}

export { PhysicsComponent };
