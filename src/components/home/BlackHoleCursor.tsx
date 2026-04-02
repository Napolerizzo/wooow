'use client';

import { useEffect, useRef } from 'react';

const VERT = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform vec2  uResolution;
uniform vec2  uMouse;
uniform float uTime;
uniform vec2  uShockwaveOrigin;
uniform float uShockwaveTime;

#define PI 3.14159265358979

// Returns UV distorted by the vortex
vec2 vortexDistort(vec2 uv, vec2 center, float strength, float radius) {
  vec2 d = uv - center;
  float dist = length(d);
  float falloff = exp(-dist * dist / (radius * radius));
  float angle = strength * falloff;
  float s = sin(angle);
  float c = cos(angle);
  vec2 rotated = vec2(
    d.x * c - d.y * s,
    d.x * s + d.y * c
  );
  return center + rotated;
}

// Shockwave ring
float shockwave(vec2 uv, vec2 origin, float t) {
  if (t <= 0.0) return 0.0;
  float speed = 0.6;
  float radius = t * speed;
  float dist = length(uv - origin);
  float ring = smoothstep(0.04, 0.0, abs(dist - radius));
  float fade = 1.0 - smoothstep(0.5, 1.2, t);
  return ring * fade * 0.3;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  // Flip Y (WebGL vs screen coords)
  vec2 mouseNorm = vec2(uMouse.x / uResolution.x, 1.0 - uMouse.y / uResolution.y);
  vec2 shockNorm = vec2(uShockwaveOrigin.x / uResolution.x, 1.0 - uShockwaveOrigin.y / uResolution.y);

  // Vortex distortion
  float vStrength = -4.0 + sin(uTime * 0.4) * 0.8;
  float vRadius = 0.18;
  vec2 distUV = vortexDistort(uv, mouseNorm, vStrength, vRadius);

  // Sample "scene" as just a very subtle dark field (the scene renders behind us)
  // Create a faint radial glow at cursor
  float d = length(distUV - mouseNorm);
  float glow = 0.0015 / (d * d + 0.0002);

  // Nebula tendrils: polar noise lines
  vec2 delta = uv - mouseNorm;
  float r = length(delta);
  float theta = atan(delta.y, delta.x);
  float tendrils = 0.0;
  for (int k = 1; k <= 3; k++) {
    float kf = float(k);
    tendrils += sin(theta * kf * 3.0 + uTime * (0.3 + kf * 0.1) + r * 12.0) * 0.5 + 0.5;
  }
  tendrils /= 3.0;
  float tendrilMask = exp(-r * r / 0.06) * tendrils * 0.08;

  // Shockwave
  float sw = shockwave(uv, shockNorm, uShockwaveTime);

  // Accumulate
  float luma = glow * 0.4 + tendrilMask + sw;
  vec3 color = mix(vec3(0.03, 0.03, 0.05), vec3(0.7, 0.85, 1.0), luma);

  gl_FragColor = vec4(color, min(luma * 3.0, 0.55));
}
`;

export default function BlackHoleCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true });
    if (!gl) return;

    let animId = 0;
    const mouse = { x: 0, y: 0 };
    let shock = { x: 0, y: 0, t: -1 };

    function resize() {
      if (!canvas) return;
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      gl!.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    // Fullscreen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uRes   = gl.getUniformLocation(prog, 'uResolution');
    const uMou   = gl.getUniformLocation(prog, 'uMouse');
    const uTim   = gl.getUniformLocation(prog, 'uTime');
    const uSWO   = gl.getUniformLocation(prog, 'uShockwaveOrigin');
    const uSWT   = gl.getUniformLocation(prog, 'uShockwaveTime');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const start = performance.now();

    function frame() {
      const t = (performance.now() - start) / 1000;
      const swAge = shock.t >= 0 ? t - shock.t : -1;

      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);

      gl!.uniform2f(uRes, canvas!.width, canvas!.height);
      gl!.uniform2f(uMou, mouse.x, mouse.y);
      gl!.uniform1f(uTim, t);
      gl!.uniform2f(uSWO, shock.x, shock.y);
      gl!.uniform1f(uSWT, swAge);

      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      animId = requestAnimationFrame(frame);
    }
    animId = requestAnimationFrame(frame);

    function onMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }
    function onClick(e: MouseEvent) {
      shock = { x: e.clientX, y: e.clientY, t: (performance.now() - start) / 1000 };
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('click', onClick);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
      }}
      aria-hidden="true"
    />
  );
}
