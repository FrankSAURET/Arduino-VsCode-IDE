import * as vscode from "vscode";

interface ILauncherNode {
    label: string;
    description?: string;
    tooltip?: string;
    command?: string;
    icon?: string;
    children?: ILauncherNode[];
}

export class ProjectLauncherProvider implements vscode.TreeDataProvider<ProjectLauncherItem> {
    private readonly _items: ILauncherNode[] = [
        {
            label: "Project",
            children: [
                {
                    label: "Initialize Project",
                    description: "Create a new project folder and sketch",
                    tooltip: "Arduino: Initialize",
                    command: "arduino.initialize",
                    icon: "new-file",
                },
                {
                    label: "Select Sketch",
                    description: "Choose the main sketch file",
                    tooltip: "Arduino: Select Sketch",
                    command: "arduino.selectSketch",
                    icon: "file-code",
                },
                {
                    label: "Verify",
                    description: "Build the current sketch",
                    tooltip: "Arduino: Verify",
                    command: "arduino.verify",
                    icon: "check",
                },
                {
                    label: "Upload",
                    description: "Build and upload to the board",
                    tooltip: "Arduino: Upload",
                    command: "arduino.upload",
                    icon: "cloud-upload",
                },
            ],
        },
        {
            label: "Device",
            children: [
                {
                    label: "Select Board",
                    description: "Choose the target board",
                    tooltip: "Arduino: Change Board Type",
                    command: "arduino.changeBoardType",
                    icon: "circuit-board",
                },
                {
                    label: "Select Serial Port",
                    description: "Choose the upload port",
                    tooltip: "Arduino: Select Serial Port",
                    command: "arduino.selectSerialPort",
                    icon: "plug",
                },
                {
                    label: "Serial Monitor",
                    description: "Open the serial monitor",
                    tooltip: "Arduino: Open Serial Monitor",
                    command: "arduino.openSerialMonitor",
                    icon: "terminal",
                },
                {
                    label: "Select Programmer",
                    description: "Choose an external programmer",
                    tooltip: "Arduino: Select Programmer",
                    command: "arduino.selectProgrammer",
                    icon: "tools",
                },
            ],
        },
        {
            label: "Tools",
            children: [
                {
                    label: "Board Manager",
                    description: "Install and manage board platforms",
                    tooltip: "Arduino: Board Manager",
                    command: "arduino.showBoardManager",
                    icon: "package",
                },
                {
                    label: "Library Manager",
                    description: "Install and manage libraries",
                    tooltip: "Arduino: Library Manager",
                    command: "arduino.showLibraryManager",
                    icon: "library",
                },
                {
                    label: "Examples",
                    description: "Browse Arduino examples",
                    tooltip: "Arduino: Examples",
                    command: "arduino.showExamples",
                    icon: "book",
                },
                {
                    label: "Rebuild IntelliSense",
                    description: "Regenerate C/C++ configuration",
                    tooltip: "Arduino: Rebuild IntelliSense Configuration",
                    command: "arduino.rebuildIntelliSenseConfig",
                    icon: "refresh",
                },
            ],
        },
    ];

    public getTreeItem(element: ProjectLauncherItem): vscode.TreeItem {
        return element;
    }

    public getChildren(element?: ProjectLauncherItem): ProjectLauncherItem[] {
        if (!element) {
            return this._items.map((item) => new ProjectLauncherItem(item));
        }
        return (element.children || []).map((item) => new ProjectLauncherItem(item));
    }
}

class ProjectLauncherItem extends vscode.TreeItem {
    constructor(private readonly _node: ILauncherNode) {
        super(
            _node.label,
            _node.children ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
        );

        this.children = _node.children;
        this.description = _node.description;
        this.tooltip = _node.tooltip || _node.label;
        this.contextValue = _node.children ? "group" : "command";

        if (_node.icon) {
            this.iconPath = new vscode.ThemeIcon(_node.icon);
        }

        if (_node.command) {
            this.command = {
                title: _node.label,
                command: _node.command,
            };
        }
    }

    public readonly children?: ILauncherNode[];
}