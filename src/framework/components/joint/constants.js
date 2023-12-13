/**
 * @typedef {(typeof JOINT_TYPE_6DOF) | (typeof JOINT_TYPE_FIXED) | (typeof JOINT_TYPE_HINGE) | (typeof JOINT_TYPE_SLIDER) | (typeof JOINT_TYPE_SPHERICAL) | (typeof JOINT_TYPE_INVALID)} JointType
 */

/**
 * @typedef {(typeof MOTION_FREE) | (typeof MOTION_LIMITED) | (typeof MOTION_LOCKED)} JointMotion
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
