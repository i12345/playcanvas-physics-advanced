import { Debug } from '../../../core/debug.js';

import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';

import { Component } from '../component.js';

import { MOTION_LOCKED, JOINT_TYPE_6DOF } from './constants.js';

/**
 * @template T paired types
 */
export class LinearAngularPair {
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
export class ObservedXYZ {
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

    /**
     * Sets this ObservedXYZ to a given Vec3
     *
     * @param {Vec3} src - the Vec3 to set this ObservedXYZ
     * @returns {void}
     */
    copy(src) {
        this._x = src.x;
        this._y = src.y;
        this._z = src.z;
        this._update();
    }
}

/**
 * @template T
 * @augments {LinearAngularPair<ObservedXYZ<T>>}
 */
export class LinearAngularXYZPair extends LinearAngularPair {
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

/**
 * The JointComponent adds a physics joint constraint linking two physics bodies.
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

        /** @type {LinearAngularXYZPair<import('./constants.js').JointMotion>} */
        this._motion = new LinearAngularXYZPair(this, { x: MOTION_LOCKED, y: MOTION_LOCKED, z: MOTION_LOCKED }, { x: MOTION_LOCKED, y: MOTION_LOCKED, z: MOTION_LOCKED });
        /** @type {LinearAngularXYZPair<Vec2>} */
        this._limits = new LinearAngularXYZPair(this, { x: new Vec2(), y: new Vec2(), z: new Vec2() }, { x: new Vec2(), y: new Vec2(), z: new Vec2() });
        /** @type {LinearAngularXYZPair<boolean>} */
        this._springs = new LinearAngularXYZPair(this, { x: false, y: false, z: false }, { x: false, y: false, z: false });
        /** @type {LinearAngularPair<Vec3>} */
        this._stiffness = new LinearAngularPair(this, new Vec3(0, 0, 0), new Vec3(0, 0, 0));
        /** @type {LinearAngularPair<Vec3>} */
        this._damping = new LinearAngularPair(this, new Vec3(0.1, 0.1, 0.1), new Vec3(0.1, 0.1, 0.1));
        /** @type {LinearAngularPair<Vec3>} */
        this._equilibrium = new LinearAngularPair(this, new Vec3(0, 0, 0), new Vec3(0, 0, 0));

        this.on('beforeremove', this._onBeforeRemove, this);
        this.on('remove', this._onRemove, this);
        this.on('set_enabled', this._onSetEnabled, this);
    }

    get motion() {
        return this._motion;
    }

    get limits() {
        return this._limits;
    }

    get springs() {
        return this._springs;
    }

    get stiffness() {
        return this._stiffness;
    }

    get damping() {
        return this._damping;
    }

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

    set entityA(entity) {
        if (entity !== null && !(this._componentA === entity || this._componentA?.isDescendantOf(entity))) {
            this._componentA = entity;
        }

        this._destroyConstraint(undefined);

        const changedEntity = (this._entityA === entity);
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

    /**
     * @private
     * @param {import('../multibody/system.js').MultiBodySetup|undefined} multiBodySetup
     * - The multibody setup this joint can be part of
     */
    _createConstraint(multiBodySetup) {
        if (!this.enabled) return;

        const _isForMultibodyLink = !this._skipMultiBodyChance && (this._entityA?.multibody?.couldBeInMultibody ?? false);

        if (_isForMultibodyLink) {
            if (!multiBodySetup) {
                // If this joint is making a multibody link, then this method should be called from the multibody's setup event
                this.entityA.multibody.createBody();
                return;
            } else if (this._tmp_skipMultiBodyChance) {
                return;
            } else if (!(this._entityA.isDescendantOf(this._entityB))) {
                throw new Error("entityA must be descendant of entityB for multibody joints");
            }
        }

        this._isForMultibodyLink = _isForMultibodyLink;

        if (this._entityA?.physics) {
            const mat = new Mat4();

            this._entityA.physics.activate();

            const jointWtm = this.entity.getWorldTransform();

            const entityAWtm = this._entityA.getWorldTransform();
            const invEntityAWtm = entityAWtm.clone().invert();
            mat.mul2(invEntityAWtm, jointWtm);

            const frameA = new Ammo.btTransform();
            const frameB = new Ammo.btTransform();

            this._convertTransform(mat, frameA);

            if (this._entityB?.physics) {
                this._entityB.physics.activate();

                const entityBWtm = this._entityB.getWorldTransform();
                const invEntityBWtm = entityBWtm.clone().invert();
                mat.mul2(invEntityBWtm, jointWtm);

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

    initFromData(data) {
        // TODO: implement

        this._createConstraint(undefined);
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
        if (!this._entityA?.multibody) {
            this._entityA?.addComponent('multibody');
        }

        this._entityA?.multibody.on('beforeSetup', this._entityA_multibody_beforeSetup, this);
        this._entityA?.multibody.on('setup', this._createConstraint, this);
        this._entityA?.multibody.on('unsetup', this._destroyConstraint, this);
    }

    /**
     * @private
     */
    _removeMultiBodyEventHandlers() {
        this._entityA?.multibody?.off('beforeSetup', this._entityA_multibody_beforeSetup, this);
        this._entityA?.multibody?.off('setup', this._createConstraint, this);
        this._entityA?.multibody?.off('unsetup', this._destroyConstraint, this);
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

export { JointComponent };
