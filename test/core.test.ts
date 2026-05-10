import { describe, it, expect } from "vitest";
import {
  editCode,
  findNodeByPath,
  applyEdit,
  type EditOptions,
} from "../src/core";
import { Project, Node, SyntaxKind } from "ts-morph";

// Helper: create an in-memory SourceFile for direct findNodeByPath testing
function makeSourceFile(code: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile("test.ts", code);
}

// ============================================================
// findNodeByPath — node type resolution
// ============================================================
describe("findNodeByPath", () => {
  it("resolves a class declaration", () => {
    const sf = makeSourceFile("class Foo {}");
    const node = findNodeByPath(sf, "Foo");
    expect(Node.isClassDeclaration(node)).toBe(true);
    if (Node.isClassDeclaration(node)) expect(node.getName()).toBe("Foo");
  });

  it("resolves a method declaration inside a class", () => {
    const sf = makeSourceFile("class Foo { bar() {} }");
    const node = findNodeByPath(sf, "Foo.bar");
    expect(Node.isMethodDeclaration(node)).toBe(true);
  });

  it("resolves a constructor", () => {
    const sf = makeSourceFile("class Foo { constructor() {} }");
    const node = findNodeByPath(sf, "Foo.constructor");
    expect(Node.isConstructorDeclaration(node)).toBe(true);
  });

  it("resolves a getter", () => {
    const sf = makeSourceFile("class Foo { get bar() { return 1; } }");
    const node = findNodeByPath(sf, "Foo.bar");
    expect(Node.isGetAccessorDeclaration(node)).toBe(true);
  });

  it("resolves a setter", () => {
    const sf = makeSourceFile(
      "class Foo { set bar(v: number) { this._v = v; } }"
    );
    const node = findNodeByPath(sf, "Foo.bar");
    expect(Node.isSetAccessorDeclaration(node)).toBe(true);
  });

  it("resolves a function declaration at file scope", () => {
    const sf = makeSourceFile("function greet() {}");
    const node = findNodeByPath(sf, "greet");
    expect(Node.isFunctionDeclaration(node)).toBe(true);
  });

  it("resolves a variable declaration at file scope", () => {
    const sf = makeSourceFile("const x = 1;");
    const node = findNodeByPath(sf, "x");
    expect(Node.isVariableDeclaration(node)).toBe(true);
  });

  it("resolves a property assignment inside object literal", () => {
    const sf = makeSourceFile("const cfg = { port: 80 };");
    const node = findNodeByPath(sf, "cfg.port");
    expect(Node.isPropertyAssignment(node)).toBe(true);
  });

  it("resolves method body as Block", () => {
    const sf = makeSourceFile("class Foo { bar() { return 1; } }");
    const node = findNodeByPath(sf, "Foo.bar.body");
    expect(node.getKind()).toBe(SyntaxKind.Block);
  });

  it("resolves static method", () => {
    const sf = makeSourceFile("class Foo { static create() {} }");
    const node = findNodeByPath(sf, "Foo.create");
    expect(Node.isMethodDeclaration(node)).toBe(true);
  });

  it("resolves static property", () => {
    const sf = makeSourceFile("class Foo { static count = 0; }");
    const node = findNodeByPath(sf, "Foo.count");
    expect(Node.isPropertyDeclaration(node)).toBe(true);
  });

  it("resolves class property", () => {
    const sf = makeSourceFile('class Foo { name = "default"; }');
    const node = findNodeByPath(sf, "Foo.name");
    expect(Node.isPropertyDeclaration(node)).toBe(true);
  });

  it("resolves nested object literal property", () => {
    const sf = makeSourceFile("const cfg = { db: { host: 'localhost' } };");
    const node = findNodeByPath(sf, "cfg.db.host");
    expect(Node.isPropertyAssignment(node)).toBe(true);
  });
});

// ============================================================
// editCode — replace
// ============================================================
describe("editCode — replace", () => {
  it("replaces an entire method", () => {
    const source = `class MyService {
  hello() {
    console.log("1");
  }
}`;
    const result = editCode(source, {
      target: "MyService.hello",
      action: "replace",
      content: "hello() { console.log('hi'); }",
    });
    expect(result).toContain("console.log('hi')");
    expect(result).not.toContain('console.log("1")');
  });

  it("replaces method body with auto-brace wrapping", () => {
    const source = `class MyService {
  hello() {
    console.log("1");
  }
}`;
    const result = editCode(source, {
      target: "MyService.hello.body",
      action: "replace",
      content: "console.log('new body');",
    });
    expect(result).toContain("console.log('new body')");
    expect(result).not.toContain('console.log("1")');
    // auto-wrapped: should contain braces
    expect(result).toContain("{");
    expect(result).toContain("}");
  });

  it("replaces method body with explicit braces (no double-wrap)", () => {
    const source = `class MyService {
  hello() {
    console.log("1");
  }
}`;
    const result = editCode(source, {
      target: "MyService.hello.body",
      action: "replace",
      content: "{ console.log('explicit'); }",
    });
    expect(result).toContain("console.log('explicit')");
    expect(result).not.toContain('console.log("1")');
  });

  it("replaces property assignment value (number)", () => {
    const source = `const config = {
  port: 1234,
};`;
    const result = editCode(source, {
      target: "config.port",
      action: "replace",
      content: "9876",
    });
    expect(result).toContain("port: 9876");
    expect(result).not.toContain("1234");
  });

  it("replaces property assignment value (string)", () => {
    const source = `const config = {
  host: "localhost",
};`;
    const result = editCode(source, {
      target: "config.host",
      action: "replace",
      content: '"prod-server"',
    });
    expect(result).toContain('host: "prod-server"');
    expect(result).not.toContain('"localhost"');
  });

  it("replaces nested object property value", () => {
    const source = `const config = {
  db: {
    host: "localhost",
    port: 5432,
  },
};`;
    const result = editCode(source, {
      target: "config.db.host",
      action: "replace",
      content: '"prod-db.example.com"',
    });
    expect(result).toContain('host: "prod-db.example.com"');
    expect(result).not.toContain('"localhost"');
    expect(result).toContain("port: 5432"); // sibling unchanged
  });

  it("replaces entire class property declaration", () => {
    const source = `class MyService {
  name = "default";
}`;
    const result = editCode(source, {
      target: "MyService.name",
      action: "replace",
      content: 'name = "updated"',
    });
    expect(result).toContain('name = "updated"');
  });

  it("replaces constructor body", () => {
    const source = `class MyService {
  constructor() {
    this.value = 0;
  }
}`;
    const result = editCode(source, {
      target: "MyService.constructor.body",
      action: "replace",
      content: "this.value = 1;",
    });
    expect(result).toContain("this.value = 1");
    expect(result).not.toContain("this.value = 0");
  });

  it("replaces getter body", () => {
    const source = `class MyService {
  get value() {
    return this._value;
  }
}`;
    const result = editCode(source, {
      target: "MyService.value.body",
      action: "replace",
      content: "return 42;",
    });
    expect(result).toContain("return 42");
  });

  it("replaces setter body", () => {
    const source = `class MyService {
  set value(v: number) {
    this._value = v;
  }
}`;
    const result = editCode(source, {
      target: "MyService.value.body",
      action: "replace",
      content: "this._value = v * 2;",
    });
    expect(result).toContain("this._value = v * 2");
  });

  it("replaces top-level function body", () => {
    const source = `function greet() {
  console.log("hi");
}`;
    const result = editCode(source, {
      target: "greet.body",
      action: "replace",
      content: 'console.log("hello");',
    });
    expect(result).toContain('console.log("hello")');
  });

  it("replaces static method body", () => {
    const source = `class MyService {
  static create() {
    return new MyService();
  }
}`;
    const result = editCode(source, {
      target: "MyService.create.body",
      action: "replace",
      content: "return new MyService(1);",
    });
    expect(result).toContain("return new MyService(1)");
  });
});

// ============================================================
// editCode — delete
// ============================================================
describe("editCode — delete", () => {
  it("deletes a method from a class", () => {
    const source = `class MyService {
  hello() {
    console.log("1");
  }
  goodbye() {
    console.log("2");
  }
}`;
    const result = editCode(source, {
      target: "MyService.hello",
      action: "delete",
    });
    expect(result).not.toContain("hello()");
    expect(result).toContain("goodbye()");
  });

  it("deletes a property from object literal", () => {
    const source = `const config = {
  port: 1234,
  host: "localhost",
};`;
    const result = editCode(source, {
      target: "config.port",
      action: "delete",
    });
    expect(result).not.toContain("port: 1234");
    expect(result).toContain('host: "localhost"');
  });

  it("deletes a class property", () => {
    const source = `class MyService {
  name = "default";
  value = 0;
}`;
    const result = editCode(source, {
      target: "MyService.name",
      action: "delete",
    });
    expect(result).not.toContain('name = "default"');
    expect(result).toContain("value = 0");
  });

  it("deletes a top-level function", () => {
    const source = `function greet() {}
function farewell() {}`;
    const result = editCode(source, {
      target: "greet",
      action: "delete",
    });
    expect(result).not.toContain("function greet");
    expect(result).toContain("function farewell");
  });
});

// ============================================================
// editCode — before / after
// ============================================================
describe("editCode — before / after", () => {
  it("inserts code before a method (decorator)", () => {
    const source = `class MyService {
  hello() {
    console.log("1");
  }
}`;
    const result = editCode(source, {
      target: "MyService.hello",
      action: "before",
      content: "@log()\n  ",
    });
    expect(result).toContain("@log()");
    expect(result).toContain("hello()");
  });

  it("inserts code after a method", () => {
    const source = `class MyService {
  hello() {
    console.log("1");
  }
}`;
    const result = editCode(source, {
      target: "MyService.hello",
      action: "after",
      content: "\n  goodbye() { console.log('bye'); }",
    });
    expect(result).toContain("goodbye()");
    expect(result).toContain("hello()");
  });

  it("inserts code before an object literal property", () => {
    const source = `const config = {
  port: 1234,
};`;
    const result = editCode(source, {
      target: "config.port",
      action: "before",
      content: 'host: "localhost",\n  ',
    });
    expect(result).toContain('host: "localhost"');
    expect(result).toContain("port: 1234");
  });
});

// ============================================================
// editCode — complex / integration
// ============================================================
describe("editCode — complex scenarios", () => {
  it("edits method body while leaving unrelated object literal intact", () => {
    const source = `export class MyService {
  hello() {
    console.log("1");
  }
}

const config = {
  port: 1234,
};`;
    const result = editCode(source, {
      target: "MyService.hello.body",
      action: "replace",
      content: "console.log('new body');",
    });
    expect(result).toContain("console.log('new body')");
    expect(result).toContain("port: 1234");
    expect(result).toContain("export class MyService");
  });

  it("edits object literal property while leaving class intact", () => {
    const source = `export class MyService {
  hello() {
    console.log("1");
  }
}

const config = {
  port: 1234,
};`;
    const result = editCode(source, {
      target: "config.port",
      action: "replace",
      content: "9876",
    });
    expect(result).toContain("port: 9876");
    expect(result).toContain('console.log("1")');
  });

  it("handles deeply nested object literal path", () => {
    const source = `const config = {
  server: {
    db: {
      host: "localhost",
    },
  },
};`;
    const result = editCode(source, {
      target: "config.server.db.host",
      action: "replace",
      content: '"prod-db"',
    });
    expect(result).toContain('host: "prod-db"');
  });

  it("replaces entire class", () => {
    const source = `class OldClass {
  method() {}
}`;
    const result = editCode(source, {
      target: "OldClass",
      action: "replace",
      content: "class NewClass { doStuff() {} }",
    });
    expect(result).toContain("class NewClass");
    expect(result).not.toContain("OldClass");
  });
});

// ============================================================
// editCode — errors
// ============================================================
describe("editCode — error paths", () => {
  it("throws when path part not found in file scope", () => {
    const source = `class MyService { hello() {} }`;
    expect(() =>
      editCode(source, {
        target: "NonExistent",
        action: "replace",
        content: "x",
      })
    ).toThrow(/not found in file scope/);
  });

  it("throws when member not found in class", () => {
    const source = `class MyService { hello() {} }`;
    expect(() =>
      editCode(source, {
        target: "MyService.nonexistent",
        action: "replace",
        content: "x",
      })
    ).toThrow(/not found in class/);
  });

  it("throws when navigating inside a block", () => {
    const source = `class MyService {
  hello() {
    console.log("1");
  }
}`;
    expect(() =>
      editCode(source, {
        target: "MyService.hello.body.something",
        action: "replace",
        content: "x",
      })
    ).toThrow(/Cannot navigate inside a Block/);
  });

  it("throws when abstract method has no body", () => {
    const source = `abstract class MyService {
  abstract hello(): void;
}`;
    expect(() =>
      editCode(source, {
        target: "MyService.hello.body",
        action: "replace",
        content: "x",
      })
    ).toThrow(/has no body/);
  });

  it("throws when variable has no initializer", () => {
    const source = `let x;`;
    expect(() =>
      editCode(source, {
        target: "x.something",
        action: "replace",
        content: "y",
      })
    ).toThrow(/has no initializer/);
  });

  it("throws when variable initializer is not an object literal", () => {
    const source = `const x = 42;`;
    expect(() =>
      editCode(source, {
        target: "x.something",
        action: "replace",
        content: "y",
      })
    ).toThrow(/not an object literal/);
  });

  it("throws when property not found in object literal", () => {
    const source = `const config = { port: 1234 };`;
    expect(() =>
      editCode(source, {
        target: "config.nonexistent",
        action: "replace",
        content: "y",
      })
    ).toThrow(/not found/);
  });

  it("throws when navigating into method with non-body path", () => {
    const source = `class MyService { hello() {} }`;
    expect(() =>
      editCode(source, {
        target: "MyService.hello.returnType",
        action: "replace",
        content: "number",
      })
    ).toThrow(/Only ".body" is supported/);
  });

  it("throws when navigating into property whose value is not an object literal", () => {
    const source = `const config = { port: 1234 };`;
    expect(() =>
      editCode(source, {
        target: "config.port.something",
        action: "replace",
        content: "y",
      })
    ).toThrow(/value is not an object literal/);
  });

  it("throws when class has no constructor but target is .constructor", () => {
    const source = `class MyService { hello() {} }`;
    expect(() =>
      editCode(source, {
        target: "MyService.constructor",
        action: "replace",
        content: "constructor() {}",
      })
    ).toThrow(/not found in class/);
  });
});

// ============================================================
// editCode — Comment (#comment)
// ============================================================
describe("editCode — Comment (#comment)", () => {
  it("replaces a JSDoc comment on a method", () => {
    const source = `class MyService {
  /**
   * Old description
   */
  hello() {
    console.log("1");
  }
}`;
    const result = editCode(source, {
      target: "MyService.hello.#comment",
      action: "replace",
      content: "New description",
    });
    expect(result).toContain("/** New description */");
    expect(result).not.toContain("Old description");
  });

  it("deletes a JSDoc comment from a class", () => {
    const source = `/**
 * My Service class
 */
class MyService {
  hello() {}
}`;
    const result = editCode(source, {
      target: "MyService.#comment",
      action: "delete",
    });
    expect(result).not.toContain("My Service class");
    expect(result).toContain("class MyService");
  });

  it("replaces JSDoc on a variable declaration", () => {
    const source = `/**
 * Config object
 */
const config = {
  port: 1234,
};`;
    const result = editCode(source, {
      target: "config.#comment",
      action: "replace",
      content: "Updated config",
    });
    expect(result).toContain("/** Updated config */");
    expect(result).not.toContain("Config object");
  });

  it("adds a comment by replacing when none exists", () => {
    const source = `class MyService { hello() {} }`;
    const result = editCode(source, {
      target: "MyService.hello.#comment",
      action: "replace",
      content: "New doc",
    });
    expect(result).toContain("/** New doc */");
    expect(result).toContain("hello()");
  });

  it("handles multiple JSDocs on a single node (replaces the last one)", () => {
    const source = `class MyService {
  /** First doc */
  /** Second doc */
  hello() {}
}`;
    const result = editCode(source, {
      target: "MyService.hello.#comment",
      action: "replace",
      content: "Replaced doc",
    });
    expect(result).toContain("/** First doc */");
    expect(result).toContain("/** Replaced doc */");
    expect(result).not.toContain("Second doc");
  });

  it("replaces a line comment on a method", () => {
    const source = `class MyService {
  // Old description
  hello() {
    console.log("1");
  }
}`;
    const result = editCode(source, {
      target: "MyService.hello.#comment",
      action: "replace",
      content: "New description",
    });
    expect(result).toContain("/** New description */");
    expect(result).not.toContain("Old description");
  });

  it("deletes a line comment from a method", () => {
    const source = `class MyService {
  // My method
  hello() {}
}`;
    const result = editCode(source, {
      target: "MyService.hello.#comment",
      action: "delete",
    });
    expect(result).not.toContain("My method");
    expect(result).toContain("hello()");
  });
});

// ============================================================
// editCode — match statement
// ============================================================
describe("editCode — match statement", () => {
  it("replaces a for-loop inside a function body using prefix match", () => {
    const source = `function fib(n: number) {
  let fib = [0, 1]; // Step 1: Initialize with first two terms

  for (let i = 2; i < n; i++) {
    // Step 2: Sum the two preceding numbers
    fib[i] = fib[i - 1] + fib[i - 2];
  }

  return fib;
}`;
    const result = editCode(source, {
      target: "fib.body",
      action: "replace",
      content: "for (let i = 2; i < n; i++) { /* new loop */ }",
      match: "for (let i = 2;",
    });
    expect(result).toContain("/* new loop */");
    expect(result).not.toContain("Sum the two preceding numbers");
    expect(result).toContain("let fib = [0, 1]"); // Other statements unchanged
    expect(result).toContain("return fib"); // Other statements unchanged
  });

  it("deletes a statement inside a function body using prefix match", () => {
    const source = `function test() {
  const a = 1;
  const b = 2;
  return a + b;
}`;
    const result = editCode(source, {
      target: "test.body",
      action: "delete",
      match: "const b",
    });
    expect(result).not.toContain("const b = 2");
    expect(result).toContain("const a = 1");
    expect(result).toContain("return a + b");
  });

  it("throws when no statement matches the prefix", () => {
    const source = `function test() { const x = 1; }`;
    expect(() =>
      editCode(source, {
        target: "test.body",
        action: "replace",
        content: "y = 2",
        match: "non-existent",
      })
    ).toThrow(/No statement found matching prefix/);
  });

  it("throws when match is used on a non-block target", () => {
    const source = `class Foo { bar() {} }`;
    expect(() =>
      editCode(source, {
        target: "Foo.bar",
        action: "replace",
        content: "new method",
        match: "bar",
      })
    ).toThrow(/--match can only be used when target is a Block or SourceFile/);
  });
});
