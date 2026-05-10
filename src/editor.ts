import { Project, Node, SyntaxKind } from "ts-morph";
import { EditOptions } from "./types";
import { querySelectorAll } from "./selector";
import { applyCommentEdit } from "./comments";

/**
 * Applies the specified edit to a node.
 */
export const applyEdit = (node: Node, action: "replace" | "delete" | "before" | "after", content?: string): void => {
    switch (action) {
        case "replace": {
            let text = content ?? "";
            
            if (Node.isPropertyAssignment(node)) {
                const init = node.getInitializer();
                if (init !== undefined) {
                    init.replaceWithText(text);
                    break;
                }
            }

            if (node.isKind(SyntaxKind.Block)) {
                const trimmed = text.trim();
                if (!trimmed.startsWith("{")) {
                    text = `{ ${trimmed} }`;
                }
            }
            
            node.replaceWithText(text);
            break;
        }
        case "delete": {
            if ("remove" in node && typeof (node as any).remove === "function") {
                (node as any).remove();
            }
            break;
        }
        case "before": {
            const sourceFile = node.getSourceFile();
            sourceFile.insertText(node.getStart(), content as string);
            break;
        }
        case "after": {
            const sourceFile = node.getSourceFile();
            sourceFile.insertText(node.getEnd(), content as string);
            break;
        }
    }
};

/**
 * Edits the provided source code based on selector and action.
 */
export const editCode = (sourceText: string, options: EditOptions): string => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("input.ts", sourceText);

    const targets = querySelectorAll(sourceFile, options.selector);

    if (targets.length === 0) {
        throw new Error(`Could not find any node matching selector: ${options.selector}`);
    }

    if (options.all !== true) {
        targets.splice(1);
    }
    else {
        targets.sort((a, b) => b.node.getStart() - a.node.getStart());
    }

    for (const target of targets) {
        if (target.isComment) {
            applyCommentEdit(target.node, options.action, options.content);
        }
        else {
            applyEdit(target.node, options.action, options.content);
        }
    }

    return sourceFile.getFullText();
};