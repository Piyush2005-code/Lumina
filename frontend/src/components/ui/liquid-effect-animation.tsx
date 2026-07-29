"use client"

import { useEffect, useRef } from "react"

export function LiquidEffectAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // Load the script dynamically
    const script = document.createElement("script")
    script.type = "module"
    script.textContent = `
      import LiquidBackground from 'https://cdn.jsdelivr.net/npm/threejs-components@0.0.22/build/backgrounds/liquid1.min.js';
      
      const canvas = document.getElementById('liquid-canvas');
      if (canvas) {
        const app = LiquidBackground(canvas);
        // Using a dark, abstract texture from Unsplash suitable for Lumina's premium theme
        app.loadImage('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop');
        app.liquidPlane.material.metalness = 0.85;
        app.liquidPlane.material.roughness = 0.15;
        app.liquidPlane.uniforms.displacementScale.value = 6;
        app.setRain(false);
        window.__liquidApp = app;
      }
    `
    document.body.appendChild(script)

    return () => {
      if (window.__liquidApp && window.__liquidApp.dispose) {
        window.__liquidApp.dispose()
      }
      document.body.removeChild(script)
    }
  }, [])

  return (
    <div
      className="fixed inset-0 m-0 w-full h-full touch-none overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <canvas ref={canvasRef} id="liquid-canvas" className="fixed inset-0 w-full h-full" />
    </div>
  )
}

declare global {
  interface Window {
    __liquidApp?: any
  }
}
