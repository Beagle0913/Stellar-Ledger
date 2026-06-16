// Allow importing .sql files as raw strings (Vite ?raw loader).
declare module '*.sql?raw' {
  const content: string
  export default content
}
