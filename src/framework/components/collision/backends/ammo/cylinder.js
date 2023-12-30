import { AmmoCollisionObject } from './base.js';

class AmmoCylinderCollisionObject extends AmmoCollisionObject {
    /**
     * @param {import('../../../../entity.js').Entity} entity
     * @param {import('../../data.js').CollisionComponentData} data
     * @returns {import('ammojs3').default.btCylinderShape}
     */
    createPhysicalShape(entity, data) {
        const axis = data.axis ?? 1;
        const radius = data.radius ?? 0.5;
        const height = data.height ?? 1;

        let halfExtents = null;
        let shape = null;

        switch (axis) {
            case 0:
                halfExtents = new Ammo.btVector3(height * 0.5, radius, radius);
                shape = new Ammo.btCylinderShapeX(halfExtents);
                break;
            case 1:
                halfExtents = new Ammo.btVector3(radius, height * 0.5, radius);
                shape = new Ammo.btCylinderShape(halfExtents);
                break;
            case 2:
                halfExtents = new Ammo.btVector3(radius, radius, height * 0.5);
                shape = new Ammo.btCylinderShapeZ(halfExtents);
                break;
        }

        Ammo.destroy(halfExtents);

        return shape;
    }
}

export { AmmoCylinderCollisionObject };
