import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {OutlinedLine, useFonts} from './GolfShort';
import type {EditData, Span} from './types';

// サムネイル（1080×1920）：上に大きなタイトル、下にスイングの決めポーズ
export const Thumbnail: React.FC<{data: EditData}> = ({data}) => {
  useFonts();
  const th = data.thumbnail!;
  const {style} = data;
  return (
    <AbsoluteFill style={{backgroundColor: style.band}}>
      <Img
        src={staticFile(th.image)}
        style={{position: 'absolute', top: th.offsetY, left: 0, width: 1080, height: 1920, objectFit: 'cover'}}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, ${style.band} 0%, ${style.band} ${(th.offsetY / 1920) * 100 - 2}%, rgba(15,21,18,0) ${((th.offsetY + 260) / 1920) * 100}%, rgba(15,21,18,0) 78%, rgba(15,21,18,0.85) 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 250,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12}}>
          <span style={{fontFamily: 'Montserrat', fontWeight: 700, fontSize: 34, letterSpacing: '0.3em', color: style.gold}}>
            GOLF LESSON
          </span>
          <span style={{width: 3, height: 34, background: style.gold, alignSelf: 'center'}} />
          <span style={{fontFamily: 'ZenKaku', fontWeight: 900, fontSize: 46, color: '#fff'}}>{data.name.label}</span>
        </div>
        {th.lines.map((line: Span[], i: number) => (
          <OutlinedLine
            key={i}
            spans={line}
            fontSize={th.sizes[i] ?? 110}
            family="ZenKaku"
            weight={900}
            style={style}
            strokeScale={1.15}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
