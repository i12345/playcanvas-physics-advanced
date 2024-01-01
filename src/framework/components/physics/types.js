import { Vec3 } from '../../../core/math/vec3.js';

/**
 * Object holding the result of a successful raycast hit.
 *
 * @category Physics
 */
class RaycastResult {
    /**
     * Create a new RaycastResult instance.
     *
     * @param {import('../../entity.js').Entity} entity - The entity that was hit.
     * @param {Vec3} point - The point at which the ray hit the entity in world space.
     * @param {Vec3} normal - The normal vector of the surface where the ray hit in world space.
     * @param {number} hitFraction - The normalized distance (between 0 and 1) at which the ray hit
     * occurred from the starting point.
     * @hideconstructor
     */
    constructor(entity, point, normal, hitFraction) {
        /**
         * The entity that was hit.
         *
         * @type {import('../../entity.js').Entity}
         */
        this.entity = entity;

        /**
         * The point at which the ray hit the entity in world space.
         *
         * @type {Vec3}
         */
        this.point = point;

        /**
         * The normal vector of the surface where the ray hit in world space.
         *
         * @type {Vec3}
         */
        this.normal = normal;

        /**
         * The normalized distance (between 0 and 1) at which the ray hit occurred from the
         * starting point.
         *
         * @type {number}
         */
        this.hitFraction = hitFraction;
    }
}

/**
 * Object holding the result of a contact between two rigid bodies.
 *
 * @category Physics
 */
class SingleContactResult {
    /**
     * Create a new SingleContactResult instance.
     *
     * @param {import('../../entity.js').Entity} a - The first entity involved in the contact.
     * @param {import('../../entity.js').Entity} b - The second entity involved in the contact.
     * @param {ContactPoint} contactPoint - The contact point between the two entities.
     * @hideconstructor
     */
    constructor(a, b, contactPoint) {
        if (arguments.length === 0) {
            /**
             * The first entity involved in the contact.
             *
             * @type {import('../../entity.js').Entity}
             */
            this.a = null;

            /**
             * The second entity involved in the contact.
             *
             * @type {import('../../entity.js').Entity}
             */
            this.b = null;

            /**
             * The total accumulated impulse applied by the constraint solver during the last
             * sub-step. Describes how hard two bodies collided.
             *
             * @type {number}
             */
            this.impulse = 0;

            /**
             * The point on Entity A where the contact occurred, relative to A.
             *
             * @type {Vec3}
             */
            this.localPointA = new Vec3();

            /**
             * The point on Entity B where the contact occurred, relative to B.
             *
             * @type {Vec3}
             */
            this.localPointB = new Vec3();

            /**
             * The point on Entity A where the contact occurred, in world space.
             *
             * @type {Vec3}
             */
            this.pointA = new Vec3();

            /**
             * The point on Entity B where the contact occurred, in world space.
             *
             * @type {Vec3}
             */
            this.pointB = new Vec3();

            /**
             * The normal vector of the contact on Entity B, in world space.
             *
             * @type {Vec3}
             */
            this.normal = new Vec3();
        } else {
            this.a = a;
            this.b = b;
            this.impulse = contactPoint.impulse;
            this.localPointA = contactPoint.localPoint;
            this.localPointB = contactPoint.localPointOther;
            this.pointA = contactPoint.point;
            this.pointB = contactPoint.pointOther;
            this.normal = contactPoint.normal;
        }
    }
}

/**
 * Object holding the result of a contact between two Entities.
 *
 * @category Physics
 */
class ContactPoint {
    /**
     * Create a new ContactPoint instance.
     *
     * @param {Vec3} [localPoint] - The point on the entity where the contact occurred, relative to
     * the entity.
     * @param {Vec3} [localPointOther] - The point on the other entity where the contact occurred,
     * relative to the other entity.
     * @param {Vec3} [point] - The point on the entity where the contact occurred, in world space.
     * @param {Vec3} [pointOther] - The point on the other entity where the contact occurred, in
     * world space.
     * @param {Vec3} [normal] - The normal vector of the contact on the other entity, in world
     * space.
     * @param {number} [impulse] - The total accumulated impulse applied by the constraint solver
     * during the last sub-step. Describes how hard two objects collide. Defaults to 0.
     * @hideconstructor
     */
    constructor(localPoint = new Vec3(), localPointOther = new Vec3(), point = new Vec3(), pointOther = new Vec3(), normal = new Vec3(), impulse = 0) {
        /**
         * The point on the entity where the contact occurred, relative to the entity.
         *
         * @type {Vec3}
         */
        this.localPoint = localPoint;

        /**
         * The point on the other entity where the contact occurred, relative to the other entity.
         *
         * @type {Vec3}
         */
        this.localPointOther = localPointOther;

        /**
         * The point on the entity where the contact occurred, in world space.
         *
         * @type {Vec3}
         */
        this.point = point;

        /**
         * The point on the other entity where the contact occurred, in world space.
         *
         * @type {Vec3}
         */
        this.pointOther = pointOther;

        /**
         * The normal vector of the contact on the other entity, in world space.
         *
         * @type {Vec3}
         */
        this.normal = normal;

        /**
         * The total accumulated impulse applied by the constraint solver during the last sub-step.
         * Describes how hard two objects collide.
         *
         * @type {number}
         */
        this.impulse = impulse;
    }
}

/**
 * Object holding the result of a contact between two Entities.
 *
 * @category Physics
 */
class ContactResult {
    /**
     * Create a new ContactResult instance.
     *
     * @param {import('../../entity.js').Entity} other - The entity that was involved in the
     * contact with this entity.
     * @param {ContactPoint[]} contacts - An array of ContactPoints with the other entity.
     * @hideconstructor
     */
    constructor(other, contacts) {
        /**
         * The entity that was involved in the contact with this entity.
         *
         * @type {import('../../entity.js').Entity}
         */
        this.other = other;

        /**
         * An array of ContactPoints with the other entity.
         *
         * @type {ContactPoint[]}
         */
        this.contacts = contacts;
    }
}

export { RaycastResult, SingleContactResult, ContactPoint, ContactResult };
