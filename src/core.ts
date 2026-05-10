import {
  Project,
  Node,
  SyntaxKind,
  SourceFile,
  ClassDeclaration,
  MethodDeclaration,
  ConstructorDeclaration,
  GetAccessorDeclaration,
  SetAccessorDeclaration,
  FunctionDeclaration,
  VariableDeclaration,
  PropertyAssignment,
  ObjectLiteralExpression,
  PropertyDeclaration,
} from "ts-morph";

export interface EditOptions {
  target: string;
  action: "replace" | "delete" | "before" | "after";
  content?: string;
  match?: string;
}

// ---------- AST PATH RESOLVER ----------
export function findNodeByPath(
  sourceFile: SourceFile,
  targetPath: string
): Node {
  const parts = targetPath.split(".");
  let currentNode: Node = sourceFile;

  for (const part of parts) {
    if (!currentNode) break;

    // 1) SourceFile root
    if (currentNode.isKind(SyntaxKind.SourceFile)) {
      const sf = currentNode as SourceFile;

      let next: Node | undefined = sf.getClass(part);
      if (!next) next = sf.getFunction(part);
      if (!next) {
        const varStmts = sf.getVariableStatements();
        for (const stmt of varStmts) {
          const decl = stmt.getDeclarations().find((d) => d.getName() === part);
          if (decl) {
            next = decl;
            break;
          }
        }
      }
      if (!next) throw new Error(`Path part "${part}" not found in file scope`);
      currentNode = next;
      continue;
    }

    // 2) Inside a class
    if (currentNode.isKind(SyntaxKind.ClassDeclaration)) {
      const cls = currentNode as ClassDeclaration;
      let member: Node | undefined;

      member = cls.getMethod(part);
      if (!member) member = cls.getStaticMethod(part);
      if (!member) member = cls.getProperty(part);
      if (!member) member = cls.getStaticProperty(part);
      if (!member) member = cls.getGetAccessor(part);
      if (!member) member = cls.getSetAccessor(part);

      if (part === "constructor") {
        const ctors = cls.getConstructors();
        member = ctors.length > 0 ? ctors[0] : undefined;
      }

      if (!member) {
        const nestedClass = cls
          .getChildren()
          .find(
            (c): c is ClassDeclaration =>
              Node.isClassDeclaration(c) && c.getName() === part
          );
        member = nestedClass;
      }

      if (!member)
        throw new Error(`Member "${part}" not found in class ${cls.getName()}`);
      currentNode = member;
      continue;
    }

    // 3) Method/Function/Constructor/Getter/Setter -> allow ".body"
    if (
      currentNode.isKind(SyntaxKind.MethodDeclaration) ||
      currentNode.isKind(SyntaxKind.Constructor) ||
      currentNode.isKind(SyntaxKind.GetAccessor) ||
      currentNode.isKind(SyntaxKind.SetAccessor) ||
      currentNode.isKind(SyntaxKind.FunctionDeclaration)
    ) {
      const funcLike = currentNode as
        | MethodDeclaration
        | ConstructorDeclaration
        | GetAccessorDeclaration
        | SetAccessorDeclaration
        | FunctionDeclaration;

      if (part === "body") {
        const body = funcLike.getBody();
        if (!body) {
          throw new Error(
            `Node at ${targetPath.substring(
              0,
              targetPath.lastIndexOf(".")
            )} has no body`
          );
        }
        currentNode = body;
        continue;
      }
      throw new Error(
        `Cannot navigate into ${currentNode.getKindName()} with "${part}". Only ".body" is supported.`
      );
    }

    // 4) VariableDeclaration -> navigate into object literal initializer
    if (currentNode.isKind(SyntaxKind.VariableDeclaration)) {
      const decl = currentNode as VariableDeclaration;
      const init = decl.getInitializer();
      if (!init) {
        throw new Error(`Variable "${decl.getName()}" has no initializer`);
      }
      if (Node.isObjectLiteralExpression(init)) {
        const prop = init.getProperty(part);
        if (!prop) {
          throw new Error(
            `Property "${part}" not found in object literal of variable "${decl.getName()}"`
          );
        }
        currentNode = prop;
        continue;
      }
      throw new Error(
        `Cannot navigate into variable "${decl.getName()}" — initializer is not an object literal`
      );
    }

    // 5) ObjectLiteralExpression -> navigate to property
    if (Node.isObjectLiteralExpression(currentNode)) {
      const obj = currentNode as ObjectLiteralExpression;
      const prop = obj.getProperty(part);
      if (!prop) {
        throw new Error(`Property "${part}" not found in object literal`);
      }
      currentNode = prop;
      continue;
    }

    // 6) PropertyAssignment -> navigate into value if it's an object literal
    if (Node.isPropertyAssignment(currentNode)) {
      const propAssign = currentNode as PropertyAssignment;
      const init = propAssign.getInitializer();
      if (!init) {
        throw new Error(`Property "${propAssign.getName()}" has no value`);
      }
      if (Node.isObjectLiteralExpression(init)) {
        const prop = init.getProperty(part);
        if (!prop) {
          throw new Error(
            `Property "${part}" not found in object literal of property "${propAssign.getName()}"`
          );
        }
        currentNode = prop;
        continue;
      }
      throw new Error(
        `Cannot navigate into property "${propAssign.getName()}" — value is not an object literal`
      );
    }

    // 7) Inside a block (no further navigation)
    if (currentNode.isKind(SyntaxKind.Block)) {
      throw new Error(
        "Cannot navigate inside a Block node; use a more specific path."
      );
    }

    // 8) Unsupported node type for navigation
    throw new Error(
      `Cannot navigate from node kind ${currentNode.getKindName()}`
    );
  }

  return currentNode;
}

// ---------- APPLY THE EDIT ----------
export function applyEdit(
  node: Node,
  action: "replace" | "delete" | "before" | "after",
  content?: string
): void {
  switch (action) {
    case "replace": {
      let text = content ?? "";

      // PropertyAssignment: replace only the value (initializer) part
      // e.g. config.port --replace "9876"  →  port: 9876
      if (Node.isPropertyAssignment(node)) {
        const init = node.getInitializer();
        if (init) {
          init.replaceWithText(text);
          break;
        }
      }

      // Block: auto-wrap in braces if missing
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
      // For PropertyAssignment, remove the whole property (including key + comma)
      (node as any).remove();
      break;
    }
    case "before": {
      const sf = node.getSourceFile();
      sf.insertText(node.getStart(), content!);
      break;
    }
    case "after": {
      const sf = node.getSourceFile();
      sf.insertText(node.getEnd(), content!);
      break;
    }
  }
}

// ---------- COMMENT EDIT ----------
function formatCommentText(text: string): string {
  const trimmedText = text.trim();
  if (trimmedText.startsWith("//") || trimmedText.startsWith("/*")) {
    return trimmedText;
  }
  if (trimmedText.includes("\n")) {
    const lines = trimmedText.split("\n");
    return `/**\n${lines.map((l) => ` * ${l}`).join("\n")}\n */`;
  }
  return `/** ${trimmedText} */`;
}

function applyCommentEdit(
  hostNode: Node,
  action: "replace" | "delete" | "before" | "after",
  content?: string
): void {
  const sf = hostNode.getSourceFile();

  // Helper to find the appropriate JSDoc host for VariableDeclaration
  let jsDocHost: Node = hostNode;
  if (Node.isVariableDeclaration(hostNode)) {
    const varStmt = hostNode.getFirstAncestorByKind(
      SyntaxKind.VariableStatement
    );
    if (varStmt) jsDocHost = varStmt;
  }

  // Try to use AST JSDoc nodes if available
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
        sf.insertText(lastDoc.getStart(), content!);
        return;
      }
      if (action === "after") {
        sf.insertText(lastDoc.getEnd(), content!);
        return;
      }
    }
  }

  // Fallback to text manipulation for line comments or nodes without JSDoc
  const fullStart = hostNode.getFullStart();
  const start = hostNode.getStart();
  const trivia = sf.getFullText().substring(fullStart, start);

  // Find leading comments in trivia
  const commentRegex = /(\/\*[\s\S]*?\*\/|\/\/.*)/g;
  const comments = [...trivia.matchAll(commentRegex)];

  if (action === "delete") {
    if (comments.length > 0) {
      const lastComment = comments[comments.length - 1];
      const deleteStart = fullStart + lastComment.index!;
      const deleteEnd = fullStart + lastComment.index! + lastComment[0].length;
      sf.removeText(deleteStart, deleteEnd);
    }
    return;
  }

  if (action === "replace") {
    const newText = formatCommentText(content ?? "");
    const indent = hostNode.getIndentationText();
    const insertText = newText + "\n" + indent;

    if (comments.length > 0) {
      const lastComment = comments[comments.length - 1];
      const replaceStart = fullStart + lastComment.index!;
      const replaceEnd = fullStart + lastComment.index! + lastComment[0].length;
      sf.replaceText([replaceStart, replaceEnd], insertText.trimEnd());
    } else {
      sf.insertText(start, insertText);
    }
    return;
  }

  if (action === "before") {
    sf.insertText(fullStart, content!);
    return;
  }
  if (action === "after") {
    sf.insertText(start, content!);
    return;
  }
}

// ---------- MAIN ENTRY POINT ----------
export function editCode(sourceText: string, options: EditOptions): string {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("input.ts", sourceText);

  let targetPath = options.target;
  let isCommentEdit = false;

  if (targetPath.endsWith(".#comment")) {
    isCommentEdit = true;
    targetPath = targetPath.slice(0, -".#comment".length);
  }

  let targetNode = findNodeByPath(sourceFile, targetPath);

  // Handle --match: find a specific statement inside a Block/SourceFile
  if (options.match) {
    if (
      !Node.isBlock(targetNode) &&
      !targetNode.isKind(SyntaxKind.SourceFile)
    ) {
      throw new Error(
        "--match can only be used when target is a Block or SourceFile"
      );
    }
    const statements = Node.isBlock(targetNode)
      ? targetNode.getStatements()
      : (targetNode as SourceFile).getStatements();

    const matchPrefix = options.match.trimStart();
    const matchedStatement = statements.find((s) =>
      s.getText().startsWith(matchPrefix)
    );

    if (!matchedStatement) {
      throw new Error(`No statement found matching prefix: "${options.match}"`);
    }
    targetNode = matchedStatement;
  }

  if (isCommentEdit) {
    applyCommentEdit(targetNode, options.action, options.content);
  } else {
    applyEdit(targetNode, options.action, options.content);
  }

  return sourceFile.getFullText();
}
