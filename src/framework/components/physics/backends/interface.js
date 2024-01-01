/**
 * @template {import('../component.js').PhysicsComponent} [Component=import('../component.js').PhysicsComponent]
 */
class PhysicsSystemBackend {
    /**
     * Constructs a backend interface for physics
     *
     * @param {import('../system.js').PhysicsComponentSystem<Component>} system - physics component system
     * @param {(typeof import('../component.js').PhysicsComponent) & { new(system: import('../system.js').PhysicsComponentSystem<Component>, entity: import('../../../entity.js').Entity): Component }} Component - component type
     */
    constructor(system, Component) {
        this.system = system;
        this.Component = Component;
    }

    /**
     * Initializes physics
     *
     * @abstract
     */
    init() {
        throw new Error("not implemented");
    }

    /**
     * Steps simulation
     * @param {number} dt - fractional seconds for update
     * @abstract
     */
    update(dt) {
        throw new Error("not implemented");
    }

    /**
     * Update steps performed after _updateDynamic() called on the dynamic
     * objects.
     *
     * @param {number} dt - fractional seconds for update
     */
    updateAfterMotion(dt) {
    }

    /**
     * Removes a {@link PhysicsComponent} from an entity.
     *
     * @param {import('../../../entity').Entity} entity - The entity to remove
     * @param {Component} component - The {@link PhysicsComponent} to remove from the entity
     */
    onRemove(entity, component) {
        throw new Error("not implemented");
    }

    /**
     * Destroys simulation backend
     */
    destroy() {
        throw new Error("not implemented");
    }
}

export { PhysicsSystemBackend };
