import { OptionProperties, CategoryProperties } from "./options";
import { optionManager } from "../extension";
import { isUndefined } from "util";

import * as vscode from "vscode";
import { DEFAULT_CHECKER, chooseChecker } from "../execute/checker";

// tslint:disable:curly
/**
 * Tries to parse an integer value, and returns undefined if it's not possible
 * @param val Value to parse
 */
function tryParseInt(val: string | undefined): number | undefined {
    if (isUndefined(val) || isNaN(parseInt(val))) return undefined;
    return parseInt(val);
}

export const OPTIONS: Map<string, Map<string, OptionProperties>> = new Map([
    ['buildAndRun', new Map([
        ['curTestSet', {
            defaultValue: 'default',
            label: 'Current Test Set',
            description: 'The name of the current test set.  This is modified using the Input/Output panel',
            type: 'string',
            setFunction: async () => optionManager!.get('buildAndRun', 'curTestSet')
        }],
        ['defaultChecker', {
            defaultValue: DEFAULT_CHECKER,
            label: 'Default checker',
            description: 'Default checker for test cases',
            type: 'string',
            setFunction: chooseChecker
        }],
        ['timeout', {
            defaultValue: 5000,
            label: 'Timeout (ms)',
            description: 'Maximum program execution time.  The program will timeout if this threshold is reached',
            type: 'number',
            setFunction: async () => 
                tryParseInt(await vscode.window.showInputBox({
                    prompt: 'New Timeout',
                    placeHolder: 'timeout (ms)',
                    value: optionManager!.get('buildAndRun', 'timeout')
                }))
        }],
        ['memSample', {
            defaultValue: 500,
            label: 'Memory + Time Sample Interval',
            description: 'How quickly memory and time are sampled when a program is running',
            type: 'number',
            setFunction: async () => 
                tryParseInt(await vscode.window.showInputBox({
                    prompt: 'New Sample Interval',
                    placeHolder: 'Sample Interval (ms)',
                    value: optionManager!.get('buildAndRun', 'memSample')
                }))
        }],
        ['charLimit', {
            defaultValue: 2000000,
            label: 'Character Limit',
            description: 'The displays for stdout and stderr will be truncated to prevent memory/lag problems',
            type: 'number',
            setFunction: async () => 
                tryParseInt(await vscode.window.showInputBox({
                    prompt: 'New Character limit',
                    placeHolder: 'Character Limit',
                    value: optionManager!.get('buildAndRun', 'charLimit')
                }))
        }]
    ])],
    ['compilerArgs', new Map([
        ['cpp', {
            defaultValue: '-Wall -O0 -DLOCAL',
            label: 'C++',
            description: 'Compiler: g++ -o <executable> <source file> <args>',
            type: 'string',
            setFunction: async () => 
                await vscode.window.showInputBox({
                    prompt: 'New Compiler Args',
                    placeHolder: 'C++ compiler args (space separated)',
                    value: optionManager!.get('compilerArgs', 'cpp')
                })
        }]
    ])],
    ['misc', new Map([
        ['testSetBackupTime', {
            defaultValue: 300000,
            label: 'Test Set Backup Time',
            description: 'Time delay for backing up test sets (every once in a while the test set data is rewritten to .vscode/testSets.json).  VSCode must be reloaded for changes to take effect',
            type: 'number',
            setFunction: async () =>
                tryParseInt(await vscode.window.showInputBox({
                    prompt: 'Test set backup time',
                    placeHolder: 'Backup time (ms)',
                    value: optionManager!.get('misc', 'testSetBackupTime')
                }))
        }]
    ])]
]);

export const CATEGORY_PROPERTIES: Map<string, CategoryProperties> = new Map([
    ['buildAndRun', {
        label: 'Build and Run',
        description: 'General options for Build and Run'
    }],
    ['compilerArgs', {
        label: 'Compiler/Interpreter Arguments',
        description: 'Arguments for compilers/interpreters when building and running'
    }],
    ['misc', {
        label: 'Miscellaneous things',
        description: 'Other settings that don\'t have to do with any of the above categories'
    }]
]);
