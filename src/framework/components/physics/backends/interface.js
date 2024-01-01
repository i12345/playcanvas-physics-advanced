class PhysicsSystemBackend {
    /**
     * Constructs a backend interface for physics
     *
     * @param {import('../system.js').PhysicsComponentSystem} system - physics component system
     * @param {typeof import('../component.js').PhysicsComponent} Component - component type
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
     * Raycast the world and return the first entity the ray hits. Fire a ray into the world from
     * start to end, if the ray hits an entity with a collision component, it returns a
     * {@link RaycastResult}, otherwise returns null.
     *
     * @param {import('../../../../core/math/vec3.js').Vec3} start - The world space point where the ray starts.
     * @param {import('../../../../core/math/vec3.js').Vec3} end - The world space point where the ray ends.
     * @param {object} [options] - The additional options for the raycasting.
     * @param {number} [options.filterCollisionGroup] - Collision group to apply to the raycast.
     * @param {number} [options.filterCollisionMask] - Collision mask to apply to the raycast.
     * @param {any[]} [options.filterTags] - Tags filters. Defined the same way as a {@link Tags#has}
     * query but within an array.
     * @param {(entity: import('../../../entity.js').Entity) => boolean} [options.filterCallback] -
     * Custom function to use to filter entities. Must return true to proceed
     * with result. Takes the entity to evaluate as argument.
     *
     * @returns {import('../types.js').RaycastResult|null} The result of the raycasting or null if there was no hit.
     */
    raycastFirst(start, end, options = {}) {
        return null;
    }

    /**
     * Raycast the world and return all entities the ray hits. It returns an array of
     * {@link RaycastResult}, one for each hit. If no hits are detected, the returned array will be
     * of length 0. Results are sorted by distance with closest first.
     *
     * @param {import('../../../../core/math/vec3.js').Vec3} start - The world space point where the ray starts.
     * @param {import('../../../../core/math/vec3.js').Vec3} end - The world space point where the ray ends.
     * @param {object} [options] - The additional options for the raycasting.
     * @param {boolean} [options.sort] - Whether to sort raycast results based on distance with closest
     * first. Defaults to false.
     * @param {number} [options.filterCollisionGroup] - Collision group to apply to the raycast.
     * @param {number} [options.filterCollisionMask] - Collision mask to apply to the raycast.
     * @param {any[]} [options.filterTags] - Tags filters. Defined the same way as a {@link Tags#has}
     * query but within an array.
     * @param {(entity: import('../../../entity.js').Entity) => boolean} [options.filterCallback] -
     * Custom function to use to filter entities. Must return true to proceed
     * with result. Takes the entity to evaluate as argument.
     *
     * @returns {import('../types.js').RaycastResult[]} An array of raycast hit results (0 length if there were no hits).
     *
     * @example
     * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
     * const hits = this.app.systems.physics.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2));
     * @example
     * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
     * // where hit entity is tagged with `bird` OR `mammal`
     * const hits = this.app.systems.physics.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2), {
     *     filterTags: [ "bird", "mammal" ]
     * });
     * @example
     * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
     * // where hit entity has a `camera` component
     * const hits = this.app.systems.physics.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2), {
     *     filterCallback: (entity) => entity && entity.camera
     * });
     * @example
     * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
     * // where hit entity is tagged with (`carnivore` AND `mammal`) OR (`carnivore` AND `reptile`)
     * // and the entity has an `anim` component
     * const hits = this.app.systems.physics.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2), {
     *     filterTags: [
     *         [ "carnivore", "mammal" ],
     *         [ "carnivore", "reptile" ]
     *     ],
     *     filterCallback: (entity) => entity && entity.anim
     * });
     */
    raycastAll(start, end, options = {}) {
        return [];
    }

    /**
     * Removes a {@link PhysicsComponent} from an entity.
     *
     * @param {import('../../../entity').Entity} entity - The entity to remove
     * @param {import('../component.js').PhysicsComponent} component - The {@link PhysicsComponent} to remove from the entity
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
