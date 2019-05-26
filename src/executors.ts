import * as sub from 'child_process';
import * as fs from 'fs';
import * as pidusage from 'pidusage';
import { optionManager } from './extension';
import { isUndefined, isNull } from 'util';

// -----------------------------------------------------------------------------------------------------------------------------
// Result Interfaces
// -----------------------------------------------------------------------------------------------------------------------------
enum ResultType {
    SUCCESS = 'Success', 
    TIMEOUT = 'Timeout', 
    RUNTIME_ERROR = 'Runtime Error', 
    INTERNAL_ERROR = 'Internal Error (spawn() call failed)'
}

export interface Result {
    exitType: ResultType; // Type of result
    exitDetail: string; // Any other details associated with the result type.  Ommitted for Success
    error?: string; // The error of the program.
    output?: string; // The output of the program.  Ommitted if result was TIMEOUT
    execTime: number; // Execution Time
    memoryUsage: number; // Memory Usage
}

export interface Executor {
    srcFile: string; // Source file
    execFile?: string | undefined; // Executable file.  Null if not compiled yet
    preExec: () => string; // Compilation - Returns file name of executable created (to be run)
    exec: (input: string) => sub.SpawnSyncReturns<Buffer>; // Execution - Runs the file with the input, and returns the SpawnSyncBuffer returned
    postExec: () => void; // Post execution - Any 
}

export async function interpretReturnBuffer(ret: sub.SpawnSyncReturns<Buffer>): Promise<Result> {
    const stats = await pidusage(ret.pid), execTime = stats.elapsed, memoryUsage = stats.memory / 1024.;

    if (!isUndefined(ret.error)) {
        return {
            exitType: ResultType.INTERNAL_ERROR,
            exitDetail: `spawn() call failed: ${ret.error.name}: ${ret.error.message}`,
            execTime,
            memoryUsage
        };
    }

    const output = ret.stdout.toString(), error = ret.stderr.toString();

    if (!isNull(ret.signal)) {
        return {
            exitType: ret.signal === 'SIGTERM' ? ResultType.TIMEOUT : ResultType.RUNTIME_ERROR,
            exitDetail: `Killed by Signal: ${ret.signal}` + (ret.signal === 'SIGTERM' ? ' (Possible timeout?)' : ''),
            output,
            error,
            execTime,
            memoryUsage
        };
    }

    var exitDetail: string = `Exit code: ${ret.status}`;
    if (ret.status > 255) {
        exitDetail += ' (Possible Segmentation Fault?)';
    }

    return {
        exitType: ret.status !== 0 ? ResultType.RUNTIME_ERROR : ResultType.SUCCESS,
        exitDetail,
        output,
        error,
        execTime,
        memoryUsage
    };
}

function getTimeoutOption(): number {
    return optionManager().get('buildAndRun', 'timeout');
}

// -----------------------------------------------------------------------------------------------------------------------------
// Executors
// -----------------------------------------------------------------------------------------------------------------------------
class CPPExecutor implements Executor {
    srcFile: string;
    execFile: string | undefined;

    constructor(srcFile: string) {
        this.srcFile = srcFile;
        this.execFile = undefined;
    }

    preExec(): string {
        this.execFile = this.srcFile.substring(0, this.srcFile.length - 3) + 'exe';
        sub.spawnSync(`g++ -o ${this.execFile} ${this.srcFile} ${optionManager().get('compilerArgs', 'cpp')}`);
        return this.execFile;
    }

    exec(input: string): sub.SpawnSyncReturns<Buffer> {
        if (isUndefined(this.execFile)) {
            throw new Error('File not compiled yet!');
        }

        return sub.spawnSync(this.execFile, {
            timeout: getTimeoutOption(),
            input: input
        });
    }

    postExec() {
        if (isUndefined(this.execFile)) {
            throw new Error('File not compiled yet!');
        }

        fs.unlinkSync(this.execFile);
    }
}

class PYExecutor implements Executor {
    srcFile: string;

    constructor(srcFile: string) {
        this.srcFile = srcFile;
    }

    preExec(): string { return this.srcFile; }

    exec(input: string): sub.SpawnSyncReturns<Buffer> {
        return sub.spawnSync(`py ${this.srcFile}`, {
            timeout: getTimeoutOption(),
            input: input
        });
    }

    postExec() {}
}

export const executors: Map<string, new (srcFile: string) => Executor> = new Map([
    ['cpp', CPPExecutor],
    ['py', PYExecutor]
]);