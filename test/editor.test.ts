import { describe, it, expect } from "vitest";
import { editCode } from "../src/editor";

describe("editCode - replace", () => {
    it("replaces an entire method", () => {
        const source = `class MyService {
  hello() {
    console.log("1");
  }
}`;
        const result = editCode(source, {
            selector: "Class::MyService Method::hello",
            action: "replace",
            content: "hello() { console.log('hi'); }"
        });
        expect(result).toContain("console.log('hi')");
        expect(result).not.toContain("console.log(\"1\")");
    });

    it("replaces method body with auto-brace wrapping", () => {
        const source = `class MyService {
  hello() {
    console.log("1");
  }
}`;
        const result = editCode(source, {
            selector: "Class::MyService Method::hello Block",
            action: "replace",
            content: "console.log('new body');"
        });
        expect(result).toContain("console.log('new body')");
        expect(result).not.toContain("console.log(\"1\")");
        expect(result).toContain("{");
        expect(result).toContain("}");
    });

    it("replaces property assignment value", () => {
        const source = `const config = {
  port: 1234,
};`;
        const result = editCode(source, {
            selector: "Variable::config PropertyAssignment::port",
            action: "replace",
            content: "9876"
        });
        expect(result).toContain("port: 9876");
        expect(result).not.toContain("1234");
    });
    
    it("replaces specific statement inside block", () => {
        const source = `function fib(n: number) {
  let fib = [0, 1];
  for (let i = 2; i < n; i++) {
    fib[i] = fib[i - 1] + fib[i - 2];
  }
  return fib;
}`;
        const result = editCode(source, {
            selector: "Function::fib Block ForBlock[text^=\"for (let\"]",
            action: "replace",
            content: "for (let i = 2; i < n; i++) { /* new */ }"
        });
        expect(result).toContain("/* new */");
        expect(result).toContain("let fib = [0, 1]");
    });

    it("replaces multiple variables globally with --all", () => {
        const source = `
            const count = 1;
            function add() {
                let count = 2;
                return count + 1;
            }
        `;
        const result = editCode(source, {
            selector: "Identifier::count",
            action: "replace",
            content: "total",
            all: true
        });
        expect(result).not.toContain("count");
        expect(result).toContain("const total = 1;");
        expect(result).toContain("let total = 2;");
        expect(result).toContain("return total + 1;");
    });
});

describe("editCode - delete", () => {
    it("deletes a method from a class", () => {
        const source = `class MyService {
  hello() {
    console.log("1");
  }
}`;
        const result = editCode(source, {
            selector: "Class::MyService Method::hello",
            action: "delete"
        });
        expect(result).not.toContain("hello()");
    });

    it("deletes a statement from a function block", () => {
        const source = `function test() {
  const a = 1;
  const b = 2;
  return a + b;
}`;
        const result = editCode(source, {
            selector: "Function::test Block VariableStatement[text^=\"const b\"]",
            action: "delete"
        });
        expect(result).not.toContain("const b = 2");
        expect(result).toContain("const a = 1");
    });
});