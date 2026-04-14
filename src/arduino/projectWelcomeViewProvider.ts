import * as path from "path";
import * as vscode from "vscode";

export class ProjectWelcomeViewProvider implements vscode.WebviewViewProvider {
    constructor(private readonly _extensionUri: vscode.Uri) {
    }

    public resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
        const webview = webviewView.webview;
        const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "images", "ArduinoCommunityLogo_Gris.svg"));

        webview.options = {
            enableCommandUris: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, "images")],
        };

        webview.html = this.getHtml(webview, logoUri);
    }

    private getHtml(webview: vscode.Webview, logoUri: vscode.Uri): string {
        const openCommandUri = webview.asWebviewUri(vscode.Uri.parse("command:arduino.openProjectFolder"));
        const newCommandUri = webview.asWebviewUri(vscode.Uri.parse("command:arduino.initialize"));

        return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        :root {
            color-scheme: light dark;
        }

        body {
            margin: 0;
            padding: 16px;
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background);
            font-family: var(--vscode-font-family);
        }

        .hero {
            display: flex;
            gap: 14px;
            align-items: center;
            padding: 14px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 14px;
            background:
                radial-gradient(circle at top right, color-mix(in srgb, var(--vscode-button-background) 18%, transparent), transparent 45%),
                linear-gradient(135deg, color-mix(in srgb, var(--vscode-editor-background) 86%, var(--vscode-button-background) 14%), var(--vscode-sideBar-background));
        }

        .hero img {
            width: 44px;
            height: 44px;
            flex: 0 0 auto;
        }

        .hero h2 {
            margin: 0;
            font-size: 16px;
            font-weight: 700;
        }

        .hero p {
            margin: 4px 0 0;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            line-height: 1.45;
        }

        .actions {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
            margin-top: 16px;
        }

        .card {
            display: block;
            text-decoration: none;
            color: inherit;
            padding: 14px;
            border-radius: 14px;
            border: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editor-background);
            transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
        }

        .card:hover {
            transform: translateY(-1px);
            border-color: var(--vscode-focusBorder);
            background: color-mix(in srgb, var(--vscode-editor-background) 85%, var(--vscode-button-background) 15%);
        }

        .eyebrow {
            display: inline-block;
            margin-bottom: 8px;
            padding: 2px 8px;
            border-radius: 999px;
            background: color-mix(in srgb, var(--vscode-button-background) 18%, transparent);
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .card strong {
            display: block;
            font-size: 14px;
            margin-bottom: 4px;
        }

        .card span {
            display: block;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            line-height: 1.45;
        }
    </style>
</head>
<body>
    <section class="hero">
        <img src="${logoUri}" alt="Arduino">
        <div>
            <h2>Arduino Start</h2>
            <p>Créez un nouveau projet ou ouvrez un sketch existant depuis ce panneau.</p>
        </div>
    </section>

    <section class="actions">
        <a class="card" href="command:arduino.initialize">
            <span class="eyebrow">Nouveau</span>
            <strong>Créer un projet Arduino</strong>
            <span>Choisit un dossier parent, crée un sous-dossier de projet et y génère un fichier .ino du même nom.</span>
        </a>
        <a class="card" href="command:arduino.openProjectFolder">
            <span class="eyebrow">Ouvrir</span>
            <strong>Ouvrir un projet existant</strong>
            <span>Sélectionne un dossier contenant un sketch ou une configuration Arduino et l’ouvre dans VS Code.</span>
        </a>
    </section>
</body>
</html>`;
    }
}