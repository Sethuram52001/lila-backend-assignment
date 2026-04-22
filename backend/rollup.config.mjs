import resolve from '@rollup/plugin-node-resolve';
import commonJS from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/main.ts',
  external: ['nakama-runtime'],
  output: {
    file: 'build/index.js',
    format: 'cjs',
    exports: 'none' // The generated code will effectively be embedded into the VM.
  },
  plugins: [
    resolve(),
    commonJS(),
    typescript()
  ]
};
