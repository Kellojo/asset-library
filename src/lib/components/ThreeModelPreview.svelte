<script lang="ts">
  import { onMount } from "svelte";
  import type { Mesh, Object3D } from "three";

  let {
    src,
    fileName = "",
    alt = "3D model preview",
  }: { src: string; fileName?: string; alt?: string } = $props();

  let container = $state<HTMLDivElement | null>(null);
  let canvas = $state<HTMLCanvasElement | null>(null);
  let isInView = $state(false);
  let errorMessage = $state("");
  let themeKey = $state("");

  function fileExt(name: string): string {
    const ext = name.split(".").pop();
    return ext ? `.${ext.toLowerCase()}` : "";
  }

  function readCssVar(name: string, fallback: string): string {
    const value = globalThis
      .getComputedStyle(globalThis.document.documentElement)
      .getPropertyValue(name)
      .trim();
    return value || fallback;
  }

  function centerModel(
    THREE: Awaited<typeof import("three")>,
    camera: import("three").PerspectiveCamera,
    controls: {
      target: { set: (x: number, y: number, z: number) => void };
      update: () => void;
    },
    object: Object3D,
  ): void {
    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());

    object.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z, 0.5);
    camera.position.set(maxDim * 1.3, maxDim * 0.9, maxDim * 1.3);
    controls.target.set(0, 0, 0);
    controls.update();
  }

  onMount(() => {
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        isInView = entries.some((entry) => entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: "200px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(container);

    themeKey =
      globalThis.document.documentElement.getAttribute("data-theme") || "dark";
    const themeObserver = new MutationObserver(() => {
      themeKey =
        globalThis.document.documentElement.getAttribute("data-theme") ||
        "dark";
    });
    themeObserver.observe(globalThis.document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      observer.disconnect();
      themeObserver.disconnect();
    };
  });

  $effect(() => {
    // Re-run renderer setup on theme changes so model lighting and grid colors update.
    themeKey;
    if (!isInView || !canvas) return;

    const localCanvas = canvas;
    if (!localCanvas) return;

    let cleanup = () => {};
    let disposed = false;
    errorMessage = "";

    const start = async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import(
          "three/examples/jsm/controls/OrbitControls.js"
        );
        const ext = fileExt(fileName);
        const accentColor = readCssVar("--accent", "hsl(217 92% 62%)");
        const accentStrongColor = readCssVar(
          "--accent-strong",
          "hsl(217 92% 70%)",
        );
        const gridColor = readCssVar("--canvas-grid", "hsl(0 0% 82%)");

        if (disposed) return;

        const renderer = new THREE.WebGLRenderer({
          canvas: localCanvas,
          antialias: true,
          alpha: true,
        });
        renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));

        const scene = new THREE.Scene();
        scene.background = null;

        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
        camera.position.set(2.2, 1.6, 2.2);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
        keyLight.position.set(3, 4, 2);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(accentColor, 0.6);
        fillLight.position.set(-2, 2, -2);
        scene.add(fillLight);

        const ambient = new THREE.AmbientLight(0xffffff, 0.45);
        scene.add(ambient);

        const grid = new THREE.GridHelper(8, 16, gridColor, gridColor);
        const gridMaterials = Array.isArray(grid.material)
          ? grid.material
          : [grid.material];
        for (const material of gridMaterials) {
          material.transparent = true;
          material.opacity = 0.25;
        }
        grid.position.y = -1;
        scene.add(grid);

        const controls = new OrbitControls(camera, localCanvas);
        controls.enableDamping = true;
        controls.target.set(0, 0, 0);

        if (ext === ".obj") {
          const { OBJLoader } = await import(
            "three/examples/jsm/loaders/OBJLoader.js"
          );
          const loader = new OBJLoader();
          const object = await loader.loadAsync(src);
          if (disposed) return;
          scene.add(object);
          centerModel(THREE, camera, controls, object);
        } else if (ext === ".fbx") {
          const { FBXLoader } = await import(
            "three/examples/jsm/loaders/FBXLoader.js"
          );
          const loader = new FBXLoader();
          const object = await loader.loadAsync(src);
          if (disposed) return;
          scene.add(object);
          centerModel(THREE, camera, controls, object);
        } else if (ext === ".stl") {
          const { STLLoader } = await import(
            "three/examples/jsm/loaders/STLLoader.js"
          );
          const loader = new STLLoader();
          const geometry = await loader.loadAsync(src);
          if (disposed) return;
          const material = new THREE.MeshStandardMaterial({
            color: accentStrongColor,
            metalness: 0.05,
            roughness: 0.8,
          });
          const mesh = new THREE.Mesh(geometry, material);
          scene.add(mesh);
          centerModel(THREE, camera, controls, mesh);
        } else {
          const { GLTFLoader } = await import(
            "three/examples/jsm/loaders/GLTFLoader.js"
          );
          const loader = new GLTFLoader();
          const gltf = await loader.loadAsync(src);
          if (disposed) return;
          scene.add(gltf.scene);
          centerModel(THREE, camera, controls, gltf.scene);
        }

        const resize = () => {
          const { clientWidth, clientHeight } = localCanvas;
          renderer.setSize(clientWidth, clientHeight, false);
          camera.aspect = clientWidth / Math.max(1, clientHeight);
          camera.updateProjectionMatrix();
        };

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(localCanvas);
        resize();

        let frame = 0;
        const animate = () => {
          controls.update();
          renderer.render(scene, camera);
          frame = requestAnimationFrame(animate);
        };
        animate();

        cleanup = () => {
          cancelAnimationFrame(frame);
          resizeObserver.disconnect();
          controls.dispose();
          grid.dispose();
          renderer.dispose();
          scene.traverse((node: Object3D) => {
            const mesh = node as Mesh;
            if (!mesh.geometry || !mesh.material) return;
            mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) {
              for (const material of mesh.material) material.dispose();
            } else {
              mesh.material.dispose();
            }
          });
        };
      } catch {
        if (!disposed) {
          errorMessage =
            "Unable to render 3D preview. For GLTF, use self-contained GLB when possible.";
        }
      }
    };

    void start();

    return () => {
      disposed = true;
      cleanup();
    };
  });
</script>

<div class="three-preview" aria-label={alt} bind:this={container}>
  {#if errorMessage}
    <p>{errorMessage}</p>
  {:else if isInView}
    <canvas bind:this={canvas}></canvas>
  {:else}
    <p>3D preview paused offscreen.</p>
  {/if}
</div>

<style>
  .three-preview {
    width: 100%;
    height: 100%;
    border-radius: 12px;
    overflow: hidden;
    background: var(--canvas-bg);
    border: 1px solid var(--borderHoverColor);
  }

  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  p {
    margin: 0;
    height: 100%;
    display: grid;
    place-items: center;
    font-size: 0.78rem;
    color: var(--app-text-muted);
  }
</style>
