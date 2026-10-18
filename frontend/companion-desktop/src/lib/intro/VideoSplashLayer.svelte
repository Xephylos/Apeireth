<script lang="ts">
  /**
   * VideoSplashLayer.svelte — AI 生成视频片头（火之文明 WebM/MP4）覆盖层。
   *
   * 素材位：public/splash/apeireth-splash.mp4（H.264，Kling/Veo 直出即用），
   *         退回 public/splash/apeireth-splash.webm。两处都缺失时本层零副作用：
   *         素材就绪前 root opacity=0 直通产品 UI（无黑幕闪烁），onComplete 立即触发。
   *
   * 淡入淡出纪律（同 IntroLayer）：只动合成 opacity，不动 layout 属性。
   *   - 淡入 400ms（素材就绪后）
   *   - 尾部 1.2s 淡出（timeupdate 预判，ended 兜底快闪淡出）
   *   - 点击 / Esc = 快进到淡出（300ms）
   * 门卫在 App.svelte（ap-splash-seen / ?splash=1 / prefers-reduced-motion）。
   */
  import {onMount} from 'svelte';

  let {onComplete}: {onComplete?: () => void} = $props();

  let rootEl: HTMLDivElement | undefined;
  let videoEl: HTMLVideoElement | undefined;
  /** 素材就绪才翻 true（之前 root 透明，产品 UI 照常可见） */
  let visible = $state(false);
  /** 0=mp4 在试 1=webm 在试 2=双双失败（放弃并直通） */
  let sourceIdx = $state(0);
  const SOURCES = ['/splash/apeireth-splash.mp4', '/splash/apeireth-splash.webm'];
  const FADE_OUT = 1200;
  const SKIP_FADE = 300;
  let fading = false;
  let finished = false;

  function finish(fadeMs: number): void {
    if (fading || finished) return;
    fading = true;
    const el = rootEl;
    if (!el) {
      finished = true;
      onComplete?.();
      return;
    }
    el.style.transition = `opacity ${fadeMs}ms linear`;
    el.style.opacity = '0';
    window.setTimeout(() => {
      if (finished) return;
      finished = true;
      onComplete?.();
    }, fadeMs + 30);
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') finish(SKIP_FADE);
  }

  onMount(() => {
    const v = videoEl;
    if (!v) return;
    const onLoaded = (): void => {
      visible = true;
      void v.play().catch(() => {
        /* 自动播放被拒：等同跳过 */
        finish(SKIP_FADE);
      });
    };
    const onTime = (): void => {
      if (!v.duration || Number.isNaN(v.duration)) return;
      if (v.duration - v.currentTime <= FADE_OUT / 1000) finish(FADE_OUT);
    };
    const onEnded = (): void => finish(SKIP_FADE);
    const onError = (): void => {
      if (sourceIdx === 0 && sourceIdx < SOURCES.length - 1) {
        sourceIdx = 1; // mp4 缺失/不可播 → 换 webm
      } else {
        finished = true;
        onComplete?.(); // 素材缺席：零副作用直通
      }
    };
    v.addEventListener('loadeddata', onLoaded);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnded);
    v.addEventListener('error', onError);
    return () => {
      v.removeEventListener('loadeddata', onLoaded);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('error', onError);
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  bind:this={rootEl}
  class="splash-layer"
  class:visible
  onclick={() => finish(SKIP_FADE)}
  role="presentation"
>
  {#if sourceIdx < SOURCES.length}
    <video
      bind:this={videoEl}
      class="splash-video"
      muted
      playsinline
      preload="auto"
      src={SOURCES[sourceIdx]}
    ></video>
  {/if}
</div>

<style>
  .splash-layer {
    position: fixed;
    inset: 0;
    z-index: 30; /* intro-layer 是 20：视频片头压在其上 */
    background: #000;
    opacity: 0; /* 素材就绪前直通（无黑幕闪烁） */
    pointer-events: none;
  }
  .splash-layer.visible {
    opacity: 1;
    transition: opacity 400ms linear;
    pointer-events: auto;
  }
  .splash-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
</style>
