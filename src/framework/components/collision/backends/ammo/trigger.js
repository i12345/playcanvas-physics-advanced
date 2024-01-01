import { BODYMASK_NOT_STATIC, BODYGROUP_TRIGGER } from '../../../physics/constants.js';
import { AMMO_BODYFLAG_NORESPONSE_OBJECT, AMMO_BODYSTATE_ACTIVE_TAG, AMMO_BODYSTATE_DISABLE_SIMULATION } from "../../../physics/backends/ammo/constants.js";
import { Trigger } from "../../trigger.js";

/** @type {import('ammojs3').default.btVector3} */
let _ammoVec1;
/** @type {import('ammojs3').default.btQuaternion} */
let _ammoQuat;
/** @type {import('ammojs3').default.btTransform} */
let _ammoTransform;

class AmmoTrigger extends Trigger {
    /**
     * Create a new Trigger instance.
     *
     * @param {import('../../../../app-base.js').AppBase} app - The running {@link AppBase}.
     * @param {import('../../component.js').CollisionComponent<import('./base.js').AmmoShape>} component -
     * The component for which the trigger will be created.
     * @param {import('../../data.js').CollisionComponentData<import('./base.js').AmmoShape>} data - The
     * data for the component.
     */
    // eslint-disable-next-line no-useless-constructor
    constructor(app, component, data) {
        super(app, component, data);
    }

    /**
     * @param {import('../../data.js').CollisionComponentData<import('./base.js').AmmoShape>} data
     */
    initialize(data) {
        if (typeof Ammo !== 'undefined' && !_ammoVec1) {
            _ammoVec1 = new Ammo.btVector3();
            _ammoQuat = new Ammo.btQuaternion();
            _ammoTransform = new Ammo.btTransform();
        }

        const entity = this.entity;
        const shape = data.shape;

        if (shape) {
            if (entity.trigger) {
                entity.trigger.destroy();
            }

            const mass = 1;

            const component = this.component;
            if (component) {
                const bodyPos = component.getShapePosition();
                const bodyRot = component.getShapeRotation();
                _ammoVec1.setValue(bodyPos.x, bodyPos.y, bodyPos.z);
                _ammoQuat.setValue(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w);
            } else {
                const pos = entity.getPosition();
                const rot = entity.getRotation();
                _ammoVec1.setValue(pos.x, pos.y, pos.z);
                _ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
            }

            _ammoTransform.setOrigin(_ammoVec1);
            _ammoTransform.setRotation(_ammoQuat);

            const body = (/** @type {import('../../../physics/backends/ammo/backend.js').AmmoPhysicsSystemBackend} */ (this.app.systems.physics.backend)).createRigidBody(mass, shape, _ammoTransform);

            body.setRestitution(0);
            body.setFriction(0);
            body.setDamping(0, 0);
            _ammoVec1.setValue(0, 0, 0);
            body.setLinearFactor(_ammoVec1);
            body.setAngularFactor(_ammoVec1);

            body.setCollisionFlags(body.getCollisionFlags() | AMMO_BODYFLAG_NORESPONSE_OBJECT);
            body.entity = entity;

            this.body = body;

            if (this.component.enabled && entity.enabled) {
                this.enable();
            }
        }
    }

    destroy() {
        const body = this.body;
        if (!body) return;

        this.disable();

        (/** @type {import('../../../physics/backends/ammo/backend.js').AmmoPhysicsSystemBackend} */ (this.app.systems.physics.backend)).destroyRigidBody(body);
    }

    /**
     * @private
     * @param {import('ammojs3').default.btTransform} transform 
     */
    _getEntityTransform(transform) {
        const component = this.component;
        if (component) {
            const bodyPos = component.getShapePosition();
            const bodyRot = component.getShapeRotation();
            _ammoVec1.setValue(bodyPos.x, bodyPos.y, bodyPos.z);
            _ammoQuat.setValue(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w);
        } else {
            const pos = this.entity.getPosition();
            const rot = this.entity.getRotation();
            _ammoVec1.setValue(pos.x, pos.y, pos.z);
            _ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
        }

        transform.setOrigin(_ammoVec1);
        transform.setRotation(_ammoQuat);
    }

    updateTransform() {
        this._getEntityTransform(_ammoTransform);

        const body = this.body;
        body.setWorldTransform(_ammoTransform);
        body.activate();
    }

    enable() {
        const body = this.body;
        if (!body) return;

        (/** @type {import('../../../physics/backends/ammo/backend.js').AmmoPhysicsSystemBackend} */ (this.app.systems.physics.backend)).addRigidBody(body, BODYGROUP_TRIGGER, BODYMASK_NOT_STATIC ^ BODYGROUP_TRIGGER);

        // set the body's activation state to active so that it is
        // simulated properly again
        body.forceActivationState(AMMO_BODYSTATE_ACTIVE_TAG);

        super.enable();
    }

    disable() {
        const body = this.body;
        if (!body) return;

        (/** @type {import('../../../physics/backends/ammo/backend.js').AmmoPhysicsSystemBackend} */ (this.app.systems.physics.backend)).removeRigidBody(body);

        // set the body's activation state to disable simulation so
        // that it properly deactivates after we remove it from the physics world
        body.forceActivationState(AMMO_BODYSTATE_DISABLE_SIMULATION);

        super.disable();
    }
}

export { AmmoTrigger };
