import { AmmoSphereCollisionObject } from "./sphere.js";
import { AmmoBoxCollisionObject } from "./box.js";
import { AmmoCapsuleCollisionObject } from "./capsule.js";
import { AmmoCylinderCollisionObject } from "./cylinder.js";
import { AmmoConeCollisionObject } from "./cone.js";
import { AmmoMeshCollisionObject } from "./mesh.js";
import { AmmoCompoundCollisionObject } from "./compound.js";
import { CollisionSystemBackend } from "../interface.js";

/**
 * @augments CollisionSystemBackend<import("./base.js").AmmoShape>
 */
class AmmoCollisionSystemBackend extends CollisionSystemBackend {
    get isLoaded() {
        return typeof Ammo !== 'undefined';
    }

    /**
     * Makes implementations to interface with backend objects.
     *
     * @param {import('../../system.js').CollisionComponentSystem<import("./base.js").AmmoShape>} system - collision component system
     * @returns {Record<import('../../constants.js').CollisionType,import('./base.js').AmmoCollisionObject>}
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
