import {Composition, staticFile} from 'remotion';
import {GolfShort} from './GolfShort';
import {Thumbnail} from './Thumbnail';
import type {EditData} from './types';

type Props = {editFile: string; data?: EditData};

const loadEdit = async (props: Props) => {
  const data: EditData = props.data ?? (await (await fetch(staticFile(props.editFile))).json());
  return data;
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="Thumbnail"
      component={Thumbnail as unknown as React.FC<Props>}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={1}
      defaultProps={{editFile: 'projects/sample/edit.json'} as Props}
      calculateMetadata={async ({props}) => ({props: {...props, data: await loadEdit(props)}})}
    />
    <Composition
      id="GolfShort"
      component={GolfShort as unknown as React.FC<Props>}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={300}
      defaultProps={{editFile: 'projects/sample/edit.json'} as Props}
      calculateMetadata={async ({props}) => {
        const data: EditData = props.data ?? (await (await fetch(staticFile(props.editFile))).json());
        return {
          durationInFrames: Math.round(data.duration * data.fps),
          fps: data.fps,
          width: data.width,
          height: data.height,
          props: {...props, data},
        };
      }}
    />
    </>
  );
};
