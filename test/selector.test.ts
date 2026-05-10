import { describe, it, expect } from "vitest";
import { Project, Node } from "ts-morph";
import { parseSelectorPart, querySelectorAll, tokenizeSelector } from "../src/selector";

const makeSourceFile = (code: string) => {
    const project = new Project({ useInMemoryFileSystem: true });
    return project.createSourceFile("test.ts", code);
};

describe("tokenizeSelector", () => {
    it("tokenizes correctly", () => {
        const tokens = tokenizeSelector("Class::MyService Method::hello Block [text^=\"for (let\"]");
        expect(tokens).toEqual(["Class::MyService", "Method::hello", "Block", "[text^=\"for (let\"]"]);
    });
});

describe("parseSelectorPart", () => {
    it("parses selector parts", () => {
        const part = parseSelectorPart("Class::MyService");
        expect(part.kind).toBe("Class");
        expect(part.name).toBe("MyService");
    });

    it("parses prefix texts", () => {
        const part = parseSelectorPart("VariableStatement[text^=\"const a\"]");
        expect(part.kind).toBe("VariableStatement");
        expect(part.textPrefix).toBe("const a");
    });

    it("parses comment pseudo", () => {
        const part = parseSelectorPart("Class::MyService:comment");
        expect(part.isComment).toBe(true);
        expect(part.name).toBe("MyService");
    });
});

describe("querySelectorAll", () => {
    it("finds class", () => {
        const sourceFile = makeSourceFile("class Foo {}");
        const results = querySelectorAll(sourceFile, "Class::Foo");
        expect(results.length).toBe(1);
        expect(Node.isClassDeclaration(results[0].node)).toBe(true);
    });
    
    it("finds method block", () => {
        const sourceFile = makeSourceFile("class Foo { bar() { return 1; } }");
        const results = querySelectorAll(sourceFile, "Class::Foo Method::bar Block");
        expect(results.length).toBe(1);
        expect(Node.isBlock(results[0].node)).toBe(true);
    });
    
    it("finds statement by text prefix", () => {
        const sourceFile = makeSourceFile("function test() { const a = 1; }");
        const results = querySelectorAll(sourceFile, "Function::test Block VariableStatement[text^=\"const a\"]");
        expect(results.length).toBe(1);
        expect(Node.isVariableStatement(results[0].node)).toBe(true);
    });

    it("finds multiple nodes globally", () => {
        const sourceFile = makeSourceFile(`
            const a = 1;
            function run() { const a = 2; }
        `);
        const results = querySelectorAll(sourceFile, "VariableDeclaration::a");
        expect(results.length).toBe(2);
    });
});