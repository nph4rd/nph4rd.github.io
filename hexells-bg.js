// Hexells-inspired background animation
// Reaction-diffusion on a hex grid, rendered via WebGL
// Catppuccin Latte palette

(function () {
  'use strict';

  const VSRC = `
    attribute vec2 a_pos;
    void main() {
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  // Simulation step: Gray-Scott reaction-diffusion on hex grid
  // Uses float textures for precision so patterns don't quantize away
  const SIM_FRAG = `
    precision highp float;
    uniform sampler2D u_state;
    uniform vec2 u_size;
    uniform float u_seed;
    uniform float u_time;

    float hash(vec3 p) {
      p = fract(p * vec3(0.1031, 0.1030, 0.0973));
      p += dot(p, p.yzx + 33.33);
      return fract((p.x + p.y) * p.z);
    }

    vec4 tex(vec2 p) {
      return texture2D(u_state, fract(p / u_size));
    }

    void main() {
      vec2 xy = gl_FragCoord.xy;
      vec2 uv = xy / u_size;

      float row = floor(xy.y);
      float odd = mod(row, 2.0);

      vec4 s = tex(xy);
      vec4 n0 = tex(xy + vec2(-1.0, 0.0));
      vec4 n1 = tex(xy + vec2(1.0, 0.0));
      vec4 n2 = tex(xy + vec2(-1.0 + odd, 1.0));
      vec4 n3 = tex(xy + vec2(odd, 1.0));
      vec4 n4 = tex(xy + vec2(-1.0 + odd, -1.0));
      vec4 n5 = tex(xy + vec2(odd, -1.0));

      vec4 avg = (n0 + n1 + n2 + n3 + n4 + n5) / 6.0;

      float a = s.x;
      float b = s.y;
      float phase = s.z;

      // Slowly drifting feed/kill in the "worms/maze" regime
      // Tighter range to avoid drifting into spots/solitons
      float t = u_time * 0.03;
      float spatialVar = sin(uv.x * 4.0 + t) * cos(uv.y * 3.0 - t * 0.7);

      float feed = 0.030 + 0.002 * sin(t * 0.41 + spatialVar);
      float kill = 0.057 + 0.001 * cos(t * 0.31 + spatialVar * 1.3);

      float Da = 0.21;
      float Db = 0.105;
      float dt = 0.95;

      float lapA = avg.x - a;
      float lapB = avg.y - b;

      float ab2 = a * b * b;
      float na = a + dt * (Da * lapA - ab2 + feed * (1.0 - a));
      float nb = b + dt * (Db * lapB + ab2 - (kill + feed) * b);

      // Color phase: slow diffusion + gentle drift
      float lapPhase = avg.z - phase;
      float nPhase = phase + 0.02 * lapPhase + 0.0003 * sin(t * 0.7 + phase * 6.2832);
      nPhase = fract(nPhase);

      // Rare seeding: inject b near existing activity to grow
      // connected structures rather than isolated singletons
      float r = hash(vec3(xy, u_seed));
      float r2 = hash(vec3(xy + 71.0, u_seed + 137.0));
      if (r > 0.9995 && avg.y > 0.01) {
        nb = max(nb, 0.15 + r2 * 0.15);
        na = min(na, 0.7);
      }

      gl_FragColor = vec4(clamp(na, 0.0, 1.0), clamp(nb, 0.0, 1.0), nPhase, 1.0);
    }
  `;

  // Visualization: map state to hex cells with Catppuccin colors
  const VIS_FRAG = `
    precision highp float;
    uniform sampler2D u_state;
    uniform vec2 u_size;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_opacity;

    // Catppuccin Latte
    const vec3 c_base     = vec3(0.937, 0.945, 0.961);
    const vec3 c_mantle   = vec3(0.902, 0.914, 0.937);
    const vec3 c_surface0 = vec3(0.800, 0.816, 0.855);
    const vec3 c_lavender = vec3(0.447, 0.529, 0.992);
    const vec3 c_sapphire = vec3(0.125, 0.624, 0.710);
    const vec3 c_teal     = vec3(0.090, 0.573, 0.600);
    const vec3 c_mauve    = vec3(0.533, 0.224, 0.937);
    const vec3 c_pink     = vec3(0.918, 0.463, 0.796);
    const vec3 c_sky      = vec3(0.016, 0.647, 0.898);
    const vec3 c_overlay0 = vec3(0.612, 0.627, 0.690);

    vec4 getHex(vec2 u) {
      vec2 s = vec2(1.0, 1.732);
      vec2 p = vec2(0.5, 0.5);
      vec2 a = mod(u, s) * 2.0 - s;
      vec2 b = mod(u + s * p, s) * 2.0 - s;
      vec2 ai = floor(u / s);
      vec2 bi = floor(u / s + p);
      ai = vec2(ai.x - ai.y * 1.0, ai.y * 2.0 + 1.0);
      bi = vec2(bi.x - bi.y * 1.0, bi.y * 2.0);
      return dot(a, a) < dot(b, b) ? vec4(a, ai) : vec4(b, bi);
    }

    float hexDist(vec2 p) {
      p = abs(p);
      return max(dot(p, vec2(0.5, 0.866)), p.x);
    }

    vec3 palette(float t) {
      // Much lighter palette - blend accent colors with base
      // so even the strongest colors stay pastel
      vec3 lightLavender = mix(c_base, c_lavender, 0.35);
      vec3 lightSapphire = mix(c_base, c_sapphire, 0.3);
      vec3 lightTeal     = mix(c_base, c_teal, 0.3);
      vec3 lightMauve    = mix(c_base, c_mauve, 0.25);
      vec3 lightPink     = mix(c_base, c_pink, 0.25);

      if (t < 0.2) return mix(c_base, c_mantle, t / 0.2);
      if (t < 0.4) return mix(c_mantle, lightLavender, (t - 0.2) / 0.2);
      if (t < 0.6) return mix(lightLavender, lightSapphire, (t - 0.4) / 0.2);
      if (t < 0.8) return mix(lightSapphire, lightTeal, (t - 0.6) / 0.2);
      if (t < 0.9) return mix(lightTeal, lightMauve, (t - 0.8) / 0.1);
      return mix(lightMauve, lightPink, (t - 0.9) / 0.1);
    }

    void main() {
      float scale = min(u_resolution.x, u_resolution.y) / 55.0;
      vec2 hexUV = gl_FragCoord.xy / scale;

      vec4 h = getHex(hexUV);
      vec2 cellId = h.zw;
      vec2 cellPos = h.xy;

      vec2 simUV = fract(cellId / u_size);
      vec4 state = texture2D(u_state, simUV);

      // Use both channels for richer gradients: b for intensity,
      // a's deviation from 1.0 adds subtle variation
      float val = state.y * 2.0 + (1.0 - state.x) * 0.5;

      float dist = hexDist(cellPos);
      float border = smoothstep(0.85, 0.9, dist);

      vec3 cellColor = palette(clamp(val, 0.0, 1.0));

      vec3 borderColor = c_overlay0 * 0.3 + c_base * 0.7;
      vec3 color = mix(cellColor, borderColor, border * 0.4);

      vec3 final = mix(c_base, color, u_opacity);
      gl_FragColor = vec4(final, 1.0);
    }
  `;

  function createShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Hexells shader error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function createProgram(gl, vSrc, fSrc) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vSrc);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('Hexells link error:', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  function createFBO(gl, w, h, useFloat, data) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    if (useFloat) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.FLOAT, data);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    }
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo };
  }

  function init() {
    const canvas = document.getElementById('hexells-bg');
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) return;

    // Float textures for precision - critical to prevent pattern die-off
    const floatExt = gl.getExtension('OES_texture_float');
    const useFloat = !!floatExt;
    if (useFloat) {
      gl.getExtension('WEBGL_color_buffer_float');
    }

    const simProg = createProgram(gl, VSRC, SIM_FRAG);
    const visProg = createProgram(gl, VSRC, VIS_FRAG);
    if (!simProg || !visProg) return;

    // Fullscreen quad
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    // Simulation grid
    const SIM_W = 128, SIM_H = 128;

    // Initialize with float data: a=1.0 everywhere, b=0.0, then seed spots
    const initData = new Float32Array(SIM_W * SIM_H * 4);
    for (let i = 0; i < SIM_W * SIM_H; i++) {
      initData[i * 4 + 0] = 1.0; // a
      initData[i * 4 + 1] = 0.0; // b
      initData[i * 4 + 2] = Math.random(); // random color phase
      initData[i * 4 + 3] = 1.0;
    }

    // Seed many initial spots spread across the grid
    for (let k = 0; k < 30; k++) {
      const cx = Math.floor(Math.random() * SIM_W);
      const cy = Math.floor(Math.random() * SIM_H);
      const r = 2 + Math.floor(Math.random() * 3);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) {
            const x = (cx + dx + SIM_W) % SIM_W;
            const y = (cy + dy + SIM_H) % SIM_H;
            const idx = (y * SIM_W + x) * 4;
            initData[idx + 0] = 0.5;
            initData[idx + 1] = 0.25;
          }
        }
      }
    }

    let fbo0, fbo1;
    if (useFloat) {
      fbo0 = createFBO(gl, SIM_W, SIM_H, true, initData);
      fbo1 = createFBO(gl, SIM_W, SIM_H, true, null);
    } else {
      // Fallback: pack into bytes
      const byteData = new Uint8Array(SIM_W * SIM_H * 4);
      for (let i = 0; i < initData.length; i++) {
        byteData[i] = Math.round(initData[i] * 255);
      }
      fbo0 = createFBO(gl, SIM_W, SIM_H, false, byteData);
      fbo1 = createFBO(gl, SIM_W, SIM_H, false, null);
    }

    const simLocs = {
      a_pos: gl.getAttribLocation(simProg, 'a_pos'),
      u_state: gl.getUniformLocation(simProg, 'u_state'),
      u_size: gl.getUniformLocation(simProg, 'u_size'),
      u_seed: gl.getUniformLocation(simProg, 'u_seed'),
      u_time: gl.getUniformLocation(simProg, 'u_time'),
    };

    const visLocs = {
      a_pos: gl.getAttribLocation(visProg, 'a_pos'),
      u_state: gl.getUniformLocation(visProg, 'u_state'),
      u_size: gl.getUniformLocation(visProg, 'u_size'),
      u_resolution: gl.getUniformLocation(visProg, 'u_resolution'),
      u_time: gl.getUniformLocation(visProg, 'u_time'),
      u_opacity: gl.getUniformLocation(visProg, 'u_opacity'),
    };

    let frame = 0;
    let lastTime = 0;
    const TARGET_INTERVAL = 1000 / 30;
    let animId = null;
    let isVisible = true;

    document.addEventListener('visibilitychange', () => {
      isVisible = !document.hidden;
      if (isVisible && !animId) {
        lastTime = performance.now();
        animId = requestAnimationFrame(render);
      }
    });

    function render(now) {
      if (!isVisible) {
        animId = null;
        return;
      }
      animId = requestAnimationFrame(render);
      if (now - lastTime < TARGET_INTERVAL) return;
      lastTime = now;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);

      // Run multiple sim steps per frame
      const stepsPerFrame = 4;
      for (let s = 0; s < stepsPerFrame; s++) {
        gl.useProgram(simProg);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo1.fbo);
        gl.viewport(0, 0, SIM_W, SIM_H);

        gl.enableVertexAttribArray(simLocs.a_pos);
        gl.vertexAttribPointer(simLocs.a_pos, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fbo0.tex);
        gl.uniform1i(simLocs.u_state, 0);
        gl.uniform2f(simLocs.u_size, SIM_W, SIM_H);
        gl.uniform1f(simLocs.u_seed, frame * stepsPerFrame + s + Math.random() * 10000);
        gl.uniform1f(simLocs.u_time, now * 0.001);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        const tmp = fbo0;
        fbo0 = fbo1;
        fbo1 = tmp;
      }

      // Visualization pass
      gl.useProgram(visProg);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);

      gl.enableVertexAttribArray(visLocs.a_pos);
      gl.vertexAttribPointer(visLocs.a_pos, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fbo0.tex);
      gl.uniform1i(visLocs.u_state, 0);
      gl.uniform2f(visLocs.u_size, SIM_W, SIM_H);
      gl.uniform2f(visLocs.u_resolution, canvas.width, canvas.height);
      gl.uniform1f(visLocs.u_time, now * 0.001);
      gl.uniform1f(visLocs.u_opacity, 0.5);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      frame++;
    }

    animId = requestAnimationFrame(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
