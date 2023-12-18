Playcanvas Physics Advanced
====

[![npm version](https://img.shields.io/npm/v/playcanvas-physics-advanced)](https://www.npmjs.com/package/playcanvas-physics-advanced)

*This is an advanced physics version of the original [PlayCanvas game engine](https://playcanvas.com/).*

On npm: [`playcanvas-physics-advanced`](https://www.npmjs.com/package/playcanvas-physics-advanced). Install with:

```shell
npm install playcanvas-physics-advanced
```

Features added/changed from original PlayCanvas:

* [`'physics'` component](./src/framework/components/physics/component.js) used instead of [`'rigidbody'` component](https://developer.playcanvas.com/en/api/pc.RigidBodyComponent.html).
* [`'multibody'` component](./src/framework/components/multibody/component.js) added to allow multibody articulations for much greater stability of many-jointed bodies.
* [`'joint'` component](./src/framework/components/joint/component.js) changed significantly from official playcanvas [joint component](https://github.com/playcanvas/engine/blob/main/src/framework/components/joint/component.js)
* [`EventHandler`](./src/core/event-handler.js) can use any key for events, not only strings; also symbols and numbers.
* [`Quat.distance()`](./src/core/math/quat.js) measures rotational distance between two quaternions.

<div align="center">
<img width="200" src="https://s3-eu-west-1.amazonaws.com/static.playcanvas.com/platform/images/logo/playcanvas-logo-medium.png"/>

# PlayCanvas WebGL Game Engine
[Docs](https://developer.playcanvas.com) | [Examples](https://playcanvas.github.io) | [Forum](https://forum.playcanvas.com) | [Blog](https://blog.playcanvas.com)

PlayCanvas is an open-source game engine. It uses HTML5 and WebGL to run games and other interactive 3D content in any mobile or desktop browser.

[![NPM version][npm-badge]][npm-url]
[![Minzipped size][minzip-badge]][minzip-url]
[![Language grade: JavaScript][code-quality-badge]][code-quality-url]
[![Average time to resolve an issue][resolution-badge]][isitmaintained-url]
[![Percentage of issues still open][open-issues-badge]][isitmaintained-url]
[![Twitter][twitter-badge]][twitter-url]

[English](https://github.com/playcanvas/engine/blob/dev/README.md)
[中文](https://github.com/playcanvas/engine/blob/dev/README-zh.md)
[日本語](https://github.com/playcanvas/engine/blob/dev/README-ja.md)
[한글](https://github.com/playcanvas/engine/blob/dev/README-kr.md)

</div>

## Users

PlayCanvas is used by leading companies in video games, advertising and visualization such as:  
**Animech, Arm, BMW, Disney, Facebook, Famobi, Funday Factory, IGT, King, Miniclip, Leapfrog, Mojiworks, Mozilla, Nickelodeon, Nordeus, NOWWA, PikPok, PlaySide Studios, Polaris, Product Madness, Samsung, Snap, Spry Fox, Zeptolab, Zynga**

## Features

PlayCanvas is a fully featured game engine.

* 🧊 **Graphics** - Advanced 2D + 3D graphics engine built on WebGL 1 & 2.
* 🏃 **Animation** - Powerful state-based animations for characters and arbitrary scene properties
* ⚛️ **Physics** - Full integration with 3D rigid-body physics engine [ammo.js](https://github.com/kripken/ammo.js)
* 🎮 **Input** - Mouse, keyboard, touch, gamepad and VR controller APIs
* 🔊 **Sound** - 3D positional sounds built on the Web Audio API
* 📦 **Assets** - Asynchronous streaming system built on [glTF 2.0](https://www.khronos.org/gltf/), [Draco](https://google.github.io/draco/) and [Basis](https://github.com/BinomialLLC/basis_universal) compression
* 📜 **Scripts** - Write game behaviors in Typescript or JavaScript

## Usage

Here's a super-simple Hello World example - a spinning cube!

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>PlayCanvas Hello Cube</title>
    <meta name='viewport' content='width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no' />
    <style>
        body {
            margin: 0;
            overflow: hidden;
        }
    </style>
    <script src='https://code.playcanvas.com/playcanvas-stable.min.js'></script>
</head>
<body>
    <canvas id='application'></canvas>
    <script>
        // create a PlayCanvas application
        const canvas = document.getElementById('application');
        const app = new pc.Application(canvas);

        // fill the available space at full resolution
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // ensure canvas is resized when window changes size
        window.addEventListener('resize', () => app.resizeCanvas());

        // create box entity
        const box = new pc.Entity('cube');
        box.addComponent('model', {
            type: 'box'
        });
        app.root.addChild(box);

        // create camera entity
        const camera = new pc.Entity('camera');
        camera.addComponent('camera', {
            clearColor: new pc.Color(0.1, 0.1, 0.1)
        });
        app.root.addChild(camera);
        camera.setPosition(0, 0, 3);

        // create directional light entity
        const light = new pc.Entity('light');
        light.addComponent('light');
        app.root.addChild(light);
        light.setEulerAngles(45, 0, 0);

        // rotate the box according to the delta time since the last frame
        app.on('update', dt => box.rotate(10 * dt, 20 * dt, 30 * dt));

        app.start();
    </script>
</body>
</html>
```

Want to play with the code yourself? Edit it on [CodePen](https://codepen.io/playcanvas/pen/NPbxMj).

## How to build

Ensure you have [Node.js](https://nodejs.org) installed. Then, install all of the required Node.js dependencies:

    npm install

Now you can run various build options:

| Command               | Description                               | Outputs                          |
|-----------------------|-------------------------------------------|----------------------------------|
| `npm run build`       | Build release, min, debug and profiler engines | `build\playcanvas[.min/.dbg/.prf].[mjs/js]` |
| `npm run build:es5`   | Build release, min, debug and profiler engines for es5 only | `build\playcanvas[.min/.dbg/.prf].js` |
| `npm run build:release` | Build release engine for es5 and es6 | `build\playcanvas.[mjs/js]` |
| `npm run build:types` | Build engine Typescript bindings          | `build\playcanvas.d.ts`          |
| `npm run docs`        | Build engine [API reference docs][docs]   | `docs`                           |

Pre-built versions of the engine are also available.

Latest development release (head revision of dev branch):

* https://code.playcanvas.com/playcanvas-latest.js
* https://code.playcanvas.com/playcanvas-latest.min.js

Latest stable release:

* https://code.playcanvas.com/playcanvas-stable.js
* https://code.playcanvas.com/playcanvas-stable.min.js

Specific engine versions:

* https://code.playcanvas.com/playcanvas-1.38.4.js
* https://code.playcanvas.com/playcanvas-1.38.4.min.js

### Generate Source Maps

To build the source map to allow for easier engine debugging, you can add `-- -m` to any engine build command. For example:

    npm run build -- -m

This will output to `build/playcanvas.js.map`

## PlayCanvas Editor

The PlayCanvas Engine is an open source engine which you can use to create HTML5 apps/games. In addition to the engine, we also make the [PlayCanvas Editor](https://playcanvas.com/):

[![Editor](https://github.com/playcanvas/editor/blob/main/images/editor.png?raw=true)](https://github.com/playcanvas/editor)

For Editor related bugs and issues, please refer to the [Editor's repo](https://github.com/playcanvas/editor).

[npm-badge]: https://img.shields.io/npm/v/playcanvas
[npm-url]: https://www.npmjs.com/package/playcanvas
[minzip-badge]: https://img.shields.io/bundlephobia/minzip/playcanvas
[minzip-url]: https://bundlephobia.com/result?p=playcanvas
[code-quality-badge]: https://img.shields.io/lgtm/grade/javascript/g/playcanvas/engine.svg?logo=lgtm&logoWidth=18
[code-quality-url]: https://lgtm.com/projects/g/playcanvas/engine/context:javascript
[resolution-badge]: https://isitmaintained.com/badge/resolution/playcanvas/engine.svg
[open-issues-badge]: https://isitmaintained.com/badge/open/playcanvas/engine.svg
[isitmaintained-url]: https://isitmaintained.com/project/playcanvas/engine
[twitter-badge]: https://img.shields.io/twitter/follow/playcanvas.svg?style=social&label=Follow
[twitter-url]: https://twitter.com/intent/follow?screen_name=playcanvas
[docs]: https://developer.playcanvas.com/en/api/
