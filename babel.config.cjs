module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
  ],
  plugins: [
    require.resolve('./tests/setup/babel-plugin-import-meta-url.cjs'),
  ],
};
