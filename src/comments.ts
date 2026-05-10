import { Node, SyntaxKind } from "ts-morph";

/**
 * Formats comment text into JSDoc style.
 */
export const formatCommentText = (text: string): string => {
    const trimmedText = text.trim();
    if (trimmedText.startsWith("//") || trimmedText.startsWith("/*")) {
        return trimmedText;
    }
    
    if (trimmedText.includes("\n")) {
        const lines = trimmedText.split("\n");
        return `/**\n${lines.map(line => ` * ${line}`).join("\n")}\n */`;
    }
    
    return `/** ${trimmedText} */`;
};

/**
 * Applies comment edit to the host node.
 */
export const applyCommentEdit = (hostNode: Node, action: "replace" | "delete" | "before" | "after", content?: string): void => {
    const sourceFile = hostNode.getSourceFile();
    
    let jsDocHost: Node = hostNode;
    if (Node.isVariableDeclaration(hostNode)) {
        const variableStatement = hostNode.getFirstAncestorByKind(SyntaxKind.VariableStatement);
        if (variableStatement !== undefined) {
            jsDocHost = variableStatement;
        }
    }
    
    if (
        Node.isClassDeclaration(jsDocHost) ||
        Node.isMethodDeclaration(jsDocHost) ||
        Node.isConstructorDeclaration(jsDocHost) ||
        Node.isGetAccessorDeclaration(jsDocHost) ||
        Node.isSetAccessorDeclaration(jsDocHost) ||
        Node.isFunctionDeclaration(jsDocHost) ||
        Node.isVariableStatement(jsDocHost) ||
        Node.isPropertyDeclaration(jsDocHost) ||
        Node.isPropertyAssignment(jsDocHost)
    ) {
        const docs = (jsDocHost as any).getJsDocs();
        if (docs.length > 0) {
            const lastDoc = docs[docs.length - 1];
            if (action === "delete") {
                lastDoc.remove();
                return;
            }
            if (action === "replace") {
                const newText = formatCommentText(content ?? "");
                lastDoc.replaceWithText(newText);
                return;
            }
            if (action === "before") {
                sourceFile.insertText(lastDoc.getStart(), content as string);
                return;
            }
            if (action === "after") {
                sourceFile.insertText(lastDoc.getEnd(), content as string);
                return;
            }
        }
    }
    
    const fullStart = hostNode.getFullStart();
    const start = hostNode.getStart();
    const trivia = sourceFile.getFullText().substring(fullStart, start);
    
    const commentRegex = /(\/\*[\s\S]*?\*\/|\/\/.*)/g;
    const comments = [...trivia.matchAll(commentRegex)];
    
    if (action === "delete") {
        if (comments.length > 0) {
            const lastComment = comments[comments.length - 1];
            const deleteStart = fullStart + (lastComment.index as number);
            const deleteEnd = fullStart + (lastComment.index as number) + lastComment[0].length;
            sourceFile.removeText(deleteStart, deleteEnd);
        }
        return;
    }
    
    if (action === "replace") {
        const newText = formatCommentText(content ?? "");
        const indent = hostNode.getIndentationText();
        const insertText = newText + "\n" + indent;
        
        if (comments.length > 0) {
            const lastComment = comments[comments.length - 1];
            const replaceStart = fullStart + (lastComment.index as number);
            const replaceEnd = fullStart + (lastComment.index as number) + lastComment[0].length;
            sourceFile.replaceText([replaceStart, replaceEnd], insertText.trimEnd());
        }
        else {
            sourceFile.insertText(start, insertText);
        }
        return;
    }
    
    if (action === "before") {
        sourceFile.insertText(fullStart, content as string);
        return;
    }
    
    if (action === "after") {
        sourceFile.insertText(start, content as string);
        return;
    }
};