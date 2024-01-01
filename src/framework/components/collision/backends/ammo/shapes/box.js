import { AmmoCollisionObject } from '../collision-object.js';

class AmmoBoxCollisionObject extends AmmoCollisionObject {
    /**
     * @param {import('../../../../../entity.js').Entity} entity
     * @param {import('../../../data.js').CollisionComponentData} data
     * @returns {import('ammojs3').default.btBoxShape}
     */
    createPhysicalShape(entity, data) {
        const he = data.halfExtents;
        const ammoHe = new Ammo.btVector3(he ? he.x : 0.5, he ? he.y : 0.5, he ? he.z : 0.5);
        const shape = new Ammo.btBoxShape(ammoHe);
        Ammo.destroy(ammoHe);
        return shape;
    }
}

export { AmmoBoxCollisionObject };
