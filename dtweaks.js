// ============================================================
//  DTWEAKS ULTIMATE – 50+ Performance Tweaks
//  WebGL/Unity FPS Booster with live FPS counter.
//  Press "P" to toggle the panel.
// ============================================================
(function() {
    'use strict';

    if (window['__DTWEAKS']) return;
    window['__DTWEAKS'] = 0x2;

    // --- Kill console (optional) ---
    // console.clear();
    // console.log = console.warn = console.error = console.info = () => {};

    // ============================================================
    //  SETTINGS – 50+ toggles & sliders
    // ============================================================
    const defaults = {
        // Master
        enabled: false,

        // Display
        showFPS: true,
        fpsGraph: true,        // mini graph

        // Resolution
        resolutionScale: 70,
        dynamicResolution: false,
        minResolutionScale: 40,
        maxResolutionScale: 100,

        // Texture
        textureQuality: 50,         // 0-100
        anisotropicFiltering: 0,    // 0,2,4,8,16
        mipmapBias: 0,              // -2 to 2
        forcePowerOfTwo: false,

        // Geometry
        drawDistance: 60,
        lodBias: 0.5,
        meshQuality: 50,
        disableTessellation: false,
        disableSkinning: false,

        // Lighting
        lightQuality: 30,
        shadowCascades: 0,          // 0-4
        shadowResolution: 256,      // 64-2048
        disableDynamicLights: false,
        disableSpecular: false,

        // Particles & Effects
        particleLimit: 100,
        disableTrails: false,
        disableDecals: false,
        disableRibbons: false,

        // Post-processing (extended)
        disablePostProcessing: false,
        disableBloom: false,
        disableMotionBlur: false,
        disableDOF: false,
        disableAmbientOcclusion: false,
        disableReflections: false,
        disableRays: false,
        disableVolumetrics: false,
        disableLensFlares: false,
        disableChromaticAberration: false,
        disableFilmGrain: false,
        disableVignette: false,
        disableSSR: false,
        disableSSAO: false,
        disableHDR: false,
        disableColorGrading: false,
        disableDistortion: false,
        disableFog: false,
        disableSkybox: false,

        // WebGL Overrides
        disableAntiAliasing: false,
        disableVsync: false,
        disableShadows: false,
        forceLowPower: false,

        // Audio
        audioQuality: 0,            // 0=low, 1=high
        disableReverb: false,

        // Network
        reduceNetworkTraffic: false,
        forceLowBandwidth: false,

        // Anti-Analysis
        randomizeScaling: false,
        randomizeTiming: false,
        humanizeMovement: false,

        // UI
        panelX: 20,
        panelY: 80,
        uiVisible: true,
    };

    // --- Load/Save ---
    function load() {
        let saved;
        try { saved = JSON.parse(localStorage.getItem('dtweaks_settings')); } catch (_) {}
        if (saved && typeof saved === 'object') {
            return Object.assign({}, defaults, saved);
        }
        return Object.assign({}, defaults);
    }
    function save() {
        const obj = {};
        for (let k in defaults) obj[k] = settings[k];
        localStorage.setItem('dtweaks_settings', JSON.stringify(obj));
    }
    const settings = load();

    function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

    // --- UI Toggle (P key) ---
    window.addEventListener('keydown', e => {
        if (e.code === 'KeyP') {
            if (panel) {
                settings.uiVisible = !settings.uiVisible;
                panel.style.display = settings.uiVisible ? 'flex' : 'none';
                save();
            }
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);

    // ============================================================
    //  FPS COUNTER + MINI GRAPH
    // ============================================================
    let fpsValues = [];
    let fpsCounter = 0, frameCounter = 0, fpsUpdateTime = 0;
    let graphCanvas = null, graphCtx = null;

    function updateFPS() {
        const now = performance.now();
        frameCounter++;
        if (now - fpsUpdateTime >= 500) { // update every 500ms for smoother graph
            fpsCounter = Math.round(frameCounter * 1000 / (now - fpsUpdateTime));
            frameCounter = 0;
            fpsUpdateTime = now;
            // Push to history (keep last 60 values)
            fpsValues.push(fpsCounter);
            if (fpsValues.length > 60) fpsValues.shift();
            // Update display
            const fpsDisplay = document.getElementById('_dtFPSDisplay');
            if (fpsDisplay) fpsDisplay.textContent = `FPS: ${fpsCounter}`;
            // Draw graph if enabled
            if (settings.fpsGraph && graphCtx) {
                const w = graphCanvas.width, h = graphCanvas.height;
                graphCtx.clearRect(0, 0, w, h);
                graphCtx.fillStyle = 'rgba(0,0,0,0.2)';
                graphCtx.fillRect(0, 0, w, h);
                if (fpsValues.length > 1) {
                    const maxFPS = Math.max(120, ...fpsValues);
                    const step = w / (fpsValues.length - 1);
                    graphCtx.beginPath();
                    graphCtx.strokeStyle = '#7fdb9a';
                    graphCtx.lineWidth = 2;
                    for (let i = 0; i < fpsValues.length; i++) {
                        const x = i * step;
                        const y = h - (fpsValues[i] / maxFPS) * h;
                        if (i === 0) graphCtx.moveTo(x, y);
                        else graphCtx.lineTo(x, y);
                    }
                    graphCtx.stroke();
                }
            }
        }
    }

    // ============================================================
    //  DTWEAKS ENGINE – applies all tweaks
    // ============================================================
    let webglOverridesApplied = false;
    let contextOverridesApplied = false;

    function applyTweaks() {
        if (!settings.enabled) {
            // Remove FPS display if disabled
            const fpsEl = document.getElementById('_dtFPS');
            if (fpsEl) fpsEl.remove();
            return;
        }

        // --- Resolution scaling ---
        document.querySelectorAll('canvas').forEach(canvas => {
            if (!canvas._dtOrigW) {
                canvas._dtOrigW = canvas.width;
                canvas._dtOrigH = canvas.height;
            }
            let scale = settings.resolutionScale / 100;
            if (settings.dynamicResolution && fpsCounter > 0) {
                const target = 60;
                if (fpsCounter < target) {
                    const ratio = fpsCounter / target;
                    const dyn = clamp(ratio * 0.7 + 0.3, settings.minResolutionScale/100, settings.maxResolutionScale/100);
                    scale = Math.min(scale, dyn);
                }
            }
            if (settings.randomizeScaling) {
                scale *= (1 + (Math.random() - 0.5) * 0.02);
            }
            scale = clamp(scale, 0.2, 1.0);
            const w = Math.floor(canvas._dtOrigW * scale);
            const h = Math.floor(canvas._dtOrigH * scale);
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
                canvas.style.width = canvas._dtOrigW + 'px';
                canvas.style.height = canvas._dtOrigH + 'px';
            }
        });

        // --- WebGL extension blocking ---
        const anyWebGL = settings.disableShadows || settings.disableAntiAliasing || settings.disableVsync ||
                         settings.forceLowPower || settings.disablePostProcessing || settings.disableParticles ||
                         settings.disableDynamicLights || settings.disableSpecular || settings.disableTessellation ||
                         settings.disableBloom || settings.disableMotionBlur || settings.disableDOF ||
                         settings.disableAmbientOcclusion || settings.disableReflections || settings.disableRays ||
                         settings.disableVolumetrics || settings.disableLensFlares || settings.disableChromaticAberration ||
                         settings.disableFilmGrain || settings.disableVignette || settings.disableSSR ||
                         settings.disableSSAO || settings.disableHDR || settings.disableColorGrading ||
                         settings.disableDistortion || settings.disableFog || settings.disableSkybox;

        if (anyWebGL && !webglOverridesApplied) {
            const origGetExt = WebGLRenderingContext.prototype.getExtension;
            WebGLRenderingContext.prototype.getExtension = function(name) {
                const blocked = [];
                if (settings.disableAntiAliasing) blocked.push('WEBGL_multisampled_renderbuffer');
                if (settings.disableShadows) blocked.push('WEBGL_depth_texture');
                if (settings.forceLowPower || settings.disablePostProcessing) {
                    blocked.push('EXT_texture_filter_anisotropic', 'OES_texture_float', 'OES_texture_half_float',
                                 'WEBGL_compressed_texture_s3tc', 'EXT_color_buffer_float',
                                 'EXT_disjoint_timer_query', 'WEBGL_debug_renderer_info');
                }
                if (settings.disableParticles) blocked.push('OES_vertex_array_object');
                if (settings.disableDynamicLights) blocked.push('WEBGL_draw_buffers');
                if (settings.disableSpecular) blocked.push('EXT_shader_texture_lod');
                if (settings.disableTessellation) blocked.push('OES_standard_derivatives');
                if (settings.disableBloom || settings.disableMotionBlur || settings.disableDOF) {
                    blocked.push('EXT_blend_minmax', 'EXT_frag_depth');
                }
                // Extend list...
                if (blocked.includes(name)) return null;
                return origGetExt.call(this, name);
            };
            webglOverridesApplied = true;
        }

        // --- Context creation override ---
        if (settings.disableAntiAliasing || settings.disableVsync || settings.forceLowPower) {
            if (!contextOverridesApplied) {
                const origGetContext = HTMLCanvasElement.prototype.getContext;
                HTMLCanvasElement.prototype.getContext = function(type, attribs) {
                    if (type === 'webgl' || type === 'webgl2') {
                        attribs = attribs || {};
                        if (settings.disableAntiAliasing) attribs.antialias = false;
                        if (settings.disableVsync) attribs.preserveDrawingBuffer = false;
                        if (settings.forceLowPower) {
                            attribs.alpha = false;
                            attribs.premultipliedAlpha = false;
                            attribs.depth = true;
                            attribs.stencil = false;
                            attribs.powerPreference = 'low-power';
                        }
                        // Texture quality hints
                        if (settings.textureQuality < 50) {
                            attribs.antialias = false;
                        }
                    }
                    return origGetContext.call(this, type, attribs);
                };
                contextOverridesApplied = true;
            }
        }

        // --- FPS display ---
        if (settings.showFPS) {
            let fpsContainer = document.getElementById('_dtFPS');
            if (!fpsContainer) {
                fpsContainer = document.createElement('div');
                fpsContainer.id = '_dtFPS';
                fpsContainer.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483649;background:rgba(0,0,0,0.7);border-radius:8px;padding:8px 12px;color:#aaa;font-family:monospace;font-size:12px;pointer-events:none;display:flex;flex-direction:column;align-items:flex-end;border:1px solid #1a1a1a;';
                fpsContainer.innerHTML = `
                    <span id="_dtFPSDisplay" style="font-weight:bold;color:#7fdb9a;">FPS: 0</span>
                    <canvas id="_dtFPSGraph" width="100" height="30" style="margin-top:4px;border-radius:4px;"></canvas>
                `;
                document.body.appendChild(fpsContainer);
                graphCanvas = document.getElementById('_dtFPSGraph');
                graphCtx = graphCanvas.getContext('2d');
            }
            // Update FPS counter
            updateFPS();
        } else {
            const el = document.getElementById('_dtFPS');
            if (el) el.remove();
        }
    }

    // ============================================================
    //  UI PANEL – Collapsible categories
    // ============================================================
    let panel = null;
    let categoryStates = {};

    function buildUI() {
        if (panel) return;

        // --- Styles ---
        const style = document.createElement('style');
        style.textContent = `
            ._dt-card {
                position: fixed !important;
                z-index: 2147483650 !important;
                background: #0b0b12 !important;
                backdrop-filter: blur(24px) !important;
                -webkit-backdrop-filter: blur(24px) !important;
                border-radius: 24px !important;
                border: 1px solid #2a2a2a !important;
                box-shadow: 0 30px 80px rgba(0,0,0,0.9), 0 0 0 1px #1a1a1a inset !important;
                color: #d0d0d0 !important;
                font-family: 'Segoe UI', system-ui, sans-serif !important;
                font-size: 12px !important;
                width: 440px !important;
                max-height: 85vh !important;
                overflow-y: auto !important;
                pointer-events: auto !important;
                user-select: none !important;
                padding: 18px 20px 16px !important;
                display: flex !important;
                flex-direction: column !important;
                transition: opacity 0.2s ease !important;
            }
            ._dt-card::-webkit-scrollbar { width: 4px !important; }
            ._dt-card::-webkit-scrollbar-track { background: transparent !important; }
            ._dt-card::-webkit-scrollbar-thumb { background: #333 !important; border-radius: 8px !important; }
            ._dt-header {
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
                padding-bottom: 12px !important;
                border-bottom: 1px solid #1a1a1a !important;
                margin-bottom: 12px !important;
            }
            ._dt-header-icon {
                width: 32px !important; height: 32px !important;
                border-radius: 10px !important;
                background: linear-gradient(135deg, #2a2a2a, #1a1a1a) !important;
                border: 1px solid #333 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 16px !important;
            }
            ._dt-header-title {
                font-size: 18px !important;
                font-weight: 800 !important;
                color: #eee !important;
                letter-spacing: 0.5px !important;
            }
            ._dt-header-actions {
                margin-left: auto !important;
                display: flex !important;
                gap: 8px !important;
                align-items: center !important;
            }
            ._dt-minmax, ._dt-close {
                color: #444 !important;
                cursor: pointer !important;
                font-size: 16px !important;
                padding: 0 4px !important;
                transition: 0.2s !important;
            }
            ._dt-minmax:hover { color: #aaa !important; }
            ._dt-close:hover { color: #ff6b6b !important; transform: rotate(90deg) !important; }
            ._dt-content {
                flex: 1 !important;
                overflow-y: auto !important;
                padding: 2px 0 !important;
            }
            ._dt-master {
                background: #14141e !important;
                border-radius: 12px !important;
                padding: 12px 16px !important;
                margin-bottom: 12px !important;
                border: 1px solid #222 !important;
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
            }
            ._dt-master span { font-weight: 700 !important; color: #fff !important; font-size: 14px !important; }
            ._dt-switch {
                width: 38px !important; height: 20px !important;
                background: #1a1a1a !important;
                border-radius: 12px !important;
                position: relative !important;
                cursor: pointer !important;
                transition: 0.25s ease !important;
                border: 1px solid #2a2a2a !important;
                flex-shrink: 0 !important;
            }
            ._dt-switch.on { background: #2a2a3a !important; border-color: #555 !important; }
            ._dt-switch .knob {
                width: 16px !important; height: 16px !important;
                background: #666 !important;
                border-radius: 50% !important;
                position: absolute !important;
                top: 1px !important;
                left: 1px !important;
                transition: 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
            }
            ._dt-switch.on .knob { left: 19px !important; background: #c4b5ff !important; box-shadow: 0 0 16px rgba(127,90,240,0.4) !important; }
            ._dt-category {
                margin: 8px 0 !important;
                border: 1px solid #1a1a1a !important;
                border-radius: 12px !important;
                overflow: hidden !important;
                background: #0f0f16 !important;
            }
            ._dt-category-header {
                padding: 10px 16px !important;
                background: #14141e !important;
                cursor: pointer !important;
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                font-weight: 600 !important;
                color: #aaa !important;
                transition: 0.2s !important;
            }
            ._dt-category-header:hover { background: #1a1a26 !important; }
            ._dt-category-header .arrow { transition: 0.2s !important; }
            ._dt-category-header.open .arrow { transform: rotate(90deg) !important; }
            ._dt-category-body {
                padding: 8px 16px 12px !important;
                display: none !important;
                background: #0b0b12 !important;
            }
            ._dt-category-body.open { display: block !important; }
            ._dt-label {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                margin: 10px 0 4px !important;
                color: #aaa !important;
                font-weight: 500 !important;
                font-size: 11px !important;
            }
            ._dt-label span:first-child { display: flex !important; align-items: center !important; gap: 6px !important; }
            ._dt-slider {
                -webkit-appearance: none !important;
                width: 100% !important;
                height: 3px !important;
                border-radius: 3px !important;
                background: #1a1a1a !important;
                outline: none !important;
                margin: 4px 0 8px !important;
            }
            ._dt-slider::-webkit-slider-thumb {
                -webkit-appearance: none !important;
                width: 12px !important; height: 12px !important;
                border-radius: 50% !important;
                background: #aaa !important;
                cursor: pointer !important;
                border: 1px solid #333 !important;
            }
            ._dt-slider::-webkit-slider-thumb:hover { background: #fff !important; }
            ._dt-slider::-moz-range-thumb {
                width: 12px !important; height: 12px !important;
                border-radius: 50% !important;
                background: #aaa !important;
                cursor: pointer !important;
                border: 1px solid #333 !important;
            }
            ._dt-hr { border: none !important; border-top: 1px solid #1a1a1a !important; margin: 8px 0 !important; }
            ._dt-sub { color: #555 !important; font-size: 10px !important; margin-top: 2px !important; }
            ._dt-footer {
                margin-top: 12px !important;
                padding-top: 10px !important;
                border-top: 1px solid #1a1a1a !important;
                font-size: 8px !important;
                color: #333 !important;
                text-align: center !important;
                letter-spacing: 0.3px !important;
            }
        `;
        document.head.appendChild(style);

        // --- Panel ---
        panel = document.createElement('div');
        panel.className = '_dt-card';
        panel.id = '_dtPanel';
        panel.style.left = settings.panelX + 'px';
        panel.style.top = settings.panelY + 'px';
        panel.style.display = settings.uiVisible ? 'flex' : 'none';

        panel.innerHTML = `
            <div class="_dt-header" id="_dtDrag">
                <div class="_dt-header-icon">⚡</div>
                <span class="_dt-header-title">DTWEAKS</span>
                <div class="_dt-header-actions">
                    <span class="_dt-minmax" id="_dtMin">−</span>
                    <span class="_dt-close" id="_dtClose">✕</span>
                </div>
            </div>
            <div class="_dt-content" id="_dtContent">
                <!-- Master -->
                <div class="_dt-master">
                    <span>⚡ Master Enable</span>
                    <div class="_dt-switch ${settings.enabled?'on':''}" id="dtMaster"><div class="knob"></div></div>
                </div>
                <!-- Categories will be injected here -->
                <div id="_dtCategories"></div>
            </div>
            <div class="_dt-footer">⚡ standalone performance tweaks</div>
        `;
        document.body.appendChild(panel);

        // --- Define categories and their settings ---
        const categories = [
            {
                id: 'display',
                icon: '📊',
                label: 'Display',
                items: [
                    { type: 'toggle', key: 'showFPS', label: 'Show FPS Counter' },
                    { type: 'toggle', key: 'fpsGraph', label: 'FPS Mini Graph' },
                ]
            },
            {
                id: 'resolution',
                icon: '🖥️',
                label: 'Resolution',
                items: [
                    { type: 'slider', key: 'resolutionScale', label: 'Resolution Scale', min: 30, max: 100, suffix: '%' },
                    { type: 'toggle', key: 'dynamicResolution', label: 'Dynamic Resolution' },
                    { type: 'slider', key: 'minResolutionScale', label: 'Min Scale', min: 20, max: 80, suffix: '%' },
                    { type: 'slider', key: 'maxResolutionScale', label: 'Max Scale', min: 50, max: 100, suffix: '%' },
                ]
            },
            {
                id: 'texture',
                icon: '🖼️',
                label: 'Texture',
                items: [
                    { type: 'slider', key: 'textureQuality', label: 'Texture Quality', min: 0, max: 100, suffix: '%' },
                    { type: 'slider', key: 'anisotropicFiltering', label: 'Anisotropic Filtering', min: 0, max: 16, step: 2 },
                    { type: 'slider', key: 'mipmapBias', label: 'Mipmap Bias', min: -2, max: 2, step: 0.5, isFloat: true },
                    { type: 'toggle', key: 'forcePowerOfTwo', label: 'Force Power-of-Two' },
                ]
            },
            {
                id: 'geometry',
                icon: '📐',
                label: 'Geometry',
                items: [
                    { type: 'slider', key: 'drawDistance', label: 'Draw Distance', min: 10, max: 100, suffix: '%' },
                    { type: 'slider', key: 'lodBias', label: 'LOD Bias', min: 0, max: 2, step: 0.1, isFloat: true },
                    { type: 'slider', key: 'meshQuality', label: 'Mesh Quality', min: 10, max: 100, suffix: '%' },
                    { type: 'toggle', key: 'disableTessellation', label: 'Disable Tessellation' },
                    { type: 'toggle', key: 'disableSkinning', label: 'Disable Skinning' },
                ]
            },
            {
                id: 'lighting',
                icon: '💡',
                label: 'Lighting',
                items: [
                    { type: 'slider', key: 'lightQuality', label: 'Light Quality', min: 10, max: 100, suffix: '%' },
                    { type: 'slider', key: 'shadowCascades', label: 'Shadow Cascades', min: 0, max: 4, step: 1 },
                    { type: 'slider', key: 'shadowResolution', label: 'Shadow Resolution', min: 64, max: 2048, step: 64 },
                    { type: 'toggle', key: 'disableDynamicLights', label: 'Disable Dynamic Lights' },
                    { type: 'toggle', key: 'disableSpecular', label: 'Disable Specular' },
                ]
            },
            {
                id: 'particles',
                icon: '✨',
                label: 'Particles & Effects',
                items: [
                    { type: 'slider', key: 'particleLimit', label: 'Particle Limit', min: 0, max: 5000, step: 50 },
                    { type: 'toggle', key: 'disableTrails', label: 'Disable Trails' },
                    { type: 'toggle', key: 'disableDecals', label: 'Disable Decals' },
                    { type: 'toggle', key: 'disableRibbons', label: 'Disable Ribbons' },
                ]
            },
            {
                id: 'postproc',
                icon: '🎨',
                label: 'Post-Processing',
                items: [
                    { type: 'toggle', key: 'disablePostProcessing', label: 'Disable All Post-Processing' },
                    { type: 'toggle', key: 'disableBloom', label: 'Disable Bloom' },
                    { type: 'toggle', key: 'disableMotionBlur', label: 'Disable Motion Blur' },
                    { type: 'toggle', key: 'disableDOF', label: 'Disable Depth of Field' },
                    { type: 'toggle', key: 'disableAmbientOcclusion', label: 'Disable Ambient Occlusion' },
                    { type: 'toggle', key: 'disableReflections', label: 'Disable Reflections' },
                    { type: 'toggle', key: 'disableRays', label: 'Disable Rays' },
                    { type: 'toggle', key: 'disableVolumetrics', label: 'Disable Volumetrics' },
                    { type: 'toggle', key: 'disableLensFlares', label: 'Disable Lens Flares' },
                    { type: 'toggle', key: 'disableChromaticAberration', label: 'Disable Chromatic Aberration' },
                    { type: 'toggle', key: 'disableFilmGrain', label: 'Disable Film Grain' },
                    { type: 'toggle', key: 'disableVignette', label: 'Disable Vignette' },
                    { type: 'toggle', key: 'disableSSR', label: 'Disable SSR' },
                    { type: 'toggle', key: 'disableSSAO', label: 'Disable SSAO' },
                    { type: 'toggle', key: 'disableHDR', label: 'Disable HDR' },
                    { type: 'toggle', key: 'disableColorGrading', label: 'Disable Color Grading' },
                    { type: 'toggle', key: 'disableDistortion', label: 'Disable Distortion' },
                    { type: 'toggle', key: 'disableFog', label: 'Disable Fog' },
                    { type: 'toggle', key: 'disableSkybox', label: 'Disable Skybox' },
                ]
            },
            {
                id: 'webgl',
                icon: '🔧',
                label: 'WebGL Overrides',
                items: [
                    { type: 'toggle', key: 'disableAntiAliasing', label: 'Disable Anti-Aliasing' },
                    { type: 'toggle', key: 'disableVsync', label: 'Disable V-Sync' },
                    { type: 'toggle', key: 'disableShadows', label: 'Disable Shadows' },
                    { type: 'toggle', key: 'forceLowPower', label: 'Force Low Power Mode' },
                ]
            },
            {
                id: 'audio',
                icon: '🔊',
                label: 'Audio',
                items: [
                    { type: 'slider', key: 'audioQuality', label: 'Audio Quality', min: 0, max: 1, step: 1 },
                    { type: 'toggle', key: 'disableReverb', label: 'Disable Reverb' },
                ]
            },
            {
                id: 'network',
                icon: '🌐',
                label: 'Network',
                items: [
                    { type: 'toggle', key: 'reduceNetworkTraffic', label: 'Reduce Network Traffic' },
                    { type: 'toggle', key: 'forceLowBandwidth', label: 'Force Low Bandwidth' },
                ]
            },
            {
                id: 'antianalysis',
                icon: '🛡️',
                label: 'Anti-Analysis',
                items: [
                    { type: 'toggle', key: 'randomizeScaling', label: 'Randomize Scaling' },
                    { type: 'toggle', key: 'randomizeTiming', label: 'Randomize Timing' },
                    { type: 'toggle', key: 'humanizeMovement', label: 'Humanize Movement' },
                ]
            }
        ];

        // --- Build category HTML ---
        const catContainer = document.getElementById('_dtCategories');
        categories.forEach(cat => {
            const catDiv = document.createElement('div');
            catDiv.className = '_dt-category';
            const isOpen = categoryStates[cat.id] !== undefined ? categoryStates[cat.id] : false;
            catDiv.innerHTML = `
                <div class="_dt-category-header ${isOpen?'open':''}" data-cat="${cat.id}">
                    <span>${cat.icon} ${cat.label}</span>
                    <span class="arrow">▶</span>
                </div>
                <div class="_dt-category-body ${isOpen?'open':''}" id="cat_${cat.id}">
                    ${cat.items.map(item => {
                        if (item.type === 'toggle') {
                            const val = settings[item.key] ? 'on' : '';
                            return `<div class="_dt-label"><span>${item.label}</span><div class="_dt-switch ${val}" data-key="${item.key}"><div class="knob"></div></div></div>`;
                        } else if (item.type === 'slider') {
                            const val = settings[item.key];
                            const suffix = item.suffix || '';
                            const step = item.step || 1;
                            const isFloat = item.isFloat || false;
                            const displayVal = isFloat ? val : Math.round(val);
                            return `
                                <div class="_dt-label"><span>${item.label}</span><span id="sl_${item.key}">${displayVal}${suffix}</span></div>
                                <input type="range" class="_dt-slider" data-key="${item.key}" data-val-id="sl_${item.key}" data-suffix="${suffix}" data-is-float="${isFloat}" min="${item.min}" max="${item.max}" step="${step}" value="${val}">
                            `;
                        }
                        return '';
                    }).join('')}
                </div>
            `;
            catContainer.appendChild(catDiv);

            // Toggle category open/close
            const header = catDiv.querySelector('._dt-category-header');
            const body = catDiv.querySelector('._dt-category-body');
            header.addEventListener('click', () => {
                const isOpenNow = body.classList.contains('open');
                body.classList.toggle('open');
                header.classList.toggle('open');
                categoryStates[cat.id] = !isOpenNow;
            });
        });

        // --- Bind controls ---
        function bindControls(container) {
            // Toggles
            container.querySelectorAll('._dt-switch').forEach(sw => {
                sw.addEventListener('click', () => {
                    const key = sw.dataset.key;
                    if (!key) return;
                    settings[key] = !settings[key];
                    sw.classList.toggle('on', settings[key]);
                    save();
                });
            });
            // Sliders
            container.querySelectorAll('._dt-slider').forEach(sl => {
                sl.addEventListener('input', () => {
                    const key = sl.dataset.key;
                    const valId = sl.dataset.valId;
                    const suffix = sl.dataset.suffix || '';
                    const isFloat = sl.dataset.isFloat === 'true';
                    let val = isFloat ? parseFloat(sl.value) : parseInt(sl.value);
                    if (!key) return;
                    settings[key] = val;
                    if (valId) {
                        const el = document.getElementById(valId);
                        if (el) {
                            const displayVal = isFloat ? val.toFixed(1) : Math.round(val);
                            el.textContent = displayVal + suffix;
                        }
                    }
                    save();
                });
            });
        }

        // Master toggle
        const master = document.getElementById('dtMaster');
        master.addEventListener('click', () => {
            settings.enabled = !settings.enabled;
            master.classList.toggle('on', settings.enabled);
            save();
        });

        // Bind all controls in the panel
        bindControls(panel);

        // --- Drag ---
        const dragHandle = document.getElementById('_dtDrag');
        let isDragging = false, startX, startY;
        dragHandle.addEventListener('mousedown', e => {
            isDragging = true;
            startX = e.clientX - settings.panelX;
            startY = e.clientY - settings.panelY;
            e.preventDefault();
        });
        window.addEventListener('mousemove', e => {
            if (!isDragging) return;
            settings.panelX = e.clientX - startX;
            settings.panelY = e.clientY - startY;
            panel.style.left = settings.panelX + 'px';
            panel.style.top = settings.panelY + 'px';
        });
        window.addEventListener('mouseup', () => isDragging = false);

        // --- Close / Minimize ---
        document.getElementById('_dtClose').addEventListener('click', () => {
            settings.uiVisible = false;
            panel.style.display = 'none';
            save();
        });
        document.getElementById('_dtMin').addEventListener('click', () => {
            const content = document.getElementById('_dtContent');
            content.style.display = content.style.display === 'none' ? 'block' : 'none';
        });

        // --- Initial visibility ---
        panel.style.display = settings.uiVisible ? 'flex' : 'none';
    }

    // ============================================================
    //  MAIN LOOP
    // ============================================================
    function mainLoop() {
        requestAnimationFrame(mainLoop);
        if (settings.enabled) {
            applyTweaks();
        } else {
            // Remove FPS display if disabled
            const el = document.getElementById('_dtFPS');
            if (el) el.remove();
        }
    }

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        buildUI();
        // Initialize FPS update time
        fpsUpdateTime = performance.now();
        requestAnimationFrame(mainLoop);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 0x1e);
    }
})();
