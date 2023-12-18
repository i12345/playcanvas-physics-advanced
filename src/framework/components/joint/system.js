import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { JointComponent } from './component.js';
import { JOINT_TYPE_6DOF, JOINT_TYPE_FIXED, JOINT_TYPE_HINGE, JOINT_TYPE_INVALID, JOINT_TYPE_SLIDER, JOINT_TYPE_SPHERICAL, MOTION_FREE, MOTION_LIMITED, MOTION_LOCKED, MOTOR_TARGET_POSITION, MOTOR_TARGET_VELOCITY, MOTOR_OFF } from './constants.js';
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
     * @param {import('./constants.js').JointMotorMode|null} mode - The motor mode.
     * If given `null`, the motor will turn off.
     * @param {number|Vec3|Quat|undefined} [target] - The position or velocity
     * the motor should target.
     * @param {number|undefined} [maxImpulse] - The maximum impulse the joint
     * motor should apply
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
     * @param {import('./constants.js').JointMotorMode|null} mode - The motor mode.
     * If given `null`, the motor will turn off.
     * @param {number|Vec3|Quat|undefined} [target] - The position or velocity
     * the motor should target.
     * @param {number|undefined} [maxImpulse] - The maximum impulse the joint
     * motor should apply
     */
    setMotor(joint, mode, target, maxImpulse) {
        // TODO: implement
        // https://stackoverflow.com/a/67466146

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
     * @param {import('./constants.js').JointMotorMode|null} mode - The motor mode.
     * If given `null`, the motor will turn off.
     * @param {number|Vec3|Quat|undefined} [target] - The position or velocity
     * the motor should target.
     * @param {number|undefined} [maxImpulse] - The maximum impulse the joint
     * motor should apply
     */
    setMotor(joint, mode, target, maxImpulse) {
        const enabled = mode && mode !== 'off';

        if (joint.isForMultibodyLink) {
            const multibodyComponent = joint.entityA.multibody;

            /** @type {import('ammojs3').default.btMultiBodySphericalJointMotor|null} */
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

            if (maxImpulse !== undefined)
                constraint.setMaxAppliedImpulse(maxImpulse);

            if (mode === MOTOR_TARGET_POSITION) {
                const q = new Ammo.btQuaternion();

                if (target instanceof Vec3) {
                    q.setEulerZYX(target.z, target.y, target.x);
                } else if (target instanceof Quat) {
                    q.setValue(target.x, target.y, target.z, target.w);
                } else {
                    throw new Error("target must be a Vec3 or Quat");
                }

                constraint.setPositionTarget(q);
                Ammo.destroy(q);
            } else if (mode === MOTOR_TARGET_VELOCITY) {
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

            if (maxImpulse !== undefined)
                constraint.setMaxMotorImpulseNormalized(maxImpulse);

            if (mode === MOTOR_TARGET_POSITION) {
                const q = new Ammo.btQuaternion();

                if (target instanceof Vec3) {
                    q.setEulerZYX(target.z, target.y, target.x);
                } else if (target instanceof Quat) {
                    q.setValue(target.x, target.y, target.z, target.w);
                } else {
                    throw new Error("target must be a Vec3 or Quat");
                }

                constraint.setMotorTargetInConstraintSpace(q);
                Ammo.destroy(q);
            } else if (mode === MOTOR_TARGET_VELOCITY) {
                throw new Error("cannot set rigidbody spherical joint motor in velocity mode");
            } else if (enabled) {
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
            const constraint =
                entityB ?
                    new Ammo.btHingeConstraint(entityA.physics.rigidBody, entityB.physics.rigidBody, frameA, frameB, true) :
                    new Ammo.btHingeConstraint(entityA.physics.rigidBody, frameA, true);

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
     * @param {import('./constants.js').JointMotorMode|null} mode - The motor mode.
     * If given `null`, the motor will turn off.
     * @param {number|Vec3|Quat|undefined} [target] - The position or velocity
     * the motor should target.
     * @param {number|undefined} [maxImpulse] - The maximum impulse the joint
     * motor should apply
     */
    setMotor(joint, mode, target, maxImpulse) {
        const enabled = mode && mode !== 'off';

        if (target instanceof Quat) {
            const real_axis = { x: new Vec3(1, 0, 0), y: new Vec3(0, 1, 0), z: new Vec3(0, 0, 1) }[this.axis(joint)];
            const target_axis = new Vec3();
            const target_angle = target.getAxisAngle(target_axis);
            if (target_angle === 0) {
                target = 0;
            } else {
                const axis_dot = target_axis.dot(real_axis);

                Debug.assert(Math.abs(Math.abs(axis_dot) - 1) < 0.01);

                target = axis_dot * target_angle;
            }
        } else if (target instanceof Vec3) {
            const real_axis = this.axis(joint);
            const real_angle = target[real_axis];

            switch (real_axis) {
                case "x":
                    Debug.assert(Math.abs(target.y) < 0.01 && Math.abs(target.z) < 0.01);
                    break;
                case "y":
                    Debug.assert(Math.abs(target.x) < 0.01 && Math.abs(target.z) < 0.01);
                    break;
                case "z":
                    Debug.assert(Math.abs(target.x) < 0.01 && Math.abs(target.y) < 0.01);
                    break;
            }

            target = real_angle;
        }

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

            if (maxImpulse !== undefined)
                constraint.setMaxAppliedImpulse(maxImpulse);

            if (mode === MOTOR_TARGET_POSITION) {
                if (typeof target !== 'number')
                    throw new Error("target must be a number or quat with same axis");

                constraint.setPositionTarget(target);
            } else if (mode === MOTOR_TARGET_VELOCITY) {
                if (typeof target !== 'number')
                    throw new Error("target must be a number or quat with same axis");

                constraint.setVelocityTarget(target);
            } else if (enabled) {
                throw new Error("unsupported motor mode");
            }
            constraint.finalizeMultiDof();
        } else {
            /** @type {import('ammojs3').default.btHingeConstraint} */
            const constraint = joint.rigidBodyConstraint;

            if (mode !== MOTOR_TARGET_POSITION) {
                constraint.enableMotor(false);
            }
            if (mode !== MOTOR_TARGET_VELOCITY) {
                // TODO: does the angular motor need to be disabled?
                constraint.enableAngularMotor(false, 0, maxImpulse ?? 1);
            }

            if (maxImpulse !== undefined)
                constraint.setMaxMotorImpulse(maxImpulse);

            if (mode === MOTOR_TARGET_POSITION) {
                if (typeof target !== 'number')
                    throw new Error("target must be a number or quat with same axis");

                constraint.enableMotor(true);
                constraint.setMotorTarget(target, 1); // TODO: what value for dt?
            } else if (mode === MOTOR_TARGET_VELOCITY) {
                if (typeof target !== 'number')
                    throw new Error("target must be a number or quat with same axis");

                constraint.enableAngularMotor(true, target, maxImpulse ?? 1);
            } else if (enabled) {
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
     * @param {import('./constants.js').JointMotorMode|null} mode - The motor mode.
     * If given `null`, the motor will turn off.
     * @param {number|Vec3|Quat|undefined} [target] - The position or velocity
     * the motor should target.
     * @param {number|undefined} [maxImpulse] - The maximum impulse the joint
     * motor should apply
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
            } else {
                // TODO: research the difference between max linear motor force and max impulse
                if (maxImpulse !== undefined)
                    constraint.setMaxLinMotorForce(maxImpulse);

                if (mode === MOTOR_TARGET_POSITION) {
                    if (typeof target !== 'number')
                        throw new Error("target must be a number");

                    // TODO: what parameters can be set?
                    // can an artificial motor controller be made for this?
                    constraint.setLowerLinLimit(target);
                    constraint.setUpperLinLimit(target);
                } else if (mode === MOTOR_TARGET_VELOCITY) {
                    if (typeof target !== 'number')
                        throw new Error("target must be a number");

                    constraint.setPoweredLinMotor(true);
                    constraint.setTargetLinMotorVelocity(target);
                } else {
                    throw new Error("unsupported motor mode");
                }
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
     * @param {import('./constants.js').JointMotorMode|null} mode - The motor mode.
     * If given `null`, the motor will turn off.
     * @param {number|Vec3|Quat|undefined} [target] - The position or velocity
     * the motor should target.
     * @param {number|undefined} [maxImpulse] - The maximum impulse the joint
     * motor should apply
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

    /**
     * Called during {@link ComponentSystem#addComponent} to initialize the component data in the
     * store. This can be overridden by derived Component Systems and either called by the derived
     * System or replaced entirely.
     *
     * @param {import('./component.js').JointComponent} component - The component being initialized.
     * @param {import('./data.js').JointComponentData} data - The data block used to initialize the component.
     * @param {Array<string | {name: string, type: string}>} properties - The array of property
     * descriptors for the component. A descriptor can be either a plain property name, or an
     * object specifying the name and type.
     * @ignore
     */
    initializeComponentData(component, data, properties) {
        component._initFromData(data);
        super.initializeComponentData(component, data, properties);
    }

    /**
     * Create a clone of component. This creates a copy of all component data variables.
     *
     * @param {import('../../entity.js').Entity} entity - The entity to clone the component from.
     * @param {import('../../entity.js').Entity} clone - The entity to clone the component into.
     * @returns {import('../component.js').Component} The newly cloned component.
     * @ignore
     */
    cloneComponent(entity, clone) {
        //TODO: use ComponentSystem.store for data for joints

        /** @type {JointComponentData} */
        const data = {
            enabled: entity.joint.enabled,

            motion: {
                linear: {
                    x: entity.joint.motion.linear.x,
                    y: entity.joint.motion.linear.y,
                    z: entity.joint.motion.linear.z
                },
                angular: {
                    x: entity.joint.motion.angular.x,
                    y: entity.joint.motion.angular.y,
                    z: entity.joint.motion.angular.z
                }
            },

            limits: {
                linear: {
                    x: entity.joint.limits.linear.x,
                    y: entity.joint.limits.linear.y,
                    z: entity.joint.limits.linear.z
                },
                angular: {
                    x: entity.joint.limits.angular.x,
                    y: entity.joint.limits.angular.y,
                    z: entity.joint.limits.angular.z
                }
            },

            springs: {
                linear: {
                    x: entity.joint.springs.linear.x,
                    y: entity.joint.springs.linear.y,
                    z: entity.joint.springs.linear.z
                },
                angular: {
                    x: entity.joint.springs.angular.x,
                    y: entity.joint.springs.angular.y,
                    z: entity.joint.springs.angular.z
                }
            },

            stiffness: {
                linear: {
                    x: entity.joint.stiffness.linear.x,
                    y: entity.joint.stiffness.linear.y,
                    z: entity.joint.stiffness.linear.z
                },
                angular: {
                    x: entity.joint.stiffness.angular.x,
                    y: entity.joint.stiffness.angular.y,
                    z: entity.joint.stiffness.angular.z
                }
            },

            damping: {
                linear: {
                    x: entity.joint.damping.linear.x,
                    y: entity.joint.damping.linear.y,
                    z: entity.joint.damping.linear.z
                },
                angular: {
                    x: entity.joint.damping.angular.x,
                    y: entity.joint.damping.angular.y,
                    z: entity.joint.damping.angular.z
                }
            },

            equilibrium: {
                linear: {
                    x: entity.joint.equilibrium.linear.x,
                    y: entity.joint.equilibrium.linear.y,
                    z: entity.joint.equilibrium.linear.z
                },
                angular: {
                    x: entity.joint.equilibrium.angular.x,
                    y: entity.joint.equilibrium.angular.y,
                    z: entity.joint.equilibrium.angular.z
                }
            },

            breakForce: entity.joint.breakForce,
            enableCollision: entity.joint.enableCollision,

            skipMultiBodyChance: entity.joint.skipMultiBodyChance,
            enableMultiBodyComponents: entity.joint.enableMultiBodyComponents
        };

        return super.addComponent(clone, data);
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
                    impl = new FixedJointImpl();
                    break;
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
     */
    updateAngularParameters(joint) {
        const impl = this._getImplementation(joint);
        impl.updateAngularParameters(joint);
    }

    /**
     * Updates the linear parameters for a joint.
     *
     * @param {JointComponent} joint - The joint to update linear parameters for
     */
    updateLinearParameters(joint) {
        const impl = this._getImplementation(joint);
        impl.updateLinearParameters(joint);
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

    /**
     * Sets the motor for the joint. It can target a certain position or
     * velocity or it can be turned off.
     *
     * @param {JointComponent} joint - The joint to set the motor for
     * @param {import('./constants.js').JointMotorMode|null} mode - The motor mode.
     * If given `null`, the motor will turn off.
     * @param {number|Vec3|Quat|undefined} [target] - The position or velocity
     * the motor should target.
     * @param {number|undefined} [maxImpulse] - The maximum impulse the joint
     * motor should apply
     */
    updateMotor(joint, mode, target, maxImpulse) {
        const impl = this._getImplementation(joint);
        impl.setMotor(joint, mode, target, maxImpulse);
    }
}

Component._buildAccessors(JointComponent.prototype, _schema);

export { JointComponentSystem };
