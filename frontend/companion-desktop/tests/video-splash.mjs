// tests/video-splash.mjs — AI 视频片头接线 (video splash), source mirror.
//
// 契约 (2026-10-17): 首启动播放一次 public/splash 素材 (ap-splash-seen), ?splash=1 强制
// 重播, prefers-reduced-motion 直接否决; 素材缺席时组件不闪黑幕、立即 onComplete 直通;
// 淡入淡出只动合成 opacity; 点击/Esc 快进淡出。纯源码镜像, 不运行浏览器。
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFile(path.join(here, '..', rel), 'utf8');

const appSrc = await read('src/App.svelte');
const layer = await read('src/lib/intro/VideoSplashLayer.svelte');

test('App gate: first-run once + forced replay + reduced-motion veto', () => {
  assert.ok(appSrc.includes("localStorage.getItem('ap-splash-seen')"), 'first-run check');
  assert.ok(appSrc.includes("introQuery?.get('splash') === '1'"), '?splash=1 force');
  assert.ok(
    /splashPlaying = \$state\(\(splashForced \|\| splashFirstRun\) && !introReduceMotion\)/.test(appSrc),
    'reduced-motion veto'
  );
  assert.ok(appSrc.includes('handleSplashComplete'), 'completes gate');
});

test('App renders VideoSplashLayer wired to the gate', () => {
  assert.ok(
    appSrc.includes("import VideoSplashLayer from './lib/intro/VideoSplashLayer.svelte';"),
    'import present'
  );
  assert.ok(
    /\{#if splashPlaying\}\s*\n\s*<VideoSplashLayer onComplete=\{handleSplashComplete\} \/>/.test(appSrc),
    'markup gated by splashPlaying'
  );
});

test('layer: mp4 first then webm fallback; missing asset completes immediately', () => {
  assert.match(layer, /apeireth-splash\.mp4/);
  assert.match(layer, /apeireth-splash\.webm/);
  assert.ok(/onComplete\?\.\(\);[^\n]*素材缺席/.test(layer), 'missing-asset path calls onComplete');
});

test('layer: no black flash before asset loads (root stays transparent)', () => {
  assert.match(layer, /\.splash-layer \{[\s\S]*?opacity: 0;/, 'root defaults to opacity 0');
  assert.ok(layer.includes('class:visible'), 'visible class flips it on');
});

test('layer: fades are opacity-only composite discipline', () => {
  const transitions = [...layer.matchAll(/transition:[^;]+;/g)].map((m) => m[0]);
  assert.ok(transitions.length >= 1, 'has transition declarations');
  for (const t of transitions) {
    assert.match(t, /opacity/, 'fade via opacity: ' + t);
    assert.ok(!/(width|height|top|left|margin|padding)/.test(t), 'layout props forbidden: ' + t);
  }
});

test('layer: Esc/click skip and timeupdate tail fade', () => {
  assert.ok(layer.includes("e.key === 'Escape'"), 'Esc fast-forward');
  assert.ok(layer.includes('timeupdate'), 'tail fade via timeupdate');
  assert.ok(layer.includes('ended'), 'ended fallback');
});

test('layer sits above intro-layer (z-index > 20)', () => {
  const m = layer.match(/z-index:\s*(\d+)/);
  assert.ok(m, 'z-index declared');
  assert.ok(Number(m[1]) > 20, 'above intro z-index 20');
});
