import './index.css';
import { Composition } from 'remotion';
import { DefralVideo, TOTAL_DURATION_IN_FRAMES } from './Video';

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DefralDemo"
        component={DefralVideo}
        durationInFrames={TOTAL_DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
