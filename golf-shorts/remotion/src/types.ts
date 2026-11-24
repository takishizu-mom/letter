// scripts/build_project.py が書き出す edit.json の型

export type Span = {text: string; em?: boolean};

export type Caption = {
  start: number; // 秒（編集後のタイムライン）
  end: number;
  lines: Span[][];
  size: 'L' | 'M' | 'S';
  fontSize: number;
  y: number; // テロップ上端の y 座標（px, 1080×1920 基準）
};

export type Cta = {label: string; lines: string[]; emphasis?: string[]; links: string[]};

export type NamePos = {x: number; y: number; mode: 'plate' | 'band' | 'none'};

export type Zoom = {start: number; end: number; scale: number};

export type Sfx = {t: number; file: string; volume: number};

export type EditData = {
  fps: number;
  width: number;
  height: number;
  duration: number;
  video: string; // public/ からの相対パス
  videoOffsetY: number; // 動画を下にずらす量（上部にテロップ帯を作る）
  title: {lines: Span[][]; start: number; end: number; fontSize: number; y: number};
  name: {label: string; handle: string; start: number; end: number; intro: NamePos; outro: NamePos};
  captions: Caption[];
  zooms: Zoom[];
  sfx: Sfx[];
  bgm: {file: string; volume: number; startFrom: number; fadeOut: number; boost?: [number, number][]; boostVolume?: number};
  intro?: {duration: number};
  thumbnail?: {image: string; offsetY: number; lines: Span[][]; sizes: number[]};
  outro?: {start: number; duration: number; cta?: Cta | null};
  style: {
    accent: string; // 強調色（黄）
    fill: string;
    stroke: string;
    strokeWidth: number;
    band: string; // 上部帯の色
    gold: string;
  };
};
