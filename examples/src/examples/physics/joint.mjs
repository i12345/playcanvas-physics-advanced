import * as pc from 'playcanvas';

/**
 * @typedef {import('../../options.mjs').ExampleOptions} ExampleOptions
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, ammoPath, glslangPath, twgslPath }) {

    pc.WasmModule.setConfig('Ammo', {
        glueUrl:     ammoPath + 'ammo.wasm.js',
        wasmUrl:     ammoPath + 'ammo.wasm.wasm',
        fallbackUrl: ammoPath + 'ammo.js'
    });
    await new Promise((resolve) => { pc.WasmModule.getInstance('Ammo', () => resolve()) });

    const assets = {
        model:    new pc.Asset('model',             'container', { url: assetPath + 'models/bitmoji.glb' }),
        idleAnim: new pc.Asset('idleAnim',          'container', { url: assetPath + 'animations/bitmoji/idle.glb' }),
        helipad:  new pc.Asset('helipad-env-atlas', 'texture',   { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false })
    };

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;
    createOptions.keyboard = new pc.Keyboard(document.body);

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.LightComponentSystem,
        pc.ScriptComponentSystem,
        pc.CollisionComponentSystem,
        pc.PhysicsComponentSystem,
        pc.JointComponentSystem,
        // pc.InputComponentSystem,
        pc.MultiBodyComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.ContainerHandler,
        // @ts-ignore
        pc.ScriptHandler,
        // @ts-ignore
        pc.AnimClipHandler,
        // @ts-ignore
        pc.AnimStateGraphHandler
    ];

    const app = new pc.AppBase(canvas);
    app.init(createOptions);

    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
    assetListLoader.load(() => {

        app.start();

        // setup skydome
        app.scene.exposure = 2;
        app.scene.skyboxMip = 2;
        app.scene.envAtlas = assets.helipad.resource;

        // Create an entity with a light component
        const lightEntity = new pc.Entity();
        lightEntity.addComponent("light", {
            castShadows: true,
            intensity: 1.5,
            normalOffsetBias: 0.2,
            shadowType: pc.SHADOW_PCF5,
            shadowDistance: 12,
            shadowResolution: 4096,
            shadowBias: 0.2
        });
        app.root.addChild(lightEntity);
        lightEntity.setLocalEulerAngles(45, 30, 0);

        // Set the gravity for our rigid bodies
        app.systems.physics.gravity.set(0, -9.81, 0);

        /**
         * @param {pc.Color} color - The color.
         * @returns {pc.StandardMaterial} The material.
         */
        function createMaterial(color) {
            const material = new pc.StandardMaterial();
            material.diffuse = color;
            // we need to call material.update when we change its properties
            material.update();
            return material;
        }

        // create a few materials for our objects
        const red = createMaterial(new pc.Color(1, 0.3, 0.3));
        const gray = createMaterial(new pc.Color(0.7, 0.7, 0.7));

        const floor = new pc.Entity();
        floor.addComponent("render", {
            type: "box",
            material: gray
        });

        // Scale it and move it so that the top is at 0 on the y axis
        floor.setLocalScale(10, 1, 10);
        floor.translateLocal(0, -0.5, 0);

        // Add a physics component so that other objects collide with it
        floor.addComponent("physics", {
            type: "static",
            restitution: 0.5
        });

        // Add a collision component
        floor.addComponent("collision", {
            type: "box",
            halfExtents: new pc.Vec3(5, 0.5, 5)
        });

        // Add the floor to the hierarchy
        app.root.addChild(floor);

        // Create an Entity with a camera component
        const cameraEntity = new pc.Entity();
        cameraEntity.addComponent("camera");
        cameraEntity.translate(5, 5, 15);
        const lookAtPosition = new pc.Vec3(0, 1.5, 0);
        cameraEntity.lookAt(lookAtPosition.x, lookAtPosition.y + 0.75, lookAtPosition.z);

        app.root.addChild(cameraEntity);

        // // create a ball template that we can clone in the update loop
        // const ball = new pc.Entity();
        // ball.tags.add('shape');
        // ball.setLocalScale(0.4, 0.4, 0.4);
        // ball.addComponent("render", {
        //     type: "sphere"
        // });

        // ball.addComponent("physics", {
        //     type: "dynamic",
        //     mass: 50,
        //     restitution: 0.5
        // });

        // ball.addComponent("collision", {
        //     type: "sphere",
        //     radius: 0.2
        // });

        // ball.enabled = false;

        const useMultibody = false;

        /**
         * Makes a link
         *
         * @param {number} length - length of link
         * @param {number} radius - radius of link
         * @param {number} interlinkdist - radius of inter-link distance
         * @param {pc.GraphNode|null} parent - parent graph node / link
         * @returns {{ entity: pc.Entity, tail: pc.Entity }} - The link and tail for adding next link
         */
        function link(length, radius, interlinkdist, parent) {
            const entity = new pc.Entity();
            parent?.addChild(entity);
            entity.setLocalPosition((length / 2) + interlinkdist, 0, 0);
            entity.addComponent('collision', { type: 'capsule', axis: 0 });
            entity.collision.radius = radius;
            entity.collision.height = length;
            // entity.collision.height = length + (2 * radius);
            entity.addComponent('physics', { type: pc.RIGIDBODY_TYPE_DYNAMIC });
            entity.physics.mass = 1;

            const render_entity = new pc.Entity();
            entity.addChild(render_entity);
            render_entity.setLocalEulerAngles(0, 0, 90);
            render_entity.setLocalScale(2 * radius, length, 2 * radius);
            render_entity.addComponent('render', { type: 'cylinder' });
            render_entity.render.material = createMaterial(new pc.Color(0.5, 0.5, 0.5));

            const render_cap_entity = new pc.Entity();
            entity.addChild(render_cap_entity);
            render_cap_entity.setLocalScale(2 * radius, 2 * radius, 2 * radius);
            render_cap_entity.setLocalPosition((length / 2) + interlinkdist, 0, 0);
            render_cap_entity.addComponent('render', { type: 'sphere' });
            render_cap_entity.render.material = createMaterial(new pc.Color(0.5, 0.5, 0.5));

            const tail = new pc.Entity();
            tail.setLocalPosition((length / 2) + interlinkdist, 0, 0);
            entity.addChild(tail);

            return { entity, tail };
        }

        /**
         * Makes a chain with a given number of links.
         * @param {number} n - Number of chain links
         * @param {number} [length] - length of capsule, from center of head to center of tail
         * @param {number} [radius] - radius of capsule
         * @param {pc.GraphNode|null} [parent] - the parent for the first link
         * @returns {{ head: pc.Entity, tail: pc.GraphNode}} - chain head and tail
         */
        function chain(n, radius = 0.1, length = 1.5, parent = null) {
            /** @type {pc.GraphNode|null} */
            let tail = parent;
            /** @type {pc.Entity|null} */
            let head = null;
            /** @type {pc.GraphNode|null} */
            let prev = parent;

            for (let i = 0; i < n; i++) {
                const nextLink = link(length, radius, 0, tail);

                if (!head) {
                    head = nextLink.entity;
                }
                if (prev) {
                    const jointEntity = new pc.Entity(`Joint ${i}`);
                    prev.addChild(jointEntity);
                    if (tail) jointEntity.setLocalPosition(tail.getLocalPosition());
                    jointEntity.addComponent('multibody');
                    jointEntity.multibody.couldBeInMultibody = useMultibody;

                    jointEntity.addComponent('joint');

                    // jointEntity.joint.type = pc.JOINT_TYPE_HINGE;
                    // jointEntity.joint.motion.angular.x = pc.MOTION_FREE;

                    jointEntity.joint.type = pc.JOINT_TYPE_SPHERICAL;
                    jointEntity.joint.motion.angular.x = pc.MOTION_FREE;
                    jointEntity.joint.motion.angular.z = pc.MOTION_FREE;

                    jointEntity.joint.componentA = nextLink.entity;
                    jointEntity.joint.componentB = prev;
                }
                tail = nextLink.tail;
                prev = nextLink.entity;
            }

            return {
                head: /** @type {pc.Entity} */ (head),
                tail: /** @type {pc.GraphNode} */ (tail)
            };
        }

        const box = new pc.Entity("box");
        box.setLocalPosition(0, 4, 1);
        app.root.addChild(box);
        const box_size = new pc.Vec3(0.5, 0.5, 0.5);
        const box_render = new pc.Entity();
        box.addChild(box_render);
        box_render.setLocalScale(box_size);
        box_render.addComponent('render', { type: 'box' });
        box_render.render.material = createMaterial(new pc.Color(0.5, 0.5, 0.5));
        // const box_attach_node = new pc.Entity("box attach node");
        // box_attach_node.setLocalPosition(box_size.x, 0, 0);
        // box_attach_node.addComponent('physics');
        // box_attach_node.addComponent('multibody');
        // box.addChild(box_attach_node);
        box.addComponent('collision', { type: 'box', halfExtents: box_size.clone().divScalar(2) });
        box.addComponent('physics', { type: pc.RIGIDBODY_TYPE_DYNAMIC, mass: 1 });

        const links = 5;
        const link_length = 0.85;
        const link_radius = 0.1;

        const chain1 = chain(links, link_radius, link_length, box); //box_attach_node);

        if (useMultibody) {
            box.addComponent('multibody');
            box.multibody.makeBase();
        }

        const weight = new pc.Entity();
        const weight_size_half = new pc.Vec3(0.5, 0.5, 0.5);
        const weight_render = new pc.Entity();
        chain1.tail.addChild(weight);
        weight.addComponent('collision', { type: 'box', halfExtents: weight_size_half });
        weight.addChild(weight_render);
        weight_render.setLocalScale(weight_size_half);
        weight_render.addComponent('render', { type: 'box' });
        weight_render.render.material = createMaterial(new pc.Color(0.5, 0.5, 0.5));
        weight.setLocalPosition(weight_size_half.x + (link_length / 2) + link_radius, 0, 0);
        weight.addComponent('physics', { type: pc.RIGIDBODY_TYPE_DYNAMIC, mass: 5 });
        weight.addComponent('multibody');

        chain1.tail.addComponent('joint');
        chain1.tail.joint.componentA = chain1.tail;
        chain1.tail.joint.componentB = weight;

        // app.systems.input.enabled = true;
        // box.addComponent('input');
        // box.input.focus();
        // box.input.on(pc.EVENT_INPUT_KEY_DOWN, (/** @type {pc.KeyInputEvent} */ e) => {
        //     const force = new pc.Vec3();
        //     switch (e.key) {
        //         case pc.KEY_LEFT:
        //         case pc.KEY_A:
        //             force.x = -1;
        //             break;
        //         case pc.KEY_RIGHT:
        //         case pc.KEY_D:
        //             force.x = +1;
        //             break;
        //         case pc.KEY_UP:
        //         case pc.KEY_W:
        //             force.z = -1;
        //             break;
        //         case pc.KEY_DOWN:
        //         case pc.KEY_S:
        //             force.z = +1;
        //             break;
        //         case pc.KEY_SPACE:
        //             force.y = 10;
        //             break;
        //         default:
        //             break;
        //     }

        //     box.physics?.applyForce(force);
        // });

        // Set an update function on the application's update event
        app.on("update", function (dt) {
            cameraEntity.lookAt(box.getPosition());

            // Show active bodies in red and frozen bodies in gray
            app.root.findByTag("shape").forEach(function (/** @type {pc.Entity} */ entity) {
                entity.render.meshInstances[0].material = entity.physics.isActive() ? red : gray;
            });
        });
    });
    return app;
}

class JointExample {
    static CATEGORY = 'Physics';
    static WEBGPU_ENABLED = true;
    static example = example;
}

export { JointExample };
