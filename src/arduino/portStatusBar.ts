// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";

import * as constants from "../common/constants";
import { ISerialPortDetail, listSerialPorts } from "../common/portList";
import { DeviceContext } from "../deviceContext";
import { checkUploadPort, IUploadPortCheck } from "./uploadPort";

/**
 * Port série du projet dans la barre d'état, en avertissement tant qu'il est vide
 * ou débranché : le défaut se voit avant de téléverser, pas vingt secondes après.
 */
export class PortStatusBar implements vscode.Disposable {

    public static getInstance(): PortStatusBar {
        if (!PortStatusBar._instance) {
            PortStatusBar._instance = new PortStatusBar();
        }
        return PortStatusBar._instance;
    }

    /** Appelé à la désactivation : un minuteur armé empêcherait l'hôte de s'arrêter. */
    public static disposeCurrent() {
        if (PortStatusBar._instance) {
            PortStatusBar._instance.dispose();
            PortStatusBar._instance = undefined;
        }
    }

    private static _instance: PortStatusBar | undefined;

    /** Délai entre deux relevés des ports : un débranchement ne produit aucun événement exploitable partout. */
    private static readonly POLL_INTERVAL_MS = 4000;

    private _item: vscode.StatusBarItem;
    private _disposables: vscode.Disposable[] = [];
    private _timer: NodeJS.Timeout | undefined;
    /** Numéro du dernier relevé lancé : un relevé lent ne doit pas écraser un plus récent. */
    private _refreshSeq = 0;
    private _isBusy: () => boolean = () => false;
    private _needsPort: () => boolean = () => true;

    private constructor() {
        this._item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, constants.statusBarPriority.PORT);
        this._item.command = "arduino.selectSerialPort";
    }

    /**
     * @param isBusy vrai pendant un téléversement : la carte y disparaît un instant du bus USB,
     *  l'avertissement clignoterait pour rien.
     * @param needsPort faux quand le téléversement se passe de port série (ST-Link).
     */
    public start(isBusy: () => boolean, needsPort: () => boolean) {
        this._isBusy = isBusy;
        this._needsPort = needsPort;
        if (this._timer) {
            return;
        }
        const dc = DeviceContext.getInstance();
        this._disposables.push(
            dc.onChangePort(() => this.refresh()),
            dc.onChangeConfiguration(() => this.refresh()),
            vscode.window.onDidChangeWindowState((state) => {
                if (state.focused) {
                    this.refresh();
                }
            }),
        );
        this._timer = setInterval(() => {
            if (vscode.window.state.focused && !this._isBusy()) {
                this.refresh();
            }
        }, PortStatusBar.POLL_INTERVAL_MS);
        this._timer.unref();
        this.refresh();
        this._item.show();
    }

    public async refresh() {
        const seq = ++this._refreshSeq;
        const port = DeviceContext.getInstance().port;
        let ports: ISerialPortDetail[] | undefined;
        try {
            ports = await listSerialPorts();
        } catch {
            ports = undefined;
        }
        if (seq !== this._refreshSeq || !this._item) {
            return;
        }
        const check: IUploadPortCheck = this._needsPort() ? checkUploadPort(port, ports) : { status: "ok" };
        if (check.status === "ok") {
            this._item.text = port ? `$(plug) ${port}` : `$(plug) ${vscode.l10n.t("No port")}`;
            this._item.tooltip = vscode.l10n.t("Serial port for upload");
            this._item.backgroundColor = undefined;
        } else {
            this._item.text = `$(warning) ${vscode.l10n.t("No port")}`;
            this._item.tooltip = check.status === "missing"
                ? vscode.l10n.t("No serial port selected for upload.")
                : vscode.l10n.t("Port {0} is not connected.", port);
            this._item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
        }
    }

    public dispose() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = undefined;
        }
        this._disposables.forEach((d) => d.dispose());
        this._disposables = [];
        if (this._item) {
            this._item.dispose();
            this._item = undefined;
        }
    }
}
