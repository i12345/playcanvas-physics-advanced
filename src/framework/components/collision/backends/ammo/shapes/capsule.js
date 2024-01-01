import { AmmoCollisionObject } from '../collision-object.js';

class AmmoCapsuleCollisionObject extends AmmoCollisionObject {
    /**
     * @param {import('../../../../../entity.js').Entity} entity
     * @param {import('../../../data.js').CollisionComponentData} data
     * @returns {import('ammojs3').default.btCapsuleShape}
     */
    createPhysicalShape(entity, data) {
        const axis = data.axis ?? 1;
        const radius = data.radius ?? 0.5;
        const height = Math.max((data.height ?? 2) - 2 * radius, 0);

        let shape = null;

        switch (axis) {
            case 0:
                shape = new Ammo.btCapsuleShapeX(radius, height);
                break;
            case 1:
                shape = new Ammo.btCapsuleShape(radius, height);
                break;
            case 2:
                shape = new Ammo.btCapsuleShapeZ(radius, height);
                break;
        }

        return shape;
    }
}

export { AmmoCapsuleCollisionObject };
