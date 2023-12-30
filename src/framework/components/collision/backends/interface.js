import { GraphNode } from '../../../../scene/graph-node.js';
import { Model } from '../../../../scene/model.js';
import { Trigger } from '../trigger.js';

/**
 * Collision system implementations
 *
 * @template [Shape=any] - shape implementation
 * @template {CollisionSystemBackend<Shape>} [Backend=CollisionSystemBackend<Shape>] - collision backend system
 */
class CollisionObjectImpl {
    /**
     * @param {import('../system.js').CollisionComponentSystem<Shape, Backend>} system
     */
    constructor(system) {
        /** @type {import('../system.js').CollisionComponentSystem<Shape, Backend>} */
        this.system = system;
    }

    /**
     * Called before the call to system.super.initializeComponentData is made
     * @param {import('../component.js').CollisionComponent} component
     * @param {import('../data.js').CollisionComponentData} data
     */
    beforeInitialize(component, data) {
        data.shape = null;

        data.model = new Model();
        data.model.graph = new GraphNode();
    }

    /**
     * Called after the call to system.super.initializeComponentData is made
     * @param {import('../component.js').CollisionComponent} component
     * @param {import('../data.js').CollisionComponentData} data
     */
    afterInitialize(component, data) {
        this.recreatePhysicalShapes(component);
        component.data.initialized = true;
    }

    /**
     * Called when a collision component changes type in order to recreate debug and physical shapes
     * @param {import('../component.js').CollisionComponent} component
     * @param {import('../data.js').CollisionComponentData} data
     */
    reset(component, data) {
        this.beforeInitialize(component, data);
        this.afterInitialize(component, data);
    }

    /**
     * Re-creates physics bodies / triggers
     * @param {import('../component.js').CollisionComponent} component
     */
    recreatePhysicalShapes(component) {
        const entity = component.entity;
        const data = component.data;

        if (this.system.backend.isLoaded) {
            if (entity.trigger) {
                entity.trigger.destroy();
                delete entity.trigger;
            }

            if (data.shape) {
                if (component._compoundParent) {
                    this.system._removeCompoundChild(component._compoundParent, data.shape);

                    if (component._compoundParent.entity.physics)
                        component._compoundParent.entity.physics.activate();
                }

                this.destroyData(data);
            }

            data.shape = this.createPhysicalShape(component.entity, data);

            const firstCompoundChild = !component._compoundParent;

            if (data.type === 'compound' && (!component._compoundParent || component === component._compoundParent)) {
                component._compoundParent = component;

                entity.forEach(this._addEachDescendant, component);
            } else if (data.type !== 'compound') {
                if (component._compoundParent && component === component._compoundParent) {
                    entity.forEach(this.system.implementations.compound._updateEachDescendant, component);
                }

                if (!component.physics) {
                    component._compoundParent = null;
                    let parent = entity.parent;
                    while (parent) {
                        /** @type {import('../../../entity.js').Entity} */
                        // @ts-ignore
                        const parentEntity = parent;
                        if (parentEntity.collision && parentEntity.collision.type === 'compound') {
                            component._compoundParent = parentEntity.collision;
                            break;
                        }
                        parent = parent.parent;
                    }
                }
            }

            if (component._compoundParent) {
                if (component !== component._compoundParent) {
                    if (firstCompoundChild && component._compoundParent.shape.getNumChildShapes() === 0) {
                        this.system.recreatePhysicalShapes(component._compoundParent);
                    } else {
                        this.system.updateCompoundChildTransform(entity);

                        if (component._compoundParent.entity.physics)
                            component._compoundParent.entity.physics.activate();
                    }
                }
            }

            if (entity.physics) {
                entity.physics.disableSimulation();
                entity.physics.createBody();

                if (entity.enabled && entity.physics.enabled) {
                    entity.physics.enableSimulation();
                }
            } else if (!component._compoundParent) {
                if (!entity.trigger) {
                    entity.trigger = new Trigger(this.system.app, component, data);
                } else {
                    entity.trigger.initialize(data);
                }
            }
        }
    }

    /**
     * Creates a physical shape for the collision. This consists
     * of the actual shape that will be used for the rigid bodies / triggers of
     * the collision.
     * @param {import('../../../entity.js').Entity} entity
     * @param {import('../data.js').CollisionComponentData} data
     * @returns {Shape}
     */
    createPhysicalShape(entity, data) {
        return /** @type {Shape} */ (undefined);
    }

    /**
     * @param {import('../component.js').CollisionComponent} component
     * @param {import('../../../../core/math/vec3.js').Vec3} position
     * @param {import('../../../../core/math/quat.js').Quat} rotation
     * @param {import('../../../../core/math/vec3.js').Vec3} scale
     */
    updateTransform(component, position, rotation, scale) {
        if (component.entity.trigger) {
            component.entity.trigger.updateTransform();
        }
    }

    /**
     * Destroys this collision object impl
     */
    destroy() {
    }

    /**
     * @protected
     * @param {Shape} shape - backend shape to destroy
     */
    destroyShape(shape) {
        throw new Error("not implemented");
    }

    destroyData(data) {
        if (data.shape) {
            this.destroyShape(data.shape);
            data.shape = null;
        }
    }

    /**
     * @param {import('../../../entity.js').Entity} entity
     * @param {import('../component.js').CollisionComponent} component
     */
    beforeRemove(entity, component) {
        if (component.data.shape) {
            if (component._compoundParent && !component._compoundParent.entity._destroying) {
                this.system._removeCompoundChild(component._compoundParent, component.data.shape);

                if (component._compoundParent.entity.physics)
                    component._compoundParent.entity.physics.activate();
            }

            component._compoundParent = null;

            this.destroyData(component.data);
        }
    }

    /**
     * Called when the collision is removed
     * @param {import('../../../entity.js').Entity} entity
     * @param {import('../data.js').CollisionComponentData} data
     */
    remove(entity, data) {
        if (entity.physics && entity.physics.body) {
            entity.physics.disableSimulation();
        }

        if (entity.trigger) {
            entity.trigger.destroy();
            delete entity.trigger;
        }
    }

    /**
     * Called when the collision is cloned to another entity
     * @param {import('../../../entity.js').Entity} entity
     * @param {import('../../../entity.js').Entity} clone
     * @returns {import('../component.js').CollisionComponent}
     */
    clone(entity, clone) {
        const src = this.system.store[entity.getGuid()];

        const data = {
            enabled: src.data.enabled,
            type: src.data.type,
            halfExtents: [src.data.halfExtents.x, src.data.halfExtents.y, src.data.halfExtents.z],
            linearOffset: [src.data.linearOffset.x, src.data.linearOffset.y, src.data.linearOffset.z],
            angularOffset: [src.data.angularOffset.x, src.data.angularOffset.y, src.data.angularOffset.z, src.data.angularOffset.w],
            radius: src.data.radius,
            axis: src.data.axis,
            height: src.data.height,
            asset: src.data.asset,
            renderAsset: src.data.renderAsset,
            model: src.data.model,
            render: src.data.render
        };

        // @ts-ignore
        return this.system.addComponent(clone, data);
    }
}

/**
 * @template [Shape=any] collision shape backend
 */
class CollisionSystemBackend {
    /** @type {boolean} */
    get isLoaded() {
        throw new Error("not implemented");
    }

    destroy() {
    }

    /**
     * Makes implementations to interface with backend objects.
     *
     * @param {import('../system.js').CollisionComponentSystem<Shape>} system - collision component system
     * @return {Record<import('../constants.js').CollisionType, CollisionObjectImpl<Shape>>}
     */
    makeTypeImplementations(system) {
        throw new Error("not implemented");
    }
}

export { CollisionObjectImpl, CollisionSystemBackend };
