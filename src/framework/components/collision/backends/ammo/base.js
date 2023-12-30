import { CollisionObjectImpl } from "../interface.js";

/** @typedef {import('ammojs3').default.btCollisionShape} AmmoShape */

/**
 * Ammo.js collision object
 *
 * @augments CollisionObjectImpl<AmmoShape,import('./backend.js').AmmoCollisionBackend>
 */
class AmmoCollisionObject extends CollisionObjectImpl {
    /**
     * @protected
     * @param {AmmoShape} shape - backend shape to destroy
     */
    destroyShape(shape) {
        Ammo.destroy(shape);
    }
}

export { AmmoCollisionObject };
