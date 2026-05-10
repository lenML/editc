import { Node, SyntaxKind } from "ts-morph";
import { SelectorPart } from "./types";

/**
 * Friendly aliases for common SyntaxKinds.
 */
const kindAliases: Record<string, SyntaxKind> = {
    Class: SyntaxKind.ClassDeclaration,
    Method: SyntaxKind.MethodDeclaration,
    Function: SyntaxKind.FunctionDeclaration,
    Variable: SyntaxKind.VariableDeclaration,
    VariableStatement: SyntaxKind.VariableStatement,
    Property: SyntaxKind.PropertyDeclaration,
    PropertyAssignment: SyntaxKind.PropertyAssignment,
    Constructor: SyntaxKind.Constructor,
    Getter: SyntaxKind.GetAccessor,
    Setter: SyntaxKind.SetAccessor,
    Block: SyntaxKind.Block,
    ForBlock: SyntaxKind.ForStatement,
    IfBlock: SyntaxKind.IfStatement,
    WhileBlock: SyntaxKind.WhileStatement,
    Return: SyntaxKind.ReturnStatement
};

/**
 * Tokenizes a selector string into individual parts.
 */
export const tokenizeSelector = (selector: string): string[] => {
    const tokens: string[] = [];
    let current = "";
    let inQuote: string | undefined = undefined;

    for (let i = 0; i < selector.length; i++) {
        const char = selector[i];
        if (inQuote !== undefined) {
            current += char;
            if (char === inQuote) {
                inQuote = undefined;
            }
        }
        else if (char === "\"" || char === "'") {
            inQuote = char;
            current += char;
        }
        else if (char === " ") {
            if (current !== "") {
                tokens.push(current);
                current = "";
            }
        }
        else {
            current += char;
        }
    }
    
    if (current !== "") {
        tokens.push(current);
    }

    return tokens;
};

/**
 * Parses a single token into a selector part object.
 */
export const parseSelectorPart = (token: string): SelectorPart => {
    const result: SelectorPart = {};
    let currentToken = token;

    if (currentToken.endsWith(":comment")) {
        result.isComment = true;
        currentToken = currentToken.slice(0, -8);
    }

    const attrMatch = currentToken.match(/\[text\^=(["'])(.*?)\1\]$/);
    if (attrMatch !== null && attrMatch !== undefined) {
        result.textPrefix = attrMatch[2];
        currentToken = currentToken.slice(0, attrMatch.index);
    }

    const doubleColonIndex = currentToken.indexOf("::");
    if (doubleColonIndex !== -1) {
        result.name = currentToken.slice(doubleColonIndex + 2);
        currentToken = currentToken.slice(0, doubleColonIndex);
    }

    if (currentToken !== "") {
        result.kind = currentToken;
    }

    return result;
};

/**
 * Checks if a given node matches the selector part.
 */
export const nodeMatchesSelector = (node: Node, sel: SelectorPart): boolean => {
    if (sel.kind !== undefined) {
        let expectedKind = kindAliases[sel.kind];
        
        if (expectedKind === undefined) {
            expectedKind = (SyntaxKind as any)[sel.kind];
        }

        if (expectedKind !== undefined) {
            if (node.getKind() !== expectedKind) {
                return false;
            }
        }
        else {
            const kindName = node.getKindName();
            if (kindName !== sel.kind && kindName !== `${sel.kind}Declaration` && kindName !== `${sel.kind}Statement`) {
                return false;
            }
        }
    }

    if (sel.name !== undefined) {
        let nodeName: string | undefined = undefined;
        if ("getName" in node && typeof (node as any).getName === "function") {
            nodeName = (node as any).getName();
        }
        else if (node.isKind(SyntaxKind.Identifier)) {
            nodeName = node.getText();
        }
        
        if (nodeName !== sel.name) {
            return false;
        }
    }

    if (sel.textPrefix !== undefined) {
        if (!node.getText().startsWith(sel.textPrefix)) {
            return false;
        }
    }

    return true;
};

/**
 * Queries the AST for all nodes matching the selector.
 */
export const querySelectorAll = (rootNode: Node, selectorText: string): { node: Node; isComment: boolean }[] => {
    const tokens = tokenizeSelector(selectorText);
    if (tokens.length === 0) {
        return [];
    }

    const selectors = tokens.map(parseSelectorPart);
    let currentNodes = [rootNode];

    for (let i = 0; i < selectors.length; i++) {
        const sel = selectors[i];
        const nextNodes = new Set<Node>();

        for (const node of currentNodes) {
            if (i === 0 && nodeMatchesSelector(node, sel)) {
                nextNodes.add(node);
            }
            
            node.forEachDescendant(childNode => {
                if (nodeMatchesSelector(childNode, sel)) {
                    nextNodes.add(childNode);
                }
            });
        }

        currentNodes = Array.from(nextNodes);
        if (currentNodes.length === 0) {
            break;
        }
    }

    const lastSel = selectors[selectors.length - 1];
    const isComment = lastSel !== undefined && lastSel.isComment === true;

    return currentNodes.map(node => ({ node, isComment }));
};