declare module "*.png" {
  const value: string;
  export default value;
}

declare module "cytoscape-navigator" {
  const value: (cy: cytoscape) => void;
  export default value;
}

declare module "react-in-viewport/dist/es/lib/useInViewport" {
  import { useInViewport } from "react-in-viewport";
  export default useInViewport;
}

declare module "*.css" {
  const content: string;
  export default content;
}
