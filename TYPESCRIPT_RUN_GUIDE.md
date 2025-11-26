# Running TypeScript from Terminal

This guide shows different ways to run TypeScript files from the terminal.

## Method 1: Using ts-node (Recommended for Quick Scripts)

### Install ts-node

```bash
npm install -D ts-node
# or globally
npm install -g ts-node
```

### Run a TypeScript file directly

```bash
# Using npx (no installation needed)
npx ts-node script.ts

# If installed globally
ts-node script.ts

# With ES modules (if your project uses "type": "module")
npx ts-node --esm script.ts
```

### Example

```bash
# Create a test script
echo 'console.log("Hello from TypeScript!");' > test.ts

# Run it
npx ts-node test.ts
```

## Method 2: Compile Then Run (Traditional)

### Step 1: Compile TypeScript to JavaScript

```bash
# Compile a single file
tsc script.ts

# Compile entire project (uses tsconfig.json)
tsc

# Watch mode (recompiles on changes)
tsc --watch
```

### Step 2: Run the compiled JavaScript

```bash
# Run the compiled file
node script.js

# For ES modules
node script.js
```

## Method 3: Using tsx (Modern Alternative)

`tsx` is a faster alternative to ts-node that works well with ES modules.

### Install tsx

```bash
npm install -D tsx
```

### Run TypeScript files

```bash
# Using npx
npx tsx script.ts

# If installed
tsx script.ts
```

## Method 4: Using Your Project's Build System

### For this Vite project:

```bash
# Development server (runs TypeScript through Vite)
npm run dev

# Build (compiles TypeScript)
npm run build

# Preview built app
npm run preview
```

### For Firebase Functions:

```bash
cd functions

# Compile TypeScript
npm run build
# or
tsc

# Run compiled JavaScript
node lib/index.js
```

## Method 5: Using Node with --loader (Node 20.6+)

Node.js 20.6+ supports TypeScript natively with a loader:

```bash
node --loader ts-node/esm script.ts
```

## Quick Examples

### Example 1: Simple TypeScript Script

Create `hello.ts`:
```typescript
const message: string = "Hello, TypeScript!";
console.log(message);
```

Run it:
```bash
npx ts-node hello.ts
```

### Example 2: Script with Imports

Create `utils.ts`:
```typescript
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
```

Create `main.ts`:
```typescript
import { greet } from './utils.js';

console.log(greet('World'));
```

Run it:
```bash
npx ts-node --esm main.ts
```

### Example 3: Using Your Project's TypeScript Config

Create a script in `scripts/` directory:
```typescript
// scripts/test-firebase.ts
import { db } from '../src/lib/firebase.js';
import { collection, getDocs } from 'firebase/firestore';

async function testFirestore() {
  try {
    const leadsRef = collection(db, 'leads');
    const snapshot = await getDocs(leadsRef);
    console.log(`Found ${snapshot.size} leads`);
  } catch (error) {
    console.error('Error:', error);
  }
}

testFirestore();
```

Run it:
```bash
npx ts-node --esm scripts/test-firebase.ts
```

## Recommended Setup for This Project

### Add ts-node to devDependencies

```bash
npm install -D ts-node
```

### Create a scripts directory

```bash
mkdir scripts
```

### Add npm script to package.json

```json
{
  "scripts": {
    "script": "ts-node --esm scripts/your-script.ts"
  }
}
```

Then run:
```bash
npm run script
```

## Troubleshooting

### "Cannot find module" errors

- Make sure you're using the correct import syntax for your module system
- For ES modules, use `.js` extensions in imports: `import { x } from './file.js'`
- Check your `tsconfig.json` module settings

### "SyntaxError: Cannot use import statement outside a module"

- Use `--esm` flag: `npx ts-node --esm script.ts`
- Or add `"type": "module"` to package.json (already present in this project)

### Type errors

- Make sure TypeScript is installed: `npm install -D typescript`
- Check your `tsconfig.json` configuration

## Quick Reference

| Command | Description |
|---------|-------------|
| `npx ts-node script.ts` | Run TypeScript file directly |
| `npx ts-node --esm script.ts` | Run with ES module support |
| `tsc script.ts` | Compile TypeScript to JavaScript |
| `tsc` | Compile entire project |
| `tsc --watch` | Watch mode compilation |
| `npx tsx script.ts` | Run with tsx (faster alternative) |
| `node script.js` | Run compiled JavaScript |

## For This Specific Project

Since you're using Vite with TypeScript:

1. **Development**: Use `npm run dev` - Vite handles TypeScript automatically
2. **Build**: Use `npm run build` - Compiles TypeScript and bundles
3. **Scripts**: Use `npx ts-node --esm` for standalone scripts
4. **Functions**: Compile with `tsc` in the functions directory

