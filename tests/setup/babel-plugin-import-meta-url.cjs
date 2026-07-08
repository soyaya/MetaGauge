/**
 * Minimal Babel plugin: rewrites `import.meta.url` to a CJS-safe equivalent
 * so source files written for native ESM (which use `import.meta.url` for
 * __dirname-style path resolution) can still be transformed to CommonJS for
 * Jest's test runtime, without changing their production ESM behavior.
 */
module.exports = function importMetaUrlPlugin() {
  return {
    visitor: {
      MetaProperty(path) {
        const { node } = path;
        if (node.meta.name === 'import' && node.property.name === 'meta') {
          // Use `module.filename` rather than the bare `__filename` identifier:
          // source files commonly do `const __filename = fileURLToPath(import.meta.url)`,
          // and referencing `__filename` here would resolve to that same (TDZ'd,
          // self-referential) local binding instead of the CJS wrapper's parameter.
          path.replaceWithSourceString(
            "({ url: require('url').pathToFileURL(module.filename).href })"
          );
        }
      },
    },
  };
};
