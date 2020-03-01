/**
 * Copyright (C) 2017 Auralia
 * Modifications copyright (C) 2020 dithpri (Racoda)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {NsApi} from "nsapi";
import Ui from "./ui";
import * as util from "util";

/**
 * Represents the operating mode of goldretriever-web.
 */
export enum Mode {
    Bank_DV,
    Auto
}

/**
 * Represents a nation name and associated password.
 */
export interface Credential {
    nation: string,
    password: string|null
}

export interface LogTableRow {
    nation: string,
    bank: string,
    dv: string,
    issues: string,
    packs: string
}

/**
 * Contains the main application logic.
 */
export default class App {
    private _cancel: boolean;
    private _pause: boolean;
    // @ts-ignore
    private _userAgent: string;

    /**
     * Initializes a new instance of the App class.
     */
    constructor() {
        this.reset();
    }

    /**
     * Converts names to a fixed form: all lowercase, with spaces replaced
     * with underscores.
     *
     * @param name The name to convert.
     *
     * @return The converted name.
     *
    private static toId(name: string) {
        return name.replace("_", " ")
                   .trim()
                   .toLowerCase()
                   .replace(" ", "_");
    }*/

    /**
     * Sleeps for the specified number of milliseconds.
     *
     * @param ms The number of milliseconds to sleep.
     *
     * @return A promise fired after sleeping for the specified number of
     * milliseconds.
     */
    private static async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Logs into or restores the nations given by the specified credentials,
     * depending on the mode specified.
     *
     * @param userAgent The user agent specified by the user.
     * @param rateLimit The rate limit to be used by the API.
     * @param mode The operating mode of the application.
     * @param credentials The names and passwords of the nations to log into or
     *                    restore.
     * @param verbose Whether or not to print out detailed error messages.
     */
    public async start(userAgent: string, rateLimit: number, mode: Mode,
                       credentials: Credential[],
                       verbose: boolean): Promise<void>
    {
        this.reset();

        this._userAgent = `goldretriever-web-dev (maintained by dithpri/Racoda, currently`
                          + ` used by "${userAgent}")`;

        const api = new NsApi(userAgent, true, rateLimit);

        try {
            if (mode === Mode.Auto) {
                Ui.log("info", "Auto mode");
                await this.auto(api, credentials, verbose);
            } else if (mode === Mode.Bank_DV) {
                Ui.log("info", "Bank/DV");
                await this.getNationsBankDV(api, credentials, verbose);
            } else {
                throw new Error("Unrecognized mode");
            }
        } finally {
            api.cleanup();
        }

        if (this._cancel) {
            Ui.log("info", "Process cancelled.");
        } else {
            Ui.log("info", "Process complete.");
        }
        await this.waitUntilUnpaused();

        Ui.handleFinish();
    }

    /**
     * Cancels the current activity being performed by the app.
     */
    public cancel() {
        Ui.log("info", "Cancelling...");
        this._cancel = true;
        this._pause = false;
    }

    /**
     * Pauses the current activity.
     */
    public pause() {
        Ui.log("info", "Pausing...");
        this._pause = true;
    }

    /**
     * Resumes the current activity.
     */
    public unpause() {
        Ui.log("info", "Unpausing...");
        this._pause = false;
    }

    /**
     * Returns whether the app is paused.
     *
     * @return Whether the app is paused.
     */
    public isPaused() {
        return this._pause;
    }

    /**
     * Resets the app.
     */
    private reset() {
        this._cancel = false;
        this._pause = false;
    }

    /**
     * TODO
     *
     * @param api The NsApi instance to use.
     * @param credentials The names and passwords of the nations
     * @param verbose Whether or not to print out detailed error messages.
     */
    private async auto(api: NsApi, credentials: Credential[],
                       verbose: boolean): Promise<void> {
        for (const credential of credentials) {
            if (this._cancel) {
                break;
            }
            await this.waitUntilUnpaused();
            try {
                // function scope
                var result: LogTableRow = <LogTableRow> await this.getSingleNationBankDV(api, credential);
            } catch(err) {
                Ui.log("error", "Bank/DV retrieval failed");
                continue;
            }
            if (credential.password !== null) {
                try {
                    let result2: LogTableRow | null = await this.getSingleNationIssuesPacks(api, credential);
                    if (result2 !== null && result2 !== undefined) {
                        result.issues = result2.issues;
                        result.packs = result2.packs;
                    }
                } catch(err) {
                    Ui.log("error", "Issue/Pack retrieval failed.")
                    if (verbose) {
                        Ui.log("error", util.inspect(err))
                    }
                }
            }
            Ui.log_tabledata(result);
        }
    }

    private async getNationsBankDV(api: NsApi,
                                  credentials: Credential[],
                                  verbose: boolean): Promise<void> {
        for (const credential of credentials) {
            if (this._cancel) {
                break;
            }
            await this.waitUntilUnpaused();
            try {
                const row: LogTableRow = await this.getSingleNationBankDV(api, credential);
                Ui.log_tabledata(row);
            } catch(err) {
                Ui.log("error", "Bank/DV retrieval failed");
                if (verbose) {
                    Ui.log("error", util.inspect(err))
                }
            }
        }
    }

    private async getSingleNationIssuesPacks(api: NsApi,
                                        credential: Credential): Promise<LogTableRow> {
        if (credential.password === null) {
            throw new Error("Tried to retrieve Issues/Packs without a password.");
        }
        Ui.log("info", `${credential.nation}: Retrieving Issues and Packs`);
        const response = await api.nationRequest(credential.nation,
            ["packs", "issues"],
            undefined,
            {password: <string>credential.password},
            true);
        const packs: string = response.packs;
        let issues: string = "0";
        if (Array.isArray(response.issues.issue)) {
            issues = response.issues.issue.length;
        } else if (response.issues.issue) {
            issues = "1";
        } else {
            issues = "0";
        }
        return {
            nation: credential.nation,
            bank: "N/A",
            dv: "N/A",
            issues: issues,
            packs: packs
        };
    }


    private async getSingleNationBankDV(api: NsApi,
                                  credential: Credential): Promise<LogTableRow> {
        Ui.log("info", `${credential.nation}: Retrieving Bank and DV`);
        // A hack, cards api is not available in node-nsapi
        const response = await api.worldRequest(["cards", "info"], {"nationname":credential.nation});
        if (response.info === "") {
            throw new Error("Received empty response. Does the nation exist?");
        }
        return {
            nation: credential.nation,
            bank: response.info.bank,
            dv: response.info.deck_value,
            issues: "N/A",
            packs: "N/A"
        };
    }

    /**
     * Sleeps until unpaused.
     *
     * @return A promise fired when the app is unpaused.
     */
    private async waitUntilUnpaused() {
        while (this._pause) {
            await App.sleep(1000);
        }
    }
}
