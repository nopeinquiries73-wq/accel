// ─── ACCEL v7.1 — No Jitter ──────────────────────────────────
// Built by spigen. Smooth as glass. No fighting the mouse.
// ──────────────────────────────────────────────────────────────

(function() {
    'use strict';

    // ─── Anti-Detection ──────────────────────────────────────
    window.console.log = function() {};
    window.console.warn = function() {};
    window.console.error = function() {};
    window.console.info = function() {};
    window.console.debug = function() {};

    document.addEventListener('keydown', function(e) {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j'))) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
            return false;
        }
    }, true);

    // ─── CONFIG ──────────────────────────────────────────────
    const _cfg = {
        aimbot: true,
        autoBhop: true,
        aimFov: 1.4,
        smoothing: 0.55,           // slightly lower for less jitter
        camOffset: 6.0,
        baseAimOffset: 14.9,
        minAimOffset: 5.0,
        distanceComp: 30,
        drawFov: true,
        drawLines: true,
        showDist: true,
        maxDistShow: 150,
        autoShoot: true,
        triggerDelay: 150,
        burstLength: 3,
        burstPause: 200,
        noRecoil: true,
        recoilReset: 0.85,         // gentler reset
        recoilDeadzone: 0.03,      // don't reset tiny movements
        antiTeamLock: true,
        forceTeam: 0,
        silentAim: false,
        lockMode: false,
        stealthMode: true,
    };

    const _storKey = 'a' + Math.random().toString(36).substring(2,6) + 'c' + Math.random().toString(36).substring(2,5);
    let _settings = {};
    try {
        const _saved = localStorage.getItem(_storKey);
        _settings = _saved ? { ..._cfg, ...JSON.parse(_saved) } : { ..._cfg };
    } catch(_) { _settings = { ..._cfg }; }

    function _save() {
        try { localStorage.setItem(_storKey, JSON.stringify(_settings)); } catch(_) {}
    }

    // ─── State ──────────────────────────────────────────────
    let _scene = null, _myPlayer = null, _cam = null;
    let _rightMouse = false, _leftMouse = false;
    let _locked = null, _keys = {}, _hooked = false, _V3 = null;
    let _lastShot = 0, _lastManualShot = 0;
    let _fps = 0, _fc = 0, _fpsTime = performance.now();
    let _burst = 0, _burstTimer = 0;
    let _canvas = null, _ctx = null, _panel = null;
    let _pitchHistory = []; // for smoothing pitch changes

    // ─── HOOK ──────────────────────────────────────────────
    const _origPush = Array.prototype.push;
    Array.prototype.push = function() {
        for (let i = 0; i < arguments.length; i++) {
            const obj = arguments[i];
            if (obj && obj.parent && obj.parent.name === 'Main' && obj.parent.type === 'Scene') {
                if (_scene !== obj.parent) {
                    _scene = obj.parent;
                    if (obj.position && obj.position.constructor) {
                        _V3 = obj.position.constructor;
                    }
                    _hooked = true;
                }
            }
        }
        return _origPush.apply(this, arguments);
    };

    // ─── UI INIT ──────────────────────────────────────────────
    const _wait = setInterval(() => {
        if (document.body) {
            clearInterval(_wait);
            _initUI();
            _loop();
        }
    }, 50);

    function _initUI() {
        _canvas = document.createElement('canvas');
        _canvas.style.cssText = `
            position:fixed; top:0; left:0;
            width:100vw; height:100vh;
            pointer-events:none;
            z-index:9998;
            opacity:0.99;
            background:transparent;
        `;
        document.body.appendChild(_canvas);
        _ctx = _canvas.getContext('2d');

        function _resize() {
            _canvas.width = window.innerWidth;
            _canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', _resize);
        _resize();

        _panel = document.createElement('div');
        _panel.style.cssText = `
            position:fixed; top:20px; right:20px;
            z-index:9999;
            background: rgba(13,13,13,0.85);
            border: 1px solid #2a2a2a;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.9);
            color: #ddd;
            font-family: 'Segoe UI', system-ui, sans-serif;
            font-size: 12px;
            width: 340px;
            max-height: 85vh;
            overflow-y: auto;
            pointer-events: auto;
            user-select: none;
            backdrop-filter: blur(6px);
            transition: border-color 0.2s;
            display: none;
        `;
        _panel.innerHTML = `
            <div style="display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid #1a1a1a;cursor:move;" id="_uiDrag">
                <span style="font-weight:800;font-size:16px;color:#fff;">ACCEL</span>
                <span style="color:#666;font-size:10px;margin-left:6px;">by spigen</span>
                <span style="margin-left:auto;font-size:10px;color:#555;" id="_fpsDisplay">0 FPS</span>
                <span id="_uiMin" style="cursor:pointer;color:#666;padding:0 6px;">−</span>
                <span id="_uiClose" style="cursor:pointer;color:#666;padding:0 6px;">✕</span>
            </div>
            <div style="display:flex;gap:4px;padding:8px 12px;border-bottom:1px solid #1a1a1a;">
                ${['AIM','TRIG','RECOIL','ESP','SET'].map(t =>
                    `<div class="_tab" data-tab="${t.toLowerCase()}" style="flex:1;text-align:center;padding:6px 0;border-radius:6px;background:#1a1a1a;color:#888;font-weight:600;font-size:10px;cursor:pointer;border:1px solid transparent;">${t}</div>`
                ).join('')}
            </div>
            <div id="_uiContent" style="padding:12px 16px;"></div>
            <div style="padding:6px 16px;border-top:1px solid #1a1a1a;color:#444;font-size:8px;text-align:center;">
                F1: toggle | F2: silent | F3: lock | H: team | F4: panel
            </div>
        `;
        document.body.appendChild(_panel);

        const _content = document.getElementById('_uiContent');
        const _tabs = {};

        function _buildTab(id, html) {
            const div = document.createElement('div');
            div.id = '_tab_' + id;
            div.style.display = id === 'aim' ? 'block' : 'none';
            div.innerHTML = html;
            _content.appendChild(div);
            _tabs[id] = div;
        }

        function _switch(key) {
            const val = _settings[key] ? 'on' : '';
            return `<div class="_sw ${val}" data-key="${key}"><div class="_knob"></div></div>`;
        }

        function _slider(key, min, max, step, suffix = '') {
            const val = _settings[key];
            return `
                <div class="_row"><span>${key.replace(/([A-Z])/g, ' $1')}</span><span class="_val" id="_val_${key}">${val}${suffix}</span></div>
                <input type="range" class="_slider" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${val}">
            `;
        }

        _buildTab('aim', `
            <div class="_row"><span>Aimbot (F1)</span>${_switch('aimbot')}</div>
            <div class="_row"><span>Silent Aim (F2)</span>${_switch('silentAim')}</div>
            <div class="_row"><span>Lock Mode (F3)</span>${_switch('lockMode')}</div>
            <div class="_row"><span>Smooth</span><span class="_val" id="_val_smoothing">${_settings.smoothing}</span></div>
            ${_slider('smoothing', 0.1, 1.0, 0.05)}
            <div class="_row"><span>FOV</span><span class="_val" id="_val_aimFov">${_settings.aimFov}</span></div>
            ${_slider('aimFov', 0.4, 2.5, 0.05)}
            <div class="_row"><span>Base Offset</span><span class="_val" id="_val_baseAimOffset">${_settings.baseAimOffset}</span></div>
            ${_slider('baseAimOffset', 5, 25, 0.5)}
            <div class="_row"><span>Min Offset</span><span class="_val" id="_val_minAimOffset">${_settings.minAimOffset}</span></div>
            ${_slider('minAimOffset', 2, 12, 0.5)}
            <div class="_row"><span>Distance Comp</span><span class="_val" id="_val_distanceComp">${_settings.distanceComp}</span></div>
            ${_slider('distanceComp', 10, 60, 5)}
        `);

        _buildTab('trig', `
            <div class="_row"><span>Auto Shoot</span>${_switch('autoShoot')}</div>
            <div class="_row"><span>Trigger Delay</span><span class="_val" id="_val_triggerDelay">${_settings.triggerDelay}</span></div>
            ${_slider('triggerDelay', 50, 300, 10)}
            <div class="_row"><span>Burst Length</span><span class="_val" id="_val_burstLength">${_settings.burstLength}</span></div>
            ${_slider('burstLength', 1, 8, 1)}
            <div class="_row"><span>Burst Pause</span><span class="_val" id="_val_burstPause">${_settings.burstPause}</span></div>
            ${_slider('burstPause', 50, 400, 10)}
        `);

        _buildTab('recoil', `
            <div class="_row"><span>No Recoil</span>${_switch('noRecoil')}</div>
            <div class="_row"><span>Recoil Reset</span><span class="_val" id="_val_recoilReset">${_settings.recoilReset}</span></div>
            ${_slider('recoilReset', 0.5, 1.0, 0.05)}
            <div class="_row"><span>Recoil Deadzone</span><span class="_val" id="_val_recoilDeadzone">${_settings.recoilDeadzone}</span></div>
            ${_slider('recoilDeadzone', 0.005, 0.1, 0.005)}
        `);

        _buildTab('esp', `
            <div class="_row"><span>Draw FOV</span>${_switch('drawFov')}</div>
            <div class="_row"><span>Draw Lines</span>${_switch('drawLines')}</div>
            <div class="_row"><span>Show Distance</span>${_switch('showDist')}</div>
            <div class="_row"><span>Max Dist</span><span class="_val" id="_val_maxDistShow">${_settings.maxDistShow}</span></div>
            ${_slider('maxDistShow', 50, 300, 10)}
        `);

        _buildTab('set', `
            <div class="_row"><span>Force Team</span>
                <select id="_forceTeamSelect" style="background:#1a1a1a;border:1px solid #333;border-radius:4px;color:#ddd;padding:2px 6px;">
                    <option value="0" ${_settings.forceTeam===0?'selected':''}>Auto</option>
                    <option value="1" ${_settings.forceTeam===1?'selected':''}>Team 1</option>
                    <option value="2" ${_settings.forceTeam===2?'selected':''}>Team 2</option>
                    <option value="3" ${_settings.forceTeam===3?'selected':''}>FFA</option>
                </select>
            </div>
            <div class="_row"><span>Anti-Team Lock</span>${_switch('antiTeamLock')}</div>
            <div class="_row"><span>Auto Bhop</span>${_switch('autoBhop')}</div>
            <div class="_row"><span>Stealth Mode</span>${_switch('stealthMode')}</div>
        `);

        // ─── Bind controls ──────────────────────────────────
        document.querySelectorAll('._tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('._tab').forEach(t => {
                    t.style.background = '#1a1a1a';
                    t.style.color = '#888';
                    t.style.borderColor = 'transparent';
                });
                tab.style.background = '#2a2a2a';
                tab.style.color = '#fff';
                tab.style.borderColor = '#555';
                const id = tab.dataset.tab;
                Object.keys(_tabs).forEach(k => {
                    _tabs[k].style.display = k === id ? 'block' : 'none';
                });
            });
        });

        document.querySelectorAll('._sw').forEach(el => {
            el.addEventListener('click', () => {
                const key = el.dataset.key;
                if (!key) return;
                _settings[key] = !_settings[key];
                el.classList.toggle('on', _settings[key]);
                _updateUI();
                _save();
            });
        });

        document.querySelectorAll('._slider').forEach(el => {
            el.addEventListener('input', () => {
                const key = el.dataset.key;
                const val = parseFloat(el.value);
                if (key) {
                    _settings[key] = val;
                    const label = document.getElementById('_val_' + key);
                    if (label) label.textContent = val;
                    _save();
                }
            });
        });

        document.getElementById('_forceTeamSelect').addEventListener('change', function() {
            _settings.forceTeam = parseInt(this.value);
            _save();
            _updateUI();
        });

        // ─── Drag ────────────────────────────────────────────
        const _drag = document.getElementById('_uiDrag');
        let _dragging = false, _offX = 0, _offY = 0;
        _drag.addEventListener('mousedown', (e) => {
            _dragging = true;
            const rect = _panel.getBoundingClientRect();
            _offX = e.clientX - rect.left;
            _offY = e.clientY - rect.top;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!_dragging) return;
            let left = e.clientX - _offX;
            let top = e.clientY - _offY;
            left = Math.max(0, Math.min(window.innerWidth - 360, left));
            top = Math.max(0, Math.min(window.innerHeight - 100, top));
            _panel.style.left = left + 'px';
            _panel.style.top = top + 'px';
            _panel.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => _dragging = false);

        document.getElementById('_uiMin').addEventListener('click', () => {
            const content = document.getElementById('_uiContent');
            content.style.display = content.style.display === 'none' ? 'block' : 'none';
        });
        document.getElementById('_uiClose').addEventListener('click', () => {
            _panel.style.display = 'none';
        });

        // ─── Keybinds ──────────────────────────────────────
        window.addEventListener('keydown', (e) => {
            _keys[e.code] = true;
            if (e.key === 'F1') {
                _settings.aimbot = !_settings.aimbot;
                _updateUI();
                _save();
                e.preventDefault();
            }
            if (e.key === 'F2') {
                _settings.silentAim = !_settings.silentAim;
                _updateUI();
                _save();
                e.preventDefault();
            }
            if (e.key === 'F3') {
                _settings.lockMode = !_settings.lockMode;
                _updateUI();
                _save();
                e.preventDefault();
            }
            if (e.key === 'h' || e.key === 'H') {
                _settings.forceTeam = (_settings.forceTeam + 1) % 4;
                document.getElementById('_forceTeamSelect').value = _settings.forceTeam;
                _updateUI();
                _save();
                e.preventDefault();
            }
            if (e.key === 'ArrowUp') {
                _settings.baseAimOffset = +(_settings.baseAimOffset + 0.5).toFixed(1);
                document.getElementById('_val_baseAimOffset').textContent = _settings.baseAimOffset;
                _save();
                e.preventDefault();
            }
            if (e.key === 'ArrowDown') {
                _settings.baseAimOffset = +(_settings.baseAimOffset - 0.5).toFixed(1);
                document.getElementById('_val_baseAimOffset').textContent = _settings.baseAimOffset;
                _save();
                e.preventDefault();
            }
            if (e.key === 'F4') {
                _panel.style.display = _panel.style.display === 'none' ? 'block' : 'none';
                e.preventDefault();
            }
        }, true);
        window.addEventListener('keyup', (e) => { _keys[e.code] = false; }, true);
        window.addEventListener('mousedown', (e) => {
            if (e.button === 2) _rightMouse = true;
            if (e.button === 0) {
                _leftMouse = true;
                _lastManualShot = performance.now();
            }
        }, true);
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2) _rightMouse = false;
            if (e.button === 0) _leftMouse = false;
        }, true);
        window.addEventListener('contextmenu', (e) => e.preventDefault(), true);

        // ─── CSS ──────────────────────────────────────────────
        const _style = document.createElement('style');
        _style.id = '_accel_ui_styles';
        _style.textContent = `
            ._row { display:flex; justify-content:space-between; align-items:center; margin:6px 0; color:#bbb; font-size:11px; }
            ._sw { width:32px; height:16px; background:#222; border:1px solid #444; border-radius:8px; position:relative; cursor:pointer; transition:0.15s; display:inline-block; flex-shrink:0; }
            ._sw.on { background:#444; border-color:#888; }
            ._sw ._knob { width:12px; height:12px; background:#fff; border-radius:50%; position:absolute; top:1px; left:1px; transition:0.15s; }
            ._sw.on ._knob { left:17px; }
            ._slider { -webkit-appearance:none; width:100%; height:2px; background:#333; border-radius:2px; outline:none; margin:4px 0; }
            ._slider::-webkit-slider-thumb { -webkit-appearance:none; width:10px; height:10px; background:#fff; border-radius:50%; cursor:pointer; }
            ._val { color:#888; font-size:10px; min-width:30px; text-align:right; }
            ._tab { transition:0.1s; }
            #_accel_ui { scrollbar-width:thin; }
            #_accel_ui::-webkit-scrollbar { width:3px; }
            #_accel_ui::-webkit-scrollbar-track { background:#111; }
            #_accel_ui::-webkit-scrollbar-thumb { background:#333; border-radius:3px; }
            select { background:#1a1a1a; border:1px solid #333; border-radius:4px; color:#ddd; padding:2px 6px; font-size:11px; }
        `;
        document.head.appendChild(_style);

        _updateUI();
        _panel.style.display = 'block';
    }

    function _updateUI() {
        document.querySelectorAll('._sw').forEach(el => {
            const key = el.dataset.key;
            if (key !== undefined) {
                el.classList.toggle('on', !!_settings[key]);
            }
        });
        if (_panel) {
            _panel.style.borderColor = _settings.aimbot ? (_settings.lockMode ? '#f90' : '#0f0') : '#2a2a2a';
        }
    }

    // ─── HELPERS ──────────────────────────────────────────────
    function _getTeamDeep(obj) {
        if (!obj) return null;
        const targets = [obj, obj.player, obj.owner, obj.userData];
        for (let t of targets) {
            if (!t) continue;
            if (t.team !== undefined) return t.team;
            if (t.teammate !== undefined) return t.teammate;
            if (t.friendly !== undefined) return t.friendly;
            for (let key in t) {
                if (typeof t[key] === 'number' && (t[key] === 1 || t[key] === 2)) {
                    if (key !== 'x' && key !== 'y' && key !== 'z' && key.length <= 4) {
                        return t[key];
                    }
                }
            }
        }
        return null;
    }

    function _getMyTeam() {
        let t = _getTeamDeep(_myPlayer);
        if (t !== null && t !== undefined) return t;
        try {
            if (window.world && window.world.localPlayer) {
                let wt = _getTeamDeep(window.world.localPlayer);
                if (wt !== null) return wt;
            }
        } catch(e) {}
        return null;
    }

    function _isEnemy(enemyObj, myTeamID) {
        let myT = myTeamID;
        if (_settings.forceTeam === 1) myT = 1;
        if (_settings.forceTeam === 2) myT = 2;
        if (_settings.forceTeam === 3) return true;

        const eTeam = _getTeamDeep(enemyObj);
        if (myT === null || myT === undefined) return true;
        if (eTeam === null || eTeam === undefined) return true;
        if (_settings.antiTeamLock && myT === eTeam) return false;
        return myT !== eTeam;
    }

    function _getDynamicOffset(dist) {
        const t = Math.min(1, dist / _settings.distanceComp);
        return _settings.minAimOffset + (_settings.baseAimOffset - _settings.minAimOffset) * t;
    }

    function _triggerShoot() {
        const now = performance.now();
        if (now - _lastManualShot < 100) return;
        if (now - _lastShot < _settings.triggerDelay) return;
        const gameCanvas = document.getElementById('inGameUI') || document.body;
        gameCanvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: window.innerWidth/2, clientY: window.innerHeight/2 }));
        setTimeout(() => {
            gameCanvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: window.innerWidth/2, clientY: window.innerHeight/2 }));
        }, 25);
        _lastShot = now;
    }

    // ─── MAIN LOOP ──────────────────────────────────────────────
    function _loop() {
        requestAnimationFrame(_loop);
        const now = performance.now();

        _fc++;
        if (now - _fpsTime > 1000) {
            _fps = _fc;
            _fc = 0;
            _fpsTime = now;
            const fpsEl = document.getElementById('_fpsDisplay');
            if (fpsEl) fpsEl.innerText = _fps + ' FPS';
        }

        if (!_ctx || !_hooked || !_scene) {
            if (_ctx) _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
            return;
        }

        _ctx.clearRect(0, 0, _canvas.width, _canvas.height);

        // ─── Find player ──────────────────────────────────────
        _myPlayer = null;
        for (const child of _scene.children) {
            if (child.type === 'Object3D' && child.children[0]?.children[0]?.type === 'PerspectiveCamera') {
                _myPlayer = child;
                _cam = child.children[0].children[0];
                break;
            }
        }
        if (!_myPlayer || !_cam) {
            return;
        }

        // ─── Auto bhop ──────────────────────────────────────
        if (_settings.autoBhop && _keys['Space']) {
            try {
                if (_myPlayer.velocity && _myPlayer.velocity.y <= 0) {
                    _myPlayer.velocity.y = 7;
                }
            } catch(e) {}
        }

        // ─── Enemies ──────────────────────────────────────────
        const myTeamID = _getMyTeam();
        const enemies = [];
        for (const child of _scene.children) {
            if (child.type !== 'Object3D' || child === _myPlayer) continue;
            try {
                if (child.position.x === 0 && child.position.z === 0) continue;
                if (!child.children || child.children.length < 2) continue;
                const dx = child.position.x - _myPlayer.position.x;
                const dz = child.position.z - _myPlayer.position.z;
                if (Math.sqrt(dx*dx + dz*dz) < 5) continue;
                if (!_isEnemy(child, myTeamID)) continue;
                enemies.push(child);
            } catch(e) {}
        }

        // ─── Aim assist ──────────────────────────────────────
        _locked = null;
        let isAimAligned = false;
        const isAiming = _rightMouse || _settings.lockMode;

        if (_settings.aimbot && isAiming) {
            let bestTarget = null;
            let minAngle = _settings.aimFov;
            const currentYaw = _myPlayer.rotation.y;
            const currentPitch = _myPlayer.children[0].rotation.x;
            const eyePos = new _V3(
                _myPlayer.position.x,
                _myPlayer.position.y + _settings.camOffset,
                _myPlayer.position.z
            );

            let bestDyaw = 0, bestDpitch = 0;

            for (const p of enemies) {
                const dx = p.position.x - eyePos.x;
                const dz = p.position.z - eyePos.z;
                const distXZ = Math.sqrt(dx*dx + dz*dz);
                if (distXZ < 2) continue;

                const dist3D = Math.sqrt(dx*dx + (p.position.y - eyePos.y)*(p.position.y - eyePos.y) + dz*dz);
                const dynOffset = _getDynamicOffset(dist3D);
                const aimY = p.position.y + dynOffset;
                const dy = aimY - eyePos.y;

                const targetYaw = Math.atan2(dx, dz) + Math.PI;
                const targetPitch = Math.atan2(dy, distXZ);

                let dyaw = targetYaw - currentYaw;
                while (dyaw > Math.PI) dyaw -= Math.PI * 2;
                while (dyaw < -Math.PI) dyaw += Math.PI * 2;
                let dpitch = targetPitch - currentPitch;
                const angleDiff = Math.sqrt(dyaw*dyaw + dpitch*dpitch);

                if (angleDiff < minAngle) {
                    minAngle = angleDiff;
                    bestTarget = p;
                    bestDyaw = dyaw;
                    bestDpitch = dpitch;
                }
            }

            if (bestTarget) {
                _locked = bestTarget;
                if (!_settings.silentAim) {
                    const smooth = _settings.smoothing;
                    const dyawSmooth = bestDyaw * smooth;
                    const dpitchSmooth = bestDpitch * smooth;
                    if (Math.abs(dyawSmooth) > 0.0005) {
                        _myPlayer.rotation.y += dyawSmooth;
                    }
                    if (Math.abs(dpitchSmooth) > 0.0005) {
                        _myPlayer.children[0].rotation.x += dpitchSmooth;
                    }
                }
                if (minAngle < 0.2) {
                    isAimAligned = true;
                }
            }
        }

        // ─── Auto shoot ──────────────────────────────────────
        if (_settings.autoShoot && _locked && isAimAligned) {
            const burstLen = _settings.burstLength || 3;
            const burstPause = _settings.burstPause || 200;
            if (_burst >= burstLen) {
                if (now - _burstTimer < burstPause) {
                    // skip
                } else {
                    _burst = 0;
                }
            }
            if (_burst < burstLen) {
                _triggerShoot();
                _burst++;
                _burstTimer = now;
            }
        } else {
            _burst = 0;
        }

        // ─── No recoil — FIXED: only reset when NOT aiming ──
        if (_settings.noRecoil && _myPlayer.children[0]) {
            const pitch = _myPlayer.children[0].rotation.x;
            const isActivelyAiming = _rightMouse || _settings.lockMode;
            // ONLY reset when aimbot is ON and NOT actively aiming
            // This prevents fighting the mouse when you're trying to aim manually
            if (_settings.aimbot && !isActivelyAiming && Math.abs(pitch) > _settings.recoilDeadzone) {
                // Gentle return to center
                _myPlayer.children[0].rotation.x *= (1 - _settings.recoilReset);
            }
        }

        // ─── Target count ──────────────────────────────────
        let targetCountEl = document.getElementById('targetCount');
        if (!targetCountEl && _panel) {
            const header = _panel.querySelector('div:first-child');
            if (header) {
                const span = document.createElement('span');
                span.id = 'targetCount';
                span.style.cssText = 'color:#888;font-size:10px;margin-left:8px;';
                span.innerText = '0';
                header.appendChild(span);
            }
            targetCountEl = document.getElementById('targetCount');
        }
        if (targetCountEl) targetCountEl.innerText = enemies.length;

        // ─── ESP Drawing ──────────────────────────────────────
        if (_settings.drawFov || _settings.drawLines || _settings.showDist) {
            if (_settings.drawFov) {
                _ctx.beginPath();
                _ctx.arc(_canvas.width/2, _canvas.height/2, (_canvas.height/2) * (_settings.aimFov / 2.2), 0, 2*Math.PI);
                _ctx.strokeStyle = "rgba(0, 243, 255, 0.12)";
                _ctx.lineWidth = 1;
                _ctx.stroke();
            }

            for (const p of enemies) {
                try {
                    const color = (p === _locked) ? "#ffff00" : "#ff3333";

                    const head = new _V3(p.position.x, p.position.y + 10.5, p.position.z);
                    head.project(_cam);
                    const foot = new _V3(p.position.x, p.position.y, p.position.z);
                    foot.project(_cam);

                    if (head.z > 1) continue;

                    const top = (-head.y * 0.5 + 0.5) * _canvas.height;
                    const bot = (-foot.y * 0.5 + 0.5) * _canvas.height;
                    const h = bot - top;
                    const w = h * 0.6;
                    const x = (head.x * 0.5 + 0.5) * _canvas.width;

                    // Box
                    _ctx.strokeStyle = color;
                    _ctx.lineWidth = 1.5;
                    _ctx.strokeRect(x - w/2, top, w, h);

                    // Target dot
                    if (p === _locked) {
                        const dist3D = Math.sqrt(
                            (p.position.x - _myPlayer.position.x)**2 +
                            (p.position.y - _myPlayer.position.y)**2 +
                            (p.position.z - _myPlayer.position.z)**2
                        );
                        const dynOff = _getDynamicOffset(dist3D);
                        const aimPoint = new _V3(p.position.x, p.position.y + dynOff, p.position.z);
                        aimPoint.project(_cam);
                        const aimY = (-aimPoint.y * 0.5 + 0.5) * _canvas.height;
                        _ctx.fillStyle = "#ff0";
                        _ctx.beginPath();
                        _ctx.arc(x, aimY, 4, 0, Math.PI * 2);
                        _ctx.fill();
                    }

                    // Lines (tracers)
                    if (_settings.drawLines) {
                        _ctx.beginPath();
                        _ctx.moveTo(_canvas.width / 2, _canvas.height);
                        _ctx.lineTo(x, bot);
                        _ctx.strokeStyle = "rgba(0, 243, 255, 0.3)";
                        _ctx.lineWidth = 1;
                        _ctx.stroke();
                    }

                    // Distance
                    if (_settings.showDist) {
                        const dx = p.position.x - _myPlayer.position.x;
                        const dy = p.position.y - _myPlayer.position.y;
                        const dz = p.position.z - _myPlayer.position.z;
                        const dist = Math.round(Math.sqrt(dx*dx + dy*dy + dz*dz));

                        if (dist <= _settings.maxDistShow) {
                            const text = `${dist}m`;
                            _ctx.font = "bold 10px 'Segoe UI', Verdana";
                            _ctx.textAlign = "center";
                            const tw = _ctx.measureText(text).width;
                            _ctx.fillStyle = "rgba(10, 15, 30, 0.7)";
                            _ctx.fillRect(x - tw/2 - 4, top - 18, tw + 8, 16);
                            _ctx.fillStyle = "#00f3ff";
                            _ctx.fillText(text, x, top - 6);
                        }
                    }
                } catch(e) {}
            }
        }

        // ─── Stealth mode ──────────────────────────────────────
        if (_settings.stealthMode) {
            if (enemies.length === 0 && !_locked) {
                _canvas.style.opacity = '0.01';
            } else {
                _canvas.style.opacity = '0.99';
            }
        } else {
            _canvas.style.opacity = '0.99';
        }
    }

    // ─── START ──────────────────────────────────────────────────
    window.__ACCEL_LOADED = true;
})();
