import React, {useEffect, useState} from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  OffthreadVideo,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {Caption, EditData, Span} from './types';

const FONTS: [string, string, string][] = [
  ['NotoSansJP', 'fonts/NotoSansJP.ttf', '100 900'],
  ['ZenKaku', 'fonts/ZenKakuGothicNew-Black.ttf', '900'],
  ['ZenKaku', 'fonts/ZenKakuGothicNew-Bold.ttf', '700'],
  ['Montserrat', 'fonts/Montserrat.ttf', '100 900'],
];

const useFonts = () => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all(
      FONTS.map(([family, file, weight]) => {
        const face = new FontFace(family, `url(${staticFile(file)})`, {weight});
        document.fonts.add(face);
        return face.load();
      }),
    ).then(() => continueRender(handle));
  }, [handle]);
};

// 白文字＋黒縁。縁を背面に別レイヤーで描くことで、縁が文字を細らせない。
const OutlinedLine: React.FC<{
  spans: Span[];
  fontSize: number;
  family: string;
  weight: number;
  style: EditData['style'];
  strokeScale?: number;
}> = ({spans, fontSize, family, weight, style, strokeScale = 1}) => {
  const stroke = Math.round(style.strokeWidth * (fontSize / 80) * strokeScale);
  const base: React.CSSProperties = {
    fontFamily: family,
    fontWeight: weight,
    fontSize,
    lineHeight: 1.18,
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
  };
  return (
    <div style={{position: 'relative', display: 'inline-block'}}>
      <div
        style={{
          ...base,
          color: style.stroke,
          WebkitTextStroke: `${stroke}px ${style.stroke}`,
          position: 'absolute',
          inset: 0,
          filter: `drop-shadow(0 ${Math.round(fontSize * 0.06)}px ${Math.round(fontSize * 0.08)}px rgba(0,0,0,0.45))`,
        }}
        aria-hidden
      >
        {spans.map((s, i) => (
          <span key={i}>{s.text}</span>
        ))}
      </div>
      <div style={{...base, position: 'relative'}}>
        {spans.map((s, i) => (
          <span key={i} style={{color: s.em ? style.accent : style.fill}}>
            {s.text}
          </span>
        ))}
      </div>
    </div>
  );
};

const CaptionView: React.FC<{c: Caption; style: EditData['style']}> = ({c, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame, fps, config: {damping: 14, stiffness: 220, mass: 0.6}, durationInFrames: 8});
  const scale = interpolate(pop, [0, 1], [c.size === 'L' ? 0.82 : 0.9, 1]);
  const opacity = interpolate(frame, [0, 3], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <div
      style={{
        position: 'absolute',
        top: c.y,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: Math.round(c.fontSize * 0.02),
        transform: `scale(${scale})`,
        transformOrigin: '50% 50%',
        opacity,
      }}
    >
      {c.lines.map((line, i) => (
        <OutlinedLine key={i} spans={line} fontSize={c.fontSize} family="NotoSansJP" weight={900} style={style} />
      ))}
    </div>
  );
};

const Title: React.FC<{data: EditData}> = ({data}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {title, style} = data;
  const len = Math.round((title.end - title.start) * fps);
  const inP = spring({frame, fps, config: {damping: 16, stiffness: 160}, durationInFrames: 14});
  const out = interpolate(frame, [len - 8, len], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div
      style={{
        position: 'absolute',
        top: title.y,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: out,
        transform: `translateY(${interpolate(inP, [0, 1], [-24, 0])}px) scale(${interpolate(inP, [0, 1], [0.94, 1])})`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 14,
          marginBottom: 8,
          textShadow: '0 2px 6px rgba(0,0,0,0.6)',
          opacity: interpolate(frame, [4, 12], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'}),
        }}
      >
        <span style={{fontFamily: 'Montserrat', fontWeight: 700, fontSize: 26, letterSpacing: '0.3em', color: style.gold}}>
          GOLF LESSON
        </span>
        <span style={{width: 2, height: 26, background: style.gold, alignSelf: 'center'}} />
        <span style={{fontFamily: 'ZenKaku', fontWeight: 900, fontSize: 36, color: '#fff', letterSpacing: '0.06em'}}>
          {data.name.label}
        </span>
      </div>
      {title.lines.map((line, i) => (
        <OutlinedLine key={i} spans={line} fontSize={title.fontSize} family="ZenKaku" weight={900} style={style} strokeScale={1.1} />
      ))}
    </div>
  );
};

// 名前表示（冒頭と最後に短く）
const NamePlate: React.FC<{data: EditData; durationFrames: number; pos: {x: number; y: number}}> = ({data, durationFrames, pos}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const inP = spring({frame, fps, config: {damping: 18, stiffness: 140}, durationInFrames: 16});
  const out = interpolate(frame, [durationFrames - 10, durationFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const {style, name} = data;
  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        opacity: out,
        transform: `translateX(${interpolate(inP, [0, 1], [-60, 0])}px)`,
        display: 'flex',
        alignItems: 'stretch',
        filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.35))',
      }}
    >
      <div style={{width: 8, background: style.gold, borderRadius: 4}} />
      <div
        style={{
          marginLeft: 14,
          background: 'rgba(12,16,14,0.72)',
          borderRadius: 14,
          padding: '14px 26px 14px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <div style={{fontFamily: 'Montserrat', fontWeight: 700, fontSize: 22, letterSpacing: '0.28em', color: style.gold}}>
          PRO GOLFER
        </div>
        <div style={{fontFamily: 'ZenKaku', fontWeight: 900, fontSize: 52, color: '#fff', lineHeight: 1.15}}>{name.label}</div>
        <div style={{fontFamily: 'Montserrat', fontWeight: 600, fontSize: 24, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.04em'}}>
          {name.handle}
        </div>
      </div>
    </div>
  );
};

// 空きがないときの名前表示：上部の帯に 1 行で
const NameBand: React.FC<{data: EditData; durationFrames: number}> = ({data, durationFrames}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8, durationFrames - 8, durationFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const {style, name} = data;
  return (
    <div
      style={{
        position: 'absolute',
        top: 236,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'baseline',
        gap: 16,
        opacity,
        textShadow: '0 2px 6px rgba(0,0,0,0.6)',
      }}
    >
      <span style={{fontFamily: 'ZenKaku', fontWeight: 900, fontSize: 40, color: '#fff'}}>{name.label}</span>
      <span style={{fontFamily: 'Montserrat', fontWeight: 600, fontSize: 26, color: style.gold, letterSpacing: '0.04em'}}>
        {name.handle}
      </span>
    </div>
  );
};

const zoomAt = (data: EditData, t: number) => {
  let s = 1;
  for (const z of data.zooms) {
    const ramp = 0.35;
    const v = interpolate(t, [z.start, z.start + ramp, z.end - ramp, z.end], [1, z.scale, z.scale, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    });
    s = Math.max(s, v);
  }
  return s;
};

export const GolfShort: React.FC<{data: EditData}> = ({data}) => {
  useFonts();
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = frame / fps;
  const z = zoomAt(data, t);
  const band = data.videoOffsetY;
  const f = (s: number) => Math.round(s * fps);
  const nameStart = f(data.name.start);
  const nameLen = f(data.name.end - data.name.start);
  const outroLen = f(3);

  return (
    <AbsoluteFill style={{backgroundColor: data.style.band}}>
      {/* 映像（上部にテロップ帯を空けるため下へずらす） */}
      <div
        style={{
          position: 'absolute',
          top: band,
          left: 0,
          width: data.width,
          height: data.height,
          transform: `scale(${z})`,
          transformOrigin: '50% 30%',
        }}
      >
        <OffthreadVideo src={staticFile(data.video)} style={{width: '100%', height: '100%'}} />
      </div>
      {/* 上部の帯：上品な濃色グラデーションで映像へなじませる */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: band + 140,
          background: `linear-gradient(180deg, ${data.style.band} 0%, ${data.style.band} ${(band / (band + 140)) * 100 - 6}%, rgba(0,0,0,0) 100%)`,
        }}
      />

      <Sequence from={f(data.title.start)} durationInFrames={f(data.title.end - data.title.start)} name="Title">
        <Title data={data} />
      </Sequence>

      {data.captions.map((c, i) => (
        <Sequence key={i} from={f(c.start)} durationInFrames={Math.max(1, f(c.end) - f(c.start))} name={`Cap ${i}`}>
          <CaptionView c={c} style={data.style} />
        </Sequence>
      ))}

      {data.name.intro.mode === 'plate' ? (
        <Sequence from={nameStart} durationInFrames={nameLen} name="Name">
          <NamePlate data={data} durationFrames={nameLen} pos={data.name.intro} />
        </Sequence>
      ) : null}
      <Sequence from={durationInFrames - outroLen} durationInFrames={outroLen} name="NameOutro">
        {data.name.outro.mode === 'plate' ? (
          <NamePlate data={data} durationFrames={outroLen} pos={data.name.outro} />
        ) : (
          <NameBand data={data} durationFrames={outroLen} />
        )}
      </Sequence>

      <Audio
        src={staticFile(data.bgm.file)}
        startFrom={f(data.bgm.startFrom)}
        volume={(fr) =>
          data.bgm.volume *
          interpolate(fr, [0, f(0.8), durationInFrames - f(data.bgm.fadeOut), durationInFrames], [0, 1, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        }
      />
      {data.sfx.map((s, i) => (
        <Sequence key={i} from={f(s.t)} name={`SE ${i}`}>
          <Audio src={staticFile(s.file)} volume={s.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
