import { Debug } from '../../../core/debug.js';

import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec2 } from '../../../core/math/vec2.js';

import { Component } from '../component.js';

import { MOTION_LOCKED, JOINT_TYPE_6DOF, MOTOR_OFF, MOTOR_TARGET_POSITION, MOTOR_TARGET_VELOCITY } from './constants.js';

/**
 * @template T paired types
 */
class LinearAngularPair {
    /**
     * Constructs a new linear angular pair
     * @param {JointComponent} joint - The joint component to trigger updates to
     * @param {T} linear - Linear element
     * @param {T} angular - Angular element
     */
    constructor(joint, linear, angular) {
        this._joint = joint;
        this._linear = linear;
        this._angular = angular;
    }

    set linear(linear) {
        this._linear = linear;
        this._joint._updateLinear();
    }

    get linear() {
        return this._linear;
    }

    set angular(angular) {
        this._angular = angular;
        this._joint._updateAngular();
    }

    get angular() {
        return this._angular;
    }

    update() {
        this._joint._updateAngular();
        this._joint._updateLinear();
    }
}

/**
 * @template T
 */
class ObservedXYZ {
    /**
     * Constructs an observed XYZ vector
     * @param {() => void} update - update callback
     * @param {T} x - x component
     * @param {T} y - y component
     * @param {T} z - z component
     */
    constructor(update, x, y, z) {
        this._update = update;
        this._x = x;
        this._y = y;
        this._z = z;
    }

    set x(x) {
        this._x = x;
        this._update();
    }

    get x() {
        return this._x;
    }

    set y(y) {
        this._y = y;
        this._update();
    }

    get y() {
        return this._y;
    }

    set z(z) {
        this._z = z;
        this._update();
    }

    get z() {
        return this._z;
    }

    update() {
        this._update();
    }
}

/**
 * @template T
 * @augments {LinearAngularPair<ObservedXYZ<T>>}
 */
class LinearAngularXYZPair extends LinearAngularPair {
    /**
     * Constructs a linear angular pair of observed XYZ vectors.
     * @param {JointComponent} joint - joint component for update callbacks
     * @param {{ x: T, y: T, z: T }} linear - initial linear components
     * @param {{ x: T, y: T, z: T }} angular - initial angular components
     */
    constructor(joint, { x: lx, y: ly, z: lz }, { x: ax, y: ay, z: az }) {
        const update = () => this.update();
        super(joint, new ObservedXYZ(update, lx, ly, lz), new ObservedXYZ(update, ax, ay, az));
    }
}

class JointMotor {
    set target(target) {
        if (this._target === target)
            return;

        this._target = target;
        if (target === undefined)
            this._mode = MOTOR_OFF;
        this.update();
    }

    /**
     * The position or velocity the motor should target.
     *
     * If given `undefined`, the motor will turn off.
     * If given a value, it will update the motor unless the motor is not
     * turned on.
     *
     * Can be `undefined` when the motor is turned off; setting to `undefined`
     * will turn off the motor.
     *
     * @type {number|Vec3|Quat|undefined}
     */
    get target() {
        return this._target;
    }

    set mode(mode) {
        if (this._mode === mode)
            return;

        this._mode = mode;
        this.update();
    }

    /**
     * The motor mode.
     *
     * @type {import('./constants.js').JointMotorMode}
     */
    get mode() {
        return this._mode;
    }

    set maxImpulse(maxImpulse) {
        if (this._maxImpulse === maxImpulse)
            return;

        this._maxImpulse = maxImpulse;
        this.update();
    }

    get maxImpulse() {
        return this._maxImpulse;
    }

    set targetPosition(target) {
        if (target === undefined) {
            this._target = undefined;
            this._mode = MOTOR_OFF;
        } else {
            this._target = target;
            this.mode = MOTOR_TARGET_POSITION;
        }

        this.update();
    }

    /**
     * The target position or `undefined` if the motor is not in position mode.
     *
     * @type {number|Vec3|Quat|undefined}
     */
    get targetPosition() {
        if (this._mode === MOTOR_TARGET_POSITION)
            return this._target;
        return undefined;
    }

    set targetVelocity(target) {
        if (target === undefined) {
            this._target = undefined;
            this._mode = MOTOR_OFF;
        } else {
            this._target = target;
            this.mode = MOTOR_TARGET_VELOCITY;
        }

        this.update();
    }

    /**
     * The target position or `undefined` if the motor is not in velocity mode.
     *
     * @type {number|Vec3|Quat|undefined}
     */
    get targetVelocity() {
        if (this._mode === MOTOR_TARGET_VELOCITY)
            return this._target;
        return undefined;
    }

    /**
     * Constructs a joint motor
     *
     * @param {() => void} update - update callback
     */
    constructor(update) {
        /** @private */
        this.update = update;

        /**
         * @private
         * @type {import('./constants.js').JointMotorMode}
         */
        this._mode = "off";

        /**
         * @private
         * @type {number|Vec3|Quat|undefined}
         */
        this._target = undefined;

        /**
         * @private
         * @type {number|undefined}
         */
        this._maxImpulse = undefined;
    }
}

/**
 * The JointComponent adds a physics joint constraint linking two physics bodies.
 *
 * TODO: add example
 *
 * @augments Component
 * @ignore
 */
class JointComponent extends Component {
    /**
     * Create a new JointComponent instance.
     *
     * @param {import('./system.js').JointComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
     * attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        Debug.assert(typeof Ammo !== 'undefined', 'ERROR: Attempting to create a pc.JointComponent but Ammo.js is not loaded');

        /** @type {import('ammojs3').default.btTypedConstraint|null} */
        this._rigidBodyConstraint = null;
        /** @type {import('ammojs3').default.btMultiBodyConstraint|null} */
        this._multiBodyLimitConstraint = null;
        /** @type {import('ammojs3').default.btMultiBodyConstraint|null} */
        this._multiBodyMotorConstraint = null;

        /** @type {import('./constants.js').JointType} */
        this._type = JOINT_TYPE_6DOF;
        /** @type {boolean} */
        this._isForMultibodyLink = false;
        /** @type {boolean} */
        this._skipMultiBodyChance = false;
        /** @type {boolean} */
        this._enableMultiBodyComponents = false;

        /** @type {boolean} */
        this._tmp_skipMultiBodyChance = false;
        /** @type {boolean} */
        this._isSettingConstraints = false;

        /** @type {import('../../../scene/graph-node.js').GraphNode|null} */
        this._componentA = null;
        /** @type {import('../../../scene/graph-node.js').GraphNode|null} */
        this._componentB = null;
        /** @type {import('../../entity.js').Entity|null} */
        this._entityA = null;
        /** @type {import('../../entity.js').Entity|null} */
        this._entityB = null;
        /** @type {number} */
        this._breakForce = 3.4e+38;
        /** @type {boolean} */
        this._enableCollision = true;

        this._motor = new JointMotor(this._updateMotor.bind(this));
        /** @type {LinearAngularXYZPair<import('./constants.js').JointMotion>} */
        this._motion = new LinearAngularXYZPair(this, { x: MOTION_LOCKED, y: MOTION_LOCKED, z: MOTION_LOCKED }, { x: MOTION_LOCKED, y: MOTION_LOCKED, z: MOTION_LOCKED });
        /** @type {LinearAngularXYZPair<Vec2>} */
        this._limits = new LinearAngularXYZPair(this, { x: new Vec2(), y: new Vec2(), z: new Vec2() }, { x: new Vec2(), y: new Vec2(), z: new Vec2() });
        /** @type {LinearAngularXYZPair<boolean>} */
        this._springs = new LinearAngularXYZPair(this, { x: false, y: false, z: false }, { x: false, y: false, z: false });
        /** @type {LinearAngularXYZPair<number>} */
        this._stiffness = new LinearAngularXYZPair(this, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
        /** @type {LinearAngularXYZPair<number>} */
        this._damping = new LinearAngularXYZPair(this, { x: 0.1, y: 0.1, z: 0.1 }, { x: 0.1, y: 0.1, z: 0.1 });
        /** @type {LinearAngularXYZPair<number>} */
        this._equilibrium = new LinearAngularXYZPair(this, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });

        this.on('beforeremove', this._onBeforeRemove, this);
        this.on('remove', this._onRemove, this);
        this.on('set_enabled', this._onSetEnabled, this);
    }

    get motor() {
        return this._motor;
    }

    /**
     * @type {import('./constants.js').LinearAngularPair<import('./constants.js').XYZ<import('./constants.js').JointMotion>>}
     */
    get motion() {
        return this._motion;
    }

    /**
     * @type {import('./constants.js').LinearAngularPair<import('./constants.js').XYZ<Vec2>>}
     */
    get limits() {
        return this._limits;
    }

    /**
     * @type {import('./constants.js').LinearAngularPair<import('./constants.js').XYZ<boolean>>}
     */
    get springs() {
        return this._springs;
    }

    /**
     * @type {import('./constants.js').LinearAngularPair<import('./constants.js').XYZ<number>>}
     */
    get stiffness() {
        return this._stiffness;
    }

    /**
     * @type {import('./constants.js').LinearAngularPair<import('./constants.js').XYZ<number>>}
     */
    get damping() {
        return this._damping;
    }

    /**
     * @type {import('./constants.js').LinearAngularPair<import('./constants.js').XYZ<number>>}
     */
    get equilibrium() {
        return this._equilibrium;
    }

    set rigidBodyConstraint(constraint) {
        if (!this._isSettingConstraints)
            throw new Error("cannot be changed");

        if (constraint === this._rigidBodyConstraint)
            return;

        const app = this.system.app;
        const dynamicsWorld = app.systems.physics.dynamicsWorld;

        if (this._rigidBodyConstraint) {
            dynamicsWorld.removeConstraint(this._rigidBodyConstraint);
            Ammo.destroy(this._rigidBodyConstraint);
        }

        if (this.enabled && constraint) {
            dynamicsWorld.addConstraint(constraint, this._enableCollision);
        }

        this._rigidBodyConstraint = constraint;
    }

    get rigidBodyConstraint() {
        return this._rigidBodyConstraint;
    }

    set multiBodyLimitConstraint(constraint) {
        if (!this._isSettingConstraints)
            throw new Error("cannot be changed");

        if (constraint === this._multiBodyLimitConstraint)
            return;

        const app = this.system.app;
        const dynamicsWorld = app.systems.physics.dynamicsWorld;

        if (this._multiBodyLimitConstraint) {
            dynamicsWorld.removeMultiBodyConstraint(this._multiBodyLimitConstraint);
            Ammo.destroy(this._multiBodyLimitConstraint);
        }

        if (this.enabled && constraint) {
            dynamicsWorld.addMultiBodyConstraint(constraint);
        }

        this._multiBodyLimitConstraint = constraint;
    }

    get multiBodyLimitConstraint() {
        return this._multiBodyLimitConstraint;
    }

    set multiBodyMotorConstraint(constraint) {
        if (!this._isSettingConstraints)
            throw new Error("cannot be changed");

        if (constraint === this._multiBodyMotorConstraint)
            return;

        const app = this.system.app;
        const dynamicsWorld = app.systems.physics.dynamicsWorld;

        if (this._multiBodyMotorConstraint) {
            dynamicsWorld.removeMultiBodyConstraint(this._multiBodyMotorConstraint);
            Ammo.destroy(this._multiBodyMotorConstraint);
        }

        if (this.enabled && constraint) {
            dynamicsWorld.addMultiBodyConstraint(constraint);
        }

        this._multiBodyMotorConstraint = constraint;
    }

    get multiBodyMotorConstraint() {
        return this._multiBodyMotorConstraint;
    }

    set type(type) {
        if (this._type !== type) {
            this._destroyConstraint(undefined);
            this._type = type;
            this._createConstraint(undefined);
        }
    }

    get type() {
        return this._type;
    }

    get isForMultibodyLink() {
        return this._isForMultibodyLink;
    }

    /**
     * Whether or not this joint would skip the chance to make a multibody link.
     *
     * @type {boolean}
     */
    set skipMultiBodyChance(skip) {
        if (this._skipMultiBodyChance !== skip && this.entityA?.multibody?.couldBeInMultibody) {
            this._destroyConstraint(undefined);
            this._createConstraint(undefined);
        }

        this._skipMultiBodyChance = skip;
    }

    get skipMultiBodyChance() {
        return this._skipMultiBodyChance;
    }

    set enableMultiBodyComponents(enableMultiBodyComponents) {
        const enabled = (enableMultiBodyComponents && !this._enableMultiBodyComponents);

        this._enableMultiBodyComponents = enableMultiBodyComponents;

        if (enabled && (((!(this.entityA?.multibody.enabled)) ?? false) || ((!(this.entityB?.multibody.enabled)) ?? false))) {
            this._destroyConstraint(undefined);
            if (this._entityA?.multibody)
                this.entityA.multibody.enabled = true;
            if (this._entityB?.multibody)
                this.entityB.multibody.enabled = true;
            this._createConstraint(undefined);
        }
    }

    /**
     * If this joint should enable {@link MultibodyComponent}'s in
     * {@link entityA} and {@link entityB} if they weren't already added and
     * enabled. If this is false, then {@link MultibodyComponent}'s will still
     * be added to {@link entityA} and {@link entityB} if they weren't already
     * added, but they must be enabled separately to use multibody joints.
     *
     * Defaults to false.
     *
     * @type {boolean}
     */
    get enableMultiBodyComponents() {
        return this._enableMultiBodyComponents;
    }

    set entityA(entity) {
        if (entity !== null && !(this._componentA === entity || this._componentA?.isDescendantOf(entity))) {
            this._componentA = entity;
        }

        this._destroyConstraint(undefined);

        const changedEntity = (this._entityA !== entity);
        if (changedEntity) {
            this._removeMultiBodyEventHandlers();
        }

        this._entityA = entity;
        if (changedEntity) {
            this._addMultiBodyEventHandlers();
        }
        this._createConstraint(undefined);
    }

    /**
     * The first entity in this constraint.
     *
     * This is {@link componentA} or its nearest parent entity that has a
     * {@link PhysicsComponent}.
     *
     * @type {import('../../entity.js').Entity|null}
     */
    get entityA() {
        return this._entityA;
    }

    set componentA(node) {
        if (this._componentA === node) return;
        this._componentA = node;
        this.entityA = node ? this._nearestEntity(node) : null;
    }

    /**
     * The first graph node in this constraint.
     *
     * If a graph node is specified or an entity that does not have a
     * {@link PhysicsComponent}, then the closest entity parent with a
     * {@link PhysicsComponent} will be used, preserving the relative
     * transform.
     *
     * If {@link isForMultibodyLink} is true, then this node will be the child
     * multibody link.
     *
     * @type {import('../../../scene/graph-node.js').GraphNode|null}
     */
    get componentA() {
        return this._componentA;
    }

    set entityB(entity) {
        if (entity !== null && !(this._componentB === entity || this._componentB?.isDescendantOf(entity))) {
            this._componentB = entity;
        }

        this._destroyConstraint(undefined);

        this._entityB = entity;

        if (this._entityB && !(this._entityB.multibody?.enabled ?? false) && !this._skipMultiBodyChance) {
            if (!this._entityB.multibody)
                this._entityB.addComponent('multibody', { enabled: false });
            this._entityB.multibody.enabled ||= this._enableMultiBodyComponents;
        }

        this._createConstraint(undefined);
    }

    /**
     * The second entity in this constraint.
     *
     * This is {@link componentB} or its nearest parent entity that has a
     * {@link PhysicsComponent}.
     *
     * @type {import('../../entity.js').Entity|null}
     */
    get entityB() {
        return this._entityB;
    }

    set componentB(node) {
        if (this._componentB === node) return;
        this._componentB = node;
        this.entityB = node ? this._nearestEntity(node) : null;
    }

    /**
     * The second graph node in this constraint.
     *
     * If a graph node is specified or an entity that does not have a
     * {@link PhysicsComponent}, then the closest entity parent with a
     * {@link PhysicsComponent} will be used, preserving the relative
     * transform.
     *
     * If {@link isForMultibodyLink} is true, then this node will be the parent
     * multibody link.
     *
     * @type {import('../../../scene/graph-node.js').GraphNode|null}
     */
    get componentB() {
        return this._componentB;
    }

    set breakForce(force) {
        if (this._breakForce !== force) {
            this._breakForce = force;
            this._updateOther();
        }
    }

    get breakForce() {
        return this._breakForce;
    }

    set enableCollision(enableCollision) {
        this._destroyConstraint(undefined);
        this._enableCollision = enableCollision;
        this._createConstraint(undefined);
    }

    get enableCollision() {
        return this._enableCollision;
    }

    /**
     * Returns the nearest entity with a {@link PhysicsComponent}
     *
     * @private
     * @param {import('../../../scene/graph-node.js').GraphNode} node - the
     * node to begin search from
     * @returns {import('../../entity.js').Entity|null} - The nearest entity
     * with physics from the node
     */
    _nearestEntity(node) {
        /** @type {import('../../entity.js').Entity} */
        let entity;
        const root = this.entity.root;
        for (; node !== root; node = /** @type {typeof node} */ (node.parent)) {
            entity = /** @type {typeof entity} */ (/** @type {unknown} */ (node));
            if (entity.physics) {
                return entity;
            }
        }

        return null;
    }

    /**
     * Converts a PlayCanvas transform into an ammo/bullet transform.
     * @private
     * @param {import('../../../core/math/mat4.js').Mat4} pcTransform - the PlayCanvas mat4 transform to convert
     * @param {import('ammojs3').default.btTransform} ammoTransform - the Ammo/Bullet transform to copy into
     */
    _convertTransform(pcTransform, ammoTransform) {
        const pos = pcTransform.getTranslation();
        const rot = new Quat();
        rot.setFromMat4(pcTransform);

        const ammoVec = new Ammo.btVector3(pos.x, pos.y, pos.z);
        const ammoQuat = new Ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w);

        ammoTransform.setOrigin(ammoVec);
        ammoTransform.setRotation(ammoQuat);

        Ammo.destroy(ammoVec);
        Ammo.destroy(ammoQuat);
    }

    /** @private */
    _updateAngular() {
        if (!this.enabled || !this.entityA) {
            return;
        }

        this._isSettingConstraints = true;
        this.system.updateAngularParameters(this);
        this._isSettingConstraints = false;
    }

    /** @private */
    _updateLinear() {
        if (!this.enabled || !this.entityA) {
            return;
        }

        this._isSettingConstraints = true;
        this.system.updateLinearParameters(this);
        this._isSettingConstraints = false;
    }

    /** @private */
    _updateOther() {
        if (!this.enabled || !this.entityA) {
            return;
        }

        this._isSettingConstraints = true;
        this.system.updateOtherParameters(this);
        this._isSettingConstraints = false;
    }

    /** @private */
    _updateMotor() {
        if (!this.enabled || !this.entityA) {
            return;
        }

        this._isSettingConstraints = true;
        this.system.updateMotor(this, this.motor.mode, this.motor.target, this.motor.maxImpulse);
        this._isSettingConstraints = false;
    }

    /**
     * @private
     * @param {import('../multibody/system.js').MultiBodySetup|undefined} multiBodySetup
     * - The multibody setup this joint can be part of
     */
    _createConstraint(multiBodySetup) {
        if (!this.enabled) return;

        const _isForMultibodyLink = !this._skipMultiBodyChance &&
            (this._entityA?.multibody?.couldBeInMultibody ?? false) &&
            (this._entityB && (this._entityB.multibody?.couldBeInMultibody ?? true));

        if (_isForMultibodyLink) {
            if (this._tmp_skipMultiBodyChance)
                return;

            if (!(this._entityA.isDescendantOf(this._entityB)))
                throw new Error("entityA must be descendant of entityB for multibody joints");

            if (!multiBodySetup) {
                // If this joint is making a multibody link, then this method should be called from the multibody's setup event
                this.entityA.multibody.createBody();
                return;
            }
        }

        this._isForMultibodyLink = _isForMultibodyLink;

        if (this._entityA?.physics) {
            const mat = new Mat4();

            this._entityA.physics.activate();

            const world_joint = this.entity.getWorldTransform();

            const world_A = this._entityA.getWorldTransform();
            const world_A_inv = world_A.clone().invert();
            mat.mul2(world_A_inv, world_joint);

            const frameA = new Ammo.btTransform();
            const frameB = new Ammo.btTransform();

            this._convertTransform(mat, frameA);

            if (this._entityB?.physics) {
                this._entityB.physics.activate();

                const world_B = this._entityB.getWorldTransform();
                const world_B_inv = world_B.clone().invert();
                mat.mul2(world_B_inv, world_joint);

                this._convertTransform(mat, frameB);
            }

            this._isSettingConstraints = true;
            this.system.createJoint(this._entityA, this._entityB, this, frameA, frameB);
            this._isSettingConstraints = false;

            Ammo.destroy(frameB);
            Ammo.destroy(frameA);

            this._updateAngular();
            this._updateLinear();
            this._updateOther();
            this._updateMotor();
        }
    }

    /**
     * @private
     * @param {import('../multibody/system.js').MultiBodySetup|undefined} multiBodySetup
     */
    _destroyConstraint(multiBodySetup) {
        if (this._isForMultibodyLink && !multiBodySetup) {
            // If this joint is making a multibody link, then this method should be called from the multibody's unsetup event
            this._tmp_skipMultiBodyChance = true;
            // ?
            // should this be destroyBody() ?
            this.entityA.multibody.createBody();
            this._tmp_skipMultiBodyChance = false;
            return;
        }

        this._isSettingConstraints = true;
        this.rigidBodyConstraint = null;
        this.multiBodyMotorConstraint = null;
        this.multiBodyLimitConstraint = null;
        this._isSettingConstraints = false;

        this._isForMultibodyLink = false;
    }

    /**
     * @private
     * @param {Partial<import('./data.js').JointComponentData>} data
     */
    _initFromData(data) {
        if (data.type)
            this._type = data.type;

        if (data.motion) {
            this._motion._linear._x = data.motion.linear.x;
            this._motion._linear._y = data.motion.linear.y;
            this._motion._linear._z = data.motion.linear.z;
            this._motion._angular._x = data.motion.angular.x;
            this._motion._angular._y = data.motion.angular.y;
            this._motion._angular._z = data.motion.angular.z;
        }

        if (data.limits) {
            this._limits._linear._x = data.limits.linear.x;
            this._limits._linear._y = data.limits.linear.y;
            this._limits._linear._z = data.limits.linear.z;
            this._limits._angular._x = data.limits.angular.x;
            this._limits._angular._y = data.limits.angular.y;
            this._limits._angular._z = data.limits.angular.z;
        }

        if (data.springs) {
            this._springs._linear._x = data.springs.linear.x;
            this._springs._linear._y = data.springs.linear.y;
            this._springs._linear._z = data.springs.linear.z;
            this._springs._angular._x = data.springs.angular.x;
            this._springs._angular._y = data.springs.angular.y;
            this._springs._angular._z = data.springs.angular.z;
        }

        if (data.stiffness) {
            this._stiffness._linear.x = data.stiffness.linear.x;
            this._stiffness._linear.y = data.stiffness.linear.y;
            this._stiffness._linear.z = data.stiffness.linear.z;
            this._stiffness._angular.x = data.stiffness.angular.x;
            this._stiffness._angular.y = data.stiffness.angular.y;
            this._stiffness._angular.z = data.stiffness.angular.z;
        }

        if (data.damping) {
            this._damping._linear.x = data.damping.linear.x;
            this._damping._linear.y = data.damping.linear.y;
            this._damping._linear.z = data.damping.linear.z;
            this._damping._angular.x = data.damping.angular.x;
            this._damping._angular.y = data.damping.angular.y;
            this._damping._angular.z = data.damping.angular.z;
        }

        if (data.equilibrium) {
            this._equilibrium._linear.x = data.equilibrium.linear.x;
            this._equilibrium._linear.y = data.equilibrium.linear.y;
            this._equilibrium._linear.z = data.equilibrium.linear.z;
            this._equilibrium._angular.x = data.equilibrium.angular.x;
            this._equilibrium._angular.y = data.equilibrium.angular.y;
            this._equilibrium._angular.z = data.equilibrium.angular.z;
        }

        if (data.breakForce !== undefined)
            this._breakForce = data.breakForce;

        if (data.enableCollision !== undefined)
            this._enableCollision = data.enableCollision;

        if (data.skipMultiBodyChance !== undefined)
            this._skipMultiBodyChance = data.skipMultiBodyChance;

        if (data.enableMultiBodyComponents !== undefined)
            this._enableMultiBodyComponents = data.enableMultiBodyComponents;
    }

    onEnable() {
        this._createConstraint(undefined);
    }

    onDisable() {
        this._destroyConstraint(undefined);
    }

    _onSetEnabled(prop, old, value) {
    }

    _onBeforeRemove() {
        this.fire('remove');
    }

    _onRemove() {
        this._destroyConstraint(undefined);
    }

    /**
     * @private
     */
    _addMultiBodyEventHandlers() {
        if (!this._entityA) return;

        if (!(this._entityA.multibody?.enabled ?? false) && !this._skipMultiBodyChance) {
            if (!this._entityA.multibody)
                this._entityA.addComponent('multibody', { enabled: false });
            this._entityA.multibody.enabled ||= this._enableMultiBodyComponents;
        }

        this._entityA.multibody.on('beforeSetup', this._entityA_multibody_beforeSetup, this);
        this._entityA.multibody.on('setup', this._createConstraint, this);
        this._entityA.multibody.on('unsetup', this._destroyConstraint, this);
    }

    /**
     * @private
     */
    _removeMultiBodyEventHandlers() {
        if (!this._entityA) return;

        this._entityA.multibody?.off('beforeSetup', this._entityA_multibody_beforeSetup, this);
        this._entityA.multibody?.off('setup', this._createConstraint, this);
        this._entityA.multibody?.off('unsetup', this._destroyConstraint, this);
    }

    /**
     * Event handler for entityA.multibody:beforeSetup.
     *
     * @private
     * @param {import('../multibody/system.js').MultiBodySetup} multibodySetup - The multibody setup for the eligibility check
     */
    _entityA_multibody_beforeSetup(multibodySetup) {
        multibodySetup.links.push(this.entityA);
    }
}

export { JointComponent, JointMotor };
