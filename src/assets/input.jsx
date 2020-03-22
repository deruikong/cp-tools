import React from 'react';
import ReactDOM from 'react-dom';
import EventBus from './vscodeEventBus';
import toErrorBoundedElement from './toErrorBoundedElement';
import { CommandHandler } from '../commandHandler';
import './scss/input.scss';
import { isUndefined } from 'util';

class InputDisplay extends React.Component {
    constructor(props) {
        super(props);

        // Initialize state
        this.state = {
            // Command State info
            curCommand: '',
            lastCommandOutput: null,

            // Current test set being viewed state info
            curTestSet: null,
            curTestIndex: null,
            curTestInput: null,
            curTestOutput: null,

            // Test cases
            cases: {}
        };
        
        // Initialize other event handlers
        EventBus.on('caseCommand', resp => this.setState({ lastCommandOutput: resp }));
        EventBus.on('updateAll', evt => {
            if (evt.curTestIndex === null) {
                Object.assign(evt, {
                    curTestInput: null,
                    curTestOutput: null
                });
            }
            else if (evt.curTestIndex !== undefined && evt.curTestIndex !== null) {
                Object.assign(evt, {
                    curTestInput: evt.cases[evt.curTestSet][evt.curTestIndex].input,
                    curTestOutput: evt.cases[evt.curTestSet][evt.curTestIndex].output
                });
            }

            this.setState(evt);
        });
        EventBus.on('updateStructure', _ => { throw new Error('Not implemented yet (defunct)'); });
        EventBus.on('updateCase', caseUpdate => {
            const casesObj = this.state.cases;
            casesObj[caseUpdate.key][caseUpdate.index][caseUpdate.isInput ? 'input' : 'output'] = caseUpdate.newData;
        });

        // Initialize command handler types
        const testSetArg = {
            isValid: (_, __, key) => this.state.cases[key] !== undefined ? null : `Test set '${key}' does not exist`,
            parse: (_, __, key) => key
        };
        const testIndexArg = { // sometimes, you want to be able to input indexes "past the end" (i.e. when using insertCase to push a case at the end)
            isValid: (key, _, index) => {
                if (isNaN(parseInt(index))) return `${index} is not a number`;
                const indexNum = parseInt(index);
                return 0 <= indexNum && indexNum < this.state.cases[key].length ? null : `Test number ${indexNum} out of range`;
            },
            parse: (_, __, arg) => parseInt(arg)
        };

        // Initialize command handler
        this.commandHandler = new CommandHandler(
            command => EventBus.post('caseCommand', { key: this.state.curTestSet, index: this.state.curTestIndex, command }),
            message => this.setState({ lastCommandOutput: message })
        )
        this.commandHandler.registerCommand('listcommands', () => {
            return 'Commands list: listcommands, select, selectcase, open, insert, insertcase, delete, deletecase, swap, swapcase, pushcase, rename, enable, disable'
        }, [], false, false, ['help']);
        this.commandHandler.registerCommand('select', (_, __, key) => {
            this.selectTestSet(key);
            return null;
        }, [testSetArg], false, false, ['sel', 's']);
        this.commandHandler.registerCommand('selectcase', (_, __, index) => {
            this.saveAndSelectTestCase(index);
            return null;
        }, [testIndexArg], true, false, ['selcase', 'selc', 'sc']);

        // Add key listener
        this._keyListener = function(e) {
            const lowerKey = e.key.toLowerCase();

            if (e.key === 'Enter') // user pressed enter
                this.dispatchCommand();
            else if (e.ctrlKey && lowerKey === 's') // user pressed Ctrl+S, Save current case 
                this.saveCurTestCase();
            else if (e.ctrlKey && lowerKey === 'r') { // user pressed Ctrl+R, Refresh all cases
                EventBus.post('updateAll');
                e.preventDefault();
            }
        };
        document.addEventListener('keydown', this._keyListener.bind(this));

        // We're ready!
        EventBus.post('updateAll');
    }

    componentWillUnmount() {
        // Unregister key listener
        document.removeEventListener('keydown', this._keyListener);
    }

    /**
     * Sends a command back to the extension host
     */
    dispatchCommand() {
        if (this.state.curCommand === null || this.state.curCommand.length === 0) return; // Empty command
        this.commandHandler.dispatchCommand(this.state.curCommand.trim(), this.state.curTestSet, this.state.curTestIndex); // Trim curCommand so end whitespace isnt counted as arguments
        this.setState({ curCommand: '' });
    }

    /**
     * Selects a test set (for viewing/editing)
     * @param {string} testSetName The name of the test set to select (assumed valud)
     * @param {function} callback Callback for the setState call of this function
     */
    selectTestSet(testSetName, callback) {
        this.setState({ curTestSet: testSetName }, () => {
            let newIndex = this.state.curTestIndex || 0;
            if (newIndex >= this.state.cases[testSetName].length) newIndex = null;
            this.selectTestCase(newIndex, callback, false);
            EventBus.post('selectTestSet', testSetName);
        });
    }

    /**
     * Selects a test case (for viewing/editing)
     * @param {string} index The index of the test case to select. Null can also be specified to deselect the currently selected test case.
     * @param {function} callback Callback for the setState call of this function
     * @param {boolean} saveCases Whether to save the cases before switching indices, defaults to true.  Set this to false if saving the current test case would constitute a duplicate action
     */
    selectTestCase(index, callback) {
        if (index === null) {
            this.setState({
                curTestIndex: null,
                curTestInput: null,
                curTestOutput: null
            }, callback);
        }
        else {
            this.setState({
                curTestIndex: index,
                curTestInput: this.state.cases[this.state.curTestSet][index].input,
                curTestOutput: this.state.cases[this.state.curTestSet][index].output,
            }, callback);
        }
    }

    /**
     * Save the data of the current edited test case
     */
    saveCurTestCase() {
        const key = this.state.curTestSet, index = this.state.curTestIndex;
        if (key === null || index === null) return; // Can't save null test set!
        EventBus.post('updateCase', { key, index, isInput: true, newData: this.state.curTestInput });
        EventBus.post('updateCase', { key, index, isInput: false, newData: this.state.curTestOutput });
    }

    /**
     * Saves the data of the current edited case, and selects a test case
     * @param {number} index The index of case to select
     */
    saveAndSelectTestCase(index) {
        this.saveCurTestCase();
        this.selectTestCase(index);
    }

    render() {
        const { curCommand } = this.state;

        return (
            <div>
                <h1>Test Cases</h1>
                <a id="refresh-link" href="#" onClick={() => EventBus.post('updateAll')}>Refresh (Ctrl+R)</a>

                {/* Command input/output */}
                <div id="command-input-div">
                    <input placeholder="Type a command here..." value={curCommand} onChange={e => this.setState({ curCommand: e.target.value })}></input>
                    <button onClick={() => this.dispatchCommand()}>Run (Enter)</button>
                </div>

                { this.state.lastCommandOutput &&
                    <p style={{whitespace: 'pre'}}>{this.state.lastCommandOutput}</p>
                }

                <div id="test-set-display-div">
                    {/* Display status of current test set and test case selection menu */}
                    <div id="test-set-display">
                        { !!this.state.curTestSet ?
                            <table>
                                <tr>
                                    <th>Case</th>
                                    <th>On/Off</th>
                                    <th>Edit Input</th>
                                    <th>Edit Output</th>
                                </tr>
                                { this.state.cases[this.state.curTestSet].map(testCase => 
                                    <tr key={testCase.index}>
                                        <td><span className={this.state.curTestIndex === testCase.index && 'selected-case'}>
                                            {testCase.index}
                                        </span></td>
                                        <td><span className={['test-' + (testCase.disabled ? 'off' : 'on'), this.state.curTestIndex === testCase.index && 'selected-case'].join(' ')}>
                                            {testCase.disabled ? 'Disabled' : 'Enabled'}
                                        </span></td>
                                        <td><span className={this.state.curTestIndex === testCase.index && 'selected-case'}>
                                            <a onClick={() => EventBus.post('openCaseFile', { key: this.state.curTestSet, index: testCase.index, isInput: true })}>Edit</a>
                                        </span></td>
                                        <td><span className={this.state.curTestIndex === testCase.index && 'selected-case'}>
                                            <a onClick={() => EventBus.post('openCaseFile', { key: this.state.curTestSet, index: testCase.index, isInput: false })}>Edit</a>
                                        </span></td>
                                    </tr>
                                )}
                            </table> :
                            <p class="none-selected">No test set selected...</p>
                        }
                    </div>

                    <div id="test-set-list">
                        <h2>Test Sets</h2>
                        <ul>
                            { Object.entries(this.state.cases).map(([testSetName, testSet]) => 
                                <li key={testSetName} class={this.state.curTestSet === testSetName ? 'selected-case' : null}>
                                    <a onClick={this.selectTestSet.bind(this, testSetName)}>[ {testSetName}, {testSet.length} cases ]</a>
                                </li>
                            )}
                        </ul>
                    </div>
                </div>

                {/* Select Test Case to Edit */}
                { !!this.state.curTestSet &&
                    <div class="selection">
                        <span>Test Cases: </span>
                        { this.state.cases[this.state.curTestSet].map((_, index) =>
                            <a key={index} class={this.state.curTestIndex === index ? 'selected-case' : null}
                                onClick={this.saveAndSelectTestCase.bind(this, index)}>[ {index} ]</a>
                        )}
                    </div>
                }

                {/* Editing test cases */}
                <h2>Editing Case {this.state.curTestIndex}</h2>
                <div>
                    { this.state.curTestIndex !== null ? (
                        <React.Fragment>
                            <div id="data-input">
                                <div>
                                    <h3>Input</h3>
                                    <textarea rows="20" value={this.state.curTestInput} onChange={e => this.setState({ curTestInput: e.target.value})}></textarea>
                                </div>

                                <div>
                                    <h3>Output</h3>
                                    <textarea rows="20" placeholder="[ no expected output ]" 
                                        value={this.state.curTestOutput} onChange={e => this.setState({ curTestOutput: e.target.value})}></textarea>
                                </div>
                            </div>

                            <button id="save-button" onClick={this.saveCurTestCase.bind(this)}>Save (Ctrl+S)</button>
                        </React.Fragment>
                    ) : <p class="none-selected">No test case selected...</p> }
                </div>
            </div>
        );
    }
}

let App = document.getElementById('app');
const ErrorBoundedDisplay = toErrorBoundedElement(InputDisplay);
ReactDOM.render(<ErrorBoundedDisplay />, App);
