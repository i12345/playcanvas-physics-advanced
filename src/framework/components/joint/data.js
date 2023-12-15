import { Vec2 } from "../../../core/math/vec2.js";
import { Vec3 } from "../../../core/math/vec3.js";
import { JOINT_TYPE_6DOF, MOTION_LOCKED } from "./constants.js";

class JointComponentData {
    constructor() {
        this.enabled = true;

        /** @type {import("./constants").JointType} */
        this.type = JOINT_TYPE_6DOF;

        /** @type {import('./constants.js').LinearAngularPair<import('./constants.js').XYZ<import('./constants.js').JointMotion>>} */
        this.motion = { linear: { x: MOTION_LOCKED, y: MOTION_LOCKED, z: MOTION_LOCKED }, angular: { x: MOTION_LOCKED, y: MOTION_LOCKED, z: MOTION_LOCKED } };
        /** @type {import('./constants.js').LinearAngularPair<import('./constants.js').XYZ<Vec2>>} */
        this.limits = { linear: { x: new Vec2(), y: new Vec2(), z: new Vec2() }, angular: { x: new Vec2(), y: new Vec2(), z: new Vec2() } };
        /** @type {import('./constants.js').LinearAngularPair<import('./constants.js').XYZ<boolean>>} */
        this.springs = { linear: { x: false, y: false, z: false }, angular: { x: false, y: false, z: false } };
        /** @type {import('./constants.js').LinearAngularPair<import('./constants.js').XYZ<number>> } */
        this.stiffness = { linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } };
        /** @type {import('./constants.js').LinearAngularPair<import('./constants.js').XYZ<number>> } */
        this.damping = { linear: { x: 0.1, y: 0.1, z: 0.1 }, angular: { x: 0.1, y: 0.1, z: 0.1 } };
        /** @type {import('./constants.js').LinearAngularPair<import('./constants.js').XYZ<number>> } */
        this.equilibrium = { linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } };

        /** @type {number} */
        this.breakForce = 3.4e+38;
        /** @type {boolean} */
        this.enableCollision = true;

        /** @type {boolean} */
        this.skipMultiBodyChance = false;
        /** @type {boolean} */
        this.enableMultiBodyComponents = false;
    }
}

export { JointComponentData };
