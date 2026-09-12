(function() {
    'use strict';

    /* ═══════════════════════════════════════════════════════════════
       ACCEL v14
       · aim: absolute-target exponential lerp, dt-normalized
       · deadzone + velocity cap → no micro-jitter, no overshoot
       · recoil decoupled: aim contribution subtracted from recoil delta
       · menu: class-based premium rebuild (segmented tabs, sections,
         pill values, spring toggles, sliders with fill + badge)
       ═══════════════════════════════════════════════════════════════ */

    // ─── ANTI-DETECT FOUNDATION ─────────────────────────────
    (function killConsole() {
        const c = window.console; if (!c) return;
        ['log','warn','error','info','debug','trace','dir','table','group','groupEnd','groupCollapsed',
         'time','timeEnd','timeLog','assert','count','countReset','clear','dirxml','profile','profileEnd']
        .forEach(k => { try { c[k] = function(){}; } catch(_){} });
    })();
    const _nativeToString = Function.prototype.toString;
    const _fakeNative = 'function () { [native code] }';
    const _ourFns = new WeakSet();
    const _markFn = (fn) => { try { _ourFns.add(fn); } catch(_){} return fn; };
    Function.prototype.toString = function() {
        if (_ourFns.has(this)) return _fakeNative;
        return _nativeToString.call(this);
    };
    _markFn(Function.prototype.toString);
    const _salt = Math.random().toString(36).slice(2, 7);
    const _id = (n) => `_${_salt}_${n}`;
    const ID = {
        esp:_id('c'), radar:_id('r'), radarC:_id('rc'), panel:_id('p'),
        drag:_id('g'), fps:_id('f'), min:_id('m'), close:_id('x'),
        status:_id('s'), dot:_id('d'), count:_id('n'), tabs:_id('b'),
        content:_id('t'), force:_id('q'), style:_id('y'),
    };
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && ['I','i','J','j','C','c'].indexOf(e.key) !== -1) ||
            (e.ctrlKey && (e.key === 'u' || e.key === 'U'))) {
            e.preventDefault(); e.stopPropagation(); return false;
        }
    }, true);

    const PI2 = Math.PI * 2;
    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

    // ─── CONFIG ─────────────────────────────────────────────
    const DEFAULTS = {
        aimbot:true, softAim:false, silentAim:false, lockMode:false,
        aimKey:'right', aimFov:1.4, smoothing:0.55,
        aimBone:'head', targetPriority:'fov',
        camOffset:6.0, aimOffset:14.9, pitchMax:1.48,
        aimDeadzone:0.0035, aimMaxVel:6.0,
        softStrength:0.35, softJitter:0.5, softMissChance:0.03, softRampFrames:6,
        prediction:true, predictionStrength:0.6, velocitySmoothing:0.82,
        latencyComp:60, bulletSpeed:900, accelComp:true, predictionMaxOffset:8.0,
        autoShoot:true, triggerDelay:150, burstLength:3, burstPause:200,
        hitSound:false, hitSoundVolume:0.5,
        antiRecoil:true, recoilMode:'blend', recoilStrength:0.85,
        recoilAdaptiveW:0.4, recoilPatternW:0.4, recoilPredictW:0.2,
        recoilCompX:1.0, recoilCompY:1.0, recoilSmooth:0.7,
        autoBhop:true, bhopStrength:7.5,
        forceTeam:0, antiTeamLock:true,
        espEnabled:true, drawFov:true, fovColor:'#7c5cff',
        drawLines:true, snaplineOrigin:'bottom',
        showDist:true, maxDistShow:150, boxThickness:1.5,
        espFade:false, espFadeDist:120,
        skeletonESP:true, skeletonThickness:1.6, skeletonJointSize:2.6,
        skeletonColor:'#00e0c6',
        skeletonHead:true, skeletonTorso:true, skeletonArms:true, skeletonLegs:true,
        skeletonSmooth:0.55, skeletonMinConf:0.35, skeletonFill:true,
        radarEnabled:true, radarSize:140, radarRange:100, stealthMode:true,
        wallBang:true, forceWallBang:false, wallBangMaxDist:150, rageMode:false,
        wallbangColor:'#ff66ff', wallbangTracer:true, wallbangWindow:220,
        crosshair:false, crosshairStyle:'cross', crosshairSize:8, crosshairColor:'#00e0c6',
        maxStealth:true, jitterInput:false, jitterAmount:1.5,
        encryptStorage:true, spoofToString:true,
    };
    const STORAGE_KEY = 'accel_krunker_v14';
    const _XOR = 0x5B;
    const _xor = (s) => { let o = ''; for (let i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) ^ _XOR); return o; };
    const _enc = (s) => { try { return btoa(_xor(s)); } catch(_) { return null; } };
    const _dec = (s) => { try { return _xor(atob(s)); } catch(_) { return null; } };
    let settings = { ...DEFAULTS };
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            let raw = saved;
            const d = _dec(saved); if (d) { try { raw = d; } catch(_){} }
            settings = { ...DEFAULTS, ...JSON.parse(raw) };
        }
    } catch(_) { settings = { ...DEFAULTS }; }
    function saveSettings() {
        try {
            const raw = JSON.stringify(settings);
            const val = settings.encryptStorage ? _enc(raw) : raw;
            localStorage.setItem(STORAGE_KEY, val || raw);
        } catch(_) {}
    }

    // ─── STATE ──────────────────────────────────────────────
    let scene=null, myPlayer=null, camera=null, Vector3=null;
    let lockedTarget=null, keys={};
    let mouseButtons={0:false,1:false,2:false};
    let isHooked=false, lastShootTime=0, lastManualShot=0;
    let burstCount=0, burstTimer=0;
    let canvas=null, ctx=null;
    let targetCount=0, fps=0, frameCount=0, lastFpsUpdate=performance.now();
    let uiVisible=true, minimized=false;
    let radarCanvas=null;
    let wasOnGround=false, jumpCooldown=0, spaceLatch=false;
    let firing=false, wasFiring=false;
    let lastFrameTime = performance.now();
    const refs = {};
    let wallbangArmed=0;
    let playerSet=new WeakSet();
    let raycastHooked=false, raycasterPatched=false;
    const camWorld = { x:0, y:0, z:0 };
    const trackState = new WeakMap();
    const scratch = { v1:null };

    // Aim state — for decoupling recoil from aim motion
    let lastAimYawDelta = 0;
    let lastAimPitchDelta = 0;

    // ─── HOOK ───────────────────────────────────────────────
    const originalPush = Array.prototype.push;
    Array.prototype.push = function() {
        for (let i = 0; i < arguments.length; i++) {
            const obj = arguments[i];
            if (obj && obj.parent && obj.parent.name === 'Main' && obj.parent.type === 'Scene') {
                if (scene !== obj.parent) {
                    scene = obj.parent;
                    if (obj.position && obj.position.constructor) Vector3 = obj.position.constructor;
                    isHooked = true; raycastHooked = false;
                }
            }
        }
        return originalPush.apply(this, arguments);
    };
    _markFn(Array.prototype.push);

    // ─── TEAM ───────────────────────────────────────────────
    function getTeamDeep(o) {
        if (!o) return null;
        const list = [o, o.player, o.owner, o.userData];
        for (let x of list) {
            if (!x) continue;
            if (x.team !== undefined) return x.team;
            if (x.teammate !== undefined) return x.teammate;
            if (x.friendly !== undefined) return x.friendly;
            for (let k in x) {
                if (typeof x[k] === 'number' && (x[k] === 1 || x[k] === 2)) {
                    if (k !== 'x' && k !== 'y' && k !== 'z' && k.length <= 4) return x[k];
                }
            }
        }
        return null;
    }
    function getMyTeam() {
        let t = getTeamDeep(myPlayer);
        if (t !== null && t !== undefined) return t;
        try { if (window.world && window.world.localPlayer) {
            let w = getTeamDeep(window.world.localPlayer); if (w !== null) return w;
        } } catch(_) {}
        return null;
    }
    function isEnemy(e, myT) {
        let m = myT;
        if (settings.forceTeam === 1) m = 1;
        if (settings.forceTeam === 2) m = 2;
        if (settings.forceTeam === 3) return true;
        const eT = getTeamDeep(e);
        if (m === null || m === undefined) return true;
        if (eT === null || eT === undefined) return true;
        if (settings.antiTeamLock && m === eT) return false;
        return m !== eT;
    }
    function aimKeyDown() {
        const k = settings.aimKey;
        if (k === 'always') return true;
        if (k === 'right') return mouseButtons[2] === true;
        if (k === 'left') return mouseButtons[0] === true;
        if (k === 'shift') return !!keys['ShiftLeft'];
        if (k === 'alt') return !!keys['AltLeft'];
        return mouseButtons[2] === true;
    }

    // ─── HIT SOUND ──────────────────────────────────────────
    let _audio = null;
    function playHit() {
        if (!settings.hitSound) return;
        try {
            if (!_audio) _audio = new (window.AudioContext || window.webkitAudioContext)();
            if (_audio.state === 'suspended') _audio.resume();
            const o = _audio.createOscillator(), g = _audio.createGain();
            o.type = 'sine'; o.frequency.value = 1450;
            g.gain.setValueAtTime(settings.hitSoundVolume * 0.12, _audio.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, _audio.currentTime + 0.06);
            o.connect(g); g.connect(_audio.destination);
            o.start(); o.stop(_audio.currentTime + 0.07);
        } catch(_) {}
    }

    // ─── PREDICTION ─────────────────────────────────────────
    function updateTrack(e, now) {
        let s = trackState.get(e);
        if (!s) { s = { x:e.position.x,y:e.position.y,z:e.position.z,vx:0,vy:0,vz:0,ax:0,ay:0,az:0,time:now }; trackState.set(e, s); return s; }
        const dt = (now - s.time) / 1000;
        if (dt < 0.0005 || dt > 0.5) { s.time = now; return s; }
        const px=e.position.x, py=e.position.y, pz=e.position.z;
        const ivx=(px-s.x)/dt, ivy=(py-s.y)/dt, ivz=(pz-s.z)/dt;
        const a = settings.velocitySmoothing;
        const ivax=(ivx-s.vx)/dt, ivay=(ivy-s.vy)/dt, ivaz=(ivz-s.vz)/dt;
        s.vx=a*s.vx+(1-a)*ivx; s.vy=a*s.vy+(1-a)*ivy; s.vz=a*s.vz+(1-a)*ivz;
        if (settings.accelComp) { s.ax=a*s.ax+(1-a)*ivax; s.ay=a*s.ay+(1-a)*ivay; s.az=a*s.az+(1-a)*ivaz; }
        else { s.ax=s.ay=s.az=0; }
        s.x=px; s.y=py; s.z=pz; s.time=now;
        return s;
    }
    function predict(e, fx, fy, fz, now) {
        if (!settings.prediction) return { x:e.position.x, y:e.position.y, z:e.position.z };
        const s = updateTrack(e, now);
        const dx=e.position.x-fx, dy=e.position.y-fy, dz=e.position.z-fz;
        const d = Math.sqrt(dx*dx+dy*dy+dz*dz);
        const t = (d / (settings.bulletSpeed || 900)) + (settings.latencyComp / 1000);
        const tS = t * settings.predictionStrength;
        let ox = s.vx*tS + 0.5*s.ax*tS*tS;
        let oy = s.vy*tS + 0.5*s.ay*tS*tS;
        let oz = s.vz*tS + 0.5*s.az*tS*tS;
        const cap = settings.predictionMaxOffset || 8;
        const mag = Math.sqrt(ox*ox+oy*oy+oz*oz);
        if (mag > cap) { const k = cap/mag; ox*=k; oy*=k; oz*=k; }
        return { x:e.position.x+ox, y:e.position.y+oy, z:e.position.z+oz };
    }
    const BONE_Y = { head:10.2, neck:9.2, chest:7.8, pelvis:5.4 };
    const boneY = (b) => BONE_Y[b] === undefined ? settings.aimOffset : BONE_Y[b];

    // ─── TRIGGER / BHOP ─────────────────────────────────────
    function triggerShoot() {
        const now = performance.now();
        if (now - lastManualShot < 80) return;
        if (now - lastShootTime < settings.triggerDelay) return;
        const gc = document.body;
        const jx = settings.jitterInput ? (Math.random()-0.5)*settings.jitterAmount : 0;
        const jy = settings.jitterInput ? (Math.random()-0.5)*settings.jitterAmount : 0;
        const cx = window.innerWidth/2 + jx, cy = window.innerHeight/2 + jy;
        gc.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true, clientX:cx, clientY:cy, button:0, buttons:1 }));
        const up = settings.jitterInput ? 14 + Math.random()*14 : 20;
        setTimeout(() => gc.dispatchEvent(new MouseEvent('mouseup', { bubbles:true, cancelable:true, clientX:cx, clientY:cy, button:0, buttons:0 })), up);
        lastShootTime = now;
    }
    _markFn(triggerShoot);
    function doBhop() {
        if (!settings.autoBhop || !myPlayer) return false;
        if (!keys['Space']) { spaceLatch = false; return false; }
        if (spaceLatch) return false;
        const now = performance.now();
        if (now - jumpCooldown < 60) return false;
        try {
            const v = myPlayer.velocity; if (!v) return false;
            const eg = myPlayer.onGround === true || myPlayer.grounded === true;
            const nz = v.y <= 0.6 && v.y > -0.6;
            const og = eg || (nz && wasOnGround);
            if (!og) { wasOnGround = nz && v.y <= 0.05; return false; }
            v.y = settings.bhopStrength; jumpCooldown = now; spaceLatch = true; wasOnGround = false;
            return true;
        } catch(_) {}
        return false;
    }

    // ─── WALLBANG ───────────────────────────────────────────
    function installWallbang() {
        if (raycastHooked || !scene) return;
        try {
            const rc = findRaycaster();
            if (!rc) { raycastHooked = true; return; }
            const proto = rc.prototype;
            if (!proto || raycasterPatched) { raycastHooked = true; return; }
            const origIO = proto.intersectObject, origIOs = proto.intersectObjects;
            const filt = (res, ray) => {
                if (!settings.wallBang || performance.now() > wallbangArmed) return res;
                if (!res || !res.length || !ray || !ray.ray || !ray.ray.origin) return res;
                const o = ray.ray.origin;
                const dx = o.x-camWorld.x, dy = o.y-camWorld.y, dz = o.z-camWorld.z;
                if (dx*dx+dy*dy+dz*dz > 100) return res;
                const keep = [];
                for (let i = 0; i < res.length; i++) {
                    const h = res[i];
                    if (h && h.object && isPlayerMesh(h.object)) keep.push(h);
                }
                return keep.length ? keep : res;
            };
            if (typeof origIO === 'function') {
                proto.intersectObject = function(o,r,t) {
                    const res = origIO.call(this,o,r,t);
                    const arr = Array.isArray(res) ? res : (res ? [res] : []);
                    const f = filt(arr, this);
                    return Array.isArray(res) ? f : (f[0]||null);
                };
                _markFn(proto.intersectObject);
            }
            if (typeof origIOs === 'function') {
                proto.intersectObjects = function(o,r,t) {
                    const res = origIOs.call(this,o,r,t);
                    const arr = Array.isArray(res) ? res : (res ? [res] : []);
                    const f = filt(arr, this);
                    return Array.isArray(res) ? f : (f[0]||null);
                };
                _markFn(proto.intersectObjects);
            }
            raycasterPatched = true; raycastHooked = true;
        } catch(_) { raycastHooked = true; }
    }
    function findRaycaster() {
        try { if (window.THREE && window.THREE.Raycaster) return window.THREE.Raycaster; } catch(_) {}
        try {
            for (const k in window) {
                try {
                    const v = window[k];
                    if (!v || typeof v !== 'function') continue;
                    if (v.prototype && typeof v.prototype.intersectObjects === 'function'
                        && typeof v.prototype.setFromCamera === 'function') return v;
                } catch(_) {}
            }
        } catch(_) {}
        return null;
    }
    const isPlayerMesh = (o) => { let p = o; while (p) { if (playerSet.has(p)) return true; p = p.parent; } return false; };
    function updateCam() {
        if (!camera) return;
        try {
            if (camera.getWorldPosition && Vector3) {
                const v = new Vector3(); camera.getWorldPosition(v);
                camWorld.x = v.x; camWorld.y = v.y; camWorld.z = v.z;
            } else { camWorld.x = camera.position.x; camWorld.y = camera.position.y; camWorld.z = camera.position.z; }
        } catch(_) { camWorld.x = camera.position.x; camWorld.y = camera.position.y; camWorld.z = camera.position.z; }
    }

    /* ═══════════════════════════════════════════════════════════════
       ANTI-RECOIL — 3-way blend (same as v13)
       ═══════════════════════════════════════════════════════════════ */
    const Recoil = (() => {
        const patterns = Object.create(null);
        const DEF = {
            pitch:[0,0.008,0.014,0.020,0.026,0.030,0.034,0.037,0.040,0.042,0.044,0.046,0.047,0.048],
            yaw:[0,0.001,-0.002,0.002,-0.001,0.002,-0.002,0.001,-0.001,0.001,-0.001,0.001,-0.001,0.001],
        };
        const S = { firing:false, shot:0, weapon:'default', lastP:0, lastY:0, emaP:0, emaY:0, emaPrevP:0, emaPrevY:0, compP:0, compY:0, learn:{active:false, samples:[]} };
        const A = 0.35;
        function setWeapon(id) { if (id && id !== S.weapon) { S.weapon = id; S.shot = 0; } }
        function begin(p, y) { S.firing=true; S.shot=0; S.lastP=p; S.lastY=y; S.emaP=0; S.emaY=0; S.emaPrevP=0; S.emaPrevY=0; S.compP=0; S.compY=0; S.learn.active=true; S.learn.samples=[]; }
        function end() {
            S.firing=false; S.shot=0; S.emaP=0; S.emaY=0; S.emaPrevP=0; S.emaPrevY=0; S.compP=0; S.compY=0;
            if (S.learn.active && S.learn.samples.length >= 3 && settings.recoilPatternW > 0) {
                const k = S.weapon;
                if (!patterns[k]) patterns[k] = { pitch:DEF.pitch.slice(), yaw:DEF.yaw.slice() };
                const pat = patterns[k];
                for (let i = 0; i < S.learn.samples.length && i < pat.pitch.length; i++) {
                    pat.pitch[i] = pat.pitch[i]*0.7 + S.learn.samples[i].p*0.3;
                    pat.yaw[i] = pat.yaw[i]*0.7 + S.learn.samples[i].y*0.3;
                }
            }
            S.learn.active=false; S.learn.samples=[];
        }
        function getPattern() { return patterns[S.weapon] || DEF; }
        // aimDeltaP/Y = the delta WE applied last frame for aim. Subtracted so recoil doesn't chase its own tail.
        function step(curP, curY, aimDeltaP, aimDeltaY, opts) {
            if (!opts.enabled || !S.firing) { S.lastP=curP; S.lastY=curY; S.compP=0; S.compY=0; return null; }
            let dP = (curP - S.lastP) - aimDeltaP;
            let dY = (curY - S.lastY) - aimDeltaY;
            while (dY > Math.PI) dY -= PI2;
            while (dY < -Math.PI) dY += PI2;
            S.emaPrevP = S.emaP; S.emaPrevY = S.emaY;
            S.emaP = A*dP + (1-A)*S.emaP;
            S.emaY = A*dY + (1-A)*S.emaY;
            if (S.learn.active && Math.abs(dP) > 0.0005) S.learn.samples.push({ p:dP, y:dY });
            const adP=S.emaP, adY=S.emaY;
            const pat = getPattern(); const idx = Math.min(S.shot, pat.pitch.length-1);
            const ptP=pat.pitch[idx], ptY=pat.yaw[idx];
            const accP = S.emaP-S.emaPrevP, accY = S.emaY-S.emaPrevY;
            const prP = S.emaP + accP*1.5, prY = S.emaY + accY*1.5;
            let blP, blY;
            if (opts.mode === 'adaptive') { blP=adP; blY=adY; }
            else if (opts.mode === 'pattern') { blP=ptP; blY=ptY; }
            else if (opts.mode === 'predictive') { blP=prP; blY=prY; }
            else {
                const s = opts.wA + opts.wP + opts.wPr || 1;
                blP = (adP*opts.wA + ptP*opts.wP + prP*opts.wPr) / s;
                blY = (adY*opts.wA + ptY*opts.wP + prY*opts.wPr) / s;
            }
            const tp = -blP * opts.strength * opts.compY;
            const ty = -blY * opts.strength * opts.compX;
            const a = 1 - opts.smooth*0.9;
            S.compP = a*tp + (1-a)*S.compP;
            S.compY = a*ty + (1-a)*S.compY;
            S.lastP = curP; S.lastY = curY; S.shot++;
            return { dP:S.compP, dY:S.compY };
        }
        return { begin, end, step, setWeapon, S, patterns };
    })();

    /* ═══════════════════════════════════════════════════════════════
       SKELETON SOLVER (same pipeline as v13)
       ═══════════════════════════════════════════════════════════════ */
    const ANATOMY = { head:'neck', neck:'chest', chest:'pelvis', pelvis:null,
        lShoulder:'chest', lElbow:'lShoulder', lHand:'lElbow',
        rShoulder:'chest', rElbow:'rShoulder', rHand:'rElbow',
        lHip:'pelvis', lKnee:'lHip', lFoot:'lKnee',
        rHip:'pelvis', rKnee:'rHip', rFoot:'rKnee' };
    const BONE_KIND = { head:'head', neck:'torso', chest:'torso', pelvis:'torso',
        lShoulder:'arm', lElbow:'arm', lHand:'arm', rShoulder:'arm', rElbow:'arm', rHand:'arm',
        lHip:'leg', lKnee:'leg', lFoot:'leg', rHip:'leg', rKnee:'leg', rFoot:'leg' };
    function slotOn(s) {
        if (!settings.skeletonESP) return false;
        const k = BONE_KIND[s];
        if (k === 'head') return settings.skeletonHead;
        if (k === 'torso') return settings.skeletonTorso;
        if (k === 'arm') return settings.skeletonArms;
        if (k === 'leg') return settings.skeletonLegs;
        return true;
    }
    const RE = [
        [/head|skull/i,'head'], [/neck/i,'neck'],
        [/chest|torso|spine|upper[_-]?body/i,'chest'],
        [/pelvis|hip[_-]?bone|waist|lower[_-]?body/i,'pelvis'],
        [/(l|left)[_\-\.]?(shoulder|upper[_-]?arm|clavicle)/i,'lShoulder'],
        [/(l|left)[_\-\.]?(elbow|forearm|lower[_-]?arm)/i,'lElbow'],
        [/(l|left)[_\-\.]?(hand|wrist)/i,'lHand'],
        [/(r|right)[_\-\.]?(shoulder|upper[_-]?arm|clavicle)/i,'rShoulder'],
        [/(r|right)[_\-\.]?(elbow|forearm|lower[_-]?arm)/i,'rElbow'],
        [/(r|right)[_\-\.]?(hand|wrist)/i,'rHand'],
        [/(l|left)[_\-\.]?(hip|thigh|upper[_-]?leg)/i,'lHip'],
        [/(l|left)[_\-\.]?(knee|shin|lower[_-]?leg|calf)/i,'lKnee'],
        [/(l|left)[_\-\.]?(foot|ankle|boot)/i,'lFoot'],
        [/(r|right)[_\-\.]?(hip|thigh|upper[_-]?leg)/i,'rHip'],
        [/(r|right)[_\-\.]?(knee|shin|lower[_-]?leg|calf)/i,'rKnee'],
        [/(r|right)[_\-\.]?(foot|ankle|boot)/i,'rFoot'],
    ];
    function nameSlot(n) { if (!n) return null; for (let i = 0; i < RE.length; i++) if (RE[i][0].test(n)) return RE[i][1]; return null; }
    function spaceSlot(lx, ly) {
        const s = lx < -0.15 ? 'l' : lx > 0.15 ? 'r' : '';
        if (ly > 9.0) return 'head';
        if (ly > 8.2) return 'neck';
        if (ly > 6.3) return s ? s+'Shoulder' : 'chest';
        if (ly > 5.2) return s ? s+'Elbow' : 'pelvis';
        if (ly > 3.8) return s ? s+'Hand' : 'pelvis';
        if (ly > 2.2) return s ? s+'Knee' : 'pelvis';
        if (s) return s+'Foot';
        return null;
    }
    const skelCache = new WeakMap();
    const RESCAN = 500;
    function scanMeshes(player) {
        const out = []; const st = [player]; let n = 0;
        while (st.length && n < 500) {
            n++;
            const o = st.pop(); if (!o) continue;
            if (o.isMesh || o.type === 'Mesh' || o.type === 'SkinnedMesh') out.push({ obj:o, name:o.name||'' });
            const c = o.children; if (c) for (let i = 0; i < c.length; i++) st.push(c[i]);
        }
        return out;
    }
    function getEntry(p, now) {
        let e = skelCache.get(p);
        if (!e || (now - e.lastScan) > RESCAN) {
            e = { meshes:scanMeshes(p), lastScan:now, bones:{} };
            for (const m of e.meshes) m.slot = nameSlot(m.name);
            skelCache.set(p, e);
        }
        return e;
    }
    function solveSkel(player, now) {
        const e = getEntry(player, now);
        if (!Vector3) return null;
        if (!scratch.v1) scratch.v1 = new Vector3();
        const b = Object.create(null);
        const px=player.position.x, py=player.position.y, pz=player.position.z;
        const yaw = player.rotation ? player.rotation.y : 0;
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        for (const m of e.meshes) {
            try { m.obj.getWorldPosition(scratch.v1); } catch(_) { continue; }
            const wx=scratch.v1.x, wy=scratch.v1.y, wz=scratch.v1.z;
            let slot = m.slot;
            if (!slot) {
                const dx=wx-px, dy=wy-py, dz=wz-pz;
                const lx = dx*cy - dz*sy;
                const lz = dx*sy + dz*cy;
                slot = spaceSlot(lx, dy);
                if (!slot) continue;
                m.slot = slot;
            }
            let bb = b[slot];
            if (!bb) bb = b[slot] = { x:0, y:0, z:0, n:0 };
            bb.x += wx; bb.y += wy; bb.z += wz; bb.n++;
        }
        const res = Object.create(null);
        for (const s in b) {
            const x = b[s];
            res[s] = { x: x.x/x.n, y: x.y/x.n, z: x.z/x.n, conf: 1.0 };
        }
        if (settings.skeletonFill) {
            const has = (s) => res[s] !== undefined;
            if (!has('pelvis') && has('chest')) res.pelvis = { x:res.chest.x, y:res.chest.y-1.4, z:res.chest.z, conf:0.4 };
            if (!has('chest') && has('pelvis')) res.chest = { x:res.pelvis.x, y:res.pelvis.y+1.4, z:res.pelvis.z, conf:0.4 };
            if (!has('neck') && has('chest')) res.neck = { x:res.chest.x, y:res.chest.y+0.85, z:res.chest.z, conf:0.4 };
            if (!has('head') && has('neck')) res.head = { x:res.neck.x, y:res.neck.y+0.9, z:res.neck.z, conf:0.4 };
            if (!has('lShoulder') && has('chest')) res.lShoulder = { x:res.chest.x-0.9, y:res.chest.y+0.4, z:res.chest.z, conf:0.35 };
            if (!has('rShoulder') && has('chest')) res.rShoulder = { x:res.chest.x+0.9, y:res.chest.y+0.4, z:res.chest.z, conf:0.35 };
            if (!has('lElbow') && has('lShoulder')) res.lElbow = { x:res.lShoulder.x-0.3, y:res.lShoulder.y-1.1, z:res.lShoulder.z, conf:0.35 };
            if (!has('rElbow') && has('rShoulder')) res.rElbow = { x:res.rShoulder.x+0.3, y:res.rShoulder.y-1.1, z:res.rShoulder.z, conf:0.35 };
            if (!has('lHand') && has('lElbow')) res.lHand = { x:res.lElbow.x-0.2, y:res.lElbow.y-1.0, z:res.lElbow.z, conf:0.35 };
            if (!has('rHand') && has('rElbow')) res.rHand = { x:res.rElbow.x+0.2, y:res.rElbow.y-1.0, z:res.rElbow.z, conf:0.35 };
            if (!has('lHip') && has('pelvis')) res.lHip = { x:res.pelvis.x-0.6, y:res.pelvis.y-0.05, z:res.pelvis.z, conf:0.4 };
            if (!has('rHip') && has('pelvis')) res.rHip = { x:res.pelvis.x+0.6, y:res.pelvis.y-0.05, z:res.pelvis.z, conf:0.4 };
            if (!has('lKnee') && has('lHip')) res.lKnee = { x:res.lHip.x-0.1, y:res.lHip.y-1.6, z:res.lHip.z, conf:0.35 };
            if (!has('rKnee') && has('rHip')) res.rKnee = { x:res.rHip.x+0.1, y:res.rHip.y-1.6, z:res.rHip.z, conf:0.35 };
            if (!has('lFoot') && has('lKnee')) res.lFoot = { x:res.lKnee.x, y:res.lKnee.y-1.6, z:res.lKnee.z, conf:0.35 };
            if (!has('rFoot') && has('rKnee')) res.rFoot = { x:res.rKnee.x, y:res.rKnee.y-1.6, z:res.rKnee.z, conf:0.35 };
        }
        const out = Object.create(null);
        const A = clamp(settings.skeletonSmooth, 0.05, 0.95);
        for (const s in res) {
            const cur = res[s], prev = e.bones[s];
            if (!prev) { e.bones[s] = { x:cur.x, y:cur.y, z:cur.z, conf:cur.conf }; out[s] = e.bones[s]; }
            else {
                prev.x = A*prev.x + (1-A)*cur.x;
                prev.y = A*prev.y + (1-A)*cur.y;
                prev.z = A*prev.z + (1-A)*cur.z;
                prev.conf = A*prev.conf + (1-A)*cur.conf;
                out[s] = prev;
            }
        }
        for (const s in e.bones) {
            if (!out[s]) {
                e.bones[s].conf *= 0.5;
                if (e.bones[s].conf > 0.1) out[s] = e.bones[s];
            }
        }
        return out;
    }
    function drawSkel(player, cam, w, h) {
        if (!settings.skeletonESP || !Vector3) return;
        const bones = solveSkel(player, performance.now());
        if (!bones) return;
        const scr = Object.create(null);
        let vis = 0, tot = 0;
        for (const s in bones) {
            const b = bones[s]; tot++;
            if (b.conf < settings.skeletonMinConf) { scr[s] = null; continue; }
            const v = new Vector3(b.x, b.y, b.z);
            v.project(cam);
            if (!isFinite(v.x) || !isFinite(v.y) || v.z > 1 || v.z < -1) { scr[s] = null; continue; }
            scr[s] = { x:(v.x*0.5+0.5)*w, y:(-v.y*0.5+0.5)*h, conf:b.conf };
            vis++;
        }
        if (vis < 3 || vis < tot * 0.25) return;
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.shadowColor = settings.skeletonColor;
        ctx.shadowBlur = 5;
        for (const s in ANATOMY) {
            const p = ANATOMY[s]; if (!p) continue;
            if (!slotOn(s) || !slotOn(p)) continue;
            const a = scr[s], b = scr[p]; if (!a || !b) continue;
            const c = Math.min(a.conf, b.conf);
            ctx.globalAlpha = clamp(c, 0.3, 1.0);
            ctx.strokeStyle = settings.skeletonColor;
            ctx.lineWidth = settings.skeletonThickness * (0.7 + 0.3 * c);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 8;
        const js = settings.skeletonJointSize;
        for (const s in scr) {
            const p = scr[s]; if (!p || !slotOn(s)) continue;
            ctx.globalAlpha = clamp(p.conf, 0.4, 1.0);
            ctx.beginPath(); ctx.arc(p.x, p.y, js * (0.6 + 0.4 * p.conf), 0, PI2); ctx.fill();
        }
        ctx.globalAlpha = 1; ctx.restore();
    }
    function wallbangActive(t) {
        if (!settings.wallBang || !t || !myPlayer) return false;
        const dx=t.position.x-myPlayer.position.x, dy=t.position.y-myPlayer.position.y, dz=t.position.z-myPlayer.position.z;
        return Math.sqrt(dx*dx+dy*dy+dz*dz) <= settings.wallBangMaxDist;
    }
    const softState = { ramp:0, jx:0, jy:0, mf:0, mx:0, my:0, lastT:null };
    function softAim(dy, dp) {
        if (softState.lastT !== lockedTarget) { softState.ramp = 0; softState.lastT = lockedTarget; }
        softState.ramp = Math.min(softState.ramp + 1, settings.softRampFrames);
        const ramp = softState.ramp / Math.max(1, settings.softRampFrames);
        if (settings.softJitter > 0) {
            softState.jx = softState.jx*0.6 + (Math.random()-0.5)*settings.softJitter*0.02;
            softState.jy = softState.jy*0.6 + (Math.random()-0.5)*settings.softJitter*0.02;
        } else { softState.jx = softState.jy = 0; }
        if (softState.mf > 0) softState.mf--;
        else if (Math.random() < settings.softMissChance * 0.05) {
            softState.mf = 2 + Math.floor(Math.random()*4);
            softState.mx = (Math.random()-0.5)*0.015;
            softState.my = (Math.random()-0.5)*0.015;
        }
        const mx = softState.mf > 0 ? softState.mx : 0;
        const my = softState.mf > 0 ? softState.my : 0;
        const pull = settings.softStrength * ramp;
        return { yaw: dy*pull + softState.jx + mx, pitch: dp*pull + softState.jy + my };
    }

    /* ═══════════════════════════════════════════════════════════════
       PREMIUM UI — class-based rebuild
       ═══════════════════════════════════════════════════════════════ */
    const CSS = `
    .acc-root, .acc-root *, .acc-root *::before, .acc-root *::after { box-sizing:border-box; }
    .acc-root {
        --bg:#0a0c12;
        --bg-2:#10131c;
        --card:rgba(22,26,38,0.72);
        --card-2:rgba(30,35,50,0.66);
        --rim:rgba(255,255,255,0.06);
        --rim-2:rgba(255,255,255,0.10);
        --text:#e8ebf5;
        --text-2:rgba(232,235,245,0.62);
        --text-3:rgba(232,235,245,0.34);
        --accent:#7c5cff;
        --accent-2:#00e0c6;
        --danger:#ff5566;
        --warn:#fdcb6e;
        --radius:20px;
        --radius-sm:10px;
        font-family:'Inter','Segoe UI',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
        -webkit-font-smoothing:antialiased;
        font-feature-settings:'ss01','cv11';
        color:var(--text);
    }
    .acc-panel {
        position:fixed; top:24px; right:24px; z-index:9999;
        width:400px; max-height:88vh;
        display:flex; flex-direction:column; overflow:hidden;
        border-radius:var(--radius);
        background:
            radial-gradient(120% 100% at 0% 0%, rgba(124,92,255,0.10), transparent 55%),
            radial-gradient(120% 100% at 100% 100%, rgba(0,224,198,0.07), transparent 55%),
            var(--card);
        backdrop-filter:blur(28px) saturate(1.7);
        -webkit-backdrop-filter:blur(28px) saturate(1.7);
        border:1px solid var(--rim);
        box-shadow:
            0 1px 0 0 rgba(255,255,255,0.04) inset,
            0 30px 80px rgba(0,0,0,0.72),
            0 8px 24px rgba(0,0,0,0.55);
        transition:transform 0.42s cubic-bezier(0.34,1.4,0.64,1), opacity 0.28s ease, border-color 0.4s ease;
        pointer-events:auto;
    }
    .acc-panel::before {
        content:''; position:absolute; inset:0; pointer-events:none; border-radius:var(--radius);
        background:linear-gradient(180deg, rgba(255,255,255,0.045), transparent 30%);
        mask:linear-gradient(#000, #000);
        -webkit-mask:linear-gradient(#000, #000);
    }
    .acc-hd {
        display:flex; align-items:center; gap:10px;
        padding:14px 16px 12px 16px;
        border-bottom:1px solid var(--rim);
        cursor:grab;
        position:relative;
    }
    .acc-hd:active { cursor:grabbing; }
    .acc-logo {
        width:30px; height:30px; border-radius:9px;
        background:conic-gradient(from 180deg at 50% 50%, #7c5cff, #00e0c6, #7c5cff);
        display:flex; align-items:center; justify-content:center;
        font-weight:800; font-size:13px; color:#0a0c12;
        box-shadow:0 4px 20px rgba(124,92,255,0.4), 0 0 0 1px rgba(255,255,255,0.08) inset;
        animation:acc-spin 12s linear infinite;
    }
    @keyframes acc-spin { to { filter:hue-rotate(360deg); } }
    .acc-brand { display:flex; align-items:baseline; gap:8px; }
    .acc-name {
        font-weight:800; font-size:15px; letter-spacing:-0.3px;
        background:linear-gradient(135deg, #ffffff 0%, #b8bfd6 100%);
        -webkit-background-clip:text; background-clip:text;
        -webkit-text-fill-color:transparent;
    }
    .acc-ver {
        font-size:9px; font-weight:600; letter-spacing:0.5px;
        color:var(--text-2);
        background:rgba(124,92,255,0.14);
        border:1px solid rgba(124,92,255,0.22);
        padding:2px 7px; border-radius:20px;
    }
    .acc-hd-right { margin-left:auto; display:flex; align-items:center; gap:8px; }
    .acc-fps {
        font-size:10px; font-weight:600; letter-spacing:0.3px;
        color:var(--text-3); font-variant-numeric:tabular-nums;
        padding:3px 8px; border-radius:8px;
        background:rgba(255,255,255,0.03); border:1px solid var(--rim);
    }
    .acc-btn {
        width:24px; height:24px; border-radius:8px;
        display:flex; align-items:center; justify-content:center;
        font-size:12px; font-weight:600; line-height:1;
        color:var(--text-3); cursor:pointer; user-select:none;
        background:rgba(255,255,255,0.03); border:1px solid var(--rim);
        transition:background 0.18s, color 0.18s, border-color 0.18s, transform 0.14s;
    }
    .acc-btn:hover { background:rgba(255,255,255,0.07); color:var(--text); border-color:var(--rim-2); }
    .acc-btn:active { transform:scale(0.94); }
    .acc-btn.close:hover { color:var(--danger); background:rgba(255,85,102,0.12); border-color:rgba(255,85,102,0.3); }
    .acc-strip {
        display:flex; align-items:center; gap:10px;
        padding:8px 16px; border-bottom:1px solid var(--rim);
        font-size:9.5px; font-weight:600; letter-spacing:0.35px;
        color:var(--text-3); text-transform:uppercase;
    }
    .acc-dot {
        width:6px; height:6px; border-radius:50%;
        background:rgba(255,255,255,0.18);
        box-shadow:0 0 0 3px rgba(255,255,255,0.02);
        transition:background 0.25s, box-shadow 0.25s;
    }
    .acc-strip .v { color:var(--text); font-variant-numeric:tabular-nums; }
    .acc-strip .sp { flex:1; }
    .acc-pill {
        font-size:8.5px; font-weight:700; letter-spacing:0.5px;
        padding:3px 8px; border-radius:20px;
        background:rgba(255,85,102,0.10); color:rgba(255,85,102,0.75);
        border:1px solid rgba(255,85,102,0.16);
        transition:opacity 0.2s, color 0.2s, background 0.2s;
    }
    .acc-tabs {
        display:flex; gap:4px; padding:10px 14px 6px 14px;
        position:relative;
    }
    .acc-tabs::after {
        content:''; position:absolute; left:14px; right:14px; bottom:0;
        height:1px; background:var(--rim);
    }
    .acc-tab {
        flex:1; text-align:center; padding:8px 0;
        font-size:10px; font-weight:700; letter-spacing:0.7px;
        color:var(--text-3); cursor:pointer; user-select:none;
        border-radius:9px;
        position:relative; z-index:1;
        transition:color 0.2s, background 0.2s, transform 0.15s;
    }
    .acc-tab:hover { color:var(--text-2); }
    .acc-tab.on {
        color:#fff;
        background:linear-gradient(135deg, rgba(124,92,255,0.22), rgba(0,224,198,0.14));
        box-shadow:
            0 0 0 1px rgba(124,92,255,0.3) inset,
            0 0 20px rgba(124,92,255,0.14);
    }
    .acc-tab.on::before {
        content:''; position:absolute; left:28%; right:28%; bottom:-6px; height:2px;
        background:linear-gradient(90deg, transparent, var(--accent), var(--accent-2), transparent);
        border-radius:2px; filter:blur(0.5px);
    }
    .acc-body {
        padding:14px 14px 16px 14px; overflow-y:auto; flex:1;
        scrollbar-width:thin; scrollbar-color:rgba(255,255,255,0.08) transparent;
    }
    .acc-body::-webkit-scrollbar { width:5px; }
    .acc-body::-webkit-scrollbar-track { background:transparent; }
    .acc-body::-webkit-scrollbar-thumb {
        background:linear-gradient(180deg, rgba(124,92,255,0.3), rgba(0,224,198,0.2));
        border-radius:6px;
    }
    .acc-page { display:none; animation:acc-fade 0.28s ease; }
    .acc-page.on { display:block; }
    @keyframes acc-fade { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:none; } }

    .acc-sec {
        margin-bottom:8px; border-radius:14px; overflow:hidden;
        background:rgba(255,255,255,0.02);
        border:1px solid var(--rim);
    }
    .acc-sec-hd {
        display:flex; align-items:center; gap:9px;
        padding:10px 12px; cursor:pointer; user-select:none;
        background:linear-gradient(180deg, rgba(255,255,255,0.03), transparent);
        transition:background 0.2s;
    }
    .acc-sec-hd:hover { background:linear-gradient(180deg, rgba(255,255,255,0.05), transparent); }
    .acc-sec-ico {
        width:18px; height:18px; border-radius:6px;
        background:linear-gradient(135deg, rgba(124,92,255,0.6), rgba(0,224,198,0.35));
        display:flex; align-items:center; justify-content:center;
        font-size:9px; font-weight:800; color:#0a0c12;
        box-shadow:0 2px 8px rgba(124,92,255,0.25);
    }
    .acc-sec-tit {
        font-size:10.5px; font-weight:700; letter-spacing:0.6px;
        color:var(--text-2); text-transform:uppercase;
    }
    .acc-sec-chev {
        margin-left:auto; font-size:9px; color:var(--text-3);
        transition:transform 0.25s cubic-bezier(0.34,1.4,0.64,1);
    }
    .acc-sec.col .acc-sec-chev { transform:rotate(-90deg); }
    .acc-sec-bd {
        padding:2px 12px 10px 12px;
        max-height:2000px; overflow:hidden;
        transition:max-height 0.32s ease, opacity 0.24s ease, padding 0.24s ease;
        opacity:1;
    }
    .acc-sec.col .acc-sec-bd {
        max-height:0; opacity:0; padding-top:0; padding-bottom:0;
    }
    .acc-row {
        display:flex; align-items:center; justify-content:space-between;
        gap:12px; padding:9px 6px;
        border-radius:8px;
        transition:background 0.16s;
    }
    .acc-row:hover { background:rgba(255,255,255,0.025); }
    .acc-row + .acc-row { border-top:1px solid rgba(255,255,255,0.025); }
    .acc-lb { display:flex; flex-direction:column; gap:2px; min-width:0; }
    .acc-lb-main { font-size:11.5px; font-weight:500; color:var(--text); }
    .acc-lb-sub { font-size:9px; font-weight:400; color:var(--text-3); letter-spacing:0.15px; }
    .acc-lb kbd {
        font-size:8px; font-weight:600; padding:1.5px 6px;
        background:rgba(255,255,255,0.05); border:1px solid var(--rim);
        border-radius:5px; font-family:inherit; color:var(--text-3);
        margin-left:6px; letter-spacing:0.4px;
    }

    .acc-tog {
        width:38px; height:22px; border-radius:11px; flex-shrink:0;
        background:rgba(255,255,255,0.06);
        border:1px solid var(--rim);
        position:relative; cursor:pointer;
        transition:background 0.28s, border-color 0.28s, box-shadow 0.28s;
    }
    .acc-tog .kn {
        width:16px; height:16px; border-radius:50%;
        background:linear-gradient(180deg, #ffffff, #c8cde0);
        position:absolute; top:2px; left:2px;
        box-shadow:0 2px 6px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.6) inset;
        transition:left 0.32s cubic-bezier(0.34,1.55,0.64,1), background 0.28s, box-shadow 0.28s;
    }
    .acc-tog:hover { background:rgba(255,255,255,0.10); }
    .acc-tog:active .kn { transform:scale(0.94); }
    .acc-tog.on {
        background:linear-gradient(135deg, var(--accent), var(--accent-2));
        border-color:rgba(124,92,255,0.4);
        box-shadow:0 0 20px rgba(124,92,255,0.28);
    }
    .acc-tog.on .kn {
        left:18px;
        box-shadow:0 2px 12px rgba(124,92,255,0.5), 0 1px 0 rgba(255,255,255,0.6) inset;
    }

    .acc-sl-wrap { padding:8px 6px 10px 6px; border-radius:8px; transition:background 0.16s; }
    .acc-sl-wrap:hover { background:rgba(255,255,255,0.02); }
    .acc-sl-head {
        display:flex; align-items:center; justify-content:space-between;
        margin-bottom:7px;
    }
    .acc-sl-lbl { font-size:10.5px; font-weight:500; color:var(--text-2); }
    .acc-sl-val {
        display:flex; align-items:center; gap:1px;
        background:rgba(124,92,255,0.10);
        border:1px solid rgba(124,92,255,0.18);
        border-radius:7px; padding:1px;
    }
    .acc-sl-val button {
        width:16px; height:16px; border:0; border-radius:5px;
        background:transparent; color:var(--text-2);
        font-size:11px; font-weight:600; line-height:1;
        cursor:pointer; font-family:inherit;
        transition:background 0.15s, color 0.15s;
    }
    .acc-sl-val button:hover { background:rgba(124,92,255,0.2); color:#fff; }
    .acc-sl-val span {
        min-width:44px; text-align:center;
        font-size:10px; font-weight:600; color:var(--text);
        font-variant-numeric:tabular-nums; padding:0 4px;
    }
    .acc-sl {
        -webkit-appearance:none; appearance:none;
        width:100%; height:5px; border-radius:5px; outline:none;
        background:rgba(255,255,255,0.06);
        position:relative;
    }
    .acc-sl::-webkit-slider-thumb {
        -webkit-appearance:none; appearance:none;
        width:15px; height:15px; border-radius:50%;
        background:radial-gradient(circle at 30% 30%, #ffffff, #a09ae8 60%, #7c5cff 100%);
        cursor:pointer;
        box-shadow:
            0 2px 10px rgba(124,92,255,0.45),
            0 0 0 1px rgba(255,255,255,0.12);
        transition:transform 0.15s;
    }
    .acc-sl::-webkit-slider-thumb:hover { transform:scale(1.12); }
    .acc-sl::-moz-range-thumb {
        width:15px; height:15px; border-radius:50%; border:none;
        background:radial-gradient(circle at 30% 30%, #ffffff, #a09ae8 60%, #7c5cff 100%);
        cursor:pointer;
        box-shadow:0 2px 10px rgba(124,92,255,0.45);
    }

    .acc-sel {
        background:rgba(255,255,255,0.04);
        border:1px solid var(--rim);
        border-radius:8px;
        color:var(--text);
        padding:5px 10px;
        font-size:10.5px; font-weight:500; font-family:inherit;
        cursor:pointer; outline:none;
        transition:border-color 0.18s, background 0.18s;
        -webkit-appearance:none; appearance:none;
        background-image:linear-gradient(45deg, transparent 50%, rgba(255,255,255,0.35) 50%), linear-gradient(135deg, rgba(255,255,255,0.35) 50%, transparent 50%);
        background-position:calc(100% - 13px) 50%, calc(100% - 8px) 50%;
        background-size:5px 5px, 5px 5px;
        background-repeat:no-repeat;
        padding-right:24px;
    }
    .acc-sel:hover { border-color:var(--rim-2); background-color:rgba(255,255,255,0.06); }
    .acc-sel:focus { border-color:rgba(124,92,255,0.4); box-shadow:0 0 0 3px rgba(124,92,255,0.12); }
    .acc-sel option { background:#10131c; color:#e8ebf5; }

    .acc-col {
        width:32px; height:22px; border-radius:6px; padding:0;
        border:1px solid var(--rim);
        background:transparent; cursor:pointer;
        transition:border-color 0.18s, transform 0.14s;
    }
    .acc-col:hover { border-color:var(--rim-2); transform:scale(1.04); }
    .acc-col::-webkit-color-swatch-wrapper { padding:2px; }
    .acc-col::-webkit-color-swatch { border:none; border-radius:4px; }
    .acc-col::-moz-color-swatch { border:none; border-radius:4px; }

    .acc-ft {
        display:flex; align-items:center; justify-content:space-between;
        padding:9px 16px 12px 16px;
        border-top:1px solid var(--rim);
        font-size:8.5px; font-weight:600; letter-spacing:0.4px;
        color:var(--text-3); text-transform:uppercase;
    }
    .acc-keys { display:flex; gap:4px; }
    .acc-keys kbd {
        font-family:inherit; font-size:8.5px; font-weight:600;
        padding:2px 6px; border-radius:5px;
        background:rgba(255,255,255,0.04);
        border:1px solid var(--rim);
        color:var(--text-3);
    }
    .acc-hint { font-size:9.5px; color:var(--text-3); line-height:1.75; padding:4px 2px; }
    .acc-hint b { color:var(--text-2); font-weight:600; }
    `;

    function buildUI() {
        const style = document.createElement('style');
        style.id = ID.style;
        style.textContent = CSS;
        document.head.appendChild(style);

        canvas = document.createElement('canvas');
        canvas.id = ID.esp;
        canvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:9996;transition:opacity 0.25s ease;';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        refs.esp = canvas;
        function rs() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        window.addEventListener('resize', rs); rs();

        const radar = document.createElement('div');
        radar.id = ID.radar;
        radar.style.cssText = `position:fixed;bottom:28px;right:28px;z-index:9997;border-radius:50%;pointer-events:none;border:1px solid rgba(255,255,255,0.05);box-shadow:0 8px 40px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.03);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);background:rgba(10,12,18,0.55);overflow:hidden;width:${settings.radarSize}px;height:${settings.radarSize}px;display:${settings.radarEnabled?'block':'none'};`;
        document.body.appendChild(radar);
        refs.radar = radar;
        radarCanvas = document.createElement('canvas');
        radarCanvas.id = ID.radarC;
        radarCanvas.width = settings.radarSize; radarCanvas.height = settings.radarSize;
        radarCanvas.style.cssText = 'width:100%;height:100%;display:block;';
        radar.appendChild(radarCanvas);
        refs.radarCanvas = radarCanvas;

        const panel = document.createElement('div');
        panel.className = 'acc-root acc-panel';
        panel.id = ID.panel;
        document.body.appendChild(panel);
        refs.panel = panel;

        panel.innerHTML = `
            <div class="acc-hd" id="${ID.drag}">
                <div class="acc-logo">A</div>
                <div class="acc-brand">
                    <div class="acc-name">ACCEL</div>
                    <div class="acc-ver">v14</div>
                </div>
                <div class="acc-hd-right">
                    <div class="acc-fps"><span id="${ID.fps}">0</span> FPS</div>
                    <div class="acc-btn" id="${ID.min}">−</div>
                    <div class="acc-btn close" id="${ID.close}">✕</div>
                </div>
            </div>
            <div class="acc-strip">
                <span class="acc-dot" id="${ID.dot}"></span>
                <span id="${ID.status}">idle</span>
                <span class="sp"></span>
                <span>targets <span class="v" id="${ID.count}">0</span></span>
                <span class="acc-pill" id="wbPill">WB</span>
            </div>
            <div class="acc-tabs" id="${ID.tabs}"></div>
            <div class="acc-body" id="${ID.content}"></div>
            <div class="acc-ft">
                <span>ACCEL · rage</span>
                <div class="acc-keys">
                    ${['F1','F2','F3','F4','H','↑↓'].map(k=>`<kbd>${k}</kbd>`).join('')}
                </div>
            </div>
        `;

        refs.fps = document.getElementById(ID.fps);
        refs.min = document.getElementById(ID.min);
        refs.close = document.getElementById(ID.close);
        refs.dot = document.getElementById(ID.dot);
        refs.status = document.getElementById(ID.status);
        refs.count = document.getElementById(ID.count);
        refs.tabs = document.getElementById(ID.tabs);
        refs.drag = document.getElementById(ID.drag);
        refs.content = document.getElementById(ID.content);
        refs.panel = panel;
        refs.radarDiv = radar;
        refs.radarCanvas = radarCanvas;

        // Tabs
        const TABS = [
            { id:'aim', label:'AIM' },
            { id:'esp', label:'ESP' },
            { id:'rage', label:'RAGE' },
            { id:'set', label:'SET' },
        ];
        let activeTab = 'aim';
        refs.tabs.innerHTML = TABS.map(t => `<div class="acc-tab${t.id===activeTab?' on':''}" data-tab="${t.id}">${t.label}</div>`).join('');
        refs.tabEls = refs.tabs.querySelectorAll('.acc-tab');

        // Pages
        const pages = {};
        function page(id, html) {
            const div = document.createElement('div');
            div.className = 'acc-page' + (id === activeTab ? ' on' : '');
            div.dataset.page = id;
            div.innerHTML = html;
            refs.content.appendChild(div);
            pages[id] = div;
        }

        // ── component builders ──
        function toggle(key, label, sub) {
            const on = !!settings[key];
            return `<div class="acc-row">
                <div class="acc-lb">
                    <div class="acc-lb-main">${label}</div>
                    ${sub ? `<div class="acc-lb-sub">${sub}</div>` : ''}
                </div>
                <div class="acc-tog${on?' on':''}" data-tog="${key}"><div class="kn"></div></div>
            </div>`;
        }
        function slider(key, min, max, step, label, suffix) {
            const v = settings[key];
            const sfx = suffix || '';
            const stepFwd = step;
            return `<div class="acc-sl-wrap" data-sl="${key}">
                <div class="acc-sl-head">
                    <div class="acc-sl-lbl">${label}</div>
                    <div class="acc-sl-val">
                        <button data-adj="-1" data-key="${key}" data-min="${min}" data-max="${max}" data-step="${step}">−</button>
                        <span id="sv_${key}">${v}${sfx}</span>
                        <button data-adj="1" data-key="${key}" data-min="${min}" data-max="${max}" data-step="${step}">+</button>
                    </div>
                </div>
                <input type="range" class="acc-sl" data-slider="${key}" data-min="${min}" data-max="${max}" data-step="${step}" data-suffix="${sfx}" min="${min}" max="${max}" step="${step}" value="${v}">
            </div>`;
        }
        function select(key, label, opts, sub) {
            const html = Object.keys(opts).map(k =>
                `<option value="${k}" ${settings[key]===k?'selected':''}>${opts[k]}</option>`).join('');
            return `<div class="acc-row">
                <div class="acc-lb">
                    <div class="acc-lb-main">${label}</div>
                    ${sub ? `<div class="acc-lb-sub">${sub}</div>` : ''}
                </div>
                <select class="acc-sel" data-sel="${key}">${html}</select>
            </div>`;
        }
        function color(key, label) {
            return `<div class="acc-row">
                <div class="acc-lb"><div class="acc-lb-main">${label}</div></div>
                <input type="color" class="acc-col" data-col="${key}" value="${settings[key]||'#ffffff'}">
            </div>`;
        }
        function row(label, html, sub, kbd) {
            return `<div class="acc-row">
                <div class="acc-lb">
                    <div class="acc-lb-main">${label}${kbd?` <kbd>${kbd}</kbd>`:''}</div>
                    ${sub ? `<div class="acc-lb-sub">${sub}</div>` : ''}
                </div>
                ${html}
            </div>`;
        }
        function section(icon, title, body, collapsed) {
            return `<div class="acc-sec${collapsed?' col':''}" data-sec>
                <div class="acc-sec-hd">
                    <div class="acc-sec-ico">${icon}</div>
                    <div class="acc-sec-tit">${title}</div>
                    <div class="acc-sec-chev">▾</div>
                </div>
                <div class="acc-sec-bd">${body}</div>
            </div>`;
        }

        page('aim', `
            ${section('◎','Aimbot', `
                ${toggle('aimbot','Aimbot','Master toggle · F1')}
                ${toggle('softAim','Soft Aim','Humanized ramp')}
                ${toggle('silentAim','Silent Aim','No visual snap · F2')}
                ${toggle('lockMode','Lock Mode','Always-on aim · F3')}
                ${select('aimKey','Aim Key',{ right:'Right Mouse', left:'Left Mouse', shift:'Left Shift', alt:'Left Alt', always:'Always' })}
                ${select('aimBone','Bone',{ head:'Head', neck:'Neck', chest:'Chest', nearest:'Nearest' })}
                ${select('targetPriority','Priority',{ fov:'Closest to FOV', nearest:'Nearest Distance' })}
            `)}
            ${section('◇','Tuning', `
                ${slider('aimFov',0.4,2.5,0.05,'FOV', '')}
                ${slider('smoothing',0.05,1.0,0.05,'Smoothing','')}
                ${slider('aimDeadzone',0.0,0.02,0.0005,'Deadzone','')}
                ${slider('aimMaxVel',1.0,20.0,0.5,'Max Velocity','')}
                ${slider('pitchMax',1.0,1.55,0.01,'Pitch Clamp','')}
                ${slider('aimOffset',5,25,0.5,'Aim Offset','')}
                ${slider('camOffset',4,10,0.5,'Cam Offset','')}
            `)}
            ${section('✦','Soft Aim', `
                ${slider('softStrength',0.05,1.0,0.05,'Strength','')}
                ${slider('softJitter',0.0,3.0,0.1,'Jitter','')}
                ${slider('softRampFrames',1,20,1,'Ramp Frames','')}
                ${slider('softMissChance',0.0,0.3,0.01,'Miss Chance','')}
            `)}
            ${section('⌁','Prediction', `
                ${toggle('prediction','Predict Movement','Velocity + latency')}
                ${toggle('accelComp','Acceleration Term','2nd derivative')}
                ${slider('predictionStrength',0.0,2.0,0.05,'Strength','')}
                ${slider('velocitySmoothing',0.0,0.98,0.02,'Velocity Smooth','')}
                ${slider('bulletSpeed',100,3000,50,'Bullet Speed',' u/s')}
                ${slider('latencyComp',0,300,5,'Latency',' ms')}
                ${slider('predictionMaxOffset',0.5,20,0.5,'Max Offset',' m')}
            `)}
            ${section('⚡','Trigger', `
                ${toggle('autoShoot','Auto Shoot','Fire when aligned')}
                ${slider('triggerDelay',50,300,10,'Trigger Delay',' ms')}
                ${slider('burstLength',1,8,1,'Burst Length','')}
                ${slider('burstPause',50,400,10,'Burst Pause',' ms')}
                ${toggle('hitSound','Hit Sound','Audio cue')}
                ${slider('hitSoundVolume',0.0,1.0,0.05,'Sound Volume','')}
            `)}
        `);

        page('esp', `
            ${section('▣','Box ESP', `
                ${toggle('espEnabled','ESP','Master')}
                ${toggle('drawFov','Draw FOV','Circle overlay')}
                ${color('fovColor','FOV Color')}
                ${toggle('drawLines','Snaplines','')}
                ${select('snaplineOrigin','Snapline Origin',{ bottom:'Bottom', center:'Center', top:'Top' })}
                ${toggle('showDist','Show Distance','')}
                ${slider('maxDistShow',50,300,10,'Max Dist',' m')}
                ${slider('boxThickness',0.5,4.0,0.1,'Box Thickness','')}
                ${toggle('espFade','Fade With Distance','')}
                ${slider('espFadeDist',40,400,10,'Fade Dist',' m')}
            `)}
            ${section('☰','Skeleton ESP', `
                ${toggle('skeletonESP','Skeleton','')}
                ${toggle('skeletonFill','Anatomy Fill','Interpolate empty bones')}
                ${toggle('skeletonHead','Head','')}
                ${toggle('skeletonTorso','Torso','')}
                ${toggle('skeletonArms','Arms','')}
                ${toggle('skeletonLegs','Legs','')}
                ${slider('skeletonThickness',0.5,4.0,0.1,'Thickness','')}
                ${slider('skeletonJointSize',1,8,0.5,'Joint Size','')}
                ${slider('skeletonSmooth',0.05,0.95,0.05,'Smooth','')}
                ${slider('skeletonMinConf',0.0,1.0,0.05,'Min Conf','')}
                ${color('skeletonColor','Skeleton Color')}
            `)}
            ${section('◉','Radar', `
                ${toggle('radarEnabled','Radar','')}
                ${slider('radarSize',80,200,10,'Size','')}
                ${slider('radarRange',30,300,10,'Range',' m')}
                ${toggle('stealthMode','Stealth Mode','Hide when no targets')}
            `)}
            ${section('✛','Crosshair', `
                ${toggle('crosshair','Custom Crosshair','')}
                ${select('crosshairStyle','Style',{ cross:'Cross', dot:'Dot', circle:'Circle' })}
                ${slider('crosshairSize',3,30,1,'Size','')}
                ${color('crosshairColor','Color')}
            `)}
        `);

        page('rage', `
            ${section('⌬','Wallbang', `
                ${toggle('wallBang','Wallbang','Raycast hook · F4')}
                ${toggle('forceWallBang','Force Through Walls','Loosen LOS')}
                ${toggle('rageMode','Rage Mode','No align needed')}
                ${toggle('wallbangTracer','Tracer Color','')}
                ${slider('wallBangMaxDist',20,400,10,'Max Dist',' m')}
                ${slider('wallbangWindow',60,500,10,'Window',' ms')}
            `)}
            ${section('⌭','Anti-Recoil', `
                ${toggle('antiRecoil','Anti-Recoil','')}
                ${select('recoilMode','Mode',{ blend:'Blend (3-way)', adaptive:'Adaptive Only', pattern:'Pattern Only', predictive:'Predictive Only' })}
                ${slider('recoilStrength',0.1,1.5,0.05,'Strength','')}
                ${slider('recoilAdaptiveW',0.0,1.0,0.05,'Adaptive Weight','')}
                ${slider('recoilPatternW',0.0,1.0,0.05,'Pattern Weight','')}
                ${slider('recoilPredictW',0.0,1.0,0.05,'Predictive Weight','')}
                ${slider('recoilCompX',0.0,2.0,0.05,'Comp X','')}
                ${slider('recoilCompY',0.0,2.0,0.05,'Comp Y','')}
                ${slider('recoilSmooth',0.0,1.0,0.05,'Smooth','')}
            `)}
            ${section('⌁','Bhop', `
                ${toggle('autoBhop','Auto Bhop','Hold Space')}
                ${slider('bhopStrength',4,12,0.5,'Strength','')}
            `)}
        `);

        page('set', `
            ${section('◈','Team', `
                ${row('Force Team', `<select class="acc-sel" id="${ID.force}">
                    <option value="0" ${settings.forceTeam===0?'selected':''}>Auto</option>
                    <option value="1" ${settings.forceTeam===1?'selected':''}>Team 1</option>
                    <option value="2" ${settings.forceTeam===2?'selected':''}>Team 2</option>
                    <option value="3" ${settings.forceTeam===3?'selected':''}>FFA</option>
                </select>`)}
                ${toggle('antiTeamLock','Anti-Team Lock','')}
            `)}
            ${section('⚿','Anti-Detection', `
                ${toggle('maxStealth','Max Stealth','')}
                ${toggle('jitterInput','Input Jitter','')}
                ${slider('jitterAmount',0.5,6.0,0.25,'Jitter Amount','')}
                ${toggle('encryptStorage','Encrypt Storage','')}
                ${toggle('spoofToString','Spoof toString','')}
            `)}
            ${section('⌘','Keybinds', `
                <div class="acc-hint">
                    <b>F1</b> Aimbot toggle · <b>F2</b> Silent Aim · <b>F3</b> Lock Mode<br>
                    <b>F4</b> Wallbang · <b>H</b> Cycle team · <b>↑↓</b> Aim offset<br>
                    <b>"</b> Toggle menu visibility
                </div>
            `, true)}
        `);

        // ── wiring ──
        function bindAll(root) {
            root.querySelectorAll('.acc-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    refs.tabEls.forEach(t => t.classList.remove('on'));
                    tab.classList.add('on');
                    activeTab = tab.dataset.tab;
                    Object.keys(pages).forEach(k => {
                        pages[k].classList.toggle('on', k === activeTab);
                    });
                });
            });
            root.querySelectorAll('.acc-sec-hd').forEach(h => {
                h.addEventListener('click', () => h.parentElement.classList.toggle('col'));
            });
            root.querySelectorAll('.acc-tog[data-tog]').forEach(el => {
                el.addEventListener('click', () => {
                    const k = el.dataset.tog;
                    settings[k] = !settings[k];
                    el.classList.toggle('on', settings[k]);
                    if (k === 'radarEnabled' && refs.radarDiv) refs.radarDiv.style.display = settings.radarEnabled ? 'block' : 'none';
                    updateStatus(); saveSettings();
                });
            });
            root.querySelectorAll('input.acc-sl').forEach(el => {
                const key = el.dataset.slider;
                const sfx = el.dataset.suffix || '';
                const min = parseFloat(el.dataset.min);
                const max = parseFloat(el.dataset.max);
                const step = parseFloat(el.dataset.step);
                function apply() {
                    const v = parseFloat(el.value);
                    settings[key] = v;
                    const lbl = document.getElementById('sv_' + key);
                    if (lbl) lbl.textContent = v + sfx;
                    if (key === 'radarSize' && refs.radarDiv) {
                        refs.radarDiv.style.width = v + 'px';
                        refs.radarDiv.style.height = v + 'px';
                        if (radarCanvas) { radarCanvas.width = v; radarCanvas.height = v; }
                    }
                    saveSettings();
                }
                el.addEventListener('input', apply);
            });
            root.querySelectorAll('.acc-sl-val button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const k = btn.dataset.key;
                    const dir = parseInt(btn.dataset.adj);
                    const min = parseFloat(btn.dataset.min);
                    const max = parseFloat(btn.dataset.max);
                    const step = parseFloat(btn.dataset.step);
                    const slider = root.querySelector(`input.acc-sl[data-slider="${k}"]`);
                    if (!slider) return;
                    let v = parseFloat(slider.value) + dir * step;
                    v = clamp(v, min, max);
                    v = Math.round(v * 1e6) / 1e6;
                    slider.value = v;
                    slider.dispatchEvent(new Event('input'));
                });
            });
            root.querySelectorAll('select[data-sel]').forEach(el => {
                el.addEventListener('change', () => {
                    settings[el.dataset.sel] = el.value;
                    saveSettings();
                });
            });
            root.querySelectorAll('input[type="color"][data-col]').forEach(el => {
                el.addEventListener('input', () => {
                    settings[el.dataset.col] = el.value;
                    saveSettings();
                });
            });
        }
        bindAll(panel);

        // ── panel controls ──
        refs.min.addEventListener('click', () => {
            minimized = !minimized;
            panel.querySelectorAll('.acc-page').forEach(p => { p.style.display = minimized ? 'none' : ''; });
            refs.tabs.style.display = minimized ? 'none' : '';
            refs.content.style.display = minimized ? 'none' : '';
            refs.min.textContent = minimized ? '+' : '−';
        });
        refs.close.addEventListener('click', () => {
            uiVisible = false;
            panel.style.transform = 'translateX(440px) scale(0.94)';
            panel.style.opacity = '0'; panel.style.pointerEvents = 'none';
        });
        let drag = false, offX = 0, offY = 0;
        refs.drag.addEventListener('mousedown', (e) => {
            drag = true;
            const r = panel.getBoundingClientRect();
            offX = e.clientX - r.left; offY = e.clientY - r.top;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!drag) return;
            const L = Math.max(0, Math.min(window.innerWidth - 420, e.clientX - offX));
            const T = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - offY));
            panel.style.left = L + 'px'; panel.style.top = T + 'px'; panel.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => drag = false);

        // ── keyboard ──
        const ft = document.getElementById(ID.force);
        document.addEventListener('keydown', (e) => {
            keys[e.code] = true;
            if (e.key === '"' || e.code === 'Quote') {
                uiVisible = !uiVisible;
                if (uiVisible) { panel.style.transform = ''; panel.style.opacity = ''; panel.style.pointerEvents = ''; }
                else { panel.style.transform = 'translateX(440px) scale(0.94)'; panel.style.opacity = '0'; panel.style.pointerEvents = 'none'; }
                e.preventDefault(); return;
            }
            if (e.key === 'F1') { settings.aimbot = !settings.aimbot; syncTogs(); updateStatus(); saveSettings(); e.preventDefault(); }
            if (e.key === 'F2') { settings.silentAim = !settings.silentAim; syncTogs(); updateStatus(); saveSettings(); e.preventDefault(); }
            if (e.key === 'F3') { settings.lockMode = !settings.lockMode; syncTogs(); updateStatus(); saveSettings(); e.preventDefault(); }
            if (e.key === 'F4') { settings.wallBang = !settings.wallBang; syncTogs(); updateStatus(); saveSettings(); e.preventDefault(); }
            if (e.key === 'h' || e.key === 'H') {
                settings.forceTeam = (settings.forceTeam + 1) % 4;
                if (ft) ft.value = settings.forceTeam;
                updateStatus(); saveSettings(); e.preventDefault();
            }
            if (e.key === 'ArrowUp') { settings.aimOffset = +(settings.aimOffset + 0.5).toFixed(1); const l = document.getElementById('sv_aimOffset'); if (l) l.textContent = settings.aimOffset; saveSettings(); e.preventDefault(); }
            if (e.key === 'ArrowDown') { settings.aimOffset = +(settings.aimOffset - 0.5).toFixed(1); const l = document.getElementById('sv_aimOffset'); if (l) l.textContent = settings.aimOffset; saveSettings(); e.preventDefault(); }
        }, true);
        document.addEventListener('keyup', (e) => { keys[e.code] = false; }, true);
        window.addEventListener('mousedown', (e) => {
            mouseButtons[e.button] = true;
            if (e.button === 0) { lastManualShot = performance.now(); if (e.isTrusted) firing = true; }
        }, true);
        window.addEventListener('mouseup', (e) => {
            mouseButtons[e.button] = false;
            if (e.button === 0) firing = false;
        }, true);
        window.addEventListener('contextmenu', (e) => e.preventDefault(), true);

        if (ft) ft.addEventListener('change', () => { settings.forceTeam = parseInt(ft.value); saveSettings(); updateStatus(); });

        // ── hide our DOM from external scanners ──
        const _our = new WeakSet();
        [canvas, radar, radarCanvas, panel].forEach(x => _our.add(x));
        panel.querySelectorAll('*').forEach(x => _our.add(x));
        const isOurs = (el) => { let p = el; while (p) { if (_our.has(p)) return true; p = p.parentNode; } return false; };
        const _qsa = Document.prototype.querySelectorAll;
        Document.prototype.querySelectorAll = function(s) {
            const l = _qsa.call(this, s), o = [];
            for (let i = 0; i < l.length; i++) if (!isOurs(l[i])) o.push(l[i]);
            return o;
        };
        const _qs = Document.prototype.querySelector;
        Document.prototype.querySelector = function(s) { const e = _qs.call(this, s); return isOurs(e) ? null : e; };
        _markFn(Document.prototype.querySelectorAll); _markFn(Document.prototype.querySelector);
    }

    function syncTogs() {
        refs.panel.querySelectorAll('.acc-tog[data-tog]').forEach(el => {
            const k = el.dataset.tog;
            el.classList.toggle('on', !!settings[k]);
        });
    }
    function updateStatus() {
        const p = refs.panel;
        if (p) p.style.borderColor = settings.aimbot ? (settings.lockMode ? 'rgba(253,203,110,0.28)' : 'rgba(124,92,255,0.28)') : '';
        const wp = document.getElementById('wbPill');
        if (wp) wp.style.opacity = settings.wallBang ? '1' : '0.3';
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
    else buildUI();

    function drawCrosshair(w, h) {
        if (!settings.crosshair || !ctx) return;
        const cx = w/2, cy = h/2, s = settings.crosshairSize;
        ctx.save();
        ctx.strokeStyle = settings.crosshairColor; ctx.fillStyle = settings.crosshairColor;
        ctx.lineWidth = 1.5; ctx.shadowColor = settings.crosshairColor; ctx.shadowBlur = 3;
        if (settings.crosshairStyle === 'cross') {
            ctx.beginPath();
            ctx.moveTo(cx-s,cy); ctx.lineTo(cx-3,cy); ctx.moveTo(cx+3,cy); ctx.lineTo(cx+s,cy);
            ctx.moveTo(cx,cy-s); ctx.lineTo(cx,cy-3); ctx.moveTo(cx,cy+3); ctx.lineTo(cx,cy+s);
            ctx.stroke();
        } else if (settings.crosshairStyle === 'dot') {
            ctx.beginPath(); ctx.arc(cx,cy,2.5,0,PI2); ctx.fill();
        } else { ctx.beginPath(); ctx.arc(cx,cy,s,0,PI2); ctx.stroke(); }
        ctx.restore();
    }

    // ─── MAIN LOOP ──────────────────────────────────────────
    function animate() {
        requestAnimationFrame(animate);
        const now = performance.now();
        const dtRaw = (now - lastFrameTime) / 1000;
        lastFrameTime = now;
        // Cap dt to prevent big jumps after tab-out
        const dt = Math.min(dtRaw, 0.05);

        frameCount++;
        if (now - lastFpsUpdate > 1000) {
            fps = frameCount; frameCount = 0; lastFpsUpdate = now;
            if (refs.fps) refs.fps.innerText = fps;
        }
        if (!ctx || !isHooked || !scene) { if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
        if (!raycastHooked) installWallbang();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        myPlayer = null;
        for (const child of scene.children) {
            if (child.type === 'Object3D' && child.children[0]?.children[0]?.type === 'PerspectiveCamera') {
                myPlayer = child; camera = child.children[0].children[0]; break;
            }
        }
        if (!myPlayer || !camera) return;
        updateCam();

        if (settings.autoBhop) doBhop();

        // ── read current rotation (raw) ──
        const curPitch = myPlayer.children[0].rotation.x;
        const curYaw = myPlayer.rotation.y;
        if (firing && !wasFiring) Recoil.begin(curPitch, curYaw);
        if (!firing && wasFiring) Recoil.end();
        wasFiring = firing;

        // ── enemies ──
        const myTeamID = getMyTeam();
        const enemies = [];
        playerSet = new WeakSet();
        for (const child of scene.children) {
            if (child.type !== 'Object3D' || child === myPlayer) continue;
            try {
                if (child.position.x === 0 && child.position.z === 0) continue;
                if (!child.children || child.children.length < 2) continue;
                const dx = child.position.x - myPlayer.position.x;
                const dz = child.position.z - myPlayer.position.z;
                if (Math.sqrt(dx*dx + dz*dz) < 5) continue;
                if (!isEnemy(child, myTeamID)) continue;
                enemies.push(child); playerSet.add(child);
            } catch(_) {}
        }
        targetCount = enemies.length;
        if (refs.count) refs.count.innerText = targetCount;

        /* ───────────────────────────────────────────────────────
           AIM — ABSOLUTE-TARGET EXPONENTIAL LERP
           key properties:
             · we aim AT a target angle, not incrementally toward it
               → prevents compound jitter from frame-to-frame noise
             · dt-normalized: smoothing value = time constant
               → same feel at 60fps and 240fps
             · deadzone: stop writing when we're this close
               → kills the final-frame micro-shake
             · velocity cap: never move more than X rad/sec
               → no overshoot when target teleports
           ─────────────────────────────────────────────────────── */
        lockedTarget = null;
        let minAngle = Infinity;
        const isAiming = aimKeyDown();
        const eyePos = new Vector3(myPlayer.position.x, myPlayer.position.y + settings.camOffset, myPlayer.position.z);

        let aimYawApplied = 0, aimPitchApplied = 0;

        if (settings.aimbot && isAiming) {
            let bestTarget = null, bestDyaw = 0, bestDpitch = 0, bestScore = Infinity;
            for (const p of enemies) {
                const pred = predict(p, eyePos.x, eyePos.y, eyePos.z, now);
                const dx = pred.x - eyePos.x;
                const dz = pred.z - eyePos.z;
                const distXZ = Math.sqrt(dx*dx + dz*dz);
                if (distXZ < 2) continue;

                let aimY = pred.y + settings.aimOffset;
                if (settings.aimBone === 'head') aimY = pred.y + BONE_Y.head;
                else if (settings.aimBone === 'neck') aimY = pred.y + BONE_Y.neck;
                else if (settings.aimBone === 'chest') aimY = pred.y + BONE_Y.chest;

                const dy = aimY - eyePos.y;
                const targetYaw = Math.atan2(dx, dz) + Math.PI;
                const targetPitch = Math.atan2(dy, distXZ);
                let dyaw = targetYaw - curYaw;
                while (dyaw > Math.PI) dyaw -= PI2; while (dyaw < -Math.PI) dyaw += PI2;
                const dpitch = targetPitch - curPitch;
                const angleDiff = Math.sqrt(dyaw*dyaw + dpitch*dpitch);

                if (angleDiff > settings.aimFov) continue;
                const score = (settings.targetPriority === 'nearest')
                    ? distXZ * 0.001 + angleDiff * 0.5
                    : angleDiff;
                if (score < bestScore) { bestScore = score; bestTarget = p; bestDyaw = dyaw; bestDpitch = dpitch; minAngle = angleDiff; }
            }

            if (bestTarget) {
                lockedTarget = bestTarget;

                // Soft aim path (ramped + jitter, no smoothing multiply)
                if (settings.softAim) {
                    const s = softAim(bestDyaw, bestDpitch);
                    aimYawApplied = clamp(s.yaw, -settings.aimMaxVel * dt, settings.aimMaxVel * dt);
                    aimPitchApplied = clamp(s.pitch, -settings.aimMaxVel * dt, settings.aimMaxVel * dt);
                } else {
                    // Deadzone
                    let dyaw = bestDyaw;
                    let dpitch = bestDpitch;
                    if (Math.abs(dyaw) < settings.aimDeadzone) dyaw = 0;
                    if (Math.abs(dpitch) < settings.aimDeadzone) dpitch = 0;

                    // Exponential lerp toward target — dt-normalized.
                    // smoothing is "how much of the remaining gap per 1/60s tick."
                    // We express as time constant: tau = (1-smooth) scaled.
                    // Higher smoothing value → snappier.
                    const smooth = clamp(settings.smoothing, 0.001, 1.0);
                    const tau = (1 - smooth) * 0.35 + 0.02;   // seconds
                    const alpha = 1 - Math.exp(-dt / tau);
                    // We want: apply the fraction that moves us alpha of the way.
                    // Incremental delta = alpha * remaining_gap
                    let dY = dyaw * alpha;
                    let dP = dpitch * alpha;
                    // Velocity cap
                    const cap = settings.aimMaxVel * dt;
                    if (Math.abs(dY) > cap) dY = Math.sign(dY) * cap;
                    if (Math.abs(dP) > cap) dP = Math.sign(dP) * cap;
                    aimYawApplied = dY;
                    aimPitchApplied = dP;
                }

                if (!settings.silentAim) {
                    myPlayer.rotation.y += aimYawApplied;
                    myPlayer.children[0].rotation.x = clamp(
                        myPlayer.children[0].rotation.x + aimPitchApplied,
                        -settings.pitchMax, settings.pitchMax
                    );
                }
            } else {
                softState.ramp = 0; softState.lastT = null;
                lastAimYawDelta = 0; lastAimPitchDelta = 0;
            }
        } else {
            softState.ramp = 0; softState.lastT = null;
            lastAimYawDelta = 0; lastAimPitchDelta = 0;
        }
        lastAimYawDelta = aimYawApplied;
        lastAimPitchDelta = aimPitchApplied;

        // ── anti-recoil (decoupled — subtracts our aim delta) ──
        if (settings.antiRecoil) {
            const cp = myPlayer.children[0].rotation.x;
            const cy2 = myPlayer.rotation.y;
            const r = Recoil.step(cp, cy2, lastAimPitchDelta, lastAimYawDelta, {
                enabled: true, mode: settings.recoilMode,
                wA: settings.recoilAdaptiveW, wP: settings.recoilPatternW, wPr: settings.recoilPredictW,
                strength: settings.recoilStrength, compX: settings.recoilCompX, compY: settings.recoilCompY,
                smooth: settings.recoilSmooth,
            });
            if (r) {
                // Recoil comp is smooth already, but cap by dt too
                const dP = clamp(r.dP, -settings.aimMaxVel * dt, settings.aimMaxVel * dt);
                const dY = clamp(r.dY, -settings.aimMaxVel * dt, settings.aimMaxVel * dt);
                myPlayer.children[0].rotation.x = clamp(
                    myPlayer.children[0].rotation.x + dP,
                    -settings.pitchMax, settings.pitchMax
                );
                myPlayer.rotation.y += dY;
            }
        }

        // ── fire / wallbang ──
        const wb = lockedTarget && wallbangActive(lockedTarget);
        const rageFire = lockedTarget && settings.rageMode && minAngle < settings.aimFov * 1.6;
        const aligned = minAngle < 0.2;
        const fireReady = lockedTarget && (aligned || (settings.wallBang && settings.forceWallBang && wb && minAngle < 0.35) || rageFire);
        if (settings.autoShoot && fireReady) {
            if (burstCount >= settings.burstLength) { if (now - burstTimer >= settings.burstPause) burstCount = 0; }
            if (burstCount < settings.burstLength) {
                triggerShoot(); playHit();
                if (settings.wallBang) wallbangArmed = now + settings.wallbangWindow;
                burstCount++; burstTimer = now;
            }
        } else burstCount = 0;

        // ── ESP + skeleton ──
        if (settings.espEnabled) {
            if (settings.drawFov) {
                ctx.beginPath();
                ctx.arc(canvas.width/2, canvas.height/2, (canvas.height/2) * (settings.aimFov / 2.2), 0, PI2);
                ctx.strokeStyle = settings.fovColor; ctx.globalAlpha = 0.18; ctx.lineWidth = 1;
                ctx.stroke(); ctx.globalAlpha = 1;
            }
            for (const p of enemies) {
                try {
                    const isL = (p === lockedTarget);
                    const isW = settings.wallBang && wallbangActive(p);
                    const color = isL ? '#ffff00' : (isW && settings.wallbangTracer) ? settings.wallbangColor : '#ff5566';

                    const ddx = p.position.x - myPlayer.position.x;
                    const ddy = p.position.y - myPlayer.position.y;
                    const ddz = p.position.z - myPlayer.position.z;
                    const dist = Math.sqrt(ddx*ddx + ddy*ddy + ddz*ddz);
                    let alpha = settings.espFade ? Math.max(0.15, 1 - (dist / settings.espFadeDist)) : 1;

                    const head = new Vector3(p.position.x, p.position.y + 10.5, p.position.z); head.project(camera);
                    const foot = new Vector3(p.position.x, p.position.y, p.position.z); foot.project(camera);

                    ctx.globalAlpha = alpha;
                    if (head.z <= 1 && foot.z <= 1) {
                        const top = (-head.y*0.5 + 0.5) * canvas.height;
                        const bot = (-foot.y*0.5 + 0.5) * canvas.height;
                        const h = bot - top, w = h * 0.6;
                        const x = (head.x*0.5 + 0.5) * canvas.width;
                        ctx.strokeStyle = color; ctx.lineWidth = settings.boxThickness;
                        ctx.strokeRect(x - w/2, top, w, h);
                        if (isL) {
                            const ap = new Vector3(p.position.x, p.position.y + boneY(settings.aimBone), p.position.z); ap.project(camera);
                            const ay = (-ap.y*0.5 + 0.5) * canvas.height;
                            ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(x, ay, 4, 0, PI2); ctx.fill();
                        }
                        if (settings.drawLines) {
                            const cx = canvas.width/2;
                            let oy = canvas.height;
                            if (settings.snaplineOrigin === 'center') oy = canvas.height/2;
                            else if (settings.snaplineOrigin === 'top') oy = 0;
                            ctx.beginPath(); ctx.moveTo(cx, oy); ctx.lineTo(x, bot);
                            ctx.strokeStyle = 'rgba(124,92,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
                        }
                        if (settings.showDist && dist <= settings.maxDistShow) {
                            const text = `${Math.round(dist)}m`;
                            ctx.font = "600 10px 'Inter','Segoe UI',sans-serif"; ctx.textAlign = 'center';
                            const tw = ctx.measureText(text).width;
                            ctx.fillStyle = 'rgba(10,12,18,0.75)';
                            ctx.fillRect(x - tw/2 - 5, top - 19, tw + 10, 16);
                            ctx.fillStyle = isW ? settings.wallbangColor : '#00e0c6';
                            ctx.fillText(text, x, top - 7);
                        }
                    }
                    if (settings.skeletonESP) drawSkel(p, camera, canvas.width, canvas.height);
                    ctx.globalAlpha = 1;
                } catch(_) {}
            }
            if (settings.radarEnabled && radarCanvas) {
                const size = settings.radarSize || 140;
                const range = settings.radarRange || 100;
                const rc = radarCanvas.getContext('2d');
                rc.clearRect(0, 0, size, size);
                const cx = size/2, cy = size/2;
                rc.fillStyle = 'rgba(10,12,18,0.6)'; rc.beginPath(); rc.arc(cx, cy, size/2, 0, PI2); rc.fill();
                rc.strokeStyle = 'rgba(255,255,255,0.035)'; rc.lineWidth = 0.5;
                for (let r = 1; r <= 3; r++) { rc.beginPath(); rc.arc(cx, cy, (r/3)*size/2, 0, PI2); rc.stroke(); }
                rc.fillStyle = '#00e0c6'; rc.shadowColor = '#00e0c6'; rc.shadowBlur = 14;
                rc.beginPath(); rc.arc(cx, cy, 3, 0, PI2); rc.fill(); rc.shadowBlur = 0;
                if (myPlayer) {
                    const myRot = myPlayer.rotation.y;
                    for (const p of enemies) {
                        const dx = p.position.x - myPlayer.position.x;
                        const dz = p.position.z - myPlayer.position.z;
                        const dist = Math.sqrt(dx*dx + dz*dz);
                        if (dist > range) continue;
                        const angle = Math.atan2(dz, dx) - myRot;
                        const r = Math.min(size/2 - 6, (dist / range) * size/2);
                        const ex = cx + Math.sin(angle) * r;
                        const ey = cy - Math.cos(angle) * r;
                        const isL = (p === lockedTarget);
                        rc.fillStyle = isL ? '#fdcb6e' : '#ff5566';
                        rc.shadowColor = rc.fillStyle; rc.shadowBlur = isL ? 16 : 8;
                        rc.beginPath(); rc.arc(ex, ey, isL ? 4 : 2.5, 0, PI2); rc.fill();
                        rc.shadowBlur = 0;
                    }
                }
            }
        }

        drawCrosshair(canvas.width, canvas.height);

        if (settings.stealthMode) {
            const any = targetCount > 0 || lockedTarget || settings.crosshair;
            canvas.style.opacity = any ? '0.99' : '0.01';
        } else canvas.style.opacity = '0.99';

        if (refs.dot && refs.status) {
            if (lockedTarget && aligned) { refs.dot.style.background = '#ff5566'; refs.dot.style.boxShadow = '0 0 16px rgba(255,85,102,0.6)'; refs.status.innerText = 'firing'; }
            else if (lockedTarget) { refs.dot.style.background = '#fdcb6e'; refs.dot.style.boxShadow = '0 0 12px rgba(253,203,110,0.45)'; refs.status.innerText = 'locked'; }
            else if (targetCount > 0) { refs.dot.style.background = '#00e0c6'; refs.dot.style.boxShadow = '0 0 12px rgba(0,224,198,0.45)'; refs.status.innerText = 'tracking'; }
            else { refs.dot.style.background = 'rgba(255,255,255,0.18)'; refs.dot.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.02)'; refs.status.innerText = 'idle'; }
        }
        const wp = document.getElementById('wbPill');
        if (wp) {
            if (wb && lockedTarget) { wp.style.color = 'rgba(255,85,102,1)'; wp.style.background = 'rgba(255,85,102,0.18)'; }
            else if (settings.wallBang) { wp.style.color = 'rgba(255,85,102,0.75)'; wp.style.background = 'rgba(255,85,102,0.10)'; }
            else { wp.style.color = 'rgba(255,255,255,0.2)'; wp.style.background = 'rgba(255,255,255,0.03)'; }
        }
    }

    animate();

    const _api = { settings, saveSettings, Recoil, ID };
    Object.defineProperty(window, 'a' + _salt, { value: _api, enumerable: false, configurable: false });
})();
