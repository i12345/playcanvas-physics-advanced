import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';

/**
 * @template [Shape=any]
 */
class CollisionComponentData {
    constructor() {
        this.enabled = true;
        /** @type {import('./constants.js').CollisionType} */
        this.type = 'box';
        this.halfExtents = new Vec3(0.5, 0.5, 0.5);
        this.linearOffset = new Vec3();
        this.angularOffset = new Quat();
        this.radius = 0.5;
        /** @type {0|1|2} */
        this.axis = 1;
        this.height = 2;
        /** @type {number} */
        this.asset = null;
        /** @type {number} */
        this.renderAsset = null;

        // Non-serialized properties
        /** @type {Shape} */
        this.shape = null;
        /** @type {import('../../../scene/model').Model} */
        this.model = null;
        this.render = null;
        this.initialized = false;
    }
}

export { CollisionComponentData };
