<script lang="ts">
  import "../app.css";
  import "../fonts.css";
  import "../toasts.css";
  import favicon from "$lib/assets/favicon.svg";
  import favicon96 from "$lib/assets/favicon-96x96.png";
  import appleTouchIcon from "$lib/assets/apple-touch-icon.png";
  import faviconIco from "$lib/assets/favicon.ico";
  import siteManifest from "$lib/assets/site.webmanifest";
  import { Toaster } from "svelte-sonner";

  let { children } = $props();
</script>

<svelte:head>
  <title>Asset Library</title>
  <link rel="icon" href={favicon} />
  <link rel="icon" type="image/png" href={favicon96} sizes="96x96" />
  <link rel="shortcut icon" href={faviconIco} />
  <link rel="apple-touch-icon" sizes="180x180" href={appleTouchIcon} />
  <meta name="apple-mobile-web-app-title" content="Asset Lib" />
  <link rel="manifest" href={siteManifest} />
</svelte:head>

{@render children()}

<Toaster
  position="top-right"
  toastOptions={{ unstyled: true, class: "toast" }}
/>
