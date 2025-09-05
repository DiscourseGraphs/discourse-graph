function readPackage(pkg, context) {
  // if (
  //   pkg.name.startsWith("@blueprintjs") ||
  //   pkg.name === "roamjs-components" ||
  //   pkg.name === "react-in-viewport"
  // ) {
  //   pkg.dependencies = {
  //     ...pkg.dependencies,
  //     react: "17.0.2",
  //     "react-dom": "17.0.2",
  //   };
  //   pkg.devDependencies = {
  //     ...pkg.devDependencies,
  //     "@types/react": "17.0.2",
  //     "@types/react-dom": "17.0.2",
  //   };
  //   pkg.peerDependencies = {};
  //   context.log(`added react 17.0.2 explicitly to ${pkg.name}`);
  // }
  if (
    pkg.name === "@types/react-dom" &&
    Number.parseInt(pkg.version.substring(0, 2)) < 19
  )
    pkg.dependencies = { "@types/react": pkg.version };
  if (pkg.name === "@types/react-vertical-timeline-component")
    pkg.dependencies = { "@types/react": "17.0.2" };
  if (pkg.name === "tldraw" || pkg.name.startsWith("@tldraw")) {
    pkg.dependencies = {
      ...pkg.dependencies,
      react: "17.0.2",
      "react-dom": "17.0.2",
    };
    pkg.devDependencies = {
      ...pkg.devDependencies,
      "@types/react": "17.0.2",
      "@types/react-dom": "17.0.2",
    };
    pkg.peerDependencies = {};
    context.log(`added react 18.2.0 explicitly to ${pkg.name}`);
  }

  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
