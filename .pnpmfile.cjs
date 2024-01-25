module.exports = {
  hooks: {
    readPackage: (pkg, context) => {
      // https://pnpm.io/how-peers-are-resolved
      if (pkg.name) {
        if (pkg.peerDependencies) {
          pkg.peerDependencies = {};
        }

        if (pkg.peerDependenciesMeta) {
          pkg.peerDependenciesMeta = {};
        }
      }

      return pkg;
    },
  },
};
