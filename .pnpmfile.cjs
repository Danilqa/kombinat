// The devDependencies name private workspace packages that are not on npm.
module.exports = {
  hooks: {
    beforePacking(pkg) {
      delete pkg.devDependencies;
      return pkg;
    },
  },
};
