/**
 * Creates a trigger object used to create internal physics objects that interact with physics bodies
 * and trigger collision events with no collision response.
 *
 * @template Shape
 * @ignore
 */
class Trigger {
    /** @type {import('./component').CollisionComponent<Shape>} */
    component;

    /**
     * Create a new Trigger instance.
     *
     * @param {import('../../app-base.js').AppBase} app - The running {@link AppBase}.
     * @param {import('./component.js').CollisionComponent<Shape>} component -
     * The component for which the trigger will be created.
     * @param {import('./data.js').CollisionComponentData<Shape>} data - The
     * data for the component.
     */
    constructor(app, component, data) {
        this.entity = component.entity;
        this.component = component;
        this.app = app;

        this.initialize(data);
    }

    /**
     * @param {import('./data.js').CollisionComponentData<Shape>} data
     * @abstract
     */
    initialize(data) {
        throw new Error("not implemented");
    }

    /**
     * @abstract
     */
    destroy() {
        throw new Error("not implemented");
    }

    /**
     * @abstract
     */
    updateTransform() {
        throw new Error("not implemented");
    }

    enable() {
        this.app.systems.physics._triggers.push(this);

        this.updateTransform();
    }

    disable() {
        const systems = this.app.systems;
        const idx = systems.physics._triggers.indexOf(this);
        if (idx > -1) {
            systems.physics._triggers.splice(idx, 1);
        }
    }
}

export { Trigger };
