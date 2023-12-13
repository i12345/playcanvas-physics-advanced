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

        const box = new pc.Entity("box");
        box.setLocalPosition(0, 4, 1);
        app.root.addChild(box);
        const box_size = new pc.Vec3(0.5, 0.5, 0.5);
        const box_render = new pc.Entity();
        box.addChild(box_render);
        box_render.setLocalScale(box_size);
        box_render.addComponent('render', { type: 'box' });
        box_render.render.material = createMaterial(new pc.Color(0.5, 0.5, 0.5));
        box.addComponent('collision', { type: 'box', halfExtents: box_size.clone().divScalar(2) });
        box.addComponent('physics', { type: pc.RIGIDBODY_TYPE_DYNAMIC, mass: 5 });

        function addLink(/** @type {pc.GraphNode} */ prev, /** @type {number} */ q) {
            const joint_length = 1;
            const joint_margin = 0.25;

            const link1 = new pc.Entity("link1");
            link1.setLocalPosition(joint_length + joint_margin, 0, 0);
            prev.addChild(link1);
            link1.addComponent('collision');
            link1.addComponent('physics', { type: pc.BODYTYPE_DYNAMIC, mass: 0.1 });
            link1.collision.type = 'box';
            link1.collision.halfExtents = new pc.Vec3(joint_length / 2, 0.1, 0.1);
            const link1_render = new pc.Entity();
            link1.addChild(link1_render);
            link1_render.addComponent('render', { type: 'box', material: createMaterial(new pc.Color(q, q, q)) });
            link1_render.setLocalScale(link1.collision.halfExtents.clone().mulScalar(2));
            const link1_joint = new pc.Entity();
            link1_joint.setLocalPosition(-(joint_length / 2) - (joint_margin / 2), 0, 0);
            link1.addChild(link1_joint);
            link1_joint.addComponent('joint');
            link1_joint.joint.type = pc.JOINT_TYPE_SPHERICAL;
            link1_joint.joint.motion.angular.x = pc.MOTION_FREE;
            link1_joint.joint.motion.angular.z = pc.MOTION_FREE;
            link1_joint.joint.componentA = link1;
            link1_joint.joint.componentB = prev;

            return {
                entity: link1,
                joint: /** @type {pc.JointComponent} */ (link1_joint.joint)
            };
        }

        const joints = /** @type {pc.JointComponent[]} */ ([]);
        const n = 10;
        for (let i = 0, prev = box; i < n; i++) {
            const link = addLink(prev, i / n);
            prev = link.entity;
            joints.push(link.joint);
        }

        // const weight = new pc.Entity("weight");
        // const weight_size_half = new pc.Vec3(0.5, 0.5, 0.5);
        // const weight_render = new pc.Entity();
        // chain1.addChild(weight);
        // weight.addChild(weight_render);
        // weight_render.setLocalScale(weight_size_half);
        // weight_render.addComponent('render', { type: 'box' });
        // weight_render.render.material = createMaterial(new pc.Color(0.5, 0.5, 0.5));
        // weight.setLocalPosition(weight_size_half.x + (link_length / 2) + link_radius, 0, 0);
        // weight.addComponent('collision', { type: 'box', halfExtents: weight_size_half });
        // weight.addComponent('physics', { type: pc.RIGIDBODY_TYPE_DYNAMIC, mass: 1 });
        // weight.addComponent('multibody');

        // const weight_joint = new pc.Entity();
        // link1.addChild(weight_joint);
        // weight_joint.setLocalPosition((link_length / 2) + (link_radius / 2), 0, 0);

        // weight_joint.addComponent('joint');
        // weight_joint.joint.type = pc.JOINT_TYPE_SPHERICAL;
        // weight_joint.joint.motion.angular.x = pc.MOTION_FREE;
        // weight_joint.joint.motion.angular.z = pc.MOTION_FREE;
        // weight_joint.joint.componentB = chain1;
        // weight_joint.joint.componentA = weight;

        const useMultibody = true;
        if (useMultibody) {
            box.addComponent('multibody');
            box.multibody.makeBase();
        }

        let t = 0;

        // Set an update function on the application's update event
        app.on("update", function (dt) {
            t += dt;

            if (t > 1) {
                for (const joint of joints) {
                    joint.
                }
            }

            cameraEntity.lookAt(box.getPosition());

            // Show active bodies in red and frozen bodies in gray
            app.root.findByTag("shape").forEach(function (/** @type {pc.Entity} */ entity) {
                entity.render.meshInstances[0].material = entity.physics.isActive() ? red : gray;
            });
        });
    });
    return app;
}

class JointWithMotorExample {
    static CATEGORY = 'Physics';
    static WEBGPU_ENABLED = true;
    static example = example;
}

export { JointWithMotorExample };
