'use client';

import { useEffect, useRef } from 'react';

export default function DatamoshScroll() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) return;

    let animId = 0;
    let glitchTime = 0;

    function resize() {
      if (!canvas) return;
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      gl!.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    const VERT = `
      attribute vec2 pos;
      void main() { gl_Position = vec4(pos, 0.0, 1.0); }
    `;
    const FRAG = `
      precision mediump float;
      uniform vec2  uRes;
      uniform float uDisplace;
      uniform float uTime;
      uniform sampler2D uTex;

      void main() {
        vec2 uv = gl_FragCoord.xy / uRes;
        // Pixel row displacement
        float rowNoise = sin(uv.y * 80.0 + uTime * 10.0) * 0.5 + 0.5;
        float dispX = uDisplace * rowNoise * 0.04;
        vec2 sampleUV = uv + vec2(dispX, 0.0);
        vec4 c = texture2D(uTex, sampleUV);
        gl_FragColor = vec4(c.rgb, c.a * uDisplace);
      }
    `;

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

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, 'pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uDis = gl.getUniformLocation(prog, 'uDisplace');
    const uTim = gl.getUniformLocation(prog, 'uTime');
    const uTex = gl.getUniformLocation(prog, 'uTex');

    // Create a simple noise texture
    const texData = new Uint8Array(256 * 256 * 4);
    for (let i = 0; i < texData.length; i += 4) {
      const v = Math.random() * 30;
      texData[i] = texData[i+1] = texData[i+2] = v;
      texData[i+3] = 255;
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, texData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.uniform1i(uTex, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const start = performance.now();

    function frame() {
      const t = (performance.now() - start) / 1000;
      glitchTime = Math.max(0, glitchTime - 0.05);

      gl!.clearColor(0,0,0,0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.uniform2f(uRes, canvas!.width, canvas!.height);
      gl!.uniform1f(uDis, glitchTime);
      gl!.uniform1f(uTim, t);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);

      animId = requestAnimationFrame(frame);
    }
    animId = requestAnimationFrame(frame);

    function onWheel(e: WheelEvent) {
      glitchTime = Math.min(1, glitchTime + Math.min(Math.abs(e.deltaY) * 0.002, 0.4));
      activeRef.current = true;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        activeRef.current = false;
      }, 300);
    }

    window.addEventListener('wheel', onWheel, { passive: true });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
      }}
      aria-hidden="true"
    />
  );
}
