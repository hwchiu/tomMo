/** Empty for the Go monolith. Defaults to the GitHub Pages project path. */
const configured = process.env.NEXT_PUBLIC_BASE_PATH;
export const basePath = configured === undefined ? "/tomMo-" : configured;
