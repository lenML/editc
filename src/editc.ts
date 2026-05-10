#!/usr/bin/env ts-node

import { Command } from "commander";
import { editCode } from "./editor";
import * as fs from "fs";
import * as path from "path";

const program = new Command();

program
    .name("editc")
    .description("Semantic code editing tool using AST selectors")
    .argument("<file>", "target file to edit")
    .requiredOption("--selector <query>", "AST selector, e.g., 'Class::MyService Method::hello Block'")
    .option("--replace <code>", "replace the node with given code")
    .option("--replace-file <filepath>", "load replacement code from a file")
    .option("--delete", "delete the targeted node")
    .option("--before <code>", "insert code before the node")
    .option("--after <code>", "insert code after the node")
    .option("--all", "apply edit to all matched nodes (global replace)")
    .option("--dry-run", "print result to stdout instead of writing file")
    .option("--backup", "create a .bak backup of the original file")
    .parse(process.argv);

const options = program.opts();
const filePath: string = path.resolve(program.args[0]);

const actions: (string | undefined)[] = [
    options.replace,
    options.replaceFile,
    options.delete,
    options.before,
    options.after
].filter(action => action !== undefined);

if (actions.length === 0) {
    console.error("Error: Must specify one action: --replace, --replace-file, --delete, --before, or --after.");
    process.exit(1);
}

if (actions.length > 1) {
    console.error("Error: Only one action can be specified at a time.");
    process.exit(1);
}

let replaceContent: string | undefined = options.replace;
if (options.replaceFile !== undefined) {
    try {
        replaceContent = fs.readFileSync(path.resolve(options.replaceFile), "utf-8");
    }
    catch (err: any) {
        console.error(`Error reading replace-file: ${err.message}.`);
        process.exit(1);
    }
}

const action: "replace" | "delete" | "before" | "after" = options.delete
    ? "delete"
    : options.before
        ? "before"
        : options.after
            ? "after"
            : "replace";

const content = replaceContent ?? options.before ?? options.after ?? undefined;

const main = async () => {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}.`);
        process.exit(1);
    }

    if (options.backup !== undefined) {
        const backupPath = filePath + ".bak";
        fs.copyFileSync(filePath, backupPath);
        console.error(`Backup created: ${backupPath}.`);
    }

    const sourceText = fs.readFileSync(filePath, "utf-8");

    let result: string;
    try {
        result = editCode(sourceText, {
            selector: options.selector,
            action,
            content,
            all: options.all === true
        });
    }
    catch (err: any) {
        console.error(`Edit failed: ${err.message}`);
        process.exit(1);
        return;
    }

    if (options.dryRun !== undefined) {
        console.log(result);
    }
    else {
        fs.writeFileSync(filePath, result, "utf-8");
        console.error(`File updated: ${filePath}.`);
    }
};

main().catch(err => {
    console.error("Unexpected error:", err);
    process.exit(1);
});