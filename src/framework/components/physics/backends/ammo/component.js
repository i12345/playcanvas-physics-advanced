import { Debug } from '../../../../../core/debug.js';

import { Quat } from '../../../../../core/math/quat.js';
import { Vec3 } from '../../../../../core/math/vec3.js';

import { BODYTYPE_STATIC, BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC } from '../../constants.js';
import { AMMO_BODYFLAG_KINEMATIC_OBJECT, AMMO_BODYSTATE_ACTIVE_TAG, AMMO_BODYSTATE_DISABLE_DEACTIVATION, AMMO_BODYSTATE_DISABLE_SIMULATION } from "./constants.js";
import { PhysicsComponent } from '../../component.js';

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
 * Ammo physics component
 */
class AmmoPhysicsComponent extends PhysicsComponent {
    /**
     * @private
     * @type {import('ammojs3').default.btRigidBody|null}
     */
    _rigidBody = null;

    /**
     * @private
     * @type {import('ammojs3').default.btMultiBodyLinkCollider|null}
     */
    _multibodyLinkCollider = null;

    /** @private */
    _angularVelocity = new Vec3();

    /** @private */
    _linearVelocity = new Vec3();

    /**
     * Create a new PhysicsComponent instance.
     *
     * @param {import('../../system.js').PhysicsComponentSystem} system - The ComponentSystem that
     * created this component.
     * @param {import('../../../../entity.js').Entity} entity - The entity this component is attached to.
     */
    constructor(system, entity) { // eslint-disable-line no-useless-constructor
        super(system, entity);
    }

    /** @ignore */
    static onLibraryLoaded() {
        // Lazily create shared variable

        if (typeof Ammo === 'undefined')
            throw new Error();

        _ammoTransform = new Ammo.btTransform();
        _ammoVec1 = new Ammo.btVector3();
        _ammoVec2 = new Ammo.btVector3();
        _ammoQuat = new Ammo.btQuaternion();
    }

    _updateAngularDamping() {
        if (this._rigidBody) {
            this._rigidBody.setDamping(this._linearDamping, this._angularDamping);
        } else if (this._multibodyLinkCollider) {
            // TODO: consider if multibody links have something like this
            throw new Error("not implemented / not exists");
        }
    }

    _updateAngularFactor() {
        if (this._type === BODYTYPE_DYNAMIC) {
            if (this._rigidBody) {
                _ammoVec1.setValue(this._angularFactor.x, this._angularFactor.y, this._angularFactor.z);
                this._rigidBody.setAngularFactor(_ammoVec1);
            } else if (this._multibodyLinkCollider) {
                throw new Error("not implemented / not exists");
            }
        }
    }

    /**
     * Defines the rotational speed of the body around each world axis.
     *
     * @type {Vec3}
     */
    set angularVelocity(velocity) {
        if (this._type !== BODYTYPE_DYNAMIC)
            throw new Error("cannot set velocity for non-dynamic objects");

        if (this._rigidBody) {
            this._rigidBody.activate();

            _ammoVec1.setValue(velocity.x, velocity.y, velocity.z);
            this._rigidBody.setAngularVelocity(_ammoVec1);
        } else if (this._multibodyLinkCollider) {
            throw new Error("not implemented / not exists");
            // research btMultiBody::setJointVel
        }
    }

    get angularVelocity() {
        if (this._type !== BODYTYPE_DYNAMIC)
            throw new Error("cannot set velocity for non-dynamic objects");

        if (this._rigidBody) {
            const velocity = this._rigidBody.getAngularVelocity();
            this._angularVelocity.set(velocity.x(), velocity.y(), velocity.z());
        } else if (this._multibodyLinkCollider) {
            throw new Error("not implemented / not exists");
            // research btMultiBody::getJointVel
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

    /**
     * this.rigidBody ?? this.multibodyLinkCollider
     * @type {import('ammojs3').default.btRigidBody|import('ammojs3').default.btMultiBodyLinkCollider|null}
     */
    get body() {
        return this._rigidBody ?? this._multibodyLinkCollider;
    }

    _updateFriction() {
        if (this._rigidBody) {
            this._rigidBody.setFriction(this._friction);
        } else if (this._multibodyLinkCollider) {
            this._multibodyLinkCollider.setFriction(this._friction);
        }
    }

    _updateLinearDamping() {
        this._updateAngularDamping();
    }

    _updateLinearFactor() {
        if (this._type === BODYTYPE_DYNAMIC) {
            if (this._rigidBody) {
                _ammoVec1.setValue(this._linearFactor.x, this._linearFactor.y, this._linearFactor.z);
                this._rigidBody.setLinearFactor(_ammoVec1);
            } else if (this._multibodyLinkCollider) {
                throw new Error("not implemented / not exists");
            }
        }
    }

    /**
     * Defines the speed of the body in a given direction.
     *
     * @type {Vec3}
     */
    set linearVelocity(velocity) {
        if (this._type !== BODYTYPE_DYNAMIC)
            throw new Error("cannot set velocity for non-dynamic objects");

        if (this._rigidBody) {
            this._rigidBody.activate();

            _ammoVec1.setValue(velocity.x, velocity.y, velocity.z);
            this._rigidBody.setLinearVelocity(_ammoVec1);
        } else if (this._multibodyLinkCollider) {
            throw new Error("not implemented / not exists");
            // research btMultiBody::setJointVel
        }
    }

    get linearVelocity() {
        if (this._type !== BODYTYPE_DYNAMIC)
            throw new Error("cannot set velocity for non-dynamic objects");

        if (this._rigidBody) {
            const velocity = this._rigidBody.getLinearVelocity();
            this._linearVelocity.set(velocity.x(), velocity.y(), velocity.z());
        } else if (this._multibodyLinkCollider) {
            throw new Error("not implemented / not exists");
            // research btMultiBody::setJointVel
        }

        return this._linearVelocity;
    }

    _updateMass() {
        if (this.body && this._type === BODYTYPE_DYNAMIC) {
            const enabled = this.enabled && this.entity.enabled;
            if (enabled) {
                this.disableSimulation();
            }

            // calculateLocalInertia writes local inertia to ammoVec1 here...
            this.body.getCollisionShape().calculateLocalInertia(this._mass, _ammoVec1);
            // ...and then writes the calculated local inertia to the body
            if (this._rigidBody) {
                this._rigidBody.setMassProps(this._mass, _ammoVec1);
                this._rigidBody.updateInertiaTensor();
            } else if (this._multibodyLinkCollider) {
                if (this.entity.multibody.linkIndex === -1) {
                    this.entity.multibody.multibody.setBaseMass(this._mass);
                    this.entity.multibody.multibody.setBaseInertia(_ammoVec1);
                } else {
                    this.entity.multibody.link.set_m_mass(this._mass);
                    this.entity.multibody.link.set_m_inertiaLocal(_ammoVec1);
                }
            }

            if (enabled) {
                this.enableSimulation();
            }
        }
    }

    _updateRestitution() {
        if (this.body) {
            this.body.setRestitution(this._restitution);
        }
    }

    _updateRollingFriction() {
        if (this.body) {
            this.body.setRollingFriction(this._rollingFriction);
        }
    }

    _updateSpinningFriction() {
        if (this.body) {
            this.body.setSpinningFriction(this._spinningFriction);
        }
    }

    _updateContactStiffness() {
        if (this.body) {
            this.body.setContactStiffnessAndDamping(this._contactStiffness, this._contactDamping);
        }
    }

    _updateContactDamping() {
        this._updateContactStiffness();
    }

    get hasBody() {
        return this.body !== null;
    }

    /**
     * Destroys the existing body and creates new physics body
     *
     * @param {*} shape - shape from collision component
     * @protected
     */
    _createBodyBackend(shape) {
        const system = /** @type {import('../../system.js').PhysicsComponentSystem} */ (this.system);
        const backend = /** @type {import('./backend.js').AmmoPhysicsSystemBackend} */ (system.backend);

        if (this.body)
            backend.onRemove(this.entity, this);

        const mass = this._type === BODYTYPE_DYNAMIC ? this._mass : 0;

        this._getEntityTransform(_ammoTransform);

        if (this.entity.multibody?.isInMultibody) {
            /** @type {import('ammojs3').default.btMultiBodyLinkCollider} */
            const collider = backend.createMultiBodyLinkCollider(mass, shape, _ammoTransform, this.entity.multibody);
            this._multibodyLinkCollider = collider;
        } else {
            /** @type {import('ammojs3').default.btRigidBody} */
            const body = backend.createRigidBody(mass, shape, _ammoTransform);

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

        const obj = /** @type {NonNullable<typeof this.body>} */ (this.body);
        obj.setRestitution(this._restitution);
        obj.setFriction(this._friction);
        obj.setRollingFriction(this._rollingFriction);
        obj.setSpinningFriction(this._spinningFriction);
        obj.setContactStiffnessAndDamping(this._contactStiffness, this._contactDamping);
        obj.entity = this.entity;

        if (this._type === BODYTYPE_KINEMATIC) {
            obj.setCollisionFlags(obj.getCollisionFlags() | AMMO_BODYFLAG_KINEMATIC_OBJECT);
            obj.setActivationState(AMMO_BODYSTATE_DISABLE_DEACTIVATION);
        }
    }

    /**
     * Returns true if the physics body is currently actively being simulated. I.e. Not 'sleeping'.
     *
     * @returns {boolean} True if the body is active.
     */
    isActive() {
        return this.body?.isActive() ?? false;
    }

    /**
     * Forcibly activate the physics body simulation. Only affects physics bodies of type
     * {@link BODYTYPE_DYNAMIC}.
     */
    activate() {
        if (this.body) {
            this.body.activate();
        }
    }

    /**
     * Add a body to the simulation.
     *
     * @protected
     */
    _enableSimulationBackend() {
        const obj = this.body;
        const system = /** @type {import('../../system.js').PhysicsComponentSystem} */ (this.system);
        const backend = /** @type {import('./backend.js').AmmoPhysicsSystemBackend} */ (system.backend);

        if (this._rigidBody) {
            backend.addRigidBody(this._rigidBody, this._group, this._mask);
        } else if (this._multibodyLinkCollider) {
            backend.addMultiBodyLinkCollider(this._multibodyLinkCollider, this._group, this._mask);
        }

        switch (this._type) {
            case BODYTYPE_DYNAMIC:
                system._dynamic.push(this);
                obj.forceActivationState(AMMO_BODYSTATE_ACTIVE_TAG);
                this.syncEntityToBody();
                break;
            case BODYTYPE_KINEMATIC:
                system._kinematic.push(this);
                obj.forceActivationState(AMMO_BODYSTATE_DISABLE_DEACTIVATION);
                break;
            case BODYTYPE_STATIC:
                obj.forceActivationState(AMMO_BODYSTATE_ACTIVE_TAG);
                this.syncEntityToBody();
                break;
        }

        if (this.entity.collision.type === 'compound') {
            system._compounds.push(this.entity.collision);
        }

        obj.activate();
    }

    /**
     * Remove a body from the simulation.
     *
     * @protected
     */
    _disableSimulationBackend() {
        const obj = this.body;

        const system = /** @type {import('../../system').PhysicsComponentSystem} */ (this.system);
        const backend = /** @type {import('./backend.js').AmmoPhysicsSystemBackend} */ (system.backend);

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
            backend.removeRigidBody(obj);
        } else if (this._multibodyLinkCollider) {
            backend.removeMultiBodyLinkCollider(obj);
        }

        // set activation state to disable simulation to avoid body.isActive() to return
        // true even if it's not in the dynamics world
        obj.forceActivationState(AMMO_BODYSTATE_DISABLE_SIMULATION);
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
        const obj = this.body;
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
     * entity.physics.applyTorque(torque);
     * @example
     * // Apply via numbers
     * entity.physics.applyTorque(0, 10, 0);
     */
    applyTorque(x, y, z) {
        const obj = this.body;
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
     */
    applyImpulse(x, y, z, px, py, pz) {
        const obj = this.body;
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
     * entity.physics.applyTorqueImpulse(torque);
     * @example
     * // Apply via numbers
     * entity.physics.applyTorqueImpulse(0, 10, 0);
     */
    applyTorqueImpulse(x, y, z) {
        const obj = this.body;
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
     * @protected
     */
    syncEntityToBody() {
        const obj = this.body;
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
     * @protected
     */
    _updateDynamic() {
        const body = this.body;
        const entity = this.entity;

        // If a dynamic body is frozen, we can assume its motion state transform is
        // the same is the entity world transform
        if (body.isActive() || entity._wasDirty) {
            if (entity._wasDirty) {
                // Warn the user about setting transform instead of using teleport function
                Debug.warn('Cannot set rigid body transform from entity. Use entity.physics#teleport instead.');
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
     * @protected
     */
    _updateKinematic() {
        this._getEntityTransform(_ammoTransform);
        if (this._rigidBody) {
            this._rigidBody.getMotionState().setWorldTransform(_ammoTransform);
        } else {
            this._multibodyLinkCollider.setWorldTransform(_ammoTransform);
        }
    }
}

export { AmmoPhysicsComponent };
