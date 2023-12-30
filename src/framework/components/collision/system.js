import { GraphNode } from '../../../scene/graph-node.js';

import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { AmmoCollisionBackend } from './backends/ammo/backend.js';

import { CollisionComponent } from './component.js';
import { CollisionComponentData } from './data.js';

const mat4 = new Mat4();
const p1 = new Vec3();
const p2 = new Vec3();
const quat = new Quat();

const _schema = [
    'enabled',
    'type',
    'halfExtents',
    'linearOffset',
    'angularOffset',
    'radius',
    'axis',
    'height',
    'asset',
    'renderAsset',
    'shape',
    'model',
    'render'
];

/**
 * Manages creation of {@link CollisionComponent}s.
 *
 * @augments ComponentSystem
 * @category Physics
 *
 * @template [Shape=any] - backend shape object
 * @template {CollisionSystemBackend<Shape>} [Backend=CollisionSystemBackend<Shape>] - collision backend system
 */
class CollisionComponentSystem extends ComponentSystem {
    /**
     * Creates a new CollisionComponentSystem instance.
     *
     * @param {import('../../app-base.js').AppBase} app - The running {@link AppBase}.
     * @hideconstructor
     */
    constructor(app) {
        super(app);

        this.id = 'collision';

        this.ComponentType = CollisionComponent;
        this.DataType = CollisionComponentData;

        this.schema = _schema;

        /** @type {Backend} */
        this._backend = /** @type {Backend} */ (/** @type {unknown} */ (new AmmoCollisionBackend()));
        this._backendUsed = false;

        /** @type {ReturnType<Backend["makeTypeImplementations"]>} */
        this._backendImplementations = /** @type {ReturnType<Backend["makeTypeImplementations"]>} */ (null);

        this.on('beforeremove', this.onBeforeRemove, this);
        this.on('remove', this.onRemove, this);
    }

    set backend(backend) {
        if (this._backendUsed)
            throw new Error("backend must be set before first use");

        this._backend = backend;
    }

    get backend() {
        return this._backend;
    }

    /**
     * @param {CollisionComponent} component
     * @param {CollisionComponentData} _data
     * @param {string[]} properties
     */
    // @ts-ignore
    initializeComponentData(component, _data, properties) {
        properties = [
            'type',
            'halfExtents',
            'radius',
            'axis',
            'height',
            'shape',
            'model',
            'asset',
            'render',
            'renderAsset',
            'enabled',
            'linearOffset',
            'angularOffset'
        ];

        // duplicate the input data because we are modifying it
        /** @type {CollisionComponentData} */
        const data = {};
        for (let i = 0, len = properties.length; i < len; i++) {
            const property = properties[i];
            data[property] = _data[property];
        }

        // asset takes priority over model
        // but they are both trying to change the mesh
        // so remove one of them to avoid conflicts
        let idx;
        if (_data.hasOwnProperty('asset')) {
            idx = properties.indexOf('model');
            if (idx !== -1) {
                properties.splice(idx, 1);
            }
            idx = properties.indexOf('render');
            if (idx !== -1) {
                properties.splice(idx, 1);
            }
        } else if (_data.hasOwnProperty('model')) {
            idx = properties.indexOf('asset');
            if (idx !== -1) {
                properties.splice(idx, 1);
            }
        }

        if (!data.type) {
            data.type = component.data.type;
        }
        component.data.type = data.type;

        if (Array.isArray(data.halfExtents)) {
            data.halfExtents = new Vec3(data.halfExtents);
        }

        if (Array.isArray(data.linearOffset)) {
            data.linearOffset = new Vec3(data.linearOffset);
        }

        if (Array.isArray(data.angularOffset)) {
            // Allow for euler angles to be passed as a 3 length array
            const values = data.angularOffset;
            if (values.length === 3) {
                data.angularOffset = new Quat().setFromEulerAngles(values[0], values[1], values[2]);
            } else {
                data.angularOffset = new Quat(data.angularOffset);
            }
        }

        this._useBackend();
        const impl = this._backendImplementations[/** @type {import('./constants.js').CollisionType} */ (data.type)];
        impl.beforeInitialize(component, data);

        super.initializeComponentData(component, data, properties);

        impl.afterInitialize(component, data);
    }

    /**
     * @private
     * @returns {Backend}
     */
    _useBackend() {
        if (!this._backendUsed) {
            if (!this.backend.isLoaded)
                throw new Error("backend not loaded");
            this._backendUsed = true;
            this._backendImplementations = /** @type {typeof this._backendImplementations} */ (this.backend.makeTypeImplementations(this));
        }

        return this._backend;
    }

    /**
     * Gets an existing implementation for the specified component
     * @param {import('./component.js').CollisionComponent} component
     * @returns {import('./backends/interface.js').CollisionObjectImpl<Shape, Backend>}
     */
    _getImplementation(component) {
        return /** @type {import('./backends/interface.js').CollisionObjectImpl<Shape, Backend>} */ (this._backendImplementations[/** @type {CollisionComponentData} */ (component.data).type]);
    }

    /**
     * @param {import('../../entity').Entity} entity
     * @param {import('../../entity').Entity} clone
     * @returns {Component}
     */
    cloneComponent(entity, clone) {
        return this._getImplementation(entity.collision).clone(entity, clone);
    }

    /**
     * @param {import('../../entity').Entity} entity
     * @param {CollisionComponent} component
     */
    onBeforeRemove(entity, component) {
        this._getImplementation(component).beforeRemove(entity, component);
        component.onBeforeRemove();
    }

    /**
     * @param {import('../../entity').Entity} entity
     * @param {CollisionComponentData} data
     */
    onRemove(entity, data) {
        this._backendImplementations[data.type].remove(entity, data);
    }

    /**
     * @param {import('../../entity').Entity} entity
     */
    updateCompoundChildTransform(entity) {
        // TODO
        // use updateChildTransform once it is exposed in ammo.js

        this._removeCompoundChild(entity.collision._compoundParent, entity.collision.data.shape);

        if (entity.enabled && entity.collision.enabled) {
            const transform = this._getNodeTransform(entity, entity.collision._compoundParent.entity);
            entity.collision._compoundParent.shape.addChildShape(transform, entity.collision.data.shape);
            Ammo.destroy(transform);
        }
    }

    /**
     * @param {CollisionComponent} collision
     * @param {import('ammojs3').default.btCollisionShape} shape
     */
    _removeCompoundChild(collision, shape) {
        /** @type {import('ammojs3').default.btCompoundShape} */
        // @ts-ignore
        const compoundShape = collision.shape;
        if (compoundShape.removeChildShape) {
            compoundShape.removeChildShape(shape);
        } else {
            const ind = collision._getCompoundChildShapeIndex(shape);
            if (ind !== null) {
                compoundShape.removeChildShapeByIndex(ind);
            }
        }
    }

    /**
     * @param {CollisionComponent} component
     * @param {Vec3} position
     * @param {Quat} rotation
     * @param {Vec3} scale
     */
    onTransformChanged(component, position, rotation, scale) {
        this._getImplementation(component).updateTransform(component, position, rotation, scale);
    }

    /**
     * Destroys the previous collision type and creates a new one based on the new type provided
     * @param {CollisionComponent} component
     * @param {import('./constants.js').CollisionType} previousType
     * @param {import('./constants.js').CollisionType} newType
     */
    changeType(component, previousType, newType) {
        this._backendImplementations[previousType].beforeRemove(component.entity, component);
        this._backendImplementations[previousType].remove(component.entity, component.data);
        this._backendImplementations[newType].reset(component, component.data);
    }

    /**
     * Recreates physics bodies or triggers for the specified component
     * @param {CollisionComponent} component
     */
    recreatePhysicalShapes(component) {
        this._getImplementation(component).recreatePhysicalShapes(component);
    }

    /**
     * @param {GraphNode} node
     * @param {GraphNode} relative
     */
    _calculateNodeRelativeTransform(node, relative) {
        if (node === relative) {
            const scale = node.getWorldTransform().getScale();
            mat4.setScale(scale.x, scale.y, scale.z);
        } else {
            this._calculateNodeRelativeTransform(node.parent, relative);
            mat4.mul(node.getLocalTransform());
        }
    }

    /**
     * @param {GraphNode} node
     * @returns {import('ammojs3').default.btVector3}
     */
    _getNodeScaling(node) {
        const wtm = node.getWorldTransform();
        const scl = wtm.getScale();
        return new Ammo.btVector3(scl.x, scl.y, scl.z);
    }

    /**
     * @param {GraphNode} node
     * @param {GraphNode} relative
     * @returns {import('ammojs3').default.btTransform}
     */
    _getNodeTransform(node, relative) {
        let pos, rot;

        if (relative) {
            this._calculateNodeRelativeTransform(node, relative);

            pos = p1;
            rot = quat;

            mat4.getTranslation(pos);
            rot.setFromMat4(mat4);
        } else {
            pos = node.getPosition();
            rot = node.getRotation();
        }
        const ammoQuat = new Ammo.btQuaternion();
        const transform = new Ammo.btTransform();

        transform.setIdentity();
        const origin = transform.getOrigin();
        /** @type {import('../../entity').Entity} */
        // @ts-ignore
        const entity = node;
        const component = entity.collision;

        if (component && component._hasOffset) {
            const lo = component.data.linearOffset;
            const ao = component.data.angularOffset;
            const newOrigin = p2;

            quat.copy(rot).transformVector(lo, newOrigin);
            newOrigin.add(pos);
            quat.copy(rot).mul(ao);

            origin.setValue(newOrigin.x, newOrigin.y, newOrigin.z);
            ammoQuat.setValue(quat.x, quat.y, quat.z, quat.w);
        } else {
            origin.setValue(pos.x, pos.y, pos.z);
            ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
        }

        transform.setRotation(ammoQuat);
        Ammo.destroy(ammoQuat);
        Ammo.destroy(origin);

        return transform;
    }

    destroy() {
        this.backend.destroy();

        super.destroy();
    }
}

Component._buildAccessors(CollisionComponent.prototype, _schema);

export { CollisionComponentSystem };
