import { Component } from "../component.js";
import { ComponentSystem } from "../system.js";

import { MultiBodyComponent } from "./component.js";
import { MultiBodyComponentData } from "./data.js";

import { Vec3 } from "../../../core/math/vec3.js";
import { Debug } from "../../../core/debug.js";

const _schema = ['enabled'];

class MultiBodySetup {
    /**
     * Creates a new MultiBodySetup instance.
     *
     * This class is used to gather the links which will be part of the
     * multibody. It will be broadcast to children of the multibody's base
     * entity (if they are not already bases of their own multibodies),
     * so they can change to become links in this {@link base}'s multibody.
     *
     * @param {import('../../entity.js').Entity} base - The base entity for
     * this multibody
     * @param {import('../../entity.js').Entity[]} links - The entities to make
     * links for this multibody
     */
    constructor(base, links) {
        this.base = base;
        this.links = links;
    }

    indexOf(entity) {
        if (entity === this.base) {
            return -1;
        }
        const index = this.links.indexOf(entity);
        if (index < 0) {
            return undefined;
        }
        return index;
    }
}

class MultiBodyComponentSystem extends ComponentSystem {
    /**
     * Create a new MultiBodyComponentSystem.
     *
     * @param {import('../../app-base.js').AppBase} app - The Application.
     * @hideconstructor
     */
    constructor(app) {
        super(app);

        this.id = 'multibody';

        this.ComponentType = MultiBodyComponent;
        this.DataType = MultiBodyComponentData;

        this.schema = _schema;

        /**
         * @type {{ [guid: string]: MultiBodySetup }}
         * @private
         */
        this._setup = {};

        this.on('beforeremove', this.onBeforeRemove, this);
        this.on('remove', this.onRemove, this);
    }

    initializeComponentData(component, data, properties) {
        super.initializeComponentData(component, data, ['enabled']);
    }

    cloneComponent(entity, clone) {
        // create new data block for clone
        const multibody = entity.multibody;
        const data = {
            enabled: multibody.enabled
        };

        return this.addComponent(clone, data);
    }

    /**
     * Gets the {@link MultiBodySetup} for the given base entity.
     * @param {import('../../entity.js').Entity} base - base entity for the
     * multibody to get setup for.
     * @returns {MultiBodySetup} - The setup for the multibody with this base.
     */
    getSetup(base) {
        return this._setup[base.getGuid()];
    }

    /**
     * Invites a component to an existing multibody, and, if accepted,
     * recreates the multibody.
     *
     * @param {import('../../entity.js').Entity} base - The base for the
     * multibody.
     * @param {import('../../entity.js').Entity} entity - The entity to invite
     * to the multibody.
     */
    offerLinkMembership(base, entity) {
        const setup = new MultiBodySetup(base, []);
        base.multibody._isBuildingMultibody = true;
        entity.multibody.beforeSetup(setup);
        if (setup.links.length > 0) {
            base.multibody._isBuildingMultibody = false;
            this.createMultiBody(base);
        } else {
            base.multibody._isBuildingMultibody = false;
        }
    }

    /**
     * Creates a multibody from the given {@link base} link.
     *
     * @private
     * @param {import('../../entity.js').Entity} base - The base component for
     * the multibody.
     */
    createMultiBody(base) {
        if (!base.physics || !base.physics.enabled) {
            Debug.error("Cannot create a multibody without physics for the base.");
            return;
        }

        const setup = this._setup[base.getGuid()] = new MultiBodySetup(base, []);
        base.multibody.beforeSetup(setup);

        if (setup.links.length === 0 || (setup.links.length === 1 && setup.links[0] === setup.base)) return;

        const mass = base.physics.mass;
        /** @type {import('ammojs3').default.btCollisionShape} */
        const shape = base.collision.shape;
        const inertia = new Ammo.btVector3(0, 0, 0);
        shape.calculateLocalInertia(mass, inertia);

        /** @type {import('ammojs3').default.btMultiBody} */
        const multibody = new Ammo.btMultiBody(
            setup.links.length,
            mass,
            inertia,
            base.physics.isStaticOrKinematic(),
            false);

        multibody.setHasSelfCollision(true);
        base.multibody._multibody = multibody;

        const pos_pc = base.getPosition();
        const rot_pc = base.getRotation();
        const pos_ammo = new Ammo.btVector3(pos_pc.x, pos_pc.y, pos_pc.z);
        const rot_ammo = new Ammo.btQuaternion(rot_pc.x, rot_pc.y, rot_pc.z, rot_pc.w);

        multibody.setBasePos(pos_ammo);
        multibody.setWorldToBaseRot(rot_ammo);

        Ammo.destroy(pos_ammo);
        Ammo.destroy(rot_ammo);

        base.multibody.setup(setup);
        this.app.systems.physics.addMultiBody(multibody, base.physics.group, base.physics.mask);
        base.multibody.afterSetup(setup);
    }

    /**
     * Destroys the multibody for the given {@link base} link.
     *
     * @private
     * @param {import('../../entity.js').Entity} base - The base component for
     * the multibody.
     * @returns {MultiBodySetup} - The setup used for this multibody
     */
    destroyMultiBody(base) {
        const multibody = base.multibody._multibody;
        this.app.systems.physics.removeMultiBody(multibody);
        const setup = this._setup[base.getGuid()];
        base.multibody.unsetup(setup);
        delete this._setup[base.getGuid()];
        this.app.systems.physics.destroyMultiBody(multibody);
        base._multibody = null;
        return setup;
    }


    /**
     * Before removing a multibody component from an entity.
     *
     * @private
     * @param {import('../../entity.js').Entity} entity - The entity to remove
     * the multibody component from
     * @param {MultiBodyComponent} component - The multibody component to remove
     */
    onBeforeRemove(entity, component) {
        if (component.enabled) {
            component.enabled = false;
        }
    }

    /**
     * Removes a multibody component from an entity.
     *
     * @private
     * @param {import('../../entity.js').Entity} entity - The entity to remove
     * the multibody component from
     * @param {MultiBodyComponent} component - The multibody component to remove
     */
    onRemove(entity, component) {
        if (component.isBaseLink) {
            this.destroyMultiBody(component._base.entity);
        }
    }
}

Component._buildAccessors(MultiBodyComponent.prototype, _schema);

export { MultiBodySetup, MultiBodyComponentSystem };
