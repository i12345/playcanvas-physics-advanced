import { AmmoSphereCollisionObject, AmmoBoxCollisionObject, AmmoCapsuleCollisionObject, AmmoCylinderCollisionObject, AmmoConeCollisionObject, AmmoMeshCollisionObject, AmmoCompoundCollisionObject } from "./shapes/index.js";
import { CollisionSystemBackend } from "../interface.js";
import { AmmoTrigger } from "./trigger.js";

/**
 * @augments CollisionSystemBackend<import("./collision-object.js").AmmoShape>
 */
class AmmoCollisionSystemBackend extends CollisionSystemBackend {
    constructor() {
        super(AmmoTrigger);
    }

    /**
     * Makes implementations to interface with backend objects.
     *
     * @param {import('../../system.js').CollisionComponentSystem<import("./collision-object.js").AmmoShape>} system - collision component system
     * @returns {Record<import('../../constants.js').CollisionType,import('./collision-object.js').AmmoCollisionObject>}
     */
    makeTypeImplementations(system) {
        return {
            sphere: new AmmoSphereCollisionObject(system),
            box: new AmmoBoxCollisionObject(system),
            capsule: new AmmoCapsuleCollisionObject(system),
            cylinder: new AmmoCylinderCollisionObject(system),
            cone: new AmmoConeCollisionObject(system),
            mesh: new AmmoMeshCollisionObject(system),
            compound: new AmmoCompoundCollisionObject(system)
        };
    }
}

export { AmmoCollisionSystemBackend as AmmoCollisionBackend };
