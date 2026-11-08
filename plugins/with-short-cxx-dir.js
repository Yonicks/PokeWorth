/**
 * Windows only: build the Android C++ code in a short folder.
 *
 * Windows stops at 260-character paths, and React Native's C++ build writes
 * very long ones (e.g. .../react_codegen_rngesturehandler_codegen.dir/D_/Git/...).
 * With the default folder (<project>/android/app/.cxx) the build fails with
 * "Filename longer than 260 characters". Pointing the CMake staging directory
 * at C:/pwcxx saves about 28 characters. Other platforms are left alone.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = 'pokeworthShortCxx';

module.exports = function withShortCxxDir(config) {
  if (process.platform !== 'win32') return config;
  return withAppBuildGradle(config, (c) => {
    if (c.modResults.contents.includes(MARKER)) return c;
    c.modResults.contents = c.modResults.contents.replace(
      /android\s*\{/,
      `android {\n    // ${MARKER}: keep the C++ build path under the Windows 260-character limit\n    externalNativeBuild { cmake { buildStagingDirectory "C:/pwcxx" } }\n`,
    );
    return c;
  });
};
