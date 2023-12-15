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
            intensity: 1,
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

        const box_C = new pc.Entity("C");
        app.root.addChild(box_C);
        box_C.setLocalPosition(0, 0, 0);
        box_C.setLocalScale(1, 0.5, 1);
        box_C.addComponent('render', { type: 'box', material: createMaterial(new pc.Color(0.25, 0.25, 0.25)) });
        box_C.addComponent('collision', { type: 'box', halfExtents: box_C.getLocalScale().clone().divScalar(2) });
        box_C.addComponent('physics', { type: pc.BODYTYPE_STATIC });

        const box_A = new pc.Entity("A");
        const box_B = new pc.Entity("B");
        const box_A_jointNode = new pc.GraphNode();
        const box_B_jointNode = new pc.GraphNode();
        box_A_jointNode.setLocalPosition(0.5, 0, 0);
        box_B_jointNode.setLocalPosition(-0.5, 0, 0);
        box_A.addChild(box_A_jointNode);
        box_B.addChild(box_B_jointNode);
        const joint = new pc.Entity("joint");
        app.root.addChild(box_A);
        box_A.setLocalPosition(0, 1, 0);
        box_A.addChild(box_B);
        box_B.setLocalPosition(2, 0, 0);
        box_A.addChild(joint);
        joint.setLocalPosition(1, 0, 0);
        box_A.addComponent('render', { type: 'box', material: createMaterial(pc.Color.RED) });
        box_B.addComponent('render', { type: 'box', material: createMaterial(pc.Color.GREEN) });
        const joint_render = new pc.Entity();
        joint_render.setLocalScale(0.1, 0.1, 0.1);
        joint_render.addComponent('render', { type: 'sphere', material: createMaterial(pc.Color.GRAY) });
        joint.addChild(joint_render);
        box_A.addComponent('collision', { type: 'box' });
        box_B.addComponent('collision', { type: 'box' });
        box_A.addComponent('physics', { type: pc.BODYTYPE_DYNAMIC });
        box_B.addComponent('physics', { type: pc.BODYTYPE_DYNAMIC });
        joint.addComponent('joint');
        joint.joint.type = pc.JOINT_TYPE_SPHERICAL;
        joint.joint.motion.angular.y = pc.MOTION_FREE;
        joint.joint.motion.angular.z = pc.MOTION_FREE;
        joint.joint.componentB = box_A_jointNode;
        joint.joint.componentA = box_B_jointNode;
        joint.joint.enableMultiBodyComponents = true;

        // Set an update function on the application's update event
        app.on("update", function (dt) {
            cameraEntity.lookAt(box_A.getPosition());

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
