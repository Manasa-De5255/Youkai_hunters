// Vite client environment and static asset module type declarations.
// Declared directly instead of referencing "vite/client" in tsconfig.json so
// Vercel serverless TypeScript builds never fail with TS2688.

interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
  readonly VITE_API_BASE_URL?: string;
  readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly url: string;
  readonly env: ImportMetaEnv;
}

declare module '*.css' {}
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.jpeg' {
  const src: string;
  export default src;
}
declare module '*.webp' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}
declare module '*.gif' {
  const src: string;
  export default src;
}
declare module '*.mp3' {
  const src: string;
  export default src;
}
declare module '*.wav' {
  const src: string;
  export default src;
}
declare module '*.ogg' {
  const src: string;
  export default src;
}
