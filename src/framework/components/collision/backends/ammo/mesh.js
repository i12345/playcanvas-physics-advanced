import { SEMANTIC_POSITION } from '../../../../../platform/graphics/constants.js';
import { GraphNode } from '../../../../../scene/graph-node.js';
import { Trigger } from '../../trigger.js';
import { AmmoCollisionObject } from './base.js';
import { AmmoTrigger } from './trigger.js';

const tempGraphNode = new GraphNode();

class AmmoMeshCollisionObject extends AmmoCollisionObject {
    /**
     * Constructs new ammo mesh collision object
     *
     * @param {import('../../system.js').CollisionComponentSystem<import('./base.js').AmmoShape>} system - collision system
     */
    constructor(system) {
        super(system);

        /** @type {Record<string,import('ammojs3').default.btTriangleMesh>} */
        this._triMeshCache = { };
    }

    // override for the mesh implementation because the asset model needs
    // special handling
    beforeInitialize(component, data) {}

    destroy() {
        for (const key in this._triMeshCache) {
            Ammo.destroy(this._triMeshCache[key]);
        }
    }

    /**
     * @param {import('../../../../../scene/mesh.js').Mesh} mesh
     * @param {import('../../../../../scene/graph-node.js').GraphNode} node
     * @param {import('ammojs3').default.btCompoundShape} shape
     */
    createAmmoMesh(mesh, node, shape) {
        let triMesh;

        if (this._triMeshCache[mesh.id]) {
            triMesh = this._triMeshCache[mesh.id];
        } else {
            const vb = mesh.vertexBuffer;

            const format = vb.getFormat();
            let stride;
            let positions;
            for (let i = 0; i < format.elements.length; i++) {
                const element = format.elements[i];
                if (element.name === SEMANTIC_POSITION) {
                    positions = new Float32Array(vb.lock(), element.offset);
                    stride = element.stride / 4;
                    break;
                }
            }

            const indices = [];
            mesh.getIndices(indices);
            const numTriangles = mesh.primitive[0].count / 3;

            const v1 = new Ammo.btVector3();
            const v2 = new Ammo.btVector3();
            const v3 = new Ammo.btVector3();
            let i1, i2, i3;

            const base = mesh.primitive[0].base;
            triMesh = new Ammo.btTriangleMesh();
            this._triMeshCache[mesh.id] = triMesh;

            for (let i = 0; i < numTriangles; i++) {
                i1 = indices[base + i * 3] * stride;
                i2 = indices[base + i * 3 + 1] * stride;
                i3 = indices[base + i * 3 + 2] * stride;
                v1.setValue(positions[i1], positions[i1 + 1], positions[i1 + 2]);
                v2.setValue(positions[i2], positions[i2 + 1], positions[i2 + 2]);
                v3.setValue(positions[i3], positions[i3 + 1], positions[i3 + 2]);
                triMesh.addTriangle(v1, v2, v3, true);
            }

            Ammo.destroy(v1);
            Ammo.destroy(v2);
            Ammo.destroy(v3);
        }

        const useQuantizedAabbCompression = true;
        const triMeshShape = new Ammo.btBvhTriangleMeshShape(triMesh, useQuantizedAabbCompression);

        const scaling = this.system._getNodeScaling(node);
        triMeshShape.setLocalScaling(scaling);
        Ammo.destroy(scaling);

        const transform = this.system._getNodeTransform(node);
        shape.addChildShape(transform, triMeshShape);
        Ammo.destroy(transform);
    }

    /**
     * @param {import('../../../../entity.js').Entity} entity
     * @param {import('../../data.js').CollisionComponentData} data
     * @returns {import('ammojs3').default.btCompoundShape}
     */
    createPhysicalShape(entity, data) {
        if (data.model || data.render) {

            const shape = new Ammo.btCompoundShape();

            if (data.model) {
                const meshInstances = data.model.meshInstances;
                for (let i = 0; i < meshInstances.length; i++) {
                    this.createAmmoMesh(meshInstances[i].mesh, meshInstances[i].node, shape);
                }
            } else if (data.render) {
                const meshes = data.render.meshes;
                for (let i = 0; i < meshes.length; i++) {
                    this.createAmmoMesh(meshes[i], tempGraphNode, shape);
                }
            }

            const entityTransform = entity.getWorldTransform();
            const scale = entityTransform.getScale();
            const vec = new Ammo.btVector3(scale.x, scale.y, scale.z);
            shape.setLocalScaling(vec);
            Ammo.destroy(vec);

            return shape;
        }

        return undefined;
    }

    /**
     * @param {import('../../component.js').CollisionComponent} component
     */
    recreatePhysicalShapes(component) {
        const data = component.data;

        if (data.renderAsset || data.asset) {
            if (component.enabled && component.entity.enabled) {
                this.loadAsset(
                    component,
                    data.renderAsset || data.asset,
                    data.renderAsset ? 'render' : 'model'
                );
                return;
            }
        }

        this.doRecreatePhysicalShape(component);
    }

    /**
     * @param {import('../../component.js').CollisionComponent} component
     * @param {*} id
     * @param {*} property
     */
    loadAsset(component, id, property) {
        const data = component.data;
        const assets = this.system.app.assets;
        const previousPropertyValue = data[property];

        const onAssetFullyReady = (asset) => {
            if (data[property] !== previousPropertyValue) {
                // the asset has changed since we started loading it, so ignore this callback
                return;
            }
            data[property] = asset.resource;
            this.doRecreatePhysicalShape(component);
        };

        const loadAndHandleAsset = (asset) => {
            asset.ready((asset) => {
                if (asset.data.containerAsset) {
                    const containerAsset = assets.get(asset.data.containerAsset);
                    if (containerAsset.loaded) {
                        onAssetFullyReady(asset);
                    } else {
                        containerAsset.ready(() => {
                            onAssetFullyReady(asset);
                        });
                        assets.load(containerAsset);
                    }
                } else {
                    onAssetFullyReady(asset);
                }
            });

            assets.load(asset);
        };

        const asset = assets.get(id);
        if (asset) {
            loadAndHandleAsset(asset);
        } else {
            assets.once('add:' + id, loadAndHandleAsset);
        }
    }

    /**
     * @param {import('../../component.js').CollisionComponent} component
     */
    doRecreatePhysicalShape(component) {
        const entity = component.entity;
        const data = component.data;

        if (data.model || data.render) {
            this.destroyData(data);

            data.shape = this.createPhysicalShape(entity, data);

            if (entity.physics) {
                entity.physics.disableSimulation();
                entity.physics.createBody();

                if (entity.enabled && entity.physics.enabled) {
                    entity.physics.enableSimulation();
                }
            } else {
                if (!entity.trigger) {
                    entity.trigger = new AmmoTrigger(this.system.app, component, data);
                } else {
                    entity.trigger.initialize(data);
                }
            }
        } else {
            this.beforeRemove(entity, component);
            this.remove(entity, data);
        }
    }

    /**
     * @param {import('../../component.js').CollisionComponent} component
     * @param {import('../../../../../core/math/vec3.js').Vec3} position
     * @param {import('../../../../../core/math/quat.js').Quat} rotation
     * @param {import('../../../../../core/math/vec3.js').Vec3} scale
     */
    updateTransform(component, position, rotation, scale) {
        if (component.shape) {
            const entityTransform = component.entity.getWorldTransform();
            const worldScale = entityTransform.getScale();

            // if the scale changed then recreate the shape
            const previousScale = component.shape.getLocalScaling();
            if (worldScale.x !== previousScale.x() ||
                worldScale.y !== previousScale.y() ||
                worldScale.z !== previousScale.z()) {
                this.doRecreatePhysicalShape(component);
            }
        }

        super.updateTransform(component, position, rotation, scale);
    }

    /**
     * @param {import('../../data.js').CollisionComponentData<import('./base.js').AmmoShape>} data
     */
    destroyData(data) {
        if (!data.shape)
            return;

        const shape = /** @type {import('ammojs3').default.btCompoundShape} */ (data.shape);

        const numShapes = shape.getNumChildShapes();
        for (let i = 0; i < numShapes; i++) {
            const child_shape = shape.getChildShape(i);
            Ammo.destroy(child_shape);
        }

        Ammo.destroy(shape);
        data.shape = null;
    }
}

export { AmmoMeshCollisionObject };
