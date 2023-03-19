import { math } from '../../../core/math/math.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { JointComponent } from './component.js';
import { JOINT_TYPE_6DOF, JOINT_TYPE_FIXED, JOINT_TYPE_HINGE, JOINT_TYPE_INVALID, JOINT_TYPE_SLIDER, JOINT_TYPE_SPHERICAL, MOTION_FREE, MOTION_LIMITED, MOTION_LOCKED } from './constants.js';
import { JointComponentData } from './data.js';

const _schema = ['enabled'];

/** @type {import('ammojs3').default.btVector3} */
let __defaultInertiaVec;

function _defaultInertiaVec() {
    if (__defaultInertiaVec) return __defaultInertiaVec;
    __defaultInertiaVec = new Ammo.btVector3();
    return __defaultInertiaVec;
}

// TODO: implement JointImpl following the pattern of collision/system > CollisionSystemImpl
// to support other joint types with custom properties
class JointImpl {
    /**
     * Makes a new joint between two entities with a mediating joint entity.
     *
     * @param {import('../../entity').Entity} entityA - The first entity of the joint
     * @param {import('../../entity').Entity} entityB - The second entity of the joint
     * @param {JointComponent} joint - The mediating joint component
     * @param {import('ammojs3').default.btTransform} frameA - Transform for entity A relative to joint
     * @param {import('ammojs3').default.btTransform} frameB - Transform for entity B relative to joint
     * @returns {void}
     */
    createJoint(entityA, entityB, joint, frameA, frameB) {
        throw new Error("not implemented");
    }

    /**
     * Updates angular parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update angular parameters for
     */
    updateAngularParameters(joint) {
        throw new Error("not implemented");
    }

    /**
     * Updates linear parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update linear parameters for
     */
    updateLinearParameters(joint) {
        throw new Error("not implemented");
    }

    /**
     * Updates other parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update other parameters for
     */
    updateOtherParameters(joint) {
        throw new Error("not implemented");
    }

    /**
     * Sets the motor for the joint. It can target a certain position or
     * velocity or it can be turned off.
     *
     * @param {JointComponent} joint - The joint to set the motor for
     * @param {'position'|'velocity'|'off'|null} mode - The motor mode.
     * If given `null`, the motor will turn off.
     * @param {number|Vec3|undefined} target - The position or velocity the motor should target
     * @param {number} maxImpulse - The maximum impulse the joint motor should apply
     */
    setMotor(joint, mode, target, maxImpulse) {
        throw new Error("not implemented");
    }
}

class Generic6DofJointImpl extends JointImpl {
    /**
     * Makes a new joint between two entities with a mediating joint entity.
     *
     * @param {import('../../entity').Entity} entityA - The first entity of the joint
     * @param {import('../../entity').Entity} entityB - The second entity of the joint
     * @param {JointComponent} joint - The mediating joint component
     * @param {import('ammojs3').default.btTransform} frameA - Transform for entity A relative to joint
     * @param {import('ammojs3').default.btTransform} frameB - Transform for entity B relative to joint
     * @returns {void}
     */
    createJoint(entityA, entityB, joint, frameA, frameB) {
        if (joint.isForMultibodyLink) {
            throw new Error("not implemented for multibodies");
        } else {
            const constraint =
                entityB ?
                    new Ammo.btGeneric6DofSpringConstraint(entityA.physics.rigidBody, entityB.physics.rigidBody, frameA, frameB, !joint.enableCollision) :
                    new Ammo.btGeneric6DofSpringConstraint(entityA.physics.rigidBody, frameA, !joint.enableCollision);

            joint.rigidBodyConstraint = constraint;
        }
    }

    /**
     * Updates the angular parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update angular parameters for
     */
    updateAngularParameters(joint) {
        const limits_lower = new Vec3();
        const limits_upper = new Vec3();

        if (joint.motion.angular.x === MOTION_LIMITED) {
            limits_lower.x = joint.limits.angular.x.x * math.DEG_TO_RAD;
            limits_upper.x = joint.limits.angular.x.y * math.DEG_TO_RAD;
        } else if (joint.motion.angular.x === MOTION_FREE) {
            limits_lower.x = 1;
            limits_upper.x = 0;
        } else { // MOTION_LOCKED
            limits_lower.x = limits_upper.x = 0;
        }

        if (joint.motion.angular.y === MOTION_LIMITED) {
            limits_lower.y = joint.limits.angular.y.x * math.DEG_TO_RAD;
            limits_upper.y = joint.limits.angular.y.y * math.DEG_TO_RAD;
        } else if (joint.motion.angular.y === MOTION_FREE) {
            limits_lower.y = 1;
            limits_upper.y = 0;
        } else { // MOTION_LOCKED
            limits_lower.y = limits_upper.y = 0;
        }

        if (joint.motion.angular.z === MOTION_LIMITED) {
            limits_lower.z = joint.limits.angular.z.x * math.DEG_TO_RAD;
            limits_upper.z = joint.limits.angular.z.y * math.DEG_TO_RAD;
        } else if (joint.motion.angular.z === MOTION_FREE) {
            limits_lower.z = 1;
            limits_upper.z = 0;
        } else { // MOTION_LOCKED
            limits_lower.z = limits_upper.z = 0;
        }

        if (joint.isForMultibodyLink) {
            throw new Error("not implemented for multibodies");
        } else {
            /** @type {import('ammojs3').default.btGeneric6DofSpringConstraint} */
            const constraint = joint.rigidBodyConstraint;

            const bt_lower = new Ammo.btVector3(limits_lower.x, limits_lower.y, limits_lower.z);
            const bt_upper = new Ammo.btVector3(limits_upper.x, limits_upper.y, limits_upper.z);

            constraint.setAngularLowerLimit(bt_lower);
            constraint.setAngularUpperLimit(bt_upper);

            Ammo.destroy(bt_lower);
            Ammo.destroy(bt_upper);

            constraint.setDamping(3, joint.damping.angular.x);
            constraint.setDamping(4, joint.damping.angular.y);
            constraint.setDamping(5, joint.damping.angular.z);

            constraint.setEquilibriumPoint(3, joint.equilibrium.angular.x);
            constraint.setEquilibriumPoint(4, joint.equilibrium.angular.y);
            constraint.setEquilibriumPoint(5, joint.equilibrium.angular.z);

            constraint.setStiffness(3, joint.stiffness.angular.x);
            constraint.setStiffness(4, joint.stiffness.angular.y);
            constraint.setStiffness(5, joint.stiffness.angular.z);

            constraint.enableSpring(3, joint.springs.angular.x);
            constraint.enableSpring(4, joint.springs.angular.y);
            constraint.enableSpring(5, joint.springs.angular.z);
        }
    }

    /**
     * Updates the linear parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update linear parameters for
     */
    updateLinearParameters(joint) {
        const limits_lower = new Vec3();
        const limits_upper = new Vec3();

        if (joint.motion.linear.x === MOTION_LIMITED) {
            limits_lower.x = joint.limits.linear.x.x * math.DEG_TO_RAD;
            limits_upper.x = joint.limits.linear.x.y * math.DEG_TO_RAD;
        } else if (joint.motion.linear.x === MOTION_FREE) {
            limits_lower.x = 1;
            limits_upper.x = 0;
        } else { // MOTION_LOCKED
            limits_lower.x = limits_upper.x = 0;
        }

        if (joint.motion.linear.y === MOTION_LIMITED) {
            limits_lower.y = joint.limits.linear.y.x * math.DEG_TO_RAD;
            limits_upper.y = joint.limits.linear.y.y * math.DEG_TO_RAD;
        } else if (joint.motion.linear.y === MOTION_FREE) {
            limits_lower.y = 1;
            limits_upper.y = 0;
        } else { // MOTION_LOCKED
            limits_lower.y = limits_upper.y = 0;
        }

        if (joint.motion.linear.z === MOTION_LIMITED) {
            limits_lower.z = joint.limits.linear.z.x * math.DEG_TO_RAD;
            limits_upper.z = joint.limits.linear.z.y * math.DEG_TO_RAD;
        } else if (joint.motion.linear.z === MOTION_FREE) {
            limits_lower.z = 1;
            limits_upper.z = 0;
        } else { // MOTION_LOCKED
            limits_lower.z = limits_upper.z = 0;
        }

        if (joint.isForMultibodyLink) {
            throw new Error("not implemented for multibodies");
        } else {
            /** @type {import('ammojs3').default.btGeneric6DofSpringConstraint} */
            const constraint = joint.rigidBodyConstraint;

            const bt_lower = new Ammo.btVector3(limits_lower.x, limits_lower.y, limits_lower.z);
            const bt_upper = new Ammo.btVector3(limits_upper.x, limits_upper.y, limits_upper.z);

            constraint.setLinearLowerLimit(bt_lower);
            constraint.setLinearUpperLimit(bt_upper);

            Ammo.destroy(bt_lower);
            Ammo.destroy(bt_upper);

            constraint.setDamping(0, joint.damping.linear.x);
            constraint.setDamping(1, joint.damping.linear.y);
            constraint.setDamping(2, joint.damping.linear.z);

            constraint.setEquilibriumPoint(0, joint.equilibrium.linear.x);
            constraint.setEquilibriumPoint(1, joint.equilibrium.linear.y);
            constraint.setEquilibriumPoint(2, joint.equilibrium.linear.z);

            constraint.setStiffness(0, joint.stiffness.linear.x);
            constraint.setStiffness(1, joint.stiffness.linear.y);
            constraint.setStiffness(2, joint.stiffness.linear.z);

            constraint.enableSpring(0, joint.springs.linear.x);
            constraint.enableSpring(1, joint.springs.linear.y);
            constraint.enableSpring(2, joint.springs.linear.z);
        }
    }

    /**
     * Updates other parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update other parameters for
     */
    updateOtherParameters(joint) {
        if (joint.isForMultibodyLink) {
            throw new Error("not implemented for multibodies");
        } else {
            /** @type {import('ammojs3').default.btGeneric6DofSpringConstraint} */
            const constraint = joint.rigidBodyConstraint;
            constraint.setBreakingImpulseThreshold(joint.breakForce);
        }
    }

    /**
     * Sets the motor for the joint. It can target a certain position or
     * velocity or it can be turned off.
     *
     * @param {JointComponent} joint - The joint to set the motor for
     * @param {'position'|'velocity'|'off'|null} mode - The motor mode.
     * If given `null`, the motor will turn off.
     * @param {number|Vec3|undefined} target - The position or velocity the motor should target
     * @param {number} maxImpulse - The maximum impulse the joint motor should apply
     */
    setMotor(joint, mode, target, maxImpulse) {
        throw new Error("motor not support for 6DoF constraint");
    }
}

class SphericalJointImpl extends JointImpl {
    /**
     * Makes a new joint between two entities with a mediating joint entity.
     *
     * @param {import('../../entity').Entity} entityA - The first entity of the joint
     * @param {import('../../entity').Entity} entityB - The second entity of the joint
     * @param {JointComponent} joint - The mediating joint component
     * @param {import('ammojs3').default.btTransform} frameA - Transform for entity A relative to joint
     * @param {import('ammojs3').default.btTransform} frameB - Transform for entity B relative to joint
     * @returns {void}
     */
    createJoint(entityA, entityB, joint, frameA, frameB) {
        if (joint.isForMultibodyLink) {
            const rot_a2b = Ammo.Clone.prototype.Quaternion(frameA.getRotation());
            rot_a2b.op_mulq(frameB.getRotation().inverse());

            const offset_a2j = frameA.getOrigin().op_mul(-1);
            const offset_j2b = frameB.getOrigin();

            entityA.multibody.base.multibody.setupSpherical(
                entityA.multibody.linkIndex,
                0,
                _defaultInertiaVec(),
                entityB.multibody.linkIndex,
                rot_a2b,
                offset_j2b,
                offset_a2j,
                !joint.enableCollision);

            Ammo.destroy(rot_a2b);
            Ammo.destroy(offset_a2j);
            Ammo.destroy(offset_j2b);
        } else {
            const constraint =
                entityB ?
                    new Ammo.btConeTwistConstraint(entityA.physics.rigidBody, entityB.physics.rigidBody, frameA, frameB) :
                    new Ammo.btConeTwistConstraint(entityA.physics.rigidBody, frameA);

            joint.rigidBodyConstraint = constraint;
        }
    }

    /**
     * Updates the angular parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update angular parameters for
     */
    updateAngularParameters(joint) {
        const limits_range = new Vec3();

        if (joint.motion.angular.x === MOTION_LIMITED) {
            limits_range.x = (joint.limits.angular.x.y - joint.limits.angular.x.x) * math.DEG_TO_RAD;
        } else if (joint.motion.angular.x === MOTION_FREE) {
            limits_range.x = -1;
        } else { // MOTION_LOCKED
            limits_range.x = 0;
        }

        if (joint.motion.angular.y === MOTION_LIMITED) {
            limits_range.y = (joint.limits.angular.y.y - joint.limits.angular.y.x) * math.DEG_TO_RAD;
        } else if (joint.motion.angular.y === MOTION_FREE) {
            limits_range.y = -1;
        } else { // MOTION_LOCKED
            limits_range.y = 0;
        }

        if (joint.motion.angular.z === MOTION_LIMITED) {
            limits_range.z = (joint.limits.angular.z.y - joint.limits.angular.z.x) * math.DEG_TO_RAD;
        } else if (joint.motion.angular.z === MOTION_FREE) {
            limits_range.z = -1;
        } else { // MOTION_LOCKED
            limits_range.z = 0;
        }

        if (joint.isForMultibodyLink) {
            const multibodyComponent = joint.entityA.multibody;

            if (limits_range.x >= 0 && limits_range.y >= 0 && limits_range.z >= 0) {
                joint.multiBodyLimitConstraint = new Ammo.btMultiBodySphericalJointLimit(
                    multibodyComponent.multibody,
                    multibodyComponent.linkIndex,
                    limits_range.x,
                    limits_range.y,
                    limits_range.z,
                    1);
            } else {
                joint.multiBodyLimitConstraint = null;
            }

            multibodyComponent.link.set_m_jointDamping(joint.damping.angular.x);
        } else {
            /** @type {import('ammojs3').default.btConeTwistConstraint} */
            const constraint = joint.rigidBodyConstraint;
            constraint.setLimit(3, limits_range.x >= 0 ? limits_range.x : 1e30);
            constraint.setLimit(4, limits_range.y >= 0 ? limits_range.y : 1e30);
            constraint.setLimit(5, limits_range.z >= 0 ? limits_range.z : 1e30);
            // TODO: consider what the values mean
            constraint.setDamping(joint.damping.angular.x);
        }
    }

    /**
     * Updates the linear parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update linear parameters for
     */
    updateLinearParameters(joint) {
        // No linear limits to set
    }

    /**
     * Updates other parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update other parameters for
     */
    updateOtherParameters(joint) {
        if (joint.isForMultibodyLink) {
            const multibodyComponent = joint.entityA.multibody;
            // TODO
        } else {
            /** @type {import('ammojs3').default.btConeTwistConstraint} */
            const constraint = joint.rigidBodyConstraint;
            constraint.setBreakingImpulseThreshold(joint.breakForce);
        }
    }

    /**
     * Sets the motor for the joint. It can target a certain position or
     * velocity or it can be turned off.
     *
     * @param {JointComponent} joint - The joint to set the motor for
     * @param {'position'|'velocity'|'off'|null} mode - The motor mode.
     * If given `null`, the motor will turn off.
     * @param {number|Vec3|undefined} target - The position or velocity the motor should target
     * @param {number} maxImpulse - The maximum impulse the joint motor should apply
     */
    setMotor(joint, mode, target, maxImpulse) {
        const enabled = mode && mode !== 'off';

        if (joint.isForMultibodyLink) {
            const multibodyComponent = joint.entityA.multibody;

            /** @type {import('ammojs3').default.btMultiBodySphericalJointMotor} */
            let constraint = joint.multiBodyMotorConstraint;
            if (constraint && !enabled) {
                joint.multiBodyMotorConstraint = null;
                return;
            } else if (!constraint && enabled) {
                joint.multiBodyMotorConstraint = constraint = new Ammo.btMultiBodySphericalJointMotor(
                    multibodyComponent.multibody,
                    multibodyComponent.linkIndex,
                    maxImpulse);
            } else if (!enabled) {
                return; // there was no constraint and it was not enabled
            }

            constraint.setMaxAppliedImpulse(maxImpulse);
            if (mode === 'position') {
                if (!(target instanceof Vec3))
                    throw new Error("target must be a Vec3");

                const q = new Ammo.btQuaternion();
                q.setEulerZYX(target.z, target.y, target.x);
                constraint.setPositionTarget(q);
                Ammo.destroy(q);
            } else if (mode === 'velocity') {
                if (!(target instanceof Vec3))
                    throw new Error("target must be a Vec3");

                const v = new Ammo.btVector3();
                v.setValue(target.x, target.y, target.z);
                constraint.setVelocityTarget(v);
                Ammo.destroy(v);
            } else {
                throw new Error("unsupported motor mode");
            }
            constraint.finalizeMultiDof();
        } else {
            /** @type {import('ammojs3').default.btConeTwistConstraint} */
            const constraint = joint.rigidBodyConstraint;
            constraint.enableMotor(enabled);
            constraint.setMaxMotorImpulseNormalized(maxImpulse);

            if (mode === 'position') {
                if (!(target instanceof Vec3))
                    throw new Error("target must be a Vec3");

                const q = new Ammo.btQuaternion();
                q.setEulerZYX(target.z, target.y, target.x);
                constraint.setMotorTargetInConstraintSpace(q);
                Ammo.destroy(q);
            } else if (mode === 'velocity') {
                throw new Error("cannot set rigidbody spherical joint motor in velocity mode");
            } else {
                throw new Error("unsupported motor mode");
            }
        }
    }
}

class HingeJointImpl extends JointImpl {
    /**
     * Returns the name of the axis that this hinge joint is for.
     *
     * @param {JointComponent} joint - The joint component to find the hinge axis for
     * @returns {'x'|'y'|'z'} - The name of the axis for the joint
     */
    axis(joint) {
        return (
            joint.motion.angular.x !== MOTION_LOCKED ? 'x' :
                joint.motion.angular.y !== MOTION_LOCKED ? 'y' :
                    joint.motion.angular.z !== MOTION_LOCKED ? 'z' :
                        undefined);
    }

    /**
     * Makes a new joint between two entities with a mediating joint entity.
     *
     * @param {import('../../entity').Entity} entityA - The first entity of the joint
     * @param {import('../../entity').Entity} entityB - The second entity of the joint
     * @param {JointComponent} joint - The mediating joint component
     * @param {import('ammojs3').default.btTransform} frameA - Transform for entity A relative to joint
     * @param {import('ammojs3').default.btTransform} frameB - Transform for entity B relative to joint
     * @returns {void}
     */
    createJoint(entityA, entityB, joint, frameA, frameB) {
        const axis = this.axis(joint);

        if (joint.isForMultibodyLink) {
            /** @type {import('ammojs3').default.btQuaternion} */
            const rot_a2b = new Ammo.btQuaternion();
            rot_a2b.op_add(frameB.getRotation());
            rot_a2b.op_mulq(frameA.getRotation().inverse());
            rot_a2b.normalize();

            const v_axis = new Ammo.btVector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);

            const offset_a2j = frameA.getOrigin().op_mul(-1);
            const offset_j2b = frameB.getOrigin();

            entityA.multibody.base.multibody.setupRevolute(
                entityA.multibody.linkIndex,
                0,
                _defaultInertiaVec(),
                entityB.multibody.linkIndex,
                rot_a2b,
                v_axis,
                offset_j2b,
                offset_a2j,
                !joint.enableCollision);

            Ammo.destroy(rot_a2b);
            Ammo.destroy(v_axis);
            Ammo.destroy(offset_a2j);
            Ammo.destroy(offset_j2b);
        } else {
            const axis_A_j = new Ammo.btVector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
            const axis_B_j = new Ammo.btVector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
            const axis_A_q = frameA.getRotation();
            const axis_B_q = frameB.getRotation();
            const axis_A_l = Ammo.TopLevelFunctions.prototype.quatRotate_(axis_A_q, axis_A_j);
            const axis_B_l = Ammo.TopLevelFunctions.prototype.quatRotate_(axis_B_q, axis_B_j);

            const constraint =
                new Ammo.btHingeConstraint(
                    entityA.physics.rigidBody,
                    entityB.physics.rigidBody,
                    frameA.getOrigin(),
                    frameB.getOrigin(),
                    axis_A_l,
                    axis_B_l,
                    true
                );

            Ammo.destroy(axis_A_j);
            Ammo.destroy(axis_B_j);
            Ammo.destroy(axis_A_q);
            Ammo.destroy(axis_B_q);
            Ammo.destroy(axis_A_l);
            Ammo.destroy(axis_B_l);

            joint.rigidBodyConstraint = constraint;
        }
    }

    /**
     * Updates the angular parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update angular parameters for
     */
    updateAngularParameters(joint) {
        const axis = this.axis(joint);
        const motion = joint.motion.angular[axis];
        const limit_lower = motion === MOTION_FREE ? 1 : joint.limits.angular[axis].x * math.DEG_TO_RAD;
        const limit_upper = motion === MOTION_FREE ? 0 : joint.limits.angular[axis].y * math.DEG_TO_RAD;

        if (joint.isForMultibodyLink) {
            const multibodyComponent = joint.entityA.multibody;

            /** @type {import('ammojs3').default.btMultiBodyJointLimitConstraint} */
            const limit = joint.multiBodyLimitConstraint;
            if (!limit) {
                joint.multiBodyLimitConstraint = new Ammo.btMultiBodyJointLimitConstraint(
                    multibodyComponent.multibody,
                    multibodyComponent.linkIndex,
                    limit_lower,
                    limit_upper);
            } else if (limit_lower <= limit_upper) {
                limit.setLowerBound(limit_lower);
                limit.setUpperBound(limit_upper);
            } else {
                joint.multiBodyLimitConstraint = null;
            }
        } else {
            /** @type {import('ammojs3').default.btHingeConstraint} */
            const constraint = joint.rigidBodyConstraint;
            // TODO: consider what the values mean and what to put
            constraint.setLimit(limit_lower, limit_upper, 0.1, 0.1);
        }
    }

    /**
     * Updates the linear parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update linear parameters for
     */
    updateLinearParameters(joint) {
        // No linear limits to set
    }

    /**
     * Updates other parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update other parameters for
     */
    updateOtherParameters(joint) {
        if (joint.isForMultibodyLink) {
            const multibodyComponent = joint.entityA.multibody;
            // TODO
        } else {
            /** @type {import('ammojs3').default.btHingeConstraint} */
            const constraint = joint.rigidBodyConstraint;
            constraint.setBreakingImpulseThreshold(joint.breakForce);
        }
    }

    /**
     * Sets the motor for the joint. It can target a certain position or
     * velocity or it can be turned off.
     *
     * @param {JointComponent} joint - The joint to set the motor for
     * @param {'position'|'velocity'|'off'|null} mode - The motor mode.
     * If given `null`, the motor will turn off.
     * @param {number|Vec3|undefined} target - The position or velocity the motor should target
     * @param {number} maxImpulse - The maximum impulse the joint motor should apply
     */
    setMotor(joint, mode, target, maxImpulse) {
        const enabled = mode && mode !== 'off';

        if (joint.isForMultibodyLink) {
            const multibodyComponent = joint.entityA.multibody;

            /** @type {import('ammojs3').default.btMultiBodyJointMotor} */
            let constraint = joint.multiBodyMotorConstraint;
            /** @type {import('../physics/system').PhysicsComponentSystem} */
            const physics = joint.system.app.systems.physics;
            if (constraint && !enabled) {
                joint.multiBodyMotorConstraint = null;
                return;
            } else if (!constraint && enabled) {
                constraint = new Ammo.btMultiBodyJointMotor(
                    multibodyComponent.multibody,
                    multibodyComponent.linkIndex,
                    0,
                    typeof target === 'number' ? target : 0,
                    maxImpulse);
                joint.multiBodyMotorConstraint = constraint;
            } else if (!enabled) {
                return; // there was no constraint and it was not enabled
            }

            constraint.setMaxAppliedImpulse(maxImpulse);
            if (mode === 'position') {
                if (typeof target !== 'number')
                    throw new Error("target must be a number");

                constraint.setPositionTarget(target);
            } else if (mode === 'velocity') {
                if (typeof target !== 'number')
                    throw new Error("target must be a number");

                constraint.setVelocityTarget(target);
            } else {
                throw new Error("unsupported motor mode");
            }
            constraint.finalizeMultiDof();
        } else {
            /** @type {import('ammojs3').default.btHingeConstraint} */
            const constraint = joint.rigidBodyConstraint;

            if (mode !== 'position') {
                constraint.enableMotor(false);
            }
            if (mode !== 'velocity') {
                // TODO: does the angular motor need to be disabled?
                constraint.enableAngularMotor(false, 0, maxImpulse);
            }

            if (mode === 'position') {
                if (typeof target !== 'number')
                    throw new Error("target must be a number");

                constraint.enableMotor(true);
                constraint.setMaxMotorImpulse(maxImpulse);
                constraint.setMotorTarget(target, 10); // TODO: what value for dt?
            } else if (mode === 'velocity') {
                if (typeof target !== 'number')
                    throw new Error("target must be a number");

                constraint.enableAngularMotor(true, target, maxImpulse);
            } else {
                throw new Error("unsupported motor mode");
            }
        }
    }
}

class SliderJointImpl extends JointImpl {
    /**
     * Returns the name of the axis that this slider joint is for.
     *
     * @param {JointComponent} joint - The joint component to find the slider axis for
     * @returns {'x'|'y'|'z'} - The name of the axis for the joint
     */
    axis(joint) {
        return (
            joint.motion.linear.x !== MOTION_LOCKED ? 'x' :
                joint.motion.linear.y !== MOTION_LOCKED ? 'y' :
                    joint.motion.linear.z !== MOTION_LOCKED ? 'z' :
                        undefined);
    }

    /**
     * Makes a new joint between two entities with a mediating joint entity.
     *
     * @param {import('../../entity').Entity} entityA - The first entity of the joint
     * @param {import('../../entity').Entity} entityB - The second entity of the joint
     * @param {JointComponent} joint - The mediating joint component
     * @param {import('ammojs3').default.btTransform} frameA - Transform for entity A relative to joint
     * @param {import('ammojs3').default.btTransform} frameB - Transform for entity B relative to joint
     * @returns {void}
     */
    createJoint(entityA, entityB, joint, frameA, frameB) {
        const axis = this.axis(joint);

        if (joint.isForMultibodyLink) {
            const rot_a2b = new Ammo.btQuaternion();
            rot_a2b.op_add(frameB.getRotation());
            rot_a2b.op_mulq(frameA.getRotation().inverse());

            const v_axis = new Ammo.btVector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);

            const offset_a2j = frameA.getOrigin().op_mul(-1);
            const offset_j2b = frameB.getOrigin();

            entityA.multibody.base.multibody.setupPrismatic(
                entityA.multibody.linkIndex,
                0,
                _defaultInertiaVec(),
                entityB.multibody.linkIndex,
                rot_a2b,
                v_axis,
                offset_j2b,
                offset_a2j,
                !joint.enableCollision);

            Ammo.destroy(rot_a2b);
            Ammo.destroy(v_axis);
            Ammo.destroy(offset_a2j);
            Ammo.destroy(offset_j2b);
        } else {
            const constraint =
                entityB ?
                    new Ammo.btSliderConstraint(entityA.physics.rigidBody, entityB.physics.rigidBody, frameA, frameB, !joint.enableCollision) :
                    new Ammo.btSliderConstraint(entityA.physics.rigidBody, frameA, !joint.enableCollision);

            joint.rigidBodyConstraint = constraint;
        }
    }

    /**
     * Updates the angular parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update angular parameters for
     */
    updateAngularParameters(joint) {
        const axis = this.axis(joint);
        const motion = joint.motion.angular[axis];
        const limit_lower = motion === MOTION_FREE ? 1 : joint.limits.angular[axis].x * math.DEG_TO_RAD;
        const limit_upper = motion === MOTION_FREE ? 0 : joint.limits.angular[axis].y * math.DEG_TO_RAD;

        if (joint.isForMultibodyLink) {
            // const link = joint.entityA.multibody.link;
            // link.set_m_jointUpperLimit(upper);
            // link.set_m_jointLowerLimit(lower);
            // TODO: this is not currently implemented in bullet
            throw new Error("angular limits not implemented yet for slider multibody joints");
        } else {
            /** @type {import('ammojs3').default.btSliderConstraint} */
            const constraint = joint.rigidBodyConstraint;
            constraint.setLowerAngLimit(limit_lower);
            constraint.setUpperAngLimit(limit_upper);
        }
    }

    /**
     * Updates the linear parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update linear parameters for
     */
    updateLinearParameters(joint) {
        const axis = this.axis(joint);
        const motion = joint.motion.linear[axis];
        const limit_lower = motion === MOTION_FREE ? 1 : joint.limits.linear[axis].x * math.DEG_TO_RAD;
        const limit_upper = motion === MOTION_FREE ? 0 : joint.limits.linear[axis].y * math.DEG_TO_RAD;

        if (joint.isForMultibodyLink) {
            // const link = joint.entityA.multibody.link;
            // link.set_m_jointUpperLimit(limit_upper);
            // link.set_m_jointLowerLimit(limit_lower);
            // TODO: this is not currently implemented in bullet
            throw new Error("linear limits not implemented yet for slider multibody joints");
        } else {
            /** @type {import('ammojs3').default.btSliderConstraint} */
            const constraint = joint.rigidBodyConstraint;
            constraint.setLowerLinLimit(limit_lower);
            constraint.setUpperLinLimit(limit_upper);
        }
    }

    /**
     * Updates other parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update other parameters for
     */
    updateOtherParameters(joint) {
        if (joint.isForMultibodyLink) {
            const multibodyComponent = joint.entityA.multibody;
            // TODO
        } else {
            /** @type {import('ammojs3').default.btSliderConstraint} */
            const constraint = joint.rigidBodyConstraint;
            constraint.setBreakingImpulseThreshold(joint.breakForce);
        }
    }

    /**
     * Sets the motor for the joint. It can target a certain position or
     * velocity or it can be turned off.
     *
     * @param {JointComponent} joint - The joint to set the motor for
     * @param {'position'|'velocity'|'off'|null} mode - The motor mode.
     * If given `null`, the motor will turn off.
     * @param {number|Vec3|undefined} target - The position or velocity the motor should target
     * @param {number} maxImpulse - The maximum impulse the joint motor should apply
     */
    setMotor(joint, mode, target, maxImpulse) {
        const enabled = mode && mode !== 'off';

        if (joint.isForMultibodyLink) {
            throw new Error('motor not supported yet for slider joints for multibodies');
        } else {
            /** @type {import('ammojs3').default.btSliderConstraint} */
            const constraint = joint.rigidBodyConstraint;

            if (!enabled) {
                constraint.setPoweredLinMotor(false);
            } else if (mode === 'position') {
                if (typeof target !== 'number')
                    throw new Error("target must be a number");

                // TODO: what parameters can be set?
                // can an artificial motor controller be made for this?
                constraint.setLowerLinLimit(target);
                constraint.setUpperLinLimit(target);
            } else if (mode === 'velocity') {
                if (typeof target !== 'number')
                    throw new Error("target must be a number");

                constraint.setPoweredLinMotor(true);
                // TODO: research the difference between max linear motor force and max impulse
                constraint.setMaxLinMotorForce(maxImpulse);
                constraint.setTargetLinMotorVelocity(target);
            } else {
                throw new Error("unsupported motor mode");
            }
        }
    }
}

class FixedJointImpl extends JointImpl {
    /**
     * Makes a new joint between two entities with a mediating joint entity.
     *
     * @param {import('../../entity').Entity} entityA - The first entity of the joint
     * @param {import('../../entity').Entity} entityB - The second entity of the joint
     * @param {JointComponent} joint - The mediating joint component
     * @param {import('ammojs3').default.btTransform} frameA - Transform for entity A relative to joint
     * @param {import('ammojs3').default.btTransform} frameB - Transform for entity B relative to joint
     * @returns {void}
     */
    createJoint(entityA, entityB, joint, frameA, frameB) {
        if (joint.isForMultibodyLink) {
            const rot_a2b = new Ammo.btQuaternion();
            rot_a2b.op_add(frameB.getRotation());
            rot_a2b.op_mulq(frameA.getRotation().inverse());

            const offset_a2j = frameA.getOrigin().op_mul(-1);
            const offset_j2b = frameB.getOrigin();

            entityA.multibody.base.multibody.setupFixed(
                entityA.multibody.linkIndex,
                0,
                _defaultInertiaVec(),
                entityB.multibody.linkIndex,
                rot_a2b,
                offset_j2b,
                offset_a2j,
                !joint.enableCollision);

            Ammo.destroy(rot_a2b);
            Ammo.destroy(offset_a2j);
            Ammo.destroy(offset_j2b);
        } else {
            const constraint = new Ammo.btFixedConstraint(
                entityA.physics.rigidBody,
                entityB.physics.rigidBody,
                frameA,
                frameB);

            joint.rigidBodyConstraint = constraint;
        }
    }

    /**
     * Updates the angular parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update angular parameters for
     */
    updateAngularParameters(joint) {
    }

    /**
     * Updates the linear parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update linear parameters for
     */
    updateLinearParameters(joint) {
    }

    /**
     * Updates other parameters of the joint.
     *
     * @param {JointComponent} joint - The joint to update other parameters for
     */
    updateOtherParameters(joint) {
        if (joint.isForMultibodyLink) {
            // TODO: is anything needed?
        } else {
            /** @type {import('ammojs3').default.btFixedConstraint} */
            const constraint = joint.rigidBodyConstraint;
            constraint.setBreakingImpulseThreshold(joint.breakForce);
        }
    }

    /**
     * Sets the motor for the joint. It can target a certain position or
     * velocity or it can be turned off.
     *
     * @param {JointComponent} joint - The joint to set the motor for
     * @param {'position'|'velocity'|'off'|null} mode - The motor mode.
     * If given `null`, the motor will turn off.
     * @param {number|Vec3|undefined} target - The position or velocity the motor should target
     * @param {number} maxImpulse - The maximum impulse the joint motor should apply
     */
    setMotor(joint, mode, target, maxImpulse) {
        const enabled = (mode && mode !== 'off');
        if (enabled) {
            throw new Error("motor impossible for fixed joint.");
        }
    }
}

/**
 * Creates and manages physics joint components.
 *
 * @augments ComponentSystem
 * @ignore
 */
class JointComponentSystem extends ComponentSystem {
    /**
     * Create a new JointComponentSystem instance.
     *
     * @param {import('../../app-base.js').AppBase} app - The application.
     * @hideconstructor
     */
    constructor(app) {
        super(app);

        this.id = 'joint';
        this.app = app;

        this.ComponentType = JointComponent;
        this.DataType = JointComponentData;

        this.schema = _schema;

        /** @type {{ [type: string]: JointImpl }} */
        this.implementations = {};
    }

    initializeComponentData(component, data, properties) {
        component.initFromData(data);
    }

    /**
     * Creates an implementation based on the joint type and caches it
     * in an internal implementations structure, before returning it.
     *
     * @param {JointComponent} joint - The joint to make impl for
     * @returns {JointImpl}
     */
    _createImplementation(joint) {
        if (this.implementations[joint.type] === undefined) {
            let impl;
            switch (joint.type) {
                case JOINT_TYPE_6DOF:
                    impl = new Generic6DofJointImpl();
                    break;
                case JOINT_TYPE_SPHERICAL:
                    impl = new SphericalJointImpl();
                    break;
                case JOINT_TYPE_HINGE:
                    impl = new HingeJointImpl();
                    break;
                case JOINT_TYPE_SLIDER:
                    impl = new SliderJointImpl();
                    break;
                case JOINT_TYPE_FIXED:
                    impl = new FixedJointImpl();
                    break;
                case JOINT_TYPE_INVALID:
                default:
                    Debug.error(`_createImplementation: Invalid collision system type: ${joint.type}`);
            }
            this.implementations[joint.type] = impl;
        }

        return this.implementations[joint.type];
    }

    /**
     * Gets an existing implementation for the specified entity
     *
     * @param {JointComponent} joint - The joint component to get type impl for
     * @returns {JointImpl}
     */
    _getImplementation(joint) {
        return this.implementations[joint.type];
    }

    /**
     * Makes a new joint between two entities with a mediating joint entity.
     *
     * @param {import('../../entity').Entity} entityA - The first entity of the joint
     * @param {import('../../entity').Entity} entityB - The second entity of the joint
     * @param {JointComponent} joint - The mediating joint component
     * @param {import('ammojs3').default.btTransform} frameA - Transform for entity A relative to joint
     * @param {import('ammojs3').default.btTransform} frameB - Transform for entity B relative to joint
     * @returns {void}
     */
    createJoint(entityA, entityB, joint, frameA, frameB) {
        const impl = this._createImplementation(joint);
        impl.createJoint(entityA, entityB, joint, frameA, frameB);
    }

    /**
     * Updates the angular parameters for a joint.
     *
     * @param {JointComponent} joint - The joint to update angular parameters for
     * @param {Vec3} limits_lower - The angular lower limits
     * @param {Vec3} limits_upper - The angular upper limits
     */
    updateAngularParameters(joint, limits_lower, limits_upper) {
        const impl = this._getImplementation(joint);
        impl.updateAngularParameters(joint, limits_lower, limits_upper);
    }

    /**
     * Updates the linear parameters for a joint.
     *
     * @param {JointComponent} joint - The joint to update linear parameters for
     * @param {Vec3} limits_lower - The linear lower limits
     * @param {Vec3} limits_upper - The linear upper limits
     */
    updateLinearParameters(joint, limits_lower, limits_upper) {
        const impl = this._getImplementation(joint);
        impl.updateLinearParameters(joint, limits_lower, limits_upper);
    }

    /**
     * Updates the other parameters for a joint.
     *
     * @param {JointComponent} joint - The joint to update other parameters for
     */
    updateOtherParameters(joint) {
        const impl = this._getImplementation(joint);
        impl.updateOtherParameters(joint);
    }
}

Component._buildAccessors(JointComponent.prototype, _schema);

export { JointComponentSystem };
