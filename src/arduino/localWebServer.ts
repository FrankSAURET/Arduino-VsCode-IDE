// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as bodyParser from "body-parser";
import * as crypto from "crypto";
import * as express from "express";
import * as http from "http";
import * as path from "path";
import { Uri } from "vscode";

export default class LocalWebServer {
    private app = express();
    private server;
    private _authToken: string;

    constructor(private _extensionPath: string) {
        // Generate a cryptographically random token for request authentication (CVE-2024-43488 fix)
        this._authToken = crypto.randomBytes(32).toString("hex");

        this.app.use("/", express.static(path.join(this._extensionPath, "./out/views")));
        this.app.use(bodyParser.json());

        // Authenticate all /api/ requests with the token
        this.app.use("/api", (req, res, next) => {
            const token = req.headers["x-auth-token"] || req.query.token;
            if (token !== this._authToken) {
                return res.status(403).send("Forbidden: invalid authentication token");
            }
            next();
        });

        this.server = http.createServer(this.app);
    }

    public get authToken(): string {
        return this._authToken;
    }

    public getServerUrl(): string {
        return `http://localhost:${this.server.address().port}`;
    }

    public getEndpointUri(type: string): Uri {
        return Uri.parse(`http://localhost:${this.server.address().port}/${type}`);
    }

    public addHandler(url: string, handler: (req, res) => void): void {
        this.app.get(url, handler);
    }

    public addPostHandler(url: string, handler: (req, res) => void): void {
        this.app.post(url, handler);
    }

    /**
     * Start webserver.
     * If it fails to listen reject will report its error.
     */
    public async start() {
        return new Promise<void>((resolve, reject) => {
            // Address and port are available as soon as the server
            // started listening, resolving localhost requires
            // some time.
            this.server.listen(0, "localhost", (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                // tslint:disable-next-line
                console.log(`Express server listening on port: ${this.server.address().port}`);
                resolve();
            });
        });
    }
}
