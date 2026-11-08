/**
 * Windows only: make the Android C++ build survive Windows' 260-character path limit.
 *
 * React Native's C++ build writes very long paths (e.g.
 * .../react_codegen_rngesturehandler_codegen.dir/D_/Git/.../RNGestureHandlerDetectorShadowNode.cpp.o,
 * about 235 characters that no folder choice can shorten). Two settings:
 *
 * 1. The CMake staging directory moves to C:/pwcxx (saves ~28 characters).
 * 2. The Android SDK's default CMake 3.22.1 ships ninja 1.10.2, which refuses
 *    paths over 260 characters even when Windows long paths are enabled. If a
 *    newer CMake from the SDK Manager is installed with ninja 1.12 or later
 *    (long-path aware), the app module uses it.
 *
 * Other platforms are left alone.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = 'pokeworthShortCxx';

function sdkDir() {
  return process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
}

/** [major, minor, patch] from "3.31.6". */
const parts = (v) => v.split('.').map((n) => parseInt(n, 10) || 0);
const compare = (a, b) => {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

/** The newest SDK CMake (above 3.22.1) whose ninja is 1.12 or newer, or null. */
function newestLongPathCmake() {
  const root = path.join(sdkDir(), 'cmake');
  if (!fs.existsSync(root)) return null;
  const versions = fs
    .readdirSync(root)
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v) && compare(v, '3.22.1') > 0)
    .sort(compare)
    .reverse();
  for (const v of versions) {
    try {
      const out = execFileSync(path.join(root, v, 'bin', 'ninja.exe'), ['--version'], { encoding: 'utf8' }).trim();
      if (compare(out, '1.12.0') >= 0) return v;
    } catch {
      // not usable; try the next one
    }
  }
  return null;
}

module.exports = function withShortCxxDir(config) {
  if (process.platform !== 'win32') return config;
  return withAppBuildGradle(config, (c) => {
    if (c.modResults.contents.includes(MARKER)) return c;
    const cmake = newestLongPathCmake();
    const version = cmake ? ` version "${cmake}"` : '';
    c.modResults.contents = c.modResults.contents.replace(
      /android\s*\{/,
      `android {\n    // ${MARKER}: keep the C++ build path under the Windows 260-character limit${cmake ? ` (CMake ${cmake})` : ''}\n    externalNativeBuild { cmake { buildStagingDirectory "C:/pwcxx"${version} } }\n`,
    );
    return c;
  });
};
