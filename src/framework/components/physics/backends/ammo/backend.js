import { Vec3 } from "../../../../../core/math/vec3.js";
import { Debug } from "../../../../../core/debug.js";
import { RaycastResult } from "../../types.js";
import { PhysicsSystemBackend } from "../interface.js";
import { AmmoPhysicsComponent } from "./component.js";
import { BODYFLAG_NORESPONSE_OBJECT } from "../../constants.js";

/** @type {import('ammojs3').default.btVector3} */
let ammoRayStart;
/** @type {import('ammojs3').default.btVector3} */
let ammoRayEnd;

/**
 * @augments PhysicsSystemBackend
 */
class AmmoPhysicsSystemBackend extends PhysicsSystemBackend {
    /**
     * @type {number}
     * @ignore
     */
    maxSubSteps = 10;

    /**
     * @type {number}
     * @ignore
     */
    fixedTimeStep = 1 / 60;

    /**
     * @type {Float32Array}
     * @private
     */
    _gravityFloat32 = new Float32Array(3);

    /** @type {import('ammojs3').default.btDefaultCollisionConfiguration} */
    collisionConfiguration;

    /** @type {import('ammojs3').default.btCollisionDispatcher} */
    dispatcher;

    /** @type {import('ammojs3').default.btDbvtBroadphase} */
    overlappingPairCache;

    /** @type {import('ammojs3').default.btMultiBodyConstraintSolver} */
    solver;

    /** @type {import('ammojs3').default.btMultiBodyDynamicsWorld} */
    dynamicsWorld;

    constructor(system) {
        super(system, AmmoPhysicsComponent);
    }

    /**
     * Initializes physics
     */
    init() {
        // Create the Ammo physics world
        if (typeof Ammo === 'undefined')
            throw new Error("Ammo not loaded");

        AmmoPhysicsComponent.onLibraryLoaded();

        this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
        this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfiguration);
        this.overlappingPairCache = new Ammo.btDbvtBroadphase();
        this.solver = new Ammo.btMultiBodyMLCPConstraintSolver(new Ammo.btDantzigSolver());
        this.dynamicsWorld = new Ammo.btMultiBodyDynamicsWorld(this.dispatcher, this.overlappingPairCache, this.solver, this.collisionConfiguration);

        if (Ammo.AdapterFunctions.prototype.setInternalTickCallback) {
            const checkForCollisionsPointer = Ammo.addFunction(this._checkForCollisions.bind(this), 'vif');
            Ammo.AdapterFunctions.prototype.setInternalTickCallback(this.dynamicsWorld, checkForCollisionsPointer);
        } else {
            Debug.warn('WARNING: This version of ammo.js can potentially fail to report contacts. Please update it to the latest version.');
        }

        // Lazily create temp vars
        ammoRayStart = new Ammo.btVector3();
        ammoRayEnd = new Ammo.btVector3();
    }

    /**
     * @param {number} dt
     */
    update(dt) {
        // downcast gravity to float32 so we can accurately compare with existing
        // gravity set in ammo.
        this._gravityFloat32[0] = this.system.gravity.x;
        this._gravityFloat32[1] = this.system.gravity.y;
        this._gravityFloat32[2] = this.system.gravity.z;

        // Check to see whether we need to update gravity on the dynamics world
        const gravity = this.dynamicsWorld.getGravity();
        if (gravity.x() !== this._gravityFloat32[0] ||
            gravity.y() !== this._gravityFloat32[1] ||
            gravity.z() !== this._gravityFloat32[2]) {
            gravity.setValue(this.system.gravity.x, this.system.gravity.y, this.system.gravity.z);
            this.dynamicsWorld.setGravity(gravity);
        }

        // Step the physics simulation
        this.dynamicsWorld.stepSimulation(dt, this.maxSubSteps, this.fixedTimeStep);
    }

    /**
     * @param {number} dt
     */
    updateAfterMotion(dt) {
        if (!Ammo.AdapterFunctions.prototype.setInternalTickCallback)
            this._checkForCollisions(Ammo.getPointer(this.dynamicsWorld), dt);
    }

    onRemove(entity, component) {
        const rigidBody = component.rigidBody;
        if (rigidBody) {
            this.removeRigidBody(rigidBody);
            this.destroyRigidBody(rigidBody);

            component.rigidBody = null;
        }

        const multibodyLinkCollider = component.multibodyLinkCollider;
        if (multibodyLinkCollider) {
            this.removeMultiBodyLinkCollider(multibodyLinkCollider);
            this.destroyMultiBodyLinkCollider(multibodyLinkCollider);

            component.multibodyLinkCollider = null;
        }
    }

    destroy() {
        if (typeof Ammo !== 'undefined') {
            Ammo.destroy(this.dynamicsWorld);
            Ammo.destroy(this.solver);
            Ammo.destroy(this.overlappingPairCache);
            Ammo.destroy(this.dispatcher);
            Ammo.destroy(this.collisionConfiguration);
            this.dynamicsWorld = null;
            this.solver = null;
            this.overlappingPairCache = null;
            this.dispatcher = null;
            this.collisionConfiguration = null;
        }
    }

    /**
     * @param {number} mass
     * @param {import('ammojs3').default.btCollisionShape} shape
     * @param {import('ammojs3').default.btTransform} transform
     * @returns {import('ammojs3').default.btRigidBody}
     */
    createRigidBody(mass, shape, transform) {
        const localInertia = new Ammo.btVector3(0, 0, 0);
        if (mass !== 0) {
            shape.calculateLocalInertia(mass, localInertia);
        }

        const motionState = new Ammo.btDefaultMotionState(transform);
        const bodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
        const body = new Ammo.btRigidBody(bodyInfo);
        Ammo.destroy(bodyInfo);
        Ammo.destroy(localInertia);

        return body;
    }

    /**
     * @param {number} mass
     * @param {import('ammojs3').default.btCollisionShape} shape
     * @param {import('ammojs3').default.btTransform} transform
     * @param {import('../multibody/component').MultiBodyComponent} multibodyComponent
     * @returns {import('ammojs3').default.btMultiBodyLinkCollider}
     */
    createMultiBodyLinkCollider(mass, shape, transform, multibodyComponent) {
        const localInertia = new Ammo.btVector3(0, 0, 0);
        if (mass !== 0) {
            shape.calculateLocalInertia(mass, localInertia);
        }

        // adapted from ammo.js/bullet/examples/MultiBody/MultiBodyConstraintFeedback.cpp > initPhysics()
        const collider = new Ammo.btMultiBodyLinkCollider(multibodyComponent.base.multibody, multibodyComponent.linkIndex);
        collider.setCollisionShape(shape);
        collider.setWorldTransform(transform);

        if (multibodyComponent.linkIndex === -1) {
            multibodyComponent.multibody.setBaseMass(mass);
            multibodyComponent.multibody.setBaseInertia(localInertia);
        } else {
            multibodyComponent.link.set_m_mass(mass);
            multibodyComponent.link.set_m_inertiaLocal(localInertia);
        }

        Ammo.destroy(localInertia);

        return collider;
    }

    /**
     * @param {import('ammojs3').default.btRigidBody} body
     * @param {number} group
     * @param {number} mask
     */
    addRigidBody(body, group, mask) {
        if (group !== undefined && mask !== undefined) {
            this.dynamicsWorld.addRigidBody(body, group, mask);
        } else {
            this.dynamicsWorld.addRigidBody(body);
        }
    }

    /**
     * @param {import('ammojs3').default.btMultiBody} body
     * @param {number} group
     * @param {number} mask
     */
    addMultiBody(body, group, mask) {
        body.finalizeMultiDof();
        this.dynamicsWorld.addMultiBody(body, group, mask);
    }

    /**
     * @param {import('ammojs3').default.btMultiBodyLinkCollider} collider - The collider to destroy
     * @param {number} group
     * @param {number} mask
     */
    addMultiBodyLinkCollider(collider, group, mask) {
        this.dynamicsWorld.addCollisionObject(collider, group, mask);

        if (collider.m_link === -1)
            collider.m_multiBody.setBaseCollider(collider);
        else
            collider.m_multiBody.getLink(collider.m_link).set_m_collider(collider);
    }

    /**
     * @param {import('ammojs3').default.btRigidBody} body
     */
    removeRigidBody(body) {
        this.dynamicsWorld.removeRigidBody(body);
    }

    /**
     * @param {import('ammojs3').default.btMultiBody} body
     */
    removeMultiBody(body) {
        this.dynamicsWorld.removeMultiBody(body);
    }

    /**
     * @param {import('ammojs3').default.btMultiBodyLinkCollider} collider - The collider to destroy
     */
    removeMultiBodyLinkCollider(collider) {
        this.dynamicsWorld.removeCollisionObject(collider);

        if (collider.m_link === -1)
            collider.m_multiBody.setBaseCollider(null);
        else
            collider.m_multiBody.getLink(collider.m_link).set_m_collider(null);
    }

    /**
     * @param {import('ammojs3').default.btRigidBody} body
     */
    destroyRigidBody(body) {
        // The motion state needs to be destroyed explicitly (if present)
        const motionState = body.getMotionState();
        if (motionState) {
            Ammo.destroy(motionState);
        }
        Ammo.destroy(body);
    }

    /**
     * @param {import('ammojs3').default.btMultiBody} body
     */
    destroyMultiBody(body) {
        Ammo.destroy(body);
    }

    /**
     * @param {import('ammojs3').default.btMultiBodyLinkCollider} collider - The collider to destroy
     */
    destroyMultiBodyLinkCollider(collider) {
        Ammo.destroy(collider);
    }

    /**
     * Raycast the world and return the first entity the ray hits. Fire a ray into the world from
     * start to end, if the ray hits an entity with a collision component, it returns a
     * {@link RaycastResult}, otherwise returns null.
     *
     * @param {Vec3} start - The world space point where the ray starts.
     * @param {Vec3} end - The world space point where the ray ends.
     * @param {object} [options] - The additional options for the raycasting.
     * @param {number} [options.filterCollisionGroup] - Collision group to apply to the raycast.
     * @param {number} [options.filterCollisionMask] - Collision mask to apply to the raycast.
     * @param {any[]} [options.filterTags] - Tags filters. Defined the same way as a {@link Tags#has}
     * query but within an array.
     * @param {Function} [options.filterCallback] - Custom function to use to filter entities.
     * Must return true to proceed with result. Takes one argument: the entity to evaluate.
     *
     * @returns {RaycastResult|null} The result of the raycasting or null if there was no hit.
     */
    raycastFirst(start, end, options = {}) {
        // Tags and custom callback can only be performed by looking at all results.
        if (options.filterTags || options.filterCallback) {
            options.sort = true;
            return this.raycastAll(start, end, options)[0] || null;
        }

        let result = null;

        ammoRayStart.setValue(start.x, start.y, start.z);
        ammoRayEnd.setValue(end.x, end.y, end.z);
        const rayCallback = new Ammo.ClosestRayResultCallback(ammoRayStart, ammoRayEnd);

        if (typeof options.filterCollisionGroup === 'number') {
            rayCallback.set_m_collisionFilterGroup(options.filterCollisionGroup);
        }

        if (typeof options.filterCollisionMask === 'number') {
            rayCallback.set_m_collisionFilterMask(options.filterCollisionMask);
        }

        this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
        if (rayCallback.hasHit()) {
            const collisionObj = rayCallback.get_m_collisionObject();
            const body = Ammo.castObject(collisionObj, Ammo.btRigidBody);

            if (body) {
                const point = rayCallback.get_m_hitPointWorld();
                const normal = rayCallback.get_m_hitNormalWorld();

                result = new RaycastResult(
                    body.entity,
                    new Vec3(point.x(), point.y(), point.z()),
                    new Vec3(normal.x(), normal.y(), normal.z()),
                    rayCallback.get_m_closestHitFraction()
                );
            }
        }

        Ammo.destroy(rayCallback);

        return result;
    }

    /**
     * Raycast the world and return all entities the ray hits. It returns an array of
     * {@link RaycastResult}, one for each hit. If no hits are detected, the returned array will be
     * of length 0. Results are sorted by distance with closest first.
     *
     * @param {Vec3} start - The world space point where the ray starts.
     * @param {Vec3} end - The world space point where the ray ends.
     * @param {object} [options] - The additional options for the raycasting.
     * @param {boolean} [options.sort] - Whether to sort raycast results based on distance with closest
     * first. Defaults to false.
     * @param {number} [options.filterCollisionGroup] - Collision group to apply to the raycast.
     * @param {number} [options.filterCollisionMask] - Collision mask to apply to the raycast.
     * @param {any[]} [options.filterTags] - Tags filters. Defined the same way as a {@link Tags#has}
     * query but within an array.
     * @param {Function} [options.filterCallback] - Custom function to use to filter entities.
     * Must return true to proceed with result. Takes the entity to evaluate as argument.
     *
     * @returns {RaycastResult[]} An array of raycast hit results (0 length if there were no hits).
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
        Debug.assert(Ammo.AllHitsRayResultCallback, 'pc.PhysicsComponentSystem#raycastAll: Your version of ammo.js does not expose Ammo.AllHitsRayResultCallback. Update it to latest.');

        const results = [];

        ammoRayStart.setValue(start.x, start.y, start.z);
        ammoRayEnd.setValue(end.x, end.y, end.z);
        const rayCallback = new Ammo.AllHitsRayResultCallback(ammoRayStart, ammoRayEnd);

        if (typeof options.filterCollisionGroup === 'number') {
            rayCallback.set_m_collisionFilterGroup(options.filterCollisionGroup);
        }

        if (typeof options.filterCollisionMask === 'number') {
            rayCallback.set_m_collisionFilterMask(options.filterCollisionMask);
        }

        this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
        if (rayCallback.hasHit()) {
            const collisionObjs = rayCallback.get_m_collisionObjects();
            const points = rayCallback.get_m_hitPointWorld();
            const normals = rayCallback.get_m_hitNormalWorld();
            const hitFractions = rayCallback.get_m_hitFractions();

            const numHits = collisionObjs.size();
            for (let i = 0; i < numHits; i++) {
                const body = Ammo.castObject(collisionObjs.at(i), Ammo.btRigidBody);

                if (body && body.entity) {
                    if (options.filterTags && !body.entity.tags.has(...options.filterTags) || options.filterCallback && !options.filterCallback(body.entity)) {
                        continue;
                    }

                    const point = points.at(i);
                    const normal = normals.at(i);
                    const result = new RaycastResult(
                        body.entity,
                        new Vec3(point.x(), point.y(), point.z()),
                        new Vec3(normal.x(), normal.y(), normal.z()),
                        hitFractions.at(i)
                    );

                    results.push(result);
                }
            }

            if (options.sort) {
                results.sort((a, b) => a.hitFraction - b.hitFraction);
            }
        }

        Ammo.destroy(rayCallback);

        return results;
    }

    /**
     * Stores a collision between the entity and other in the contacts map and returns true if it
     * is a new collision.
     *
     * @param {import('../../../../entity.js').Entity} entity - The entity.
     * @param {import('../../../../entity.js').Entity} other - The entity that collides with the first
     * entity.
     * @returns {boolean} True if this is a new collision, false otherwise.
     * @private
     */
    _storeCollision(entity, other) {
        let isNewCollision = false;
        const guid = entity.getGuid();

        this.system.collisions[guid] = this.system.collisions[guid] || { others: [], entity: entity };

        if (this.system.collisions[guid].others.indexOf(other) < 0) {
            this.system.collisions[guid].others.push(other);
            isNewCollision = true;
        }

        this.system.frameCollisions[guid] = this.system.frameCollisions[guid] || { others: [], entity: entity };
        this.system.frameCollisions[guid].others.push(other);

        return isNewCollision;
    }

    /**
     * @private
     * @param {import('ammojs3').default.btManifoldPoint} contactPoint 
     * @returns {import('../../types.js').ContactPoint}
     */
    _createContactPointFromAmmo(contactPoint) {
        const localPointA = contactPoint.get_m_localPointA();
        const localPointB = contactPoint.get_m_localPointB();
        const positionWorldOnA = contactPoint.getPositionWorldOnA();
        const positionWorldOnB = contactPoint.getPositionWorldOnB();
        const normalWorldOnB = contactPoint.get_m_normalWorldOnB();

        const contact = this.system.contactPointPool.allocate();
        contact.localPoint.set(localPointA.x(), localPointA.y(), localPointA.z());
        contact.localPointOther.set(localPointB.x(), localPointB.y(), localPointB.z());
        contact.point.set(positionWorldOnA.x(), positionWorldOnA.y(), positionWorldOnA.z());
        contact.pointOther.set(positionWorldOnB.x(), positionWorldOnB.y(), positionWorldOnB.z());
        contact.normal.set(normalWorldOnB.x(), normalWorldOnB.y(), normalWorldOnB.z());
        contact.impulse = contactPoint.getAppliedImpulse();
        return contact;
    }

    /**
     * @private
     * @param {import('ammojs3').default.btManifoldPoint} contactPoint 
     * @returns {import('../../types.js').ContactPoint}
     */
    _createReverseContactPointFromAmmo(contactPoint) {
        const localPointA = contactPoint.get_m_localPointA();
        const localPointB = contactPoint.get_m_localPointB();
        const positionWorldOnA = contactPoint.getPositionWorldOnA();
        const positionWorldOnB = contactPoint.getPositionWorldOnB();
        const normalWorldOnB = contactPoint.get_m_normalWorldOnB();

        const contact = this.system.contactPointPool.allocate();
        contact.localPointOther.set(localPointA.x(), localPointA.y(), localPointA.z());
        contact.localPoint.set(localPointB.x(), localPointB.y(), localPointB.z());
        contact.pointOther.set(positionWorldOnA.x(), positionWorldOnA.y(), positionWorldOnA.z());
        contact.point.set(positionWorldOnB.x(), positionWorldOnB.y(), positionWorldOnB.z());
        contact.normal.set(normalWorldOnB.x(), normalWorldOnB.y(), normalWorldOnB.z());
        contact.impulse = contactPoint.getAppliedImpulse();
        return contact;
    }

    /**
     * @private
     * @param {import('../../../../entity.js').Entity} a 
     * @param {import('../../../../entity.js').Entity} b 
     * @param {import('../../types.js').ContactPoint} contactPoint 
     * @returns {import('../../types.js').SingleContactResult}
     */
    _createSingleContactResult(a, b, contactPoint) {
        const result = this.system.singleContactResultPool.allocate();

        result.a = a;
        result.b = b;
        result.localPointA = contactPoint.localPoint;
        result.localPointB = contactPoint.localPointOther;
        result.pointA = contactPoint.point;
        result.pointB = contactPoint.pointOther;
        result.normal = contactPoint.normal;
        result.impulse = contactPoint.impulse;

        return result;
    }

    /**
     * 
     * @param {import('../../../../entity.js').Entity} other 
     * @param {import('../../types.js').ContactPoint[]} contacts 
     * @returns 
     */
    _createContactResult(other, contacts) {
        const result = this.system.contactResultPool.allocate();
        result.other = other;
        result.contacts = contacts;
        return result;
    }

    /**
     * Removes collisions that no longer exist from the collisions list and fires collisionend
     * events to the related entities.
     *
     * @private
     */
    _cleanOldCollisions() {
        const collisions = this.system.collisions;
        const frameCollisions = this.system.frameCollisions;

        for (const guid in collisions) {
            if (collisions.hasOwnProperty(guid)) {
                const frameCollision = frameCollisions[guid];
                const collision = collisions[guid];
                const entity = collision.entity;
                const entityCollision = entity.collision;
                const entityPhysics = entity.physics;
                const others = collision.others;
                const length = others.length;
                let i = length;
                while (i--) {
                    const other = others[i];
                    // if the contact does not exist in the current frame collisions then fire event
                    if (!frameCollision || frameCollision.others.indexOf(other) < 0) {
                        // remove from others list
                        others.splice(i, 1);

                        if (entity.trigger) {
                            // handle a trigger entity
                            if (entityCollision) {
                                entityCollision.fire('triggerleave', other);
                            }
                            if (other.physics) {
                                other.physics.fire('triggerleave', entity);
                            }
                        } else if (!other.trigger) {
                            // suppress events if the other entity is a trigger
                            if (entityPhysics) {
                                entityPhysics.fire('collisionend', other);
                            }
                            if (entityCollision) {
                                entityCollision.fire('collisionend', other);
                            }
                        }
                    }
                }

                if (others.length === 0) {
                    delete collisions[guid];
                }
            }
        }
    }

    /**
     * Returns true if the entity has a contact event attached and false otherwise.
     *
     * @param {import('../../../../entity.js').Entity} entity - Entity to test.
     * @returns {boolean} True if the entity has a contact and false otherwise.
     * @private
     */
    _hasContactEvent(entity) {
        const c = entity.collision;
        if (c && (c.hasEvent('collisionstart') || c.hasEvent('collisionend') || c.hasEvent('contact'))) {
            return true;
        }

        const p = entity.physics;
        return (p && (p.hasEvent('collisionstart') || p.hasEvent('collisionend') || p.hasEvent('contact'))) ?? false;
    }

    /**
     * Checks for collisions and fires collision events.
     *
     * @param {number} world - The pointer to the dynamics world that invoked this callback.
     * @param {number} timeStep - The amount of simulation time processed in the last simulation tick.
     * @private
     */
    _checkForCollisions(world, timeStep) {
        /** @type {import('ammojs3').default.btDynamicsWorld} */
        const dynamicsWorld = Ammo.wrapPointer(world, Ammo.btDynamicsWorld);

        // Check for collisions and fire callbacks
        const dispatcher = dynamicsWorld.getDispatcher();
        const numManifolds = dispatcher.getNumManifolds();

        const system = this.system;

        system.frameCollisions = {};

        // loop through the all contacts and fire events
        for (let i = 0; i < numManifolds; i++) {
            const manifold = dispatcher.getManifoldByIndexInternal(i);

            const body0 = manifold.getBody0();
            const body1 = manifold.getBody1();

            /** @type {import('ammojs3').default.btRigidBody} */
            const wb0 = Ammo.castObject(body0, Ammo.btRigidBody);
            /** @type {import('ammojs3').default.btRigidBody} */
            const wb1 = Ammo.castObject(body1, Ammo.btRigidBody);

            const e0 = wb0.entity;
            const e1 = wb1.entity;

            // check if entity is null - TODO: investigate when this happens
            if (!e0 || !e1) {
                continue;
            }

            const flags0 = wb0.getCollisionFlags();
            const flags1 = wb1.getCollisionFlags();

            const numContacts = manifold.getNumContacts();
            const forwardContacts = [];
            const reverseContacts = [];
            let newCollision;

            if (numContacts > 0) {
                // don't fire contact events for triggers
                if ((flags0 & BODYFLAG_NORESPONSE_OBJECT) ||
                    (flags1 & BODYFLAG_NORESPONSE_OBJECT)) {

                    const e0Events = e0.collision && (e0.collision.hasEvent('triggerenter') || e0.collision.hasEvent('triggerleave'));
                    const e1Events = e1.collision && (e1.collision.hasEvent('triggerenter') || e1.collision.hasEvent('triggerleave'));
                    const e0BodyEvents = e0.physics && (e0.physics.hasEvent('triggerenter') || e0.physics.hasEvent('triggerleave'));
                    const e1BodyEvents = e1.physics && (e1.physics.hasEvent('triggerenter') || e1.physics.hasEvent('triggerleave'));

                    // fire triggerenter events for triggers
                    if (e0Events) {
                        newCollision = this._storeCollision(e0, e1);
                        if (newCollision && !(flags1 & BODYFLAG_NORESPONSE_OBJECT)) {
                            e0.collision.fire('triggerenter', e1);
                        }
                    }

                    if (e1Events) {
                        newCollision = this._storeCollision(e1, e0);
                        if (newCollision && !(flags0 & BODYFLAG_NORESPONSE_OBJECT)) {
                            e1.collision.fire('triggerenter', e0);
                        }
                    }

                    // fire triggerenter events for rigidbodies
                    if (e0BodyEvents) {
                        if (!newCollision) {
                            newCollision = this._storeCollision(e1, e0);
                        }

                        if (newCollision) {
                            e0.physics.fire('triggerenter', e1);
                        }
                    }

                    if (e1BodyEvents) {
                        if (!newCollision) {
                            newCollision = this._storeCollision(e0, e1);
                        }

                        if (newCollision) {
                            e1.physics.fire('triggerenter', e0);
                        }
                    }
                } else {
                    const e0Events = this._hasContactEvent(e0);
                    const e1Events = this._hasContactEvent(e1);
                    const globalEvents = system.hasEvent('contact');

                    if (globalEvents || e0Events || e1Events) {
                        for (let j = 0; j < numContacts; j++) {
                            const btContactPoint = manifold.getContactPoint(j);
                            const contactPoint = this._createContactPointFromAmmo(btContactPoint);

                            if (e0Events || e1Events) {
                                forwardContacts.push(contactPoint);
                                const reverseContactPoint = this._createReverseContactPointFromAmmo(btContactPoint);
                                reverseContacts.push(reverseContactPoint);
                            }

                            if (globalEvents) {
                                // fire global contact event for every contact
                                const result = this._createSingleContactResult(e0, e1, contactPoint);
                                system.fire('contact', result);
                            }
                        }

                        if (e0Events) {
                            const forwardResult = this._createContactResult(e1, forwardContacts);
                            newCollision = this._storeCollision(e0, e1);

                            if (e0.collision) {
                                e0.collision.fire('contact', forwardResult);
                                if (newCollision) {
                                    e0.collision.fire('collisionstart', forwardResult);
                                }
                            }

                            if (e0.physics) {
                                e0.physics.fire('contact', forwardResult);
                                if (newCollision) {
                                    e0.physics.fire('collisionstart', forwardResult);
                                }
                            }
                        }

                        if (e1Events) {
                            const reverseResult = this._createContactResult(e0, reverseContacts);
                            newCollision = this._storeCollision(e1, e0);

                            if (e1.collision) {
                                e1.collision.fire('contact', reverseResult);
                                if (newCollision) {
                                    e1.collision.fire('collisionstart', reverseResult);
                                }
                            }

                            if (e1.physics) {
                                e1.physics.fire('contact', reverseResult);
                                if (newCollision) {
                                    e1.physics.fire('collisionstart', reverseResult);
                                }
                            }
                        }
                    }
                }
            }
        }

        // check for collisions that no longer exist and fire events
        this._cleanOldCollisions();

        // Reset contact pools
        this.system.contactPointPool.freeAll();
        this.system.contactResultPool.freeAll();
        this.system.singleContactResultPool.freeAll();
    }
}

export { AmmoPhysicsSystemBackend };
