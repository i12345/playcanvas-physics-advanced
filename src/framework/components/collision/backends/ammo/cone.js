import { AmmoCollisionObject } from './base.js';

class AmmoConeCollisionObject extends AmmoCollisionObject {
    /**
     * @param {import('../../../../entity.js').Entity} entity
     * @param {import('../../data.js').CollisionComponentData} data
     * @returns {import('ammojs3').default.btConeShape}
     */
    createPhysicalShape(entity, data) {
        const axis = data.axis ?? 1;
        const radius = data.radius ?? 0.5;
        const height = data.height ?? 1;

        let shape = null;

        switch (axis) {
            case 0:
                shape = new Ammo.btConeShapeX(radius, height);
                break;
            case 1:
                shape = new Ammo.btConeShape(radius, height);
                break;
            case 2:
                shape = new Ammo.btConeShapeZ(radius, height);
                break;
        }

        return shape;
    }
}

export { AmmoConeCollisionObject };
