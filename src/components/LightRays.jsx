import { useEffect, useRef } from 'react'
import { Renderer, Program, Triangle, Mesh } from 'ogl'

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)

  return m
    ? [
        parseInt(m[1], 16) / 255,
        parseInt(m[2], 16) / 255,
        parseInt(m[3], 16) / 255,
      ]
    : [1, 1, 1]
}

const getAnchorAndDir = (origin, w, h) => {
  const outside = 0.2

  switch (origin) {
    case 'top-left':
      return { anchor: [0, -outside * h], dir: [0.7, 0.7] }

    case 'top-right':
      return { anchor: [w, -outside * h], dir: [-0.7, 0.7] }

    case 'left':
      return { anchor: [-outside * w, h * 0.5], dir: [1, 0] }

    case 'right':
      return {
        anchor: [(1 + outside) * w, h * 0.5],
        dir: [-1, 0],
      }

    case 'bottom-left':
      return {
        anchor: [0, (1 + outside) * h],
        dir: [0.7, -0.7],
      }

    case 'bottom-center':
      return {
        anchor: [w * 0.5, (1 + outside) * h],
        dir: [0, -1],
      }

    case 'bottom-right':
      return {
        anchor: [w, (1 + outside) * h],
        dir: [-0.7, -0.7],
      }

    default:
      return {
        anchor: [w * 0.5, -outside * h],
        dir: [0, 1],
      }
  }
}

function LightRays({
  raysOrigin = 'top-center',
  raysColor = '#3B82F6',
  raysSpeed = 0.8,
  lightSpread = 0.8,
  rayLength = 2,
  pulsating = false,
  fadeDistance = 1,
  saturation = 1,
  followMouse = true,
  mouseInfluence = 0.08,
  noiseAmount = 0.02,
  distortion = 0.02,
  className = '',
}) {
  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const animationRef = useRef(null)
  const mouseRef = useRef({ x: 0.5, y: 0.5 })

  useEffect(() => {
    const container = containerRef.current

    if (!container) return

    const renderer = new Renderer({
      dpr: Math.min(window.devicePixelRatio, 2),
      alpha: true,
      premultipliedAlpha: true,
    })

    rendererRef.current = renderer

    const gl = renderer.gl

    gl.canvas.style.width = '100%'
    gl.canvas.style.height = '100%'
    gl.canvas.style.display = 'block'

    container.innerHTML = ''
    container.appendChild(gl.canvas)

    const vertex = `
      attribute vec2 position;

      varying vec2 vUv;

      void main() {
        vUv = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `

    const fragment = `
      precision highp float;

      uniform float iTime;
      uniform vec2 iResolution;

      uniform vec2 rayPos;
      uniform vec2 rayDir;

      uniform vec3 raysColor;

      uniform float raysSpeed;
      uniform float lightSpread;
      uniform float rayLength;
      uniform float pulsating;
      uniform float fadeDistance;
      uniform float saturation;

      uniform vec2 mousePos;
      uniform float mouseInfluence;

      uniform float noiseAmount;
      uniform float distortion;

      varying vec2 vUv;

      float noise(vec2 st) {
        return fract(
          sin(dot(st.xy, vec2(12.9898, 78.233)))
          * 43758.5453123
        );
      }

      float rayStrength(
        vec2 raySource,
        vec2 rayRefDirection,
        vec2 coord,
        float seedA,
        float seedB,
        float speed
      ) {
        vec2 sourceToCoord = coord - raySource;

        vec2 dirNorm = normalize(sourceToCoord);

        float cosAngle = dot(
          dirNorm,
          rayRefDirection
        );

        float distortedAngle =
          cosAngle +
          distortion *
          sin(
            iTime * 2.0 +
            length(sourceToCoord) * 0.01
          ) *
          0.2;

        float spreadFactor = pow(
          max(distortedAngle, 0.0),
          1.0 / max(lightSpread, 0.001)
        );

        float distance = length(sourceToCoord);

        float maxDistance =
          max(iResolution.x, iResolution.y)
          * rayLength;

        float lengthFalloff =
          clamp(
            (maxDistance - distance) /
            maxDistance,
            0.0,
            1.0
          );

        float fadeFalloff =
          clamp(
            (
              iResolution.x *
              fadeDistance -
              distance
            ) /
            (
              iResolution.x *
              fadeDistance
            ),
            0.5,
            1.0
          );

        float pulse =
          pulsating > 0.5
          ? (
              0.8 +
              0.2 *
              sin(iTime * speed * 3.0)
            )
          : 1.0;

        float baseStrength = clamp(
          (
            0.45 +
            0.15 *
            sin(
              distortedAngle *
              seedA +
              iTime *
              speed
            )
          ) +
          (
            0.3 +
            0.2 *
            cos(
              -distortedAngle *
              seedB +
              iTime *
              speed
            )
          ),
          0.0,
          1.0
        );

        return
          baseStrength *
          lengthFalloff *
          fadeFalloff *
          spreadFactor *
          pulse;
      }

      void main() {

        vec2 coord = vec2(
          gl_FragCoord.x,
          iResolution.y - gl_FragCoord.y
        );

        vec2 finalRayDir = rayDir;

        if (mouseInfluence > 0.0) {

          vec2 mouseScreenPos =
            mousePos *
            iResolution.xy;

          vec2 mouseDirection =
            normalize(
              mouseScreenPos -
              rayPos
            );

          finalRayDir =
            normalize(
              mix(
                rayDir,
                mouseDirection,
                mouseInfluence
              )
            );
        }

        float rays1 =
          rayStrength(
            rayPos,
            finalRayDir,
            coord,
            36.2214,
            21.11349,
            1.5 * raysSpeed
          );

        float rays2 =
          rayStrength(
            rayPos,
            finalRayDir,
            coord,
            22.3991,
            18.0234,
            1.1 * raysSpeed
          );

        float strength =
          rays1 * 0.5 +
          rays2 * 0.4;

        if (noiseAmount > 0.0) {

          float n =
            noise(
              coord * 0.01 +
              iTime * 0.1
            );

          strength *=
            1.0 -
            noiseAmount +
            noiseAmount * n;
        }

        float brightness =
          1.0 -
          coord.y / iResolution.y;

        vec3 color =
          raysColor * strength;

        color.r *=
          0.1 +
          brightness * 0.8;

        color.g *=
          0.3 +
          brightness * 0.6;

        color.b *=
          0.5 +
          brightness * 0.5;

        if (saturation != 1.0) {

          float gray =
            dot(
              color,
              vec3(
                0.299,
                0.587,
                0.114
              )
            );

          color =
            mix(
              vec3(gray),
              color,
              saturation
            );
        }

        gl_FragColor =
          vec4(
            color * strength,
            strength
          );
      }
    `

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },

      rayPos: { value: [0, 0] },
      rayDir: { value: [0, 1] },

      raysColor: {
        value: hexToRgb(raysColor),
      },

      raysSpeed: {
        value: raysSpeed,
      },

      lightSpread: {
        value: lightSpread,
      },

      rayLength: {
        value: rayLength,
      },

      pulsating: {
        value: pulsating ? 1 : 0,
      },

      fadeDistance: {
        value: fadeDistance,
      },

      saturation: {
        value: saturation,
      },

      mousePos: {
        value: [0.5, 0.5],
      },

      mouseInfluence: {
        value: mouseInfluence,
      },

      noiseAmount: {
        value: noiseAmount,
      },

      distortion: {
        value: distortion,
      },
    }

    const geometry = new Triangle(gl)

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms,
      transparent: true,
    })

    const mesh = new Mesh(gl, {
      geometry,
      program,
    })

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight

      renderer.setSize(width, height)

      const dpr = renderer.dpr

      const bufferWidth = width * dpr
      const bufferHeight = height * dpr

      uniforms.iResolution.value = [
        bufferWidth,
        bufferHeight,
      ]

      const { anchor, dir } =
        getAnchorAndDir(
          raysOrigin,
          bufferWidth,
          bufferHeight
        )

      uniforms.rayPos.value = anchor
      uniforms.rayDir.value = dir
    }

    const pointerMove = (event) => {

      if (!followMouse) return

      const rect =
        container.getBoundingClientRect()

      mouseRef.current = {
        x:
          (event.clientX - rect.left) /
          rect.width,

        y:
          (event.clientY - rect.top) /
          rect.height,
      }
    }

    const animate = (time) => {

      uniforms.iTime.value =
        time * 0.001

      uniforms.mousePos.value = [
        mouseRef.current.x,
        1.0 - mouseRef.current.y,
      ]

      renderer.render({
        scene: mesh,
      })

      animationRef.current =
        requestAnimationFrame(animate)
    }

    resize()

    window.addEventListener(
      'resize',
      resize
    )

    window.addEventListener(
      'pointermove',
      pointerMove
    )

    animationRef.current =
      requestAnimationFrame(animate)

    return () => {

      window.removeEventListener(
        'resize',
        resize
      )

      window.removeEventListener(
        'pointermove',
        pointerMove
      )

      if (animationRef.current) {
        cancelAnimationFrame(
          animationRef.current
        )
      }

      if (gl.canvas.parentNode) {
        gl.canvas.parentNode.removeChild(
          gl.canvas
        )
      }

      renderer.gl.getExtension(
        'WEBGL_lose_context'
      )?.loseContext()

      rendererRef.current = null
    }
  }, [
    raysOrigin,
    raysColor,
    raysSpeed,
    lightSpread,
    rayLength,
    pulsating,
    fadeDistance,
    saturation,
    followMouse,
    mouseInfluence,
    noiseAmount,
    distortion,
  ])

  return (
    <div
      ref={containerRef}
      className={`light-rays ${className}`}
    />
  )
}

export default LightRays