Playcanvas Physics Advanced
====

[![npm version](https://img.shields.io/npm/dt/playcanvas-physics-advanced)](https://www.npmjs.com/package/playcanvas-physics-advanced)

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

PlayCanvasは、オープンソースのゲームエンジンです。

HTML5とWebGLを使用してゲームやインタラクティブな3Dコンテンツをモバイルやデスクトップのブラウザで実行できます。

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

## 利用実績

PlayCanvasは、ビデオゲーム、広告、ビジュアライゼーションの分野で大手企業に採用されています。
**Animech, Arm, BMW, Disney, Facebook, Famobi, Funday Factory, IGT, King, Miniclip, Leapfrog, Mojiworks, Mozilla, Nickelodeon, Nordeus, NOWWA, PikPok, PlaySide Studios, Polaris, Product Madness, Samsung, Snap, Spry Fox, Zeptolab, Zynga**

## 機能

PlayCanvasはフル機能のゲームエンジンです。

* 🧊 **グラフィックス** -  WebGL 1.0 & 2.0で構築された高度な2D + 3Dグラフィックスエンジン。
* 🏃 **アニメーション** - キャラクターやシーンに対する強力なステートベースのアニメーション
* ⚛️ **物理** - 3Dリジッドボディ物理エンジン [ammo.js](https://github.com/kripken/ammo.js)
* 🎮 **インプット** - マウス、キーボード、タッチ、ゲームパッド、VRコントローラのAPI
* 🔊 **サウンド** - Web Audio APIを利用した3D位置情報サウンド
* 📦 **アセット** - [glTF 2.0](https://www.khronos.org/gltf/)、[Draco](https://google.github.io/draco/)、[Basis](https://github.com/BinomialLLC/basis_universal) の圧縮技術を利用した非同期型ストリーミングシステム
* 📜 **スクリプト** - TypeScriptとJavaScriptをサポート

## 使用方法

シンプルなHello Worldの例です。

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
このコードを自分で試すには[CodePen](https://codepen.io/playcanvas/pen/NPbxMj)をクリックします。

## ビルドの手順

Node.jsがインストールされていることを確認します。
次に、必要なNode.jsの依存関係をすべてインストールします。

    npm install

これで、様々なオプションでビルドを実行できるようになりました。

| コマンド                | 説明                               | 出力ファイル                          |
|------------------------|-------------------------------------------|----------------------------------|
| `npm run build`        | リリース用、デバッグ用、プロファイラー用エンジンをビルドする | `build\playcanvas[.dbg/.prf].js` |
| `npm run build:types`  | TypeScript型定義ファイルをビルドする          | `build\playcanvas.d.ts`          |
| `npm run docs`         |  [APIリファレンス][docs] をビルドする| `docs`                           |


また、ビルド済みのエンジンも利用できます。

最新版のビルド(devブランチのHEADリビジョン)

* https://code.playcanvas.com/playcanvas-latest.js
* https://code.playcanvas.com/playcanvas-latest.min.js

最新安定版のビルド
* https://code.playcanvas.com/playcanvas-stable.js
* https://code.playcanvas.com/playcanvas-stable.min.js

特定のバージョンのビルド
* https://code.playcanvas.com/playcanvas-1.38.4.js
* https://code.playcanvas.com/playcanvas-1.38.4.min.js

### Generate Source Maps

エンジンのデバッグがしやすいようにソースマップを構築するには、任意のエンジン構築コマンドに`-- -m`を追加します。例えば、以下のようになります。


    npm run build -- -m

これにより`build/playcanvas.js.map`が出力されます。

## PlayCanvasエディター

PlayCanvas エンジンは、HTML5 アプリやゲームを作成するためのオープンソースのエンジンです。エンジンに加えて、[PlayCanvasエディター](https://playcanvas.com/)があります。

[![Editor](https://github.com/playcanvas/editor/blob/main/images/editor.png?raw=true)](https://github.com/playcanvas/editor)

エディター関連のバグや問題については、[Editor's repo](https://github.com/playcanvas/editor)を参照してください。


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
