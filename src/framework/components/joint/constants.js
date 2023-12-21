/**
 * @typedef {(typeof MOTION_FREE) | (typeof MOTION_LIMITED) | (typeof MOTION_LOCKED)} JointMotion
 */

/**
 * @typedef {(typeof JOINT_TYPE_6DOF) | (typeof JOINT_TYPE_FIXED) | (typeof JOINT_TYPE_HINGE) | (typeof JOINT_TYPE_SLIDER) | (typeof JOINT_TYPE_SPHERICAL) | (typeof JOINT_TYPE_INVALID)} JointType
 */

/**
 * @typedef {(typeof MOTOR_TARGET_POSITION) | (typeof MOTOR_TARGET_VELOCITY) | (typeof MOTOR_OFF)} JointMotorMode
 */

/**
 * @typedef {number|import('../../../core/math/vec3.js').Vec3|import('../../../core/math/quat.js').Quat} JointPosition
 */

/**
 * @template T
 * @typedef {{ linear: T, angular: T }} LinearAngularPair<T>
 */

/**
 * @template T
 * @typedef {{ x: T, y: T, z: T }} XYZ<T>
 */

/**
 * Specified degree of freedom has free movement.
 *
 * @type {string}
 * @ignore
 */
export const MOTION_FREE = 'free';

/**
 * Specified degree of freedom has limited movement.
 *
 * @type {string}
 * @ignore
 */
export const MOTION_LIMITED = 'limited';

/**
 * Specified degree of freedom is locked and allows no movement.
 *
 * @type {string}
 * @ignore
 */
export const MOTION_LOCKED = 'locked';

/**
 * The joint motor targets a position.
 *
 * Supported by:
 *
 * **TODO: is this degrees or radians?**
 *
 * - hinge (rigid body & multibody) - number or quat with axis matching the joint's axis
 * - spherical (rigid body & multibody) - vector3 (euler angles [radians or degrees?]) or quat
 * - slider (rigid body only) - number
 */
export const MOTOR_TARGET_POSITION = "position";

/**
 * The joint motor targets a velocity.
 *
 * Supported by:
 *
 * **TODO: is this degrees or radians?**
 *
 * - hinge (rigid body & multibody) - number or quat with axis matching the joint's axis
 * - spherical (multibody only) - vector3 (euler angles)
 * - slider (rigid body only) - number
 */
export const MOTOR_TARGET_VELOCITY = "velocity";

/**
 * The joint motor is turned off.
 */
export const MOTOR_OFF = "off";

/**
 * The joint has potentially 6 degrees of freedom
 *
 * This is not implemented for multibody links.
 */
export const JOINT_TYPE_6DOF = "6dof";

/**
 * The joint has 1 axis of rotation. This is discerned by considering
 * whichever axis of `motion.angular` not locked.
 *
 * For multibody links, this is implemented with the revolute joint type.
 */
export const JOINT_TYPE_HINGE = "hinge";

/**
 * The joint has 2 or 3 axes of rotation.
 *
 * For rigid bodies, this is implemented with the cone-twist joint type.
 * For multibody links this is implemented with the spherical joint type.
 */
export const JOINT_TYPE_SPHERICAL = "spherical";

/**
 * The joint has 1 axis of translation. This is discerned by considering
 * whichever axis of `motion.linear` not locked.
 *
 * For multibody links this is implemented with the prismatic joint type.
 */
export const JOINT_TYPE_SLIDER = "slider";

/**
 * The joint has 0 degrees of freedom.
 *
 * For multibody links this is implemented with the fixed joint type.
 */
export const JOINT_TYPE_FIXED = "fixed";

/**
 * Invalid
 */
export const JOINT_TYPE_INVALID = "invalid";
