module.exports = {
  hooks: {
    readPackage: (pkg, context) => {
      if (pkg.name) {
        // https://pnpm.io/zh/how-peers-are-resolved

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
