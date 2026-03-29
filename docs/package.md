**don’t use CommonJS** 🙂

### Use **ESM only**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

### Why this is the *right* choice **now**

* **Native ESM everywhere** (Node 18/20+, Bun, Deno, modern bundlers)
* Clean `import` / `export`, no interop hacks
* Future-proof for:

  * tree-shaking
  * edge / workers
  * package `exports`
* Matches how *new* libraries are written in 2025–2026

### What *not* to do

* ❌ `"module": "commonjs"` → legacy, friction, dead-end
* ❌ `"module": "ES2020"` without `NodeNext` → subtle resolution bugs with Node ESM

### Minimal `package.json` you should use

```json
{
  "type": "module",
  "exports": {
    ".": "./dist/index.js"
  }
}
```

### One important rule (don’t trip on this)

* Use **explicit file extensions** in imports:

  ```ts
  import { x } from "./utils.js";
  ```
