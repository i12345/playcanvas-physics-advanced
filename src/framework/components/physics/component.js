import { Debug } from '../../../core/debug.js';

import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';

import {
    BODYFLAG_KINEMATIC_OBJECT, BODYTYPE_STATIC,
    BODYGROUP_DYNAMIC, BODYGROUP_KINEMATIC, BODYGROUP_STATIC,
    BODYMASK_ALL, BODYMASK_NOT_STATIC,
    BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_DISABLE_SIMULATION,
    BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC
} from './constants.js';
import { Component } from '../component.js';

// Shared math variable to avoid excessive allocation
/** @type {import('ammojs3').default.btTransform} */
let _ammoTransform;
/** @type {import('ammojs3').default.btVector3} */
let _ammoVec1;
/** @type {import('ammojs3').default.btVector3} */
let _ammoVec2;
/** @type {import('ammojs3').default.btQuaternion} */
let _ammoQuat;

const _quat1 = new Quat();
const _quat2 = new Quat();
const _vec3 = new Vec3();

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
 */
class PhysicsComponent extends Component {
    /** @private */
    _angularDamping = 0;

    /** @private */
    _angularFactor = new Vec3(1, 1, 1);

    /** @private */
    _angularVelocity = new Vec3();

    /**
     * @private
     * @type {import('ammojs3').default.btRigidBody}
     */
    _rigidBody = null;

    /**
     * @private
     * @type {import('ammojs3').default.btMultiBodyLinkCollider}
     */
    _multibodyLinkCollider = null;

    /** @private */
    _friction = 0.5;

    /** @private */
    _group = BODYGROUP_STATIC;

    /** @private */
    _linearDamping = 0;

    /** @private */
    _linearFactor = new Vec3(1, 1, 1);

    /** @private */
    _linearVelocity = new Vec3();

    /** @private */
    _mask = BODYMASK_NOT_STATIC;

    /** @private */
    _mass = 1;

    /** @private */
    _restitution = 0;

    /** @private */
    _rollingFriction = 0;

    /** @private */
    _spinningFriction = 0;

    /** @private */
    _contactStiffness = 1e30; // BT_LARGE_FLOAT when double precision enabled

    /** @private */
    _contactDamping = 0.1;

    /** @private */
    _simulationEnabled = false;

    /** @private */
    /** @type {typeof BODYTYPE_STATIC | typeof BODYTYPE_DYNAMIC | typeof BODYTYPE_KINEMATIC} */
    _type = BODYTYPE_STATIC;

    /** @type {import('./system').PhysicsComponentSystem} */
    // system;

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
     * @param {import('./system').ContactResult} result - Details of the contact between the two physics bodies.
     */

    /**
     * Fired when two physics bodies start touching.
     *
     * @event PhysicsComponent#collisionstart
     * @param {import('./system').ContactResult} result - Details of the contact between the two physics bodies.
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

            if (this._rigidBody) {
                this._rigidBody.setDamping(this._linearDamping, damping);
            }
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

            if (this._rigidBody && this._type === BODYTYPE_DYNAMIC) {
                _ammoVec1.setValue(factor.x, factor.y, factor.z);
                this._rigidBody.setAngularFactor(_ammoVec1);
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
     */
    set angularVelocity(velocity) {
        if (this._rigidBody && this._type === BODYTYPE_DYNAMIC) {
            this._rigidBody.activate();

            _ammoVec1.setValue(velocity.x, velocity.y, velocity.z);
            this._rigidBody.setAngularVelocity(_ammoVec1);

            this._angularVelocity.copy(velocity);
        }
    }

    get angularVelocity() {
        if (this._rigidBody && this._type === BODYTYPE_DYNAMIC) {
            const velocity = this._rigidBody.getAngularVelocity();
            this._angularVelocity.set(velocity.x(), velocity.y(), velocity.z());
        }
        return this._angularVelocity;
    }

    set rigidBody(rigidBody) {
        if (this._rigidBody !== rigidBody) {
            this._rigidBody = rigidBody;

            if (rigidBody && this._simulationEnabled) {
                rigidBody.activate();
            }
        }
    }

    get rigidBody() {
        return this._rigidBody;
    }

    set multibodyLinkCollider(multibodyLinkCollider) {
        if (this._multibodyLinkCollider !== multibodyLinkCollider) {
            this._multibodyLinkCollider = multibodyLinkCollider;

            if (multibodyLinkCollider && this._simulationEnabled) {
                multibodyLinkCollider.activate();
            }
        }
    }

    get multibodyLinkCollider() {
        return this._multibodyLinkCollider;
    }

    get collisionObject() {
        return this._rigidBody ?? this._multibodyLinkCollider;
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

            if (this._rigidBody) {
                this._rigidBody.setFriction(friction);
            }
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

            if (this._rigidBody) {
                this._rigidBody.setDamping(damping, this._angularDamping);
            }
            // TODO: consider if multibody links have something like this
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

            if (this._rigidBody && this._type === BODYTYPE_DYNAMIC) {
                _ammoVec1.setValue(factor.x, factor.y, factor.z);
                this._rigidBody.setLinearFactor(_ammoVec1);
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
     */
    set linearVelocity(velocity) {
        if (this._rigidBody && this._type === BODYTYPE_DYNAMIC) {
            this._rigidBody.activate();

            _ammoVec1.setValue(velocity.x, velocity.y, velocity.z);
            this._rigidBody.setLinearVelocity(_ammoVec1);

            this._linearVelocity.copy(velocity);
        }
    }

    get linearVelocity() {
        if (this._rigidBody && this._type === BODYTYPE_DYNAMIC) {
            const velocity = this._rigidBody.getLinearVelocity();
            this._linearVelocity.set(velocity.x(), velocity.y(), velocity.z());
        }
        return this._linearVelocity;
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

            if (this.collisionObject && this._type === BODYTYPE_DYNAMIC) {
                const enabled = this.enabled && this.entity.enabled;
                if (enabled) {
                    this.disableSimulation();
                }

                // calculateLocalInertia writes local inertia to ammoVec1 here...
                this.collisionObject.getCollisionShape().calculateLocalInertia(mass, _ammoVec1);
                // ...and then writes the calculated local inertia to the body
                if (this._rigidBody) {
                    this._rigidBody.setMassProps(mass, _ammoVec1);
                    this._rigidBody.updateInertiaTensor();
                } else if (this._multibodyLinkCollider) {
                    if (this.entity.multibody.linkIndex === -1) {
                        this.entity.multibody.multibody.setBaseMass(mass);
                        this.entity.multibody.multibody.setBaseInertia(_ammoVec1);
                    } else {
                        this.entity.multibody.link.set_m_mass(mass);
                        this.entity.multibody.link.set_m_inertiaLocal(_ammoVec1);
                    }
                }

                if (enabled) {
                    this.enableSimulation();
                }
            }
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

            if (this._rigidBody) {
                this._rigidBody.setRestitution(restitution);
            } else if (this._multibodyLinkCollider) {
                this._multibodyLinkCollider.setRestitution(restitution);
            }
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

            if (this._rigidBody) {
                this._rigidBody.setRollingFriction(friction);
            } else if (this._multibodyLinkCollider) {
                this._multibodyLinkCollider.setRollingFriction(friction);
            }
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

            if (this._rigidBody) {
                this._rigidBody.setSpinningFriction(friction);
            } else if (this._multibodyLinkCollider) {
                this._multibodyLinkCollider.setSpinningFriction(friction);
            }
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

            if (this._rigidBody) {
                this._rigidBody.setContactStiffnessAndDamping(stiffness, this._contactDamping);
            } else if (this._multibodyLinkCollider) {
                this._multibodyLinkCollider.setContactStiffnessAndDamping(stiffness, this._contactDamping);
            }
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

            if (this._rigidBody) {
                this._rigidBody.setContactStiffnessAndDamping(this._contactStiffness, damping);
            } else if (this._multibodyLinkCollider) {
                this._multibodyLinkCollider.setContactStiffnessAndDamping(this._contactStiffness, damping);
            }
        }
    }

    get contactDamping() {
        return this._contactDamping;
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
     * If the Entity has a Collision shape attached then create a physics body using this shape. This
     * method destroys the existing body.
     *
     * @private
     */
    createBody() {
        const entity = this.entity;
        let shape;

        if (entity.collision) {
            shape = entity.collision.shape;

            // if a trigger was already created from the collision system
            // destroy it
            if (entity.trigger) {
                entity.trigger.destroy();
                delete entity.trigger;
            }
        }

        if (shape) {
            if (this.collisionObject)
                this.system.onRemove(entity, this);

            const mass = this._type === BODYTYPE_DYNAMIC ? this._mass : 0;

            this._getEntityTransform(_ammoTransform);

            if (this.entity.multibody?.isInMultibody) {
                /** @type {import('ammojs3').default.btMultiBodyLinkCollider} */
                const collider = this.system.createMultiBodyLinkCollider(mass, shape, _ammoTransform, this.entity.multibody);
                this._multibodyLinkCollider = collider;
            } else {
                /** @type {import('ammojs3').default.btRigidBody} */
                const body = this.system.createRigidBody(mass, shape, _ammoTransform);

                body.setDamping(this._linearDamping, this._angularDamping);

                if (this._type === BODYTYPE_DYNAMIC) {
                    const linearFactor = this._linearFactor;
                    _ammoVec1.setValue(linearFactor.x, linearFactor.y, linearFactor.z);
                    body.setLinearFactor(_ammoVec1);

                    const angularFactor = this._angularFactor;
                    _ammoVec1.setValue(angularFactor.x, angularFactor.y, angularFactor.z);
                    body.setAngularFactor(_ammoVec1);
                }

                this._rigidBody = body;
            }

            const obj = this.collisionObject;
            obj.setRestitution(this._restitution);
            obj.setFriction(this._friction);
            obj.setRollingFriction(this._rollingFriction);
            obj.setSpinningFriction(this._spinningFriction);
            obj.setContactStiffnessAndDamping(this._contactStiffness, this._contactDamping);
            obj.entity = entity;

            if (this._type === BODYTYPE_KINEMATIC) {
                obj.setCollisionFlags(obj.getCollisionFlags() | BODYFLAG_KINEMATIC_OBJECT);
                obj.setActivationState(BODYSTATE_DISABLE_DEACTIVATION);
            }

            if (this.enabled && entity.enabled) {
                this.enableSimulation();
            }
        }
    }

    /**
     * Returns true if the physics body is currently actively being simulated. I.e. Not 'sleeping'.
     *
     * @returns {boolean} True if the body is active.
     */
    isActive() {
        return this.collisionObject?.isActive() ?? false;
    }

    /**
     * Forcibly activate the physics body simulation. Only affects physics bodies of type
     * {@link BODYTYPE_DYNAMIC}.
     */
    activate() {
        if (this.collisionObject) {
            this.collisionObject.activate();
        }
    }

    /**
     * Add a body to the simulation.
     *
     * @ignore
     */
    enableSimulation() {
        const entity = this.entity;
        if (entity.collision && entity.collision.enabled && !this._simulationEnabled) {
            const obj = this.collisionObject;
            if (obj) {
                if (this._rigidBody) {
                    this.system.addRigidBody(this._rigidBody, this._group, this._mask);
                } else if (this._multibodyLinkCollider) {
                    this.system.addMultiBodyLinkCollider(this._multibodyLinkCollider, this._group, this._mask);
                }

                switch (this._type) {
                    case BODYTYPE_DYNAMIC:
                        this.system._dynamic.push(this);
                        obj.forceActivationState(BODYSTATE_ACTIVE_TAG);
                        this.syncEntityToBody();
                        break;
                    case BODYTYPE_KINEMATIC:
                        this.system._kinematic.push(this);
                        obj.forceActivationState(BODYSTATE_DISABLE_DEACTIVATION);
                        break;
                    case BODYTYPE_STATIC:
                        obj.forceActivationState(BODYSTATE_ACTIVE_TAG);
                        this.syncEntityToBody();
                        break;
                }

                if (entity.collision.type === 'compound') {
                    this.system._compounds.push(entity.collision);
                }

                obj.activate();

                this._simulationEnabled = true;
            }
        }
    }

    /**
     * Remove a body from the simulation.
     *
     * @ignore
     */
    disableSimulation() {
        const obj = this.collisionObject;
        if (obj && this._simulationEnabled) {
            /** @type {import('./system').PhysicsComponentSystem} */
            const system = this.system;

            let idx = system._compounds.indexOf(this.entity.collision);
            if (idx > -1) {
                system._compounds.splice(idx, 1);
            }

            idx = system._dynamic.indexOf(this);
            if (idx > -1) {
                system._dynamic.splice(idx, 1);
            }

            idx = system._kinematic.indexOf(this);
            if (idx > -1) {
                system._kinematic.splice(idx, 1);
            }

            if (this._rigidBody) {
                system.removeRigidBody(obj);
            } else if (this._multibodyLinkCollider) {
                system.removeMultiBodyLinkCollider(obj);
            }

            // set activation state to disable simulation to avoid body.isActive() to return
            // true even if it's not in the dynamics world
            obj.forceActivationState(BODYSTATE_DISABLE_SIMULATION);

            this._simulationEnabled = false;
        }
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
     */
    applyForce(x, y, z, px, py, pz) {
        const obj = this.collisionObject;
        if (obj) {
            obj.activate();

            if (x instanceof Vec3) {
                _ammoVec1.setValue(x.x, x.y, x.z);
            } else {
                _ammoVec1.setValue(x, y, z);
            }

            if (y instanceof Vec3) {
                _ammoVec2.setValue(y.x, y.y, y.z);
            } else if (px !== undefined) {
                _ammoVec2.setValue(px, py, pz);
            } else {
                _ammoVec2.setValue(0, 0, 0);
            }

            if (this._rigidBody) {
                this._rigidBody.applyForce(_ammoVec1, _ammoVec2);
            } else {
                if (this._multibodyLinkCollider) {
                    if (this.entity.multibody.linkIndex === -1) {
                        this.entity.multibody.base.multibody.addBaseForce(_ammoVec1);
                    } else {
                        this.entity.multibody.base.multibody.addLinkForce(this.multibodyLinkCollider.m_link, _ammoVec1);
                    }
                }
            }
        }
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
     * entity.rigidbody.applyTorque(torque);
     * @example
     * // Apply via numbers
     * entity.physics.applyTorque(0, 10, 0);
     */
    applyTorque(x, y, z) {
        const obj = this.collisionObject;
        if (obj) {
            obj.activate();

            if (x instanceof Vec3) {
                _ammoVec1.setValue(x.x, x.y, x.z);
            } else {
                _ammoVec1.setValue(x, y, z);
            }

            if (this._rigidBody) {
                this._rigidBody.applyTorque(_ammoVec1);
            } else {
                if (this.entity.multibody.linkIndex === -1) {
                    this.entity.multibody.base.multibody.addBaseTorque(_ammoVec1);
                } else {
                    this.entity.multibody.base.multibody.addLinkTorque(this.multibodyLinkCollider.m_link, _ammoVec1);
                }
            }
        }
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
     * entity.rigidbody.applyImpulse(impulse);
     * @example
     * // Apply an impulse along the world-space positive y-axis at 1 unit down the positive
     * // z-axis of the entity's local-space.
     * const impulse = new pc.Vec3(0, 10, 0);
     * const relativePoint = new pc.Vec3(0, 0, 1);
     * entity.rigidbody.applyImpulse(impulse, relativePoint);
     * @example
     * // Apply an impulse along the world-space positive y-axis at the entity's position.
     * entity.physics.applyImpulse(0, 10, 0);
     * @example
     * // Apply an impulse along the world-space positive y-axis at 1 unit down the positive
     * // z-axis of the entity's local-space.
     * entity.physics.applyImpulse(0, 10, 0, 0, 0, 1);
     */
    applyImpulse(x, y, z, px, py, pz) {
        const obj = this.collisionObject;
        if (obj) {
            obj.activate();

            if (x instanceof Vec3) {
                _ammoVec1.setValue(x.x, x.y, x.z);
            } else {
                _ammoVec1.setValue(x, y, z);
            }

            if (y instanceof Vec3) {
                _ammoVec2.setValue(y.x, y.y, y.z);
            } else if (px !== undefined) {
                _ammoVec2.setValue(px, py, pz);
            } else {
                _ammoVec2.setValue(0, 0, 0);
            }

            if (this._rigidBody) {
                this._rigidBody.applyImpulse(_ammoVec1, _ammoVec2);
            } else {
                throw new Error("Cannot apply impulse to multibody link.");
            }
        }
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
     * entity.rigidbody.applyTorqueImpulse(torque);
     * @example
     * // Apply via numbers
     * entity.physics.applyTorqueImpulse(0, 10, 0);
     */
    applyTorqueImpulse(x, y, z) {
        const obj = this.collisionObject;
        if (obj) {
            obj.activate();

            if (x instanceof Vec3) {
                _ammoVec1.setValue(x.x, x.y, x.z);
            } else {
                _ammoVec1.setValue(x, y, z);
            }

            if (this._rigidBody) {
                this._rigidBody.applyTorqueImpulse(_ammoVec1);
            } else {
                throw new Error("Cannot apply torque impulse to multibody link.");
            }
        }
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
     * Writes an entity transform into an Ammo.btTransform but ignoring scale.
     *
     * @param {import('ammojs3').default.btTransform} transform - The ammo transform to write the entity transform to.
     * @private
     */
    _getEntityTransform(transform) {
        const entity = this.entity;

        const component = entity.collision;
        if (component) {
            const bodyPos = component.getShapePosition();
            const bodyRot = component.getShapeRotation();
            _ammoVec1.setValue(bodyPos.x, bodyPos.y, bodyPos.z);
            _ammoQuat.setValue(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w);
        } else {
            const pos = entity.getPosition();
            const rot = entity.getRotation();
            _ammoVec1.setValue(pos.x, pos.y, pos.z);
            _ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
        }

        transform.setOrigin(_ammoVec1);
        transform.setRotation(_ammoQuat);
    }

    /**
     * Set the rigid body transform to be the same as the Entity transform. This must be called
     * after any Entity transformation functions (e.g. {@link Entity#setPosition}) are called in
     * order to update the rigid body to match the Entity.
     *
     * @private
     */
    syncEntityToBody() {
        const obj = this.collisionObject;
        if (obj) {
            this._getEntityTransform(_ammoTransform);

            if (this._multibodyLinkCollider) {
                if (this.entity.multibody.linkIndex === -1) {
                    // this.entity.multibody.multibody.setBaseWorldTransform(_ammoTransform);
                } else {
                    // TODO: update joint pos to match
                }
            } else if (this._rigidBody) {
                if (this._type === BODYTYPE_KINEMATIC) {
                    const motionState = this._rigidBody.getMotionState();
                    if (motionState) {
                        motionState.setWorldTransform(_ammoTransform);
                    }
                }
            }

            obj.setWorldTransform(_ammoTransform);

            obj.activate();
        }
    }

    /**
     * Sets an entity's transform to match that of the world transformation matrix of a dynamic
     * physics body's motion state.
     *
     * @private
     */
    _updateDynamic() {
        const body = this.collisionObject;
        const entity = this.entity;

        // If a dynamic body is frozen, we can assume its motion state transform is
        // the same is the entity world transform
        if (body.isActive() || entity._wasDirty) {
            if (entity._wasDirty) {
                // Warn the user about setting transform instead of using teleport function
                Debug.warn('Cannot set rigid body transform from entity. Use entity.rigidbody#teleport instead.');
            }

            let objTransform = _ammoTransform;
            if (this._rigidBody) {
                this._rigidBody.getMotionState().getWorldTransform(objTransform);
            } else if (this._multibodyLinkCollider) {
                objTransform = this._multibodyLinkCollider.getWorldTransform();
                // this comes by ref so there is no need to destroy it
            }

            const p = objTransform.getOrigin();
            const q = objTransform.getRotation();

            const component = entity.collision;
            if (component && component._hasOffset) {
                const lo = component.data.linearOffset;
                const ao = component.data.angularOffset;

                // Un-rotate the angular offset and then use the new rotation to
                // un-translate the linear offset in local space
                // Order of operations matter here
                const invertedAo = _quat2.copy(ao).invert();
                const entityRot = _quat1.set(q.x(), q.y(), q.z(), q.w()).mul(invertedAo);

                entityRot.transformVector(lo, _vec3);
                entity.setPosition(p.x() - _vec3.x, p.y() - _vec3.y, p.z() - _vec3.z);
                entity.setRotation(entityRot);
            } else {
                entity.setPosition(p.x(), p.y(), p.z());
                entity.setRotation(q.x(), q.y(), q.z(), q.w());
            }

            entity._wasDirty = false;
        }
    }

    /**
     * Writes the entity's world transformation matrix into the motion state of a kinematic body.
     *
     * @private
     */
    _updateKinematic() {
        this._getEntityTransform(_ammoTransform);
        if (this._rigidBody) {
            this._rigidBody.getMotionState().setWorldTransform(_ammoTransform);
        } else {
            this._multibodyLinkCollider.setWorldTransform(_ammoTransform);
        }
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
     * entity.rigidbody.teleport(position, pc.Vec3.ZERO);
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
        if (!this.collisionObject) {
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
