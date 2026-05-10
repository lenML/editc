# editc

edit code by code path without `old_text`

## Usage

```bash
cd editc-ts
npm install

# 方式一：直接使用 tsx（不需要编译）
npx tsx src/editc.ts index.ts --target MyService.hello --replace "hello() { console.log('done'); }"

# 方式二：编译后运行
npm run build
node dist/editc.js index.ts --target MyService.hello.body --replace "return 42;"
```

### Example

假设源文件 `index.ts`：

```ts
class MyService {
  hello() {
    console.log("1");
  }
}
```

#### 替换整个方法

```bash
npx tsx src/editc.ts index.ts --target MyService.hello --replace "hello() { console.log('hi'); }"
```

#### 只替换方法体（自动包裹花括号）

```bash
npx tsx src/editc.ts index.ts --target MyService.hello.body --replace "console.log('new body');"
```

#### 插入装饰器

```bash
npx tsx src/editc.ts index.ts --target MyService.hello --before "@log()"
```

#### 删除方法

```bash
npx tsx src/editc.ts index.ts --target MyService.hello --delete
```

#### 替换/删除/添加 注释

使用 `.#comment` 后缀定位注释。替换时不需要手动添加 `//` 或 `/** */`，工具会自动识别并包裹。如果目标节点原本没有注释，会自动添加。

```bash
# 替换注释（自动包裹）
npx tsx src/editc.ts index.ts --target MyService.hello.#comment --replace "New description"

# 删除注释
npx tsx src/editc.ts index.ts --target MyService.hello.#comment --delete
```

#### 匹配并替换语句块

定位到函数体或块级作用域（如 `fib.body`）后，可以通过 `--match` 传入前缀文本，精准匹配并替换整个对应的语句。

```bash
# 替换 for 循环（原语句以 "for (let i = 2;" 开头）
npx tsx src/editc.ts index.ts --target fib.body --match "for (let i = 2;" --replace "for (let i = 2; i < n; i++) { /* new loop */ }"

# 删除特定语句
npx tsx src/editc.ts index.ts --target fib.body --match "const b" --delete
```
