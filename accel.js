(function() {
    'use strict';

    if (window['__ACCEL_V52']) return;
    window['__ACCEL_V52'] = 0x1;

    // --- Console Kill ---
    console['clear']();
    console['log'] = console['warn'] = console['error'] = console['info'] = () => {};

    // --- Console Detection (via RegExp toString hack) ---
    const O = () => {
        const C = /./;
        C['toString'] = function() {
            this['opened'] = !![];
            return '';
        };
        setInterval(() => {
            console['log']('%c', C);
            if (C['opened']) {
                window['__detected'] = !![];
            } else {
                window['__detected'] = ![];
            }
        }, 0x3e8); // 1000ms
    };
    O();

    // --- Site Detection ---
    const n = location['hostname'];
    const i = n['includes']('veck.io');
    const K = n['includes']('buildnow.gg');

    const c = {
        'veck.io': {
            'targetColor': [0xca, 0x1f, 0x2d], // Red
            'tolerance': 0x1e,
            'minBarWidth': 0x6,
            'maxBarHeight': 0x5,
            'searchTopPercent': 0.3,
            'aimOffsetY': 0xf
        },
        'buildnow.gg': {
            'targetColor': [0x0, 0xc8, 0x64], // Green
            'tolerance': 0x32,
            'minBarWidth': 0x5,
            'maxBarHeight': 0x6,
            'searchTopPercent': 0.35,
            'aimOffsetY': 0xa
        }
    };

    const M = i ? c['veck.io'] : K ? c['buildnow.gg'] : c['veck.io'];

    // --- Default Settings ---
    const b = {
        'active': ![],
        'toggle': ![],
        'smooth': 0.35,
        'prediction': !![],
        'predictionFactor': 0.5,
        'fovRadius': 0x8c,
        'aimOffsetY': M['aimOffsetY'],
        'scanFPS': 0x3c,
        'softAimEnabled': ![],
        'softSmooth': 0.08,
        'softReactionMs': 0x96,
        'softWobbleAmp': 2.5,
        'softOvershoot': 0.05,
        'triggerbot': !![],
        'triggerDistance': 0x8,
        'fireDelay': 0x190,
        'streamerMode': ![],
        'holdToAim': ![],
        'fpsBoost': ![],
        'resScale': 0x4b,
        'unlockFPS': ![],
        'advanced': ![],
        'colorTolerance': M['tolerance'],
        'minBarWidth': M['minBarWidth'],
        'maxBarHeight': M['maxBarHeight'],
        'searchTopPercent': M['searchTopPercent']
    };

    // --- Load/Save Settings from localStorage ---
    function g() {
        let C;
        try {
            C = JSON['parse'](localStorage['getItem']('accel_v52'));
        } catch (D) {}
        if (C && typeof C === 'object') {
            return Object['assign']({}, b, C);
        }
        return Object['assign']({}, b);
    }

    function L() {
        const C = {};
        for (let D in b) C[D] = z[D];
        localStorage['setItem']('accel_v52', JSON['stringify'](C));
    }

    const z = g();

    // --- CapsLock & UI Toggle ---
    let F = ![];
    document['addEventListener']('keydown', C => {
        if (C['code'] === 'CapsLock') {
            F = !F;
            C['preventDefault']();
        }
        if (C['code'] === 'Quote') {
            if (z['uiPanel']) {
                z['uiVisible'] = !z['uiVisible'];
                z['uiPanel']['style']['display'] = z['uiVisible'] ? 'block' : 'none';
            }
            C['preventDefault']();
        }
    });

    function T() {
        try {
            return KeyboardEvent['prototype']['getModifierState']?.['call']({}, 'CapsLock') || F;
        } catch (C) {
            return F;
        }
    }

    // --- Right Mouse Hold Detection ---
    let J = ![];
    document['addEventListener']('mousedown', C => {
        if (C['button'] === 0x2) J = !![];
    });
    document['addEventListener']('mouseup', C => {
        if (C['button'] === 0x2) J = ![];
    });
    document['addEventListener']('contextmenu', C => C['preventDefault']());

    // --- FPS Boost: Resolution Scaling ---
    function x() {
        document['querySelectorAll']('canvas')['forEach'](C => {
            if (!C['_accelOriginalW']) {
                C['_accelOriginalW'] = C['width'];
                C['_accelOriginalH'] = C['height'];
            }
            if (z['fpsBoost']) {
                const D = z['resScale'] / 0x64;
                C['width'] = Math['floor'](C['_accelOriginalW'] * D);
                C['height'] = Math['floor'](C['_accelOriginalH'] * D);
            } else {
                C['width'] = C['_accelOriginalW'];
                C['height'] = C['_accelOriginalH'];
            }
        });
    }

    // --- Unlock FPS (bypass requestAnimationFrame) ---
    function a() {
        if (z['unlockFPS']) {
            if (!window['_accelOrigRAF']) {
                window['_accelOrigRAF'] = window['requestAnimationFrame'];
            }
            window['requestAnimationFrame'] = function(C) {
                return setTimeout(() => C(performance['now']()), 0x0);
            };
        } else {
            if (window['_accelOrigRAF']) {
                window['requestAnimationFrame'] = window['_accelOrigRAF'];
            }
        }
    }

    // --- FOV Ring Overlay ---
    let R, o;

    function E() {
        if (R) return;
        R = document['createElement']('div');
        R['id'] = '_ac52ov';
        R['style']['cssText'] =
            'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483630;display:none;';
        document['body']['appendChild'](R);

        o = document['createElement']('canvas');
        o['id'] = '_ac52ring';
        o['width'] = innerWidth;
        o['height'] = innerHeight;
        o['style']['cssText'] = 'width:100vw;height:100vh;';
        R['appendChild'](o);
    }

    function d(C) {
        if (R) {
            R['style']['display'] = C && !z['streamerMode'] ? 'block' : 'none';
        }
    }

    function q() {
        if (!o || !z['active'] || z['streamerMode']) return;
        const C = o['getContext']('2d');
        C['clearRect'](0x0, 0x0, o['width'], o['height']);
        const D = o['width'] / 0x2;
        const y = o['height'] / 0x2;
        C['save']();
        C['strokeStyle'] = 'rgba(255,255,255,0.25)';
        C['lineWidth'] = 0x1;
        C['beginPath']();
        C['arc'](D, y, z['fovRadius'], 0x0, 0x2 * Math['PI']);
        C['stroke']();
        C['restore']();
    }

    // --- Target Tracking (Bar detection & persistence) ---
    let Y = [];
    let B = 0x1;

    function X(C) {
        const D = Date['now']();
        const y = new Set();
        const H = [];

        for (const s of C) {
            let U = Infinity;
            let W = null;

            for (const e of Y) {
                if (y['has'](e['id'])) continue;
                const j = Math['hypot'](s['x'] - e['lastPos']['x'], s['y'] - e['lastPos']['y']);
                if (j < 0x32 && j < U) {
                    U = j;
                    W = e;
                }
            }

            if (W) {
                W['velocity'] = {
                    'x': s['x'] - W['lastPos']['x'],
                    'y': s['y'] - W['lastPos']['y']
                };
                W['lastPos'] = { 'x': s['x'], 'y': s['y'] };
                W['lastSeen'] = D;
                W['bar'] = s;
                W['barLeft'] = s['x'] - s['width'] / 0x2;
                W['barRight'] = s['x'] + s['width'] / 0x2;

                W['leftHistory']['push'](W['barLeft']);
                if (W['leftHistory']['length'] > 0xa) W['leftHistory']['shift']();

                W['rightHistory']['push'](W['barRight']);
                if (W['rightHistory']['length'] > 0xa) W['rightHistory']['shift']();

                const l = h(W['leftHistory']);
                const I = h(W['rightHistory']);
                W['staticEdge'] = l <= I ? 'left' : 'right';

                if (s['width'] > W['maxBarWidth']) W['maxBarWidth'] = s['width'];

                if (W['staticEdge'] === 'left') {
                    W['anchorX'] = W['barLeft'] + W['maxBarWidth'] / 0x2;
                } else {
                    W['anchorX'] = W['barRight'] - W['maxBarWidth'] / 0x2;
                }
                W['anchorY'] = s['y'];

                H['push'](W);
                y['add'](W['id']);
            } else {
                H['push']({
                    'id': B++,
                    'lastPos': { 'x': s['x'], 'y': s['y'] },
                    'lastSeen': D,
                    'velocity': { 'x': 0x0, 'y': 0x0 },
                    'bar': s,
                    'barLeft': s['x'] - s['width'] / 0x2,
                    'barRight': s['x'] + s['width'] / 0x2,
                    'leftHistory': [s['x'] - s['width'] / 0x2],
                    'rightHistory': [s['x'] + s['width'] / 0x2],
                    'staticEdge': 'left',
                    'maxBarWidth': s['width'],
                    'anchorX': s['x'],
                    'anchorY': s['y']
                });
            }
        }

        // Remove stale tracks (older than 1s)
        Y = H['filter'](Z => D - Z['lastSeen'] < 0x3e8);
    }

    // Variance helper for edge stability
    function h(C) {
        if (C['length'] < 0x2) return 0x0;
        const D = C['reduce']((y, H) => y + H, 0x0) / C['length'];
        return C['reduce']((y, H) => y + (H - D) * (H - D), 0x0) / C['length'];
    }

    // --- Scan Canvas for Color Targets ---
    function u() {
        const C = document['querySelector']('canvas');
        if (!C) return [];

        const D = 0.2; // Downscale factor
        const H = Math['floor'](C['width'] * D);
        const s = Math['floor'](C['height'] * D);

        const U = document['createElement']('canvas');
        U['width'] = H;
        U['height'] = s;
        const W = U['getContext']('2d');
        W['drawImage'](C, 0x0, 0x0, H, s);

        const e = W['getImageData'](0x0, 0x0, H, s);
        const j = e['data'];

        const l = Math['floor'](H / 0x2);
        const I = Math['floor'](s / 0x2);
        const Z = Math['floor'](z['fovRadius'] * D);

        const [t, p, N] = M['targetColor'];
        const f = z['colorTolerance'];
        const O0 = Math['floor'](s * z['searchTopPercent']);
        const O1 = s - 0x5;
        const O2 = [];
        const O3 = new Uint8Array(H * s);

        // Scan pixels within FOV
        for (let O6 = Math['max'](I - Z, O0); O6 <= Math['min'](I + Z, O1); O6++) {
            const O7 = O6 - I;
            for (let O8 = l - Z; O8 <= l + Z; O8++) {
                const O9 = O8 - l;
                if (O9 * O9 + O7 * O7 > Z * Z) continue;
                const OO = (O6 * H + O8) * 0x4;
                const On = j[OO];
                const Oi = j[OO + 0x1];
                const OK = j[OO + 0x2];
                if (Math['sqrt']((On - t) ** 0x2 + (Oi - p) ** 0x2 + (OK - N) ** 0x2) < f) {
                    O3[O6 * H + O8] = 0x1;
                }
            }
        }

        const O4 = z['minBarWidth'];
        const O5 = z['maxBarHeight'];

        // Find contiguous bars
        for (let Oc = Math['max'](I - Z, O0); Oc <= Math['min'](I + Z, O1); Oc++) {
            let OM = -0x1;
            for (let Ob = l - Z; Ob <= l + Z; Ob++) {
                if (Ob < 0x0 || Ob >= H) continue;
                const Og = Ob - l;
                const OL = Oc - I;
                if (Og * Og + OL * OL > Z * Z) {
                    OM = -0x1;
                    continue;
                }
                if (O3[Oc * H + Ob]) {
                    if (OM === -0x1) OM = Ob;
                } else {
                    if (OM !== -0x1 && Ob - OM >= O4) {
                        let Oz = 0x1;
                        // Scan downwards
                        for (let OF = Oc + 0x1; OF < Math['min'](I + Z, O1); OF++) {
                            let OT = ![];
                            for (let OJ = OM; OJ < Ob; OJ++) {
                                if (O3[OF * H + OJ]) { OT = !![]; break; }
                            }
                            if (OT) Oz++;
                            else break;
                        }
                        // Scan upwards
                        for (let Ox = Oc - 0x1; Ox >= Math['max'](I - Z, O0); Ox--) {
                            let Oa = ![];
                            for (let OR = OM; OR < Ob; OR++) {
                                if (O3[Ox * H + OR]) { Oa = !![]; break; }
                            }
                            if (Oa) Oz++;
                            else break;
                        }
                        if (Oz <= O5) {
                            const Oo = (OM + Ob - 0x1) / 0x2;
                            const OE = Ob - OM;
                            O2['push']({
                                'x': Oo / D,
                                'y': Oc / D,
                                'width': OE / D
                            });
                        }
                    }
                    OM = -0x1;
                }
            }
        }

        return O2;
    }

    // --- Aim Logic ---
    let w = 'idle';
    let r = 0x0;
    let A = 0x0;
    let V = 0x0;
    let v = 0x0; // last trigger fire time
    let G = 0x0; // last scan time

    function P() {
        const C = z['active'] && (z['holdToAim'] ? J : !![]);
        if (!C) {
            w = 'idle';
            return;
        }

        const D = performance['now']();
        if (D - G < 0x3e8 / z['scanFPS']) return;
        G = D;

        const y = u();
        X(y);

        const H = innerWidth / 0x2;
        const s = innerHeight / 0x2;
        let U = null;
        let W = z['fovRadius'];

        // Find closest tracked target
        for (const t of Y) {
            const N = t['bar'];
            const f = Math['hypot'](N['x'] - H, N['y'] - s);
            if (f < W) {
                W = f;
                U = t;
            }
        }

        if (!U) {
            w = 'idle';
            return;
        }

        let e = U['anchorX'];
        let j = U['anchorY'];

        // Prediction
        if (z['prediction'] && (U['velocity']['x'] !== 0x0 || U['velocity']['y'] !== 0x0)) {
            const O0 = Math['hypot'](U['velocity']['x'], U['velocity']['y']);
            if (O0 > 0x0) {
                const O1 = U['velocity']['x'] / O0;
                const O2 = U['velocity']['y'] / O0;
                const O3 = Math['hypot'](e - H, j - s) * z['predictionFactor'];
                e += O1 * O3 * 0.5;
                j += O2 * O3 * 0.5;
            }
        }

        j += z['aimOffsetY'];

        let l, I;

        // --- Soft Aim (human-like) ---
        if (z['softAimEnabled']) {
            const O4 = e - H;
            const O5 = j - s;

            if (w === 'idle') {
                w = 'waiting';
                r = D;
                A = (Math['random']() - 0.5) * z['softWobbleAmp'] * 0x2;
                V = (Math['random']() - 0.5) * z['softWobbleAmp'] * 0x2;
                return;
            }

            if (w === 'waiting') {
                if (D - r < z['softReactionMs']) return;
                w = 'pulling';
                r = D;
            }

            if (w === 'pulling') {
                const O6 = D - r;
                const O7 = 0x1c2; // ~450ms pull duration
                const O8 = Math['min'](0x1, O6 / O7);
                const O9 = O8 < 0.7 ? (O8 / 0.7) * 0.85 : 0.85 + ((O8 - 0.7) / 0.3) * 0.15;

                l = O4 * O9 * z['softSmooth'] * (0x1 + z['softOvershoot']);
                I = O5 * O9 * z['softSmooth'] * (0x1 + z['softOvershoot']);
                l += A * Math['sin'](O8 * Math['PI'] * 0x2);
                I += V * Math['sin'](O8 * Math['PI'] * 0x2);

                if (O8 >= 0x1) {
                    w = 'correcting';
                    r = D;
                }
            }

            if (w === 'correcting') {
                const OO = e - H;
                const On = j - s;
                const Oi = z['softSmooth'] * 0.25;
                l = OO * Oi;
                I = On * Oi;
                l += Math['sin'](D * 0.015) * z['softWobbleAmp'] * 0.5;
                I += Math['cos'](D * 0.018) * z['softWobbleAmp'] * 0.5;

                if (Math['abs'](OO) < 0x2 && Math['abs'](On) < 0x2) w = 'idle';
            }

        } else {
            // --- Normal Smooth Aim ---
            const OK = (e - H) * z['smooth'];
            const Oc = (j - s) * z['smooth'];
            if (Math['abs'](OK) < 0.2 && Math['abs'](Oc) < 0.2) return;
            l = OK;
            I = Oc;
        }

        const Z = document['querySelector']('canvas');
        if (!Z) return;

        // Dispatch mouse move
        Z['dispatchEvent'](new MouseEvent('mousemove', {
            'clientX': H + l,
            'clientY': s + I,
            'movementX': l,
            'movementY': I,
            'bubbles': !![]
        }));

        // --- Triggerbot ---
        if (z['triggerbot']) {
            const OM = Math['hypot'](e - H, j - s);
            const Ob = z['softAimEnabled'] ? z['triggerDistance'] * 1.3 : z['triggerDistance'];
            const Og = z['softAimEnabled'] ? z['fireDelay'] + Math['random']() * 0x28 : z['fireDelay'];

            if (OM <= Ob && D - v >= Og) {
                Z['dispatchEvent'](new MouseEvent('mousedown', { 'button': 0x0, 'bubbles': !![] }));
                Z['dispatchEvent'](new MouseEvent('mouseup', { 'button': 0x0, 'bubbles': !![] }));
                v = D;
            }
        }
    }

    // --- UPGRADED UI PANEL (glassmorphism, Apple-style) ---
    function Q() {
        if (z['uiPanel']) return;

        // --- Create panel container ---
        const panel = document['createElement']('div');
        panel['id'] = '_ac52ui';
        panel['style']['cssText'] = `
            position:fixed; left:${z['panelX'] || 20}px; top:${z['panelY'] || 64}px;
            z-index:2147483650;
            background:rgba(18,20,30,0.72);
            backdrop-filter:blur(24px) saturate(1.5);
            -webkit-backdrop-filter:blur(24px) saturate(1.5);
            border:0.5px solid rgba(255,255,255,0.06);
            border-radius:20px;
            box-shadow:0 20px 60px rgba(0,0,0,0.7), inset 0 0 0 0.5px rgba(255,255,255,0.04);
            color:#f2f2f3;
            font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
            font-size:12px;
            width:380px;
            max-height:90vh;
            overflow-y:auto;
            pointer-events:auto;
            user-select:none;
            transition:border-color 0.3s ease;
        `;
        document['body']['appendChild'](panel);
        z['uiPanel'] = panel;
        z['panelX'] = parseInt(panel['style']['left']);
        z['panelY'] = parseInt(panel['style']['top']);

        // --- Build HTML structure ---
        panel['innerHTML'] = `
            <div style="display:flex;align-items:center;gap:10px;padding:14px 18px 8px;border-bottom:0.5px solid rgba(255,255,255,0.04);" id="_ac52drag">
                <div style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#6c5ce7,#00cec9);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff;box-shadow:0 4px 12px rgba(108,92,231,0.35);">A</div>
                <span style="font-size:16px;font-weight:700;letter-spacing:-0.3px;background:linear-gradient(135deg,#f0f0ff,#a0aec0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">ACCEL</span>
                <span style="font-size:8px;font-weight:600;color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.06);padding:2px 10px;border-radius:20px;border:0.5px solid rgba(255,255,255,0.05);">5.2</span>
                <div style="margin-left:auto;display:flex;gap:8px;">
                    <span id="_ac52min" style="cursor:pointer;color:rgba(255,255,255,0.25);font-size:14px;">−</span>
                    <span id="_ac52close" style="cursor:pointer;color:rgba(255,255,255,0.25);font-size:14px;">✕</span>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;padding:6px 18px 10px;border-bottom:0.5px solid rgba(255,255,255,0.04);">
                <span style="font-size:9px;font-weight:500;color:rgba(255,255,255,0.25);">STATUS</span>
                <span id="activeDot" style="color:${z['active'] ? '#7fd99a' : '#ff8080'};font-size:12px;">●</span>
                <span style="font-size:9px;font-weight:400;color:rgba(255,255,255,0.15);">|</span>
                <span style="font-size:9px;font-weight:400;color:rgba(255,255,255,0.25);">CapsLock / Right‑click</span>
                <span style="margin-left:auto;font-size:8px;color:rgba(255,255,255,0.12);">" hide</span>
            </div>
            <div style="display:flex;gap:4px;padding:10px 16px 0;border-bottom:0.5px solid rgba(255,255,255,0.04);">
                <div class="ac52tab active" data-tab="aim" style="flex:1;text-align:center;padding:8px 0;border-radius:8px;border:0.5px solid transparent;background:transparent;color:#fff;font-size:10px;font-weight:700;cursor:pointer;transition:0.15s;border-bottom:2px solid #6c5ce7;">AIM</div>
                <div class="ac52tab" data-tab="trig" style="flex:1;text-align:center;padding:8px 0;border-radius:8px;border:0.5px solid transparent;background:transparent;color:rgba(255,255,255,0.25);font-size:10px;font-weight:700;cursor:pointer;transition:0.15s;">TRIG</div>
                <div class="ac52tab" data-tab="fps" style="flex:1;text-align:center;padding:8px 0;border-radius:8px;border:0.5px solid transparent;background:transparent;color:rgba(255,255,255,0.25);font-size:10px;font-weight:700;cursor:pointer;transition:0.15s;">FPS</div>
                <div class="ac52tab" data-tab="set" style="flex:1;text-align:center;padding:8px 0;border-radius:8px;border:0.5px solid transparent;background:transparent;color:rgba(255,255,255,0.25);font-size:10px;font-weight:700;cursor:pointer;transition:0.15s;">SET</div>
            </div>
            <div id="_ac52content" style="padding:14px 18px 18px;"></div>
        `;

        // --- Inject modern CSS ---
        const style = document['createElement']('style');
        style['textContent'] = `
            .ac52tab{cursor:pointer;transition:0.15s;}
            .ac52tab:hover{color:#fff!important;}
            .ac52tab.active{color:#fff!important;border-bottom:2px solid #6c5ce7!important;}
            .ac52sw{width:38px;height:22px;background:rgba(255,255,255,0.08);border:0.5px solid rgba(255,255,255,0.04);border-radius:11px;position:relative;cursor:pointer;transition:0.25s cubic-bezier(0.34,1.56,0.64,1);display:inline-block;vertical-align:middle;flex-shrink:0;}
            .ac52sw.on{background:linear-gradient(135deg,#6c5ce7,#00cec9);border-color:rgba(108,92,231,0.3);}
            .ac52sw .knob{width:16px;height:16px;background:rgba(255,255,255,0.2);border-radius:50%;position:absolute;top:2px;left:2px;transition:0.25s cubic-bezier(0.34,1.56,0.64,1);box-shadow:0 2px 8px rgba(0,0,0,0.2);}
            .ac52sw.on .knob{left:18px;background:#fff;box-shadow:0 2px 12px rgba(108,92,231,0.4);}
            .ac52sw:active .knob{transform:scale(0.9);}
            .ac52label{display:flex;justify-content:space-between;align-items:center;margin:8px 0;color:rgba(255,255,255,0.7);font-weight:500;font-size:11px;}
            .ac52label span:first-child{color:rgba(255,255,255,0.6);}
            .ac52label .val{color:rgba(255,255,255,0.4);font-weight:400;min-width:32px;text-align:right;}
            .ac52slider{-webkit-appearance:none;appearance:none;width:100%;height:2px;background:rgba(255,255,255,0.06);border-radius:2px;outline:none;margin:4px 0 8px;}
            .ac52slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;border-radius:50%;background:radial-gradient(circle at 30% 30%, #a78bfa, #6c5ce7);cursor:pointer;box-shadow:0 2px 8px rgba(108,92,231,0.3);border:0.5px solid rgba(255,255,255,0.1);transition:0.15s;}
            .ac52slider::-webkit-slider-thumb:hover{transform:scale(1.1);}
            .ac52slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:radial-gradient(circle at 30% 30%, #a78bfa, #6c5ce7);cursor:pointer;border:0.5px solid rgba(255,255,255,0.1);}
            .ac52hr{border:none;border-top:0.5px solid rgba(255,255,255,0.04);margin:12px 0;}
            .ac52adv{margin-top:4px;padding-top:4px;}
            .ac52sec-title{color:#fff;font-weight:700;font-size:11px;margin:10px 0 4px;letter-spacing:0.3px;}
            ::-webkit-scrollbar{width:3px;}
            ::-webkit-scrollbar-track{background:transparent;}
            ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:6px;}
        `;
        document['head']['appendChild'](style);

        // --- Build tab content containers ---
        const content = document['getElementById']('_ac52content');
        const tabs = {};

        function createTab(id, html) {
            const div = document['createElement']('div');
            div['style']['display'] = id === 'aim' ? 'block' : 'none';
            div['innerHTML'] = html;
            content['appendChild'](div);
            tabs[id] = div;
        }

        // Helper: switch (toggle)
        function sw(key) {
            const on = z[key] ? 'on' : '';
            return `<div class="ac52sw ${on}" data-key="${key}"><div class="knob"></div></div>`;
        }

        // Helper: slider
        function sl(key, min, max, step, suffix = '', isFloat = false) {
            const val = z[key];
            const valId = 'sl_' + key;
            return `
                <div class="ac52label"><span>${key.replace(/([A-Z])/g, ' $1')}</span><span class="val" id="${valId}">${val}${suffix}</span></div>
                <input type="range" class="ac52slider" data-key="${key}" data-val-id="${valId}" data-is-float="${isFloat}" data-suffix="${suffix}" min="${min}" max="${max}" step="${step}" value="${val}">
            `;
        }

        // --- AIM Tab ---
        createTab('aim', `
            <div class="ac52label"><span>Hold to Aim (right mouse)</span>${sw('holdToAim')}</div>
            ${sl('scanFPS', 10, 1000, 10, '', false)}
            ${sl('smooth', 0.05, 1, 0.05, '', true)}
            ${sl('fovRadius', 50, 300, 10, 'px', false)}
            <div class="ac52label"><span>Prediction</span>${sw('prediction')}</div>
            ${sl('predictionFactor', 0, 1, 0.1, '', true)}
            ${sl('aimOffsetY', 0, 40, 1, 'px', false)}
            <div class="ac52hr"></div>
            <div class="ac52sec-title">SOFT AIM</div>
            <div class="ac52label"><span>Enable</span>${sw('softAimEnabled')}</div>
            ${sl('softSmooth', 0.02, 0.2, 0.01, '', true)}
            ${sl('softReactionMs', 0, 400, 10, 'ms', false)}
            ${sl('softWobbleAmp', 0, 6, 0.5, '', true)}
        `);

        // --- TRIG Tab ---
        createTab('trig', `
            <div class="ac52label"><span>Triggerbot</span>${sw('triggerbot')}</div>
            ${sl('triggerDistance', 2, 30, 1, 'px', false)}
            ${sl('fireDelay', 50, 600, 10, 'ms', false)}
        `);

        // --- FPS Tab ---
        createTab('fps', `
            <div class="ac52label"><span>Boost FPS</span>${sw('fpsBoost')}</div>
            ${sl('resScale', 30, 100, 5, '%', false)}
            <div class="ac52label"><span>Unlock FPS</span>${sw('unlockFPS')}</div>
            <div style="margin-top:8px;color:rgba(255,255,255,0.2);font-size:10px;">Boost lowers render resolution. Unlock FPS bypasses browser cap.</div>
        `);

        // --- SET Tab ---
        createTab('set', `
            <div class="ac52label"><span>Streamer (hide ring)</span>${sw('streamerMode')}</div>
            <div class="ac52hr"></div>
            <div class="ac52label"><span>Advanced</span><div class="ac52sw ${z['advanced'] ? 'on' : ''}" id="advancedToggle"><div class="knob"></div></div></div>
            <div class="ac52adv" style="display:${z['advanced'] ? 'block' : 'none'};">
                ${sl('colorTolerance', 10, 100, 5, '', false)}
                ${sl('minBarWidth', 2, 20, 1, 'px', false)}
                ${sl('maxBarHeight', 3, 20, 1, 'px', false)}
                ${sl('searchTopPercent', 0.1, 0.8, 0.05, '', true)}
            </div>
            <div style="margin-top:8px;color:rgba(255,255,255,0.15);font-size:9px;">Press " to hide/show panel</div>
        `);

        // --- Bind UI events ---

        // Tab switching
        const tabEls = panel['querySelectorAll']('.ac52tab');
        tabEls['forEach'](tab => {
            tab['addEventListener']('click', () => {
                tabEls['forEach'](t => { t['classList']['remove']('active'); t['style']['borderBottom'] = '2px solid transparent'; });
                tab['classList']['add']('active');
                tab['style']['borderBottom'] = '2px solid #6c5ce7';
                const id = tab['dataset']['tab'];
                Object['keys'](tabs)['forEach'](k => {
                    tabs[k]['style']['display'] = k === id ? 'block' : 'none';
                });
            });
        });

        // Helper: bind all toggles and sliders within a container
        function bindControls(container) {
            // Toggles
            container['querySelectorAll']('.ac52sw')['forEach'](el => {
                // Skip advancedToggle (handled separately)
                if (el['id'] === 'advancedToggle') return;
                el['addEventListener']('click', () => {
                    const key = el['dataset']['key'];
                    if (key) {
                        z[key] = !z[key];
                        el['classList']['toggle']('on', z[key]);
                        // Update knob position via CSS class
                        if (key === 'fpsBoost') x();
                        if (key === 'unlockFPS') a();
                        if (key === 'active') {
                            z['active'] = z['toggle'] || T();
                            updateActiveDot();
                        }
                        L();
                    }
                });
            });

            // Sliders
            container['querySelectorAll']('.ac52slider')['forEach'](el => {
                el['addEventListener']('input', () => {
                    const key = el['dataset']['key'];
                    const valId = el['dataset']['valId'];
                    const isFloat = el['dataset']['isFloat'] === 'true';
                    const suffix = el['dataset']['suffix'] || '';
                    const val = isFloat ? parseFloat(el['value']) : parseInt(el['value']);
                    if (key) {
                        z[key] = val;
                        const label = document['getElementById'](valId);
                        if (label) label['textContent'] = val + suffix;
                        if (key === 'resScale' && z['fpsBoost']) x();
                        L();
                    }
                });
            });
        }

        // Bind all tabs
        for (let id in tabs) {
            bindControls(tabs[id]);
        }

        // --- Active dot updater ---
        function updateActiveDot() {
            const dot = document['getElementById']('activeDot');
            if (dot) dot['style']['color'] = z['active'] ? '#7fd99a' : '#ff8080';
        }

        // --- Advanced toggle (special) ---
        const advToggle = document['getElementById']('advancedToggle');
        if (advToggle) {
            advToggle['addEventListener']('click', () => {
                z['advanced'] = !z['advanced'];
                advToggle['classList']['toggle']('on', z['advanced']);
                document['querySelectorAll']('.ac52adv')['forEach'](el => {
                    el['style']['display'] = z['advanced'] ? 'block' : 'none';
                });
                L();
            });
        }

        // --- Active toggle (master) - we have no explicit master toggle in new UI, but we have CapsLock and right-click. We keep the status dot. 
        // The 'active' state is derived from toggle + CapsLock, so we don't need a separate toggle.

        // --- Dragging ---
        const drag = document['getElementById']('_ac52drag');
        let dragging = ![];
        let offX = 0, offY = 0;
        drag['addEventListener']('mousedown', e => {
            dragging = !![];
            offX = e['clientX'] - z['panelX'];
            offY = e['clientY'] - z['panelY'];
            e['preventDefault']();
        });
        window['addEventListener']('mousemove', e => {
            if (!dragging) return;
            z['panelX'] = e['clientX'] - offX;
            z['panelY'] = e['clientY'] - offY;
            panel['style']['left'] = z['panelX'] + 'px';
            panel['style']['top'] = z['panelY'] + 'px';
        });
        window['addEventListener']('mouseup', () => dragging = ![]);

        // --- Close / Minimize ---
        document['getElementById']('_ac52close')['addEventListener']('click', () => {
            panel['style']['display'] = 'none';
            z['uiVisible'] = ![];
        });
        document['getElementById']('_ac52min')['addEventListener']('click', () => {
            const c = document['getElementById']('_ac52content');
            c['style']['display'] = c['style']['display'] === 'none' ? 'block' : 'none';
        });

        // Initial advanced state
        if (z['advanced']) {
            document['querySelectorAll']('.ac52adv')['forEach'](el => el['style']['display'] = 'block');
        }

        // Apply FPS settings after a delay
        setTimeout(() => {
            if (z['fpsBoost']) x();
            if (z['unlockFPS']) a();
        }, 0x3e8);

        // Show panel
        panel['style']['display'] = 'block';
        z['uiVisible'] = !![];
    }

    // --- Main Loop ---
    function m() {
        requestAnimationFrame(m);
        z['active'] = z['toggle'] || T();

        if (window['__detected']) {
            d(![]);
            return;
        }

        d(z['active']);
        q();
        P();

        if (!z['active']) v = 0x0;
    }

    // --- Init ---
    function k() {
        E();
        Q();
        if (z['toggle'] || T()) {
            z['active'] = !![];
            d(!![]);
        }
        requestAnimationFrame(m);
    }

    if (document['readyState'] === 'loading') {
        document['addEventListener']('DOMContentLoaded', k);
    } else {
        setTimeout(k, 0x1e);
    }

})();
