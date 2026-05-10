# editc

Edit code by powerful **AST Selectors** without `old_text`.

## Usage

```bash
npm install

# Option 1: Run directly with tsx (no build required)
npx tsx src/editc.ts index.ts --selector "Class::MyService Method::hello" --replace "hello() { console.log('done'); }"

# Option 2: Build and run
npm run build
node dist/editc.js index.ts --selector "Class::MyService Method::hello Block" --replace "return 42;"
```

## Selector Syntax

The AST Selector syntax works similarly to CSS Selectors, matching elements down the TypeScript Abstract Syntax Tree.

### Basic Format

Each part of a selector is space-separated, representing a descendant relationship.
Format for a single part: `[Kind]::[Name][text^="Prefix"]:comment`

| Component       | Description                                                                                                                                                                                                            | Example                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `Kind`          | The AST `SyntaxKind`. We support **all** native kinds (e.g., `VariableDeclaration`, `Identifier`, `ReturnStatement`), and provide friendly aliases like `Class`, `Function`, `Method`, `ForBlock`, `IfBlock`, `Block`. | `Function` or `FunctionDeclaration` |
| `::Name`        | Matches the explicit `.getName()` or the identifier text of the node.                                                                                                                                                  | `Class::MyService`                  |
| `[text^="..."]` | A property selector that matches if the node's full text starts with the specified prefix.                                                                                                                             | `ForBlock[text^="for (let i = 0"]`  |
| `:comment`      | A pseudo-class that targets the leading JSDoc or line comment attached to the node, instead of the node itself.                                                                                                        | `Method::hello:comment`             |

### CLI Options

- `--selector <query>` : The AST selector path (required).
- `--replace <code>` : Replace the matched node with the given code.
- `--replace-file <filepath>` : Load replacement code from a file.
- `--delete` : Delete the targeted node entirely.
- `--before <code>` : Insert text right before the targeted node.
- `--after <code>` : Insert text right after the targeted node.
- `--all` : By default, editc edits the _first_ matching node. Pass `--all` to edit **all matching nodes** globally in the file scope.

## Examples

Assume the source file `index.ts`:

```ts
class MyService {
  hello() {
    console.log("1");
  }
}

function fib(n: number) {
  let fib = [0, 1];
  for (let i = 2; i < n; i++) {
    fib[i] = fib[i - 1] + fib[i - 2];
  }
  return fib;
}
```

### Replace an entire method

```bash
npx tsx src/editc.ts index.ts --selector "Class::MyService Method::hello" --replace "hello() { console.log('hi'); }"
```

### Replace only the method body (auto-wraps in braces)

```bash
npx tsx src/editc.ts index.ts --selector "Class::MyService Method::hello Block" --replace "console.log('new body');"
```

### Delete a specific block statement using text prefix

```bash
npx tsx src/editc.ts index.ts --selector "Function::fib Block VariableStatement[text^='let fib =']" --delete
```

### Replace Comments

Use `:comment` to edit JSDocs safely. You don't need to wrap your replacement in `/** */`, the tool does it for you.

```bash
npx tsx src/editc.ts index.ts --selector "Class::MyService Method::hello:comment" --replace "Says hello."
```

### Global Rename / Replace using `--all`

Find all variables/identifiers named `fib` and rename them.

```bash
npx tsx src/editc.ts index.ts --selector "Function::fib Block Identifier::fib" --replace "fib_arr" --all
```
