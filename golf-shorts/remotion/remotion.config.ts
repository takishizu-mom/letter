import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
// コンテナ内の Chromium を使う（ダウンロード不要）
Config.setBrowserExecutable(process.env.REMOTION_CHROME ?? '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell');
