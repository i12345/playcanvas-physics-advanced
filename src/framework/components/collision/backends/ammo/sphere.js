import { AmmoCollisionObject } from './base.js';

class AmmoSphereCollisionObject extends AmmoCollisionObject {
    /**
     * @param {import('../../../../entity.js').Entity} entity
     * @param {import('../../data.js').CollisionComponentData} data
     * @returns {import('ammojs3').default.btSphereShape}
     */
    createPhysicalShape(entity, data) {
        return new Ammo.btSphereShape(data.radius);
    }
}

export { AmmoSphereCollisionObject };
