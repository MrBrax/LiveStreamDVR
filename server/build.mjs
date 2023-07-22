import * as esbuild from "esbuild";

await esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    outfile: "build/server.js",
    platform: "node",
    target: "node18",
    // output to console
    logLevel: "info",
    treeShaking: true,
    // packages: "external",
    metafile: true,
    sourcemap: true,
});
