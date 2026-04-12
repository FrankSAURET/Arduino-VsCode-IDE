// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

// Read auth token from URL for secure API access (CVE-2024-43488 fix)
function getAuthToken(): string {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") || "";
}

function postHTTP(url, postData) {
    const request = new Request(url, {
        method: "POST",
        headers: new Headers({
            "Content-Type": "application/json",
            "x-auth-token": getAuthToken(),
        }),
        body: JSON.stringify(postData),
    });
    return window.fetch(request);
}

function fetchWithAuth(url) {
    const separator = url.includes("?") ? "&" : "?";
    return window.fetch(`${url}${separator}token=${encodeURIComponent(getAuthToken())}`);
}

export function getBoardPackages(update) {
    return fetchWithAuth(`/api/boardpackages?update=${update}`).then((response) => response.json());
}

export function installBoard(packageName, arch, version) {
    return postHTTP("/api/installboard", {
        packageName,
        arch,
        version,
    }).then((response) => response.json());
}

export function uninstallBoard(boardName, packagePath) {
    return postHTTP("/api/uninstallboard", {
        boardName,
        packagePath,
    }).then((response) => response.json());
}

export function openLink(link) {
    return postHTTP("/api/openlink", {
        link,
    }).then((response) => response.json());
}

export function openSettings(query) {
    return postHTTP("/api/opensettings", {
        query,
    }).then((response) => response.json());
}

export function getLibraries(update) {
    return fetchWithAuth(`/api/libraries?update=${update}`).then((response) => response.json());
}

export function installLibrary(libraryName, version) {
    return postHTTP("/api/installlibrary", {
        libraryName,
        version,
    }).then((response) => response.json());
}

export function uninstallLibrary(libraryName, libraryPath) {
    return postHTTP("/api/uninstalllibrary", {
        libraryName,
        libraryPath,
    }).then((response) => response.json());
}

export function addLibPath(libraryPath) {
    return postHTTP("/api/addlibpath", {
        libraryPath,
    }).then((response) => response.json());
}

export function getInstalledBoards() {
    return fetchWithAuth(`/api/installedboards`).then((response) => response.json());
}

export function updateSelectedBoard(boardId) {
    return postHTTP("/api/updateselectedboard", {
        boardId,
    }).then((response) => response.json());
}

export function getConfigItems() {
    return fetchWithAuth(`/api/configitems`).then((response) => response.json());
}

export function updateConfigItem(configId, optionId) {
    return postHTTP("/api/updateconfig", {
        configId,
        optionId,
    }).then((response) => response.json());
}

export function getExamples() {
    return fetchWithAuth("/api/examples").then((response) => response.json());
}

export function openExample(examplePath) {
    return postHTTP("/api/openexample", {
        examplePath,
    }).then((response) => response.json());
}
