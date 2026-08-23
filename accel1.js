(function() {
    'use strict';

    // ─── ANTI-DETECTION ──────────────────────────────────────
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
    const DEFAULTS = {
        aimbot: true,
        silentAim: false,
        lockMode: false,
        aimFov: 1.4,
        smoothing: 0.7,
        camOffset: 6.0,
        aimOffset: 14.9,
        drawFov: true,
        drawLines: true,
        showDist: true,
        maxDistShow: 150,
        autoShoot: true,
        triggerDelay: 150,
        burstLength: 3,
        burstPause: 200,
        antiRecoil: true,
        recoilStrength: 0.85,
        autoBhop: true,
        bhopStrength: 7.5,
        forceTeam: 0,
        antiTeamLock: true,
        espEnabled: true,
        radarEnabled: true,
        radarSize: 140,
        stealthMode: true,
    };

    const STORAGE_KEY = 'accel_krunker_v9';
    let settings = {};
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        settings = saved ? { ...DEFAULTS, ...JSON.parse(saved) } : { ...DEFAULTS };
    } catch(_) { settings = { ...DEFAULTS }; }

    function saveSettings() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch(_) {}
    }

    // ─── STATE ──────────────────────────────────────────────
    let scene = null, myPlayer = null, camera = null, Vector3 = null;
    let rightMouse = false, lockedTarget = null, keys = {};
    let isHooked = false, lastShootTime = 0, lastManualShot = 0;
    let burstCount = 0, burstTimer = 0;
    let canvas = null, ctx = null;
    let targetCount = 0, fps = 0, frameCount = 0, lastFpsUpdate = performance.now();
    let uiVisible = true, contentMinimized = false;
    let radarCanvas = null;
    let wasOnGround = false;
    let jumpCooldown = 0;

    // ─── HOOK ──────────────────────────────────────────────────
    const originalPush = Array.prototype.push;
    Array.prototype.push = function() {
        for (let i = 0; i < arguments.length; i++) {
            const obj = arguments[i];
            if (obj && obj.parent && obj.parent.name === 'Main' && obj.parent.type === 'Scene') {
                if (scene !== obj.parent) {
                    scene = obj.parent;
                    if (obj.position && obj.position.constructor) {
                        Vector3 = obj.position.constructor;
                    }
                    isHooked = true;
                }
            }
        }
        return originalPush.apply(this, arguments);
    };

    // ─── HELPERS ──────────────────────────────────────────────
    function getTeamDeep(obj) {
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

    function getMyTeam() {
        let t = getTeamDeep(myPlayer);
        if (t !== null && t !== undefined) return t;
        try {
            if (window.world && window.world.localPlayer) {
                let wt = getTeamDeep(window.world.localPlayer);
                if (wt !== null) return wt;
            }
        } catch(e) {}
        return null;
    }

    function isEnemy(enemyObj, myTeamID) {
        let myT = myTeamID;
        if (settings.forceTeam === 1) myT = 1;
        if (settings.forceTeam === 2) myT = 2;
        if (settings.forceTeam === 3) return true;
        const eTeam = getTeamDeep(enemyObj);
        if (myT === null || myT === undefined) return true;
        if (eTeam === null || eTeam === undefined) return true;
        if (settings.antiTeamLock && myT === eTeam) return false;
        return myT !== eTeam;
    }

    function triggerShoot() {
        const now = performance.now();
        if (now - lastManualShot < 80) return;
        if (now - lastShootTime < settings.triggerDelay) return;
        const gameCanvas = document.getElementById('inGameUI') || document.body;
        gameCanvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: window.innerWidth/2, clientY: window.innerHeight/2 }));
        setTimeout(() => {
            gameCanvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: window.innerWidth/2, clientY: window.innerHeight/2 }));
        }, 20);
        lastShootTime = now;
    }

    // ─── AUTO BHOP ──────────────────────────────────────────────
    function doBhop() {
        if (!settings.autoBhop) return false;
        if (!myPlayer) return false;
        if (!keys['Space']) return false;

        const now = performance.now();
        if (now - jumpCooldown < 50) return false;

        try {
            // Check if player is on ground (velocity.y <= 0 and position is stable)
            if (myPlayer.velocity) {
                const velY = myPlayer.velocity.y;
                // Only jump if falling or on ground
                if (velY <= 0.5 && velY > -2) {
                    // Check if we were on ground or just landed
                    myPlayer.velocity.y = settings.bhopStrength;
                    jumpCooldown = now;
                    return true;
                }
                // If falling, allow jump at the peak of fall (for bhop timing)
                // Krunker bhop works by jumping the frame you touch ground
                // We'll detect ground contact via velocity near zero
                if (Math.abs(velY) < 0.5 && velY <= 0) {
                    myPlayer.velocity.y = settings.bhopStrength;
                    jumpCooldown = now;
                    return true;
                }
            }
            // Fallback: try to find position change to detect ground
            if (myPlayer.position) {
                // If player hasn't moved down in the last frame, they're on ground
                // We'll use a simple timer-based approach
                if (wasOnGround) {
                    myPlayer.velocity.y = settings.bhopStrength;
                    jumpCooldown = now;
                    wasOnGround = false;
                    return true;
                }
                wasOnGround = true;
            }
        } catch(e) {}
        return false;
    }

    // ─── BUILD UI ──────────────────────────────────────────────
    function buildUI() {
        // ... (UI code same as before, just ensure autoBhop toggle is in recoil tab)
        // We'll use the same UI structure with bhop toggle in the recoil tab

        // Overlay canvas
        canvas = document.createElement('canvas');
        canvas.id = 'accelEspCanvas';
        canvas.style.cssText = 'position:fixed; top:0; left:0; pointer-events:none; z-index:9996; transition: opacity 0.25s ease;';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Radar container
        const radarDiv = document.createElement('div');
        radarDiv.id = 'accelRadar';
        radarDiv.style.cssText = `
            position:fixed; bottom:28px; right:28px; z-index:9997;
            border-radius:50%; pointer-events:none;
            border:0.5px solid rgba(255,255,255,0.04);
            box-shadow:0 8px 40px rgba(0,0,0,0.5), inset 0 0 0 0.5px rgba(255,255,255,0.03);
            backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
            background:rgba(10,12,20,0.5); overflow:hidden;
            width:${settings.radarSize}px; height:${settings.radarSize}px;
            display:${settings.radarEnabled ? 'block' : 'none'};
        `;
        document.body.appendChild(radarDiv);

        radarCanvas = document.createElement('canvas');
        radarCanvas.width = settings.radarSize;
        radarCanvas.height = settings.radarSize;
        radarCanvas.style.cssText = 'width:100%; height:100%; display:block;';
        radarDiv.appendChild(radarCanvas);

        // Panel
        const panel = document.createElement('div');
        panel.id = 'accelPanel';
        panel.style.cssText = `
            position:fixed; top:24px; right:24px; z-index:9999;
            width:380px; max-height:90vh;
            display:flex; flex-direction:column; overflow:hidden;
            transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease, border-color 0.4s ease;
            border-radius:24px; pointer-events:auto; user-select:none;
            background:rgba(18,20,30,0.65);
            backdrop-filter:blur(24px) saturate(1.6);
            -webkit-backdrop-filter:blur(24px) saturate(1.6);
            border:0.5px solid rgba(255,255,255,0.06);
            box-shadow:0 20px 60px rgba(0,0,0,0.7), inset 0 0 0 0.5px rgba(255,255,255,0.04);
        `;
        document.body.appendChild(panel);

        panel.innerHTML = `
            <div class="panel-header" id="accelDrag" style="display:flex;align-items:center;padding:14px 20px 10px 20px;border-bottom:0.5px solid rgba(255,255,255,0.05);flex-shrink:0;cursor:grab;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <div style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#6c5ce7,#00cec9);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#fff;box-shadow:0 4px 12px rgba(108,92,231,0.35);">A</div>
                    <span style="font-weight:700;font-size:16px;letter-spacing:-0.3px;background:linear-gradient(135deg,#f0f0ff,#a0aec0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">ACCEL</span>
                    <span style="font-size:8px;font-weight:600;color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.06);padding:2px 8px;border-radius:20px;border:0.5px solid rgba(255,255,255,0.05);">v9</span>
                </div>
                <div style="margin-left:auto;display:flex;align-items:center;gap:10px;">
                    <span style="font-size:10px;font-weight:500;color:rgba(255,255,255,0.25);font-variant-numeric:tabular-nums;"><span id="accelFps">0</span> FPS</span>
                    <span id="accelMin" style="width:24px;height:24px;border-radius:6px;border:0.5px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.25);font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:0.2s;">−</span>
                    <span id="accelClose" style="width:24px;height:24px;border-radius:6px;border:0.5px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.03);color:rgba(255,100,100,0.3);font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:0.2s;">✕</span>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;padding:6px 20px;border-bottom:0.5px solid rgba(255,255,255,0.04);flex-shrink:0;font-size:9px;font-weight:500;color:rgba(255,255,255,0.2);">
                <span style="display:flex;align-items:center;gap:4px;">
                    <span id="statusDot" style="width:5px;height:5px;border-radius:50%;display:inline-block;background:rgba(255,255,255,0.12);transition:0.3s;"></span>
                    <span id="statusLabel">idle</span>
                </span>
                <span style="display:flex;align-items:center;gap:4px;">targets <span id="accelCount" style="color:rgba(255,255,255,0.5);font-weight:600;">0</span></span>
                <span style="flex:1;"></span>
                <span style="font-size:8px;color:rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);padding:2px 8px;border-radius:12px;border:0.5px solid rgba(255,255,255,0.04);">" panel</span>
            </div>
            <div class="tabs" id="accelTabs" style="display:flex;gap:4px;padding:8px 16px 0 16px;flex-shrink:0;border-bottom:0.5px solid rgba(255,255,255,0.04);">
                ${['aim','trig','recoil','esp','set'].map(t => `<div class="tab" data-tab="${t}" style="flex:1;text-align:center;padding:8px 0 10px 0;font-size:10px;font-weight:600;letter-spacing:0.4px;color:rgba(255,255,255,0.2);cursor:pointer;border-bottom:2px solid transparent;transition:0.25s;${t==='aim'?'border-bottom-color:#6c5ce7;color:#fff;':''}">${t.toUpperCase()}</div>`).join('')}
            </div>
            <div id="accelContent" style="padding:14px 18px 18px 18px;overflow-y:auto;flex:1;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.05) transparent;"></div>
            <div style="padding:8px 20px 12px 20px;border-top:0.5px solid rgba(255,255,255,0.04);flex-shrink:0;display:flex;justify-content:space-between;align-items:center;font-size:8px;color:rgba(255,255,255,0.12);">
                <span>ACCEL · by spigen</span>
                <div style="display:flex;gap:8px;">
                    <kbd style="background:rgba(255,255,255,0.04);padding:1px 7px;border-radius:4px;border:0.5px solid rgba(255,255,255,0.04);font-family:inherit;font-size:8px;color:rgba(255,255,255,0.15);">F1</kbd>
                    <kbd style="background:rgba(255,255,255,0.04);padding:1px 7px;border-radius:4px;border:0.5px solid rgba(255,255,255,0.04);font-family:inherit;font-size:8px;color:rgba(255,255,255,0.15);">F2</kbd>
                    <kbd style="background:rgba(255,255,255,0.04);padding:1px 7px;border-radius:4px;border:0.5px solid rgba(255,255,255,0.04);font-family:inherit;font-size:8px;color:rgba(255,255,255,0.15);">F3</kbd>
                    <kbd style="background:rgba(255,255,255,0.04);padding:1px 7px;border-radius:4px;border:0.5px solid rgba(255,255,255,0.04);font-family:inherit;font-size:8px;color:rgba(255,255,255,0.15);">H</kbd>
                    <kbd style="background:rgba(255,255,255,0.04);padding:1px 7px;border-radius:4px;border:0.5px solid rgba(255,255,255,0.04);font-family:inherit;font-size:8px;color:rgba(255,255,255,0.15);">↑↓</kbd>
                </div>
            </div>
        `;

        const contentDiv = document.getElementById('accelContent');
        const pages = {};

        function page(id, html) {
            const div = document.createElement('div');
            div.className = 'tab-page' + (id === 'aim' ? ' active' : '');
            div.style.display = id === 'aim' ? 'block' : 'none';
            div.dataset.page = id;
            div.innerHTML = html;
            contentDiv.appendChild(div);
            pages[id] = div;
        }

        function sw(key) {
            const on = settings[key] ? 'on' : '';
            return `<div class="toggle ${on}" data-key="${key}" style="width:40px;height:24px;border-radius:12px;background:rgba(255,255,255,0.08);border:0.5px solid rgba(255,255,255,0.04);position:relative;cursor:pointer;transition:0.3s cubic-bezier(0.34,1.56,0.64,1);flex-shrink:0;"><div class="knob" style="width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,0.2);position:absolute;top:2px;left:${on ? '18px' : '2px'};transition:0.3s cubic-bezier(0.34,1.56,0.64,1);box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div></div>`;
        }

        function sl(key, min, max, step, suffix = '') {
            const val = settings[key];
            return `
                <div style="padding:2px 0 6px 0;">
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;">
                        <span style="font-size:10px;color:rgba(255,255,255,0.35);font-weight:400;">${key.replace(/([A-Z])/g, ' $1')}</span>
                        <span style="font-size:10px;font-weight:500;color:rgba(255,255,255,0.5);min-width:30px;text-align:right;font-variant-numeric:tabular-nums;" id="sv_${key}">${val}${suffix}</span>
                    </div>
                    <input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${val}" style="-webkit-appearance:none;appearance:none;width:100%;height:3px;border-radius:4px;background:rgba(255,255,255,0.06);outline:none;margin:6px 0 2px 0;transition:0.2s;">
                </div>
            `;
        }

        page('aim', `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:0.5px solid rgba(255,255,255,0.02);"><span style="font-size:11px;font-weight:500;color:rgba(255,255,255,0.6);">Aimbot <span style="font-size:8px;color:rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);padding:1px 6px;border-radius:10px;">F1</span></span>${sw('aimbot')}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:0.5px solid rgba(255,255,255,0.02);"><span style="font-size:11px;font-weight:500;color:rgba(255,255,255,0.6);">Silent Aim <span style="font-size:8px;color:rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);padding:1px 6px;border-radius:10px;">F2</span></span>${sw('silentAim')}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:0.5px solid rgba(255,255,255,0.02);"><span style="font-size:11px;font-weight:500;color:rgba(255,255,255,0.6);">Lock Mode <span style="font-size:8px;color:rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);padding:1px 6px;border-radius:10px;">F3</span></span>${sw('lockMode')}</div>
            ${sl('smoothing', 0.1, 1.0, 0.05)}
            ${sl('aimFov', 0.4, 2.5, 0.05)}
            ${sl('aimOffset', 5, 25, 0.5)}
        `);

        page('trig', `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:0.5px solid rgba(255,255,255,0.02);"><span style="font-size:11px;font-weight:500;color:rgba(255,255,255,0.6);">Auto Shoot</span>${sw('autoShoot')}</div>
            ${sl('triggerDelay', 50, 300, 10, 'ms')}
            ${sl('burstLength', 1, 8, 1)}
            ${sl('burstPause', 50, 400, 10, 'ms')}
        `);

        page('recoil', `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:0.5px solid rgba(255,255,255,0.02);"><span style="font-size:11px;font-weight:500;color:rgba(255,255,255,0.6);">Anti-Recoil</span>${sw('antiRecoil')}</div>
            ${sl('recoilStrength', 0.3, 1.0, 0.05)}
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;margin-top:8px;border-top:0.5px solid rgba(255,255,255,0.03);"><span style="font-size:11px;font-weight:500;color:rgba(255,255,255,0.6);">Auto Bhop <span style="font-size:8px;color:rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);padding:1px 6px;border-radius:10px;">Hold Space</span></span>${sw('autoBhop')}</div>
            ${sl('bhopStrength', 4, 12, 0.5)}
        `);

        page('esp', `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:0.5px solid rgba(255,255,255,0.02);"><span style="font-size:11px;font-weight:500;color:rgba(255,255,255,0.6);">ESP Enabled</span>${sw('espEnabled')}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:0.5px solid rgba(255,255,255,0.02);"><span style="font-size:11px;font-weight:500;color:rgba(255,255,255,0.6);">Draw FOV</span>${sw('drawFov')}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:0.5px solid rgba(255,255,255,0.02);"><span style="font-size:11px;font-weight:500;color:rgba(255,255,255,0.6);">Draw Lines</span>${sw('drawLines')}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:0.5px solid rgba(255,255,255,0.02);"><span style="font-size:11px;font-weight:500;color:rgba(255,255,255,0.6);">Show Distance</span>${sw('showDist')}</div>
            ${sl('maxDistShow', 50, 300, 10, 'm')}
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:0.5px solid rgba(255,255,255,0.02);"><span style="font-size:11px;font-weight:500;color:rgba(255,255,255,0.6);">Radar</span>${sw('radarEnabled')}</div>
            ${sl('radarSize', 80, 200, 10)}
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;margin-top:8px;border-top:0.5px solid rgba(255,255,255,0.03);"><span style="font-size:11px;font-weight:500;color:rgba(255,255,255,0.6);">Stealth Mode</span>${sw('stealthMode')}</div>
        `);

        page('set', `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:0.5px solid rgba(255,255,255,0.02);">
                <span style="font-size:11px;font-weight:500;color:rgba(255,255,255,0.6);">Force Team</span>
                <select id="accelForceTeam" style="background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.06);border-radius:8px;color:rgba(255,255,255,0.7);padding:4px 10px;font-size:10px;font-weight:500;font-family:inherit;cursor:pointer;outline:none;">
                    <option value="0" ${settings.forceTeam===0?'selected':''}>Auto</option>
                    <option value="1" ${settings.forceTeam===1?'selected':''}>Team 1</option>
                    <option value="2" ${settings.forceTeam===2?'selected':''}>Team 2</option>
                    <option value="3" ${settings.forceTeam===3?'selected':''}>FFA</option>
                </select>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;"><span style="font-size:11px;font-weight:500;color:rgba(255,255,255,0.6);">Anti-Team Lock</span>${sw('antiTeamLock')}</div>
        `);

        // --- Styles ---
        const style = document.createElement('style');
        style.textContent = `
            .tab.active { color:#fff !important; border-bottom-color:#6c5ce7 !important; }
            .tab.active::after { content:''; position:absolute; bottom:-2px; left:20%; right:20%; height:2px; background:linear-gradient(90deg,#6c5ce7,#00cec9); border-radius:4px; filter:blur(4px); opacity:0.6; }
            .toggle.on { background:linear-gradient(135deg,#6c5ce7,#00cec9) !important; border-color:rgba(108,92,231,0.3) !important; }
            .toggle.on .knob { left:18px !important; background:#fff !important; box-shadow:0 2px 12px rgba(108,92,231,0.4) !important; }
            .toggle:hover { transform:scale(1.02); }
            .toggle:active .knob { transform:scale(0.92); }
            input[type="range"]::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:14px; height:14px; border-radius:50%; background:radial-gradient(circle at 30% 30%, #a78bfa, #6c5ce7); cursor:pointer; box-shadow:0 2px 12px rgba(108,92,231,0.3); border:0.5px solid rgba(255,255,255,0.1); transition:0.15s; }
            input[type="range"]::-webkit-slider-thumb:hover { transform:scale(1.1); }
            input[type="range"]::-moz-range-thumb { width:14px; height:14px; border-radius:50%; background:radial-gradient(circle at 30% 30%, #a78bfa, #6c5ce7); cursor:pointer; border:0.5px solid rgba(255,255,255,0.1); }
            .tab { position:relative; }
            .tab-page { animation:fadeSlide 0.3s ease; }
            @keyframes fadeSlide { 0% { opacity:0; transform:translateY(6px); } 100% { opacity:1; transform:translateY(0); } }
            #accelPanel::-webkit-scrollbar { width:3px; }
            #accelPanel::-webkit-scrollbar-track { background:transparent; }
            #accelPanel::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:6px; }
        `;
        document.head.appendChild(style);

        // ─── BIND EVENTS ──────────────────────────────────────────

        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.style.borderBottomColor = 'transparent'; t.style.color = 'rgba(255,255,255,0.2)'; });
                tab.classList.add('active');
                tab.style.borderBottomColor = '#6c5ce7';
                tab.style.color = '#fff';
                const id = tab.dataset.tab;
                Object.keys(pages).forEach(k => {
                    pages[k].style.display = (k === id) ? 'block' : 'none';
                });
            });
        });

        // Toggles
        document.querySelectorAll('.toggle').forEach(el => {
            el.addEventListener('click', () => {
                const key = el.dataset.key;
                if (!key) return;
                settings[key] = !settings[key];
                const knob = el.querySelector('.knob');
                if (settings[key]) {
                    el.classList.add('on');
                    knob.style.left = '18px';
                    knob.style.background = '#fff';
                } else {
                    el.classList.remove('on');
                    knob.style.left = '2px';
                    knob.style.background = 'rgba(255,255,255,0.2)';
                }
                updateStatus();
                saveSettings();
                if (key === 'radarEnabled') {
                    const radarDiv = document.getElementById('accelRadar');
                    if (radarDiv) radarDiv.style.display = settings.radarEnabled ? 'block' : 'none';
                }
            });
        });

        // Sliders
        document.querySelectorAll('input[type="range"]').forEach(el => {
            el.addEventListener('input', () => {
                const key = el.dataset.key;
                const val = parseFloat(el.value);
                if (key) {
                    settings[key] = val;
                    const label = document.getElementById('sv_' + key);
                    if (label) {
                        const suffix = key === 'triggerDelay' || key === 'burstPause' ? 'ms' :
                                       key === 'maxDistShow' ? 'm' : '';
                        label.textContent = val + suffix;
                    }
                    if (key === 'radarSize') {
                        const radarDiv = document.getElementById('accelRadar');
                        if (radarDiv) {
                            radarDiv.style.width = val + 'px';
                            radarDiv.style.height = val + 'px';
                            const rCanvas = radarDiv.querySelector('canvas');
                            if (rCanvas) {
                                rCanvas.width = val;
                                rCanvas.height = val;
                                rCanvas.style.width = '100%';
                                rCanvas.style.height = '100%';
                            }
                        }
                    }
                    saveSettings();
                }
            });
        });

        // Force team
        const ft = document.getElementById('accelForceTeam');
        if (ft) {
            ft.addEventListener('change', () => {
                settings.forceTeam = parseInt(ft.value);
                saveSettings();
                updateStatus();
            });
        }

        // Panel controls
        document.getElementById('accelMin').addEventListener('click', () => {
            contentMinimized = !contentMinimized;
            document.querySelectorAll('.tab-page').forEach(p => { p.style.display = contentMinimized ? 'none' : ''; });
            document.querySelector('.tabs').style.display = contentMinimized ? 'none' : '';
            document.querySelector('#accelPanel > div:last-child').style.display = contentMinimized ? 'none' : '';
            document.getElementById('accelMin').textContent = contentMinimized ? '+' : '−';
        });

        document.getElementById('accelClose').addEventListener('click', () => {
            uiVisible = false;
            const p = document.getElementById('accelPanel');
            p.style.transform = 'translateX(420px) scale(0.96)';
            p.style.opacity = '0';
            p.style.pointerEvents = 'none';
        });

        // Drag
        const drag = document.getElementById('accelDrag');
        let dragging = false, offX = 0, offY = 0;
        drag.addEventListener('mousedown', (e) => {
            dragging = true;
            const rect = panel.getBoundingClientRect();
            offX = e.clientX - rect.left;
            offY = e.clientY - rect.top;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            let left = e.clientX - offX;
            let top = e.clientY - offY;
            left = Math.max(0, Math.min(window.innerWidth - 420, left));
            top = Math.max(0, Math.min(window.innerHeight - 120, top));
            panel.style.left = left + 'px';
            panel.style.top = top + 'px';
            panel.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => dragging = false);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            keys[e.code] = true;

            // Quote key toggles UI
            if (e.key === '"' || e.code === 'Quote') {
                uiVisible = !uiVisible;
                const p = document.getElementById('accelPanel');
                if (uiVisible) {
                    p.style.transform = '';
                    p.style.opacity = '';
                    p.style.pointerEvents = '';
                } else {
                    p.style.transform = 'translateX(420px) scale(0.96)';
                    p.style.opacity = '0';
                    p.style.pointerEvents = 'none';
                }
                e.preventDefault();
                return;
            }
            if (e.key === 'F1') { settings.aimbot = !settings.aimbot; syncToggles(); updateStatus(); saveSettings(); e.preventDefault(); }
            if (e.key === 'F2') { settings.silentAim = !settings.silentAim; syncToggles(); updateStatus(); saveSettings(); e.preventDefault(); }
            if (e.key === 'F3') { settings.lockMode = !settings.lockMode; syncToggles(); updateStatus(); saveSettings(); e.preventDefault(); }
            if (e.key === 'h' || e.key === 'H') {
                settings.forceTeam = (settings.forceTeam + 1) % 4;
                const ft2 = document.getElementById('accelForceTeam');
                if (ft2) ft2.value = settings.forceTeam;
                updateStatus();
                saveSettings();
                e.preventDefault();
            }
            if (e.key === 'ArrowUp') {
                settings.aimOffset = +(settings.aimOffset + 0.5).toFixed(1);
                const lbl = document.getElementById('sv_aimOffset');
                if (lbl) lbl.textContent = settings.aimOffset;
                saveSettings();
                e.preventDefault();
            }
            if (e.key === 'ArrowDown') {
                settings.aimOffset = +(settings.aimOffset - 0.5).toFixed(1);
                const lbl = document.getElementById('sv_aimOffset');
                if (lbl) lbl.textContent = settings.aimOffset;
                saveSettings();
                e.preventDefault();
            }
        }, true);

        document.addEventListener('keyup', (e) => {
            keys[e.code] = false;
        }, true);

        // Mouse buttons
        window.addEventListener('mousedown', (e) => { if (e.button === 2) rightMouse = true; if (e.button === 0) lastManualShot = performance.now(); }, true);
        window.addEventListener('mouseup', (e) => { if (e.button === 2) rightMouse = false; }, true);
        window.addEventListener('contextmenu', (e) => e.preventDefault(), true);

        // ─── INIT ──────────────────────────────────────────────
        syncToggles();
        updateStatus();

        window.__accel = {
            ctx: ctx,
            canvas: canvas,
            radarDiv: document.getElementById('accelRadar'),
            radarCanvas: radarCanvas,
            updateStatus: updateStatus,
            syncToggles: syncToggles,
            panel: panel,
            settings: settings,
            saveSettings: saveSettings,
            lockedTarget: null,
            doBhop: doBhop,
        };
    }

    // ─── SYNC TOGGLES ──────────────────────────────────────────
    function syncToggles() {
        document.querySelectorAll('.toggle').forEach(el => {
            const key = el.dataset.key;
            if (key !== undefined) {
                const on = !!settings[key];
                el.classList.toggle('on', on);
                const knob = el.querySelector('.knob');
                if (knob) {
                    knob.style.left = on ? '18px' : '2px';
                    knob.style.background = on ? '#fff' : 'rgba(255,255,255,0.2)';
                }
            }
        });
        const ft = document.getElementById('accelForceTeam');
        if (ft) ft.value = settings.forceTeam;
    }

    function updateStatus() {
        const border = document.getElementById('accelPanel');
        if (border) {
            border.style.borderColor = settings.aimbot ? (settings.lockMode ? 'rgba(253,203,110,0.3)' : 'rgba(0,206,201,0.25)') : 'rgba(255,255,255,0.04)';
        }
        syncToggles();
    }

    // ─── BUILD UI WHEN DOM READY ────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildUI);
    } else {
        buildUI();
    }

    // ─── MAIN LOOP ──────────────────────────────────────────
    function animate() {
        requestAnimationFrame(animate);
        const now = performance.now();

        // FPS
        frameCount++;
        if (now - lastFpsUpdate > 1000) {
            fps = frameCount;
            frameCount = 0;
            lastFpsUpdate = now;
            const fpsEl = document.getElementById('accelFps');
            if (fpsEl) fpsEl.innerText = fps;
        }

        if (!ctx || !isHooked || !scene) {
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // ─── Find player ──────────────────────────────────────
        myPlayer = null;
        for (const child of scene.children) {
            if (child.type === 'Object3D' && child.children[0]?.children[0]?.type === 'PerspectiveCamera') {
                myPlayer = child;
                camera = child.children[0].children[0];
                break;
            }
        }
        if (!myPlayer || !camera) return;

        // ─── AUTO BHOP ──────────────────────────────────────────
        // This runs every frame when space is held
        if (settings.autoBhop) {
            doBhop();
        }

        // ─── Enemies ──────────────────────────────────────────
        const myTeamID = getMyTeam();
        const enemies = [];
        for (const child of scene.children) {
            if (child.type !== 'Object3D' || child === myPlayer) continue;
            try {
                if (child.position.x === 0 && child.position.z === 0) continue;
                if (!child.children || child.children.length < 2) continue;
                const dx = child.position.x - myPlayer.position.x;
                const dz = child.position.z - myPlayer.position.z;
                if (Math.sqrt(dx*dx + dz*dz) < 5) continue;
                if (!isEnemy(child, myTeamID)) continue;
                enemies.push(child);
            } catch(e) {}
        }
        targetCount = enemies.length;
        const countEl = document.getElementById('accelCount');
        if (countEl) countEl.innerText = targetCount;

        // ─── Aim assist ──────────────────────────────────────
        lockedTarget = null;
        let isAimAligned = false;
        const isAiming = rightMouse || settings.lockMode;

        if (settings.aimbot && isAiming) {
            let bestTarget = null;
            let minAngle = settings.aimFov;
            const currentYaw = myPlayer.rotation.y;
            const currentPitch = myPlayer.children[0].rotation.x;
            const eyePos = new Vector3(
                myPlayer.position.x,
                myPlayer.position.y + settings.camOffset,
                myPlayer.position.z
            );

            let bestDyaw = 0, bestDpitch = 0;

            for (const p of enemies) {
                const dx = p.position.x - eyePos.x;
                const dy = (p.position.y + settings.aimOffset) - eyePos.y;
                const dz = p.position.z - eyePos.z;
                const distXZ = Math.sqrt(dx*dx + dz*dz);
                if (distXZ < 2) continue;

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
                lockedTarget = bestTarget;
                if (!settings.silentAim) {
                    myPlayer.rotation.y += bestDyaw * settings.smoothing;
                    myPlayer.children[0].rotation.x += bestDpitch * settings.smoothing;
                }
                if (minAngle < 0.2) {
                    isAimAligned = true;
                }
            }
        }

        // ─── Anti-Recoil ──────────────────────────────────────────
        if (settings.antiRecoil && settings.aimbot && isAiming && lockedTarget && isAimAligned) {
            const currentPitch = myPlayer.children[0].rotation.x;
            const targetPitch = Math.atan2(
                (lockedTarget.position.y + settings.aimOffset) - (myPlayer.position.y + settings.camOffset),
                Math.sqrt(
                    (lockedTarget.position.x - myPlayer.position.x) ** 2 +
                    (lockedTarget.position.z - myPlayer.position.z) ** 2
                )
            );
            const pitchDiff = targetPitch - currentPitch;
            if (pitchDiff < -0.02) {
                myPlayer.children[0].rotation.x += pitchDiff * 0.08 * settings.recoilStrength;
            }
        }

        // ─── Auto shoot ──────────────────────────────────────
        if (settings.autoShoot && lockedTarget && isAimAligned) {
            if (burstCount >= settings.burstLength) {
                if (now - burstTimer < settings.burstPause) {
                    // skip
                } else {
                    burstCount = 0;
                }
            }
            if (burstCount < settings.burstLength) {
                triggerShoot();
                burstCount++;
                burstTimer = now;
            }
        } else {
            burstCount = 0;
        }

        // ─── ESP ──────────────────────────────────────────────
        if (settings.espEnabled) {
            if (settings.drawFov) {
                ctx.beginPath();
                ctx.arc(canvas.width/2, canvas.height/2, (canvas.height/2) * (settings.aimFov / 2.2), 0, 2*Math.PI);
                ctx.strokeStyle = "rgba(0, 243, 255, 0.12)";
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            for (const p of enemies) {
                try {
                    const color = (p === lockedTarget) ? "#ffff00" : "#ff3333";

                    const head = new Vector3(p.position.x, p.position.y + 10.5, p.position.z);
                    head.project(camera);
                    const foot = new Vector3(p.position.x, p.position.y, p.position.z);
                    foot.project(camera);

                    if (head.z > 1) continue;

                    const top = (-head.y * 0.5 + 0.5) * canvas.height;
                    const bot = (-foot.y * 0.5 + 0.5) * canvas.height;
                    const h = bot - top;
                    const w = h * 0.6;
                    const x = (head.x * 0.5 + 0.5) * canvas.width;

                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(x - w/2, top, w, h);

                    if (p === lockedTarget) {
                        const aimPoint = new Vector3(p.position.x, p.position.y + settings.aimOffset, p.position.z);
                        aimPoint.project(camera);
                        const aimY = (-aimPoint.y * 0.5 + 0.5) * canvas.height;
                        ctx.fillStyle = "#ff0";
                        ctx.beginPath();
                        ctx.arc(x, aimY, 4, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    if (settings.drawLines) {
                        ctx.beginPath();
                        ctx.moveTo(canvas.width / 2, canvas.height);
                        ctx.lineTo(x, bot);
                        ctx.strokeStyle = "rgba(0, 243, 255, 0.3)";
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }

                    if (settings.showDist) {
                        const dx = p.position.x - myPlayer.position.x;
                        const dy = p.position.y - myPlayer.position.y;
                        const dz = p.position.z - myPlayer.position.z;
                        const dist = Math.round(Math.sqrt(dx*dx + dy*dy + dz*dz));

                        if (dist <= settings.maxDistShow) {
                            const text = `${dist}m`;
                            ctx.font = "bold 10px 'Segoe UI', Verdana";
                            ctx.textAlign = "center";
                            const tw = ctx.measureText(text).width;
                            ctx.fillStyle = "rgba(10, 15, 30, 0.7)";
                            ctx.fillRect(x - tw/2 - 4, top - 18, tw + 8, 16);
                            ctx.fillStyle = "#00f3ff";
                            ctx.fillText(text, x, top - 6);
                        }
                    }
                } catch(e) {}
            }

            // ─── Radar ──────────────────────────────────────────
            if (settings.radarEnabled && radarCanvas) {
                const size = settings.radarSize || 140;
                const rc = radarCanvas.getContext('2d');
                rc.clearRect(0, 0, size, size);

                const cx = size/2, cy = size/2;

                rc.fillStyle = 'rgba(10,12,20,0.6)';
                rc.beginPath();
                rc.arc(cx, cy, size/2, 0, 2*Math.PI);
                rc.fill();

                rc.strokeStyle = 'rgba(255,255,255,0.03)';
                rc.lineWidth = 0.5;
                for (let r = 1; r <= 3; r++) {
                    rc.beginPath();
                    rc.arc(cx, cy, (r/3) * size/2, 0, 2*Math.PI);
                    rc.stroke();
                }

                rc.fillStyle = '#00cec9';
                rc.shadowColor = '#00cec9';
                rc.shadowBlur = 12;
                rc.beginPath();
                rc.arc(cx, cy, 3, 0, 2*Math.PI);
                rc.fill();
                rc.shadowBlur = 0;

                if (myPlayer) {
                    const playerPos = myPlayer.position;
                    const myRot = myPlayer.rotation.y;
                    for (const p of enemies) {
                        const dx = p.position.x - playerPos.x;
                        const dz = p.position.z - playerPos.z;
                        const dist = Math.sqrt(dx*dx + dz*dz);
                        if (dist > 100) continue;
                        const angle = Math.atan2(dz, dx) - myRot;
                        const r = Math.min(size/2 - 6, (dist / 100) * size/2);
                        const ex = cx + Math.sin(angle) * r;
                        const ey = cy - Math.cos(angle) * r;
                        const isLocked = (p === lockedTarget);
                        rc.fillStyle = isLocked ? '#fdcb6e' : '#ff6b6b';
                        rc.shadowColor = isLocked ? '#fdcb6e' : '#ff6b6b';
                        rc.shadowBlur = isLocked ? 16 : 8;
                        rc.beginPath();
                        rc.arc(ex, ey, isLocked ? 4 : 2.5, 0, 2*Math.PI);
                        rc.fill();
                        rc.shadowBlur = 0;
                    }
                }
            }
        }

        // ─── Stealth mode ──────────────────────────────────────
        if (settings.stealthMode) {
            canvas.style.opacity = (targetCount === 0 && !lockedTarget) ? '0.01' : '0.99';
        } else {
            canvas.style.opacity = '0.99';
        }

        // ─── Status dot ──────────────────────────────────────────
        const dot = document.getElementById('statusDot');
        const label = document.getElementById('statusLabel');
        if (lockedTarget && isAimAligned) {
            dot.style.background = '#ff6b6b';
            dot.style.boxShadow = '0 0 16px rgba(255,107,107,0.5)';
            label.innerText = 'firing';
        } else if (lockedTarget) {
            dot.style.background = '#fdcb6e';
            dot.style.boxShadow = '0 0 12px rgba(253,203,110,0.4)';
            label.innerText = 'locked';
        } else if (targetCount > 0) {
            dot.style.background = '#00cec9';
            dot.style.boxShadow = '0 0 12px rgba(0,206,201,0.4)';
            label.innerText = 'tracking';
        } else {
            dot.style.background = 'rgba(255,255,255,0.12)';
            dot.style.boxShadow = 'none';
            label.innerText = 'idle';
        }

        // ─── BHOP indicator ──────────────────────────────────────
        if (settings.autoBhop && keys['Space'] && myPlayer && myPlayer.velocity) {
            // Visual feedback for bhop
            // Could add a small indicator, but keeping it clean
            if (myPlayer.velocity.y > 0) {
                // Player is jumping via bhop
                // We could show a small icon, but leaving it subtle
            }
        }
    }

    // ─── START LOOP ──────────────────────────────────────────
    animate();

    // ─── EXPOSE ──────────────────────────────────────────────
    window.__ACCEL_LOADED = true;
    window.__ACCEL = { settings, saveSettings };
})();
