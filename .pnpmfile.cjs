// Users never install devDependencies, so the published manifest leaves them out.
module.exports = {
  hooks: {
    beforePacking(pkg) {
      delete pkg.devDependencies;
      return pkg;
    },
  },
};
