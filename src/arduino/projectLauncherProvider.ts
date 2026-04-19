import * as vscode from "vscode";

interface IQuickAccessItem {
    label: string;
    tooltip: string;
    command: string;
    icon: string;
}

export class QuickAccessProvider implements vscode.TreeDataProvider<QuickAccessItem> {
    private readonly _items: IQuickAccessItem[] = [
        {
            label: vscode.l10n.t("New Project"),
            tooltip: vscode.l10n.t("Arduino: Initialize"),
            command: "arduino.initialize",
            icon: "new-file",
        },
        {
            label: vscode.l10n.t("Open Project"),
            tooltip: vscode.l10n.t("Arduino: Open Project Folder"),
            command: "arduino.openProjectFolder",
            icon: "folder-opened",
        },
        {
            label: vscode.l10n.t("Verify"),
            tooltip: vscode.l10n.t("Arduino: Verify"),
            command: "arduino.verify",
            icon: "check",
        },
        {
            label: vscode.l10n.t("Upload"),
            tooltip: vscode.l10n.t("Arduino: Upload"),
            command: "arduino.upload",
            icon: "cloud-upload",
        },
        {
            label: vscode.l10n.t("Select Board"),
            tooltip: vscode.l10n.t("Arduino: Change Board Type"),
            command: "arduino.changeBoardType",
            icon: "circuit-board",
        },
        {
            label: vscode.l10n.t("Select Serial Port"),
            tooltip: vscode.l10n.t("Arduino: Select Serial Port"),
            command: "arduino.selectSerialPort",
            icon: "plug",
        },
        {
            label: vscode.l10n.t("Serial Monitor"),
            tooltip: vscode.l10n.t("Arduino: Open Serial Monitor"),
            command: "arduino.openSerialMonitor",
            icon: "terminal",
        },
        {
            label: vscode.l10n.t("Board Manager"),
            tooltip: vscode.l10n.t("Arduino: Board Manager"),
            command: "arduino.showBoardManager",
            icon: "package",
        },
        {
            label: vscode.l10n.t("Library Manager"),
            tooltip: vscode.l10n.t("Arduino: Library Manager"),
            command: "arduino.showLibraryManager",
            icon: "library",
        },
        {
            label: vscode.l10n.t("Examples"),
            tooltip: vscode.l10n.t("Arduino: Examples"),
            command: "arduino.showExamples",
            icon: "book",
        },
        {
            label: vscode.l10n.t("Select Programmer"),
            tooltip: vscode.l10n.t("Arduino: Select Programmer"),
            command: "arduino.selectProgrammer",
            icon: "tools",
        },
        {
            label: vscode.l10n.t("Rebuild IntelliSense"),
            tooltip: vscode.l10n.t("Arduino: Rebuild IntelliSense Configuration"),
            command: "arduino.rebuildIntelliSenseConfig",
            icon: "refresh",
        },
    ];

    public getTreeItem(element: QuickAccessItem): vscode.TreeItem {
        return element;
    }

    public getChildren(): QuickAccessItem[] {
        return this._items.map((item) => new QuickAccessItem(item));
    }
}

class QuickAccessItem extends vscode.TreeItem {
    constructor(node: IQuickAccessItem) {
        super(node.label, vscode.TreeItemCollapsibleState.None);
        this.tooltip = node.tooltip;
        this.iconPath = new vscode.ThemeIcon(node.icon);
        this.command = {
            title: node.label,
            command: node.command,
        };
    }
}