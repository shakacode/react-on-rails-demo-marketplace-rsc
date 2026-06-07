function addIoredisExternal(externals) {
  const ioredisExternal = { ioredis: 'commonjs2 ioredis' };
  if (!externals) return ioredisExternal;
  if (Array.isArray(externals)) {
    const hasIoredis = externals.some((external) => (
      external && typeof external === 'object' && 'ioredis' in external
    ));
    return hasIoredis ? externals : [...externals, ioredisExternal];
  }
  if (typeof externals === 'function' || typeof externals === 'string' || externals instanceof RegExp) {
    return [externals, ioredisExternal];
  }
  return { ...externals, ...ioredisExternal };
}

module.exports = addIoredisExternal;
