import { AmmoCollisionObject } from '../collision-object.js';

class AmmoCompoundCollisionObject extends AmmoCollisionObject {
    /**
     * @param {import('../../../../../entity.js').Entity} entity
     * @param {import('../../../data.js').CollisionComponentData} data
     * @returns {import('ammojs3').default.btCompoundShape}
     */
    createPhysicalShape(entity, data) {
        return new Ammo.btCompoundShape();
    }

    /**
     * @param {import('../../../../../entity.js').Entity} entity
     */
    _addEachDescendant(entity) {
        if (!entity.collision || entity.physics)
            return;

        entity.collision._compoundParent = this;

        if (entity !== this.entity) {
            this.system.recreatePhysicalShapes(entity.collision);
        }
    }

    /**
     * @param {import('../../../../../entity.js').Entity} entity
     */
    _updateEachDescendant(entity) {
        if (!entity.collision)
            return;

        if (entity.collision._compoundParent !== this)
            return;

        entity.collision._compoundParent = null;

        if (entity !== this.entity && !entity.physics) {
            entity.collision.system.recreatePhysicalShapes(entity.collision);
        }
    }

    /**
     * @param {import('../../../../../entity.js').Entity} entity
     */
    _updateEachDescendantTransform(entity) {
        if (!entity.collision || entity.collision._compoundParent !== this.collision._compoundParent)
            return;

        this.collision.system.updateCompoundChildTransform(entity);
    }
}

export { AmmoCompoundCollisionObject };
