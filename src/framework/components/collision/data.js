import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';

class CollisionComponentData {
    constructor() {
        this.enabled = true;
        /** @type {'box'|'sphere'|'capsule'|'cylinder'|'cone'|'mesh'|'compound'} */
        this.type = 'box';
        this.halfExtents = new Vec3(0.5, 0.5, 0.5);
        this.linearOffset = new Vec3();
        this.angularOffset = new Quat();
        this.radius = 0.5;
        this.axis = 1;
        this.height = 2;
        /** @type {number} */
        this.asset = null;
        /** @type {number} */
        this.renderAsset = null;

        // Non-serialized properties
        /** @type {import('ammojs3').default.btCollisionShape} */
        this.shape = null;
        /** @type {import('../../../scene/model').Model} */
        this.model = null;
        this.render = null;
        this.initialized = false;
    }
}

export { CollisionComponentData };
