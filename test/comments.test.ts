import { describe, it, expect } from "vitest";
import { editCode } from "../src/editor";

describe("editCode - comments", () => {
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
            selector: "Class::MyService Method::hello:comment",
            action: "replace",
            content: "New description"
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
            selector: "Class::MyService:comment",
            action: "delete"
        });
        expect(result).not.toContain("My Service class");
        expect(result).toContain("class MyService");
    });
});