// console.log("Injected!");

const runtime = globalThis.browser?.runtime ?? globalThis.chrome?.runtime;

function sendProgress(payload) {
    const result = runtime.sendMessage({
        type: "cdp-progress",
        ...payload,
    });

    if (result?.catch) {
        result.catch(() => {});
    }
}

function getRootFolderName() {
    const pathContener = document.getElementById("parentsdoc");
    const wholePath = pathContener.querySelector(".nom");

    return pathContener.querySelector(".nom")?.textContent ?? wholePath.children.item(wholePath.length - 1).textContent.trim();
}


async function startDownload() {
    try {
        const rootName = getRootFolderName();
        const seenPages = new Set();

        const arboRoot = {};
        async function iterOnPage(doc, arbo) {
            const mainSection = doc.querySelector("section");

            const files = mainSection.getElementsByClassName("doc");
            const folders = mainSection.getElementsByClassName("rep");

            // TODO: filter recent elements (they're in a sub cat)
            for (const fileElt of files) {
                const name = fileElt.querySelector(".nom").textContent.trim();
                const url = fileElt.querySelector("a").href;
                const extension = fileElt.querySelector(".docdonnees")?.textContent.split(",")[0].slice(1);
                if (!extension) continue; //No perm for this file.

                arbo[name] = {
                    type: "file",
                    data: {
                        name,
                        url,
                        extension
                    }
                }
                // console.log(`File: ${name}`);
            }

            for await (const folderElt of folders) {
                const name = folderElt.querySelector(".nom").textContent.trim();
                const target = folderElt.querySelector("a").href;
                const lockedPart = folderElt.querySelector(".icon-minilock");
                if (lockedPart) continue; // Locked folder

                arbo[name] = {
                    type: "folder",
                    data: {}
                }
                // console.log(`Folder: ${name}`);

                if (seenPages.has(target)) {
                    continue;
                }

                seenPages.add(target);

                const nextPage = await fetch(target).then(res => res.text());
                const nextDoc = (new DOMParser()).parseFromString(nextPage, "text/html");
                await iterOnPage(nextDoc, arbo[name].data);
            }
        }

        sendProgress({
            phase: "scan",
            percent: 0,
            status: "Analyse",
            detail: `Lecture de ${rootName}`,
            indeterminate: true,
        });

        await iterOnPage(document, arboRoot);


        // Now arbo is complete, and it's the only thing we need. No more html.
        // console.log(arboRoot);
        const zipRoot = new JSZip();
        const fileEntries = [];

        function collectFiles(arbo, currentPath = "") {
            for (const [name, entry] of Object.entries(arbo)) {
                const entryPath = currentPath ? `${currentPath}/${name}` : name;

                if (entry.type === "file") {
                    fileEntries.push({
                        path: entryPath,
                        data: entry.data,
                    });
                } else if (entry.type === "folder") {
                    collectFiles(entry.data, entryPath);
                }
            }
        }

        collectFiles(arboRoot);

        let completedFiles = 0;
        const totalFiles = fileEntries.length || 1;

        sendProgress({
            phase: "pack",
            percent: 0,
            status: "Assemblage",
            detail: `${fileEntries.length} fichier${fileEntries.length > 1 ? "s" : ""} à ajouter`,
            indeterminate: false,
        });

        for (const { path, data } of fileEntries) {
            const res = await fetch(data.url);

            if (!res.ok) {
                console.error(`Error while downloading file: ${path}`);
                completedFiles += 1;
                sendProgress({
                    phase: "pack",
                    percent: (completedFiles / totalFiles) * 100,
                    status: "Assemblage",
                    detail: `${completedFiles}/${fileEntries.length} fichiers traités`,
                    indeterminate: false,
                });
                continue;
            }

            const fullName = `${path}.${data.extension}`;
            const fileData = Array.from(new Uint8Array(await res.arrayBuffer()));
            // That's the ONLY FUCKING WAY I (gpt not me) found how to add this freaking file to the archive
            zipRoot.file(fullName, fileData, { binary: true });

            completedFiles += 1;
            sendProgress({
                phase: "pack",
                percent: (completedFiles / totalFiles) * 100,
                status: "Assemblage",
                detail: `${completedFiles}/${fileEntries.length} fichiers ajoutés`,
                indeterminate: false,
            });
        }

        sendProgress({
            phase: "finalize",
            percent: 100,
            status: "Génération",
            detail: "Création de l’archive ZIP...",
            indeterminate: true,
        });

        const contentToDownload = await zipRoot.generateAsync({ type: "blob" });
        saveAs(contentToDownload, `${rootName}.zip`);

        sendProgress({
            phase: "done",
            percent: 100,
            status: "Terminé",
            detail: `Archive prête : ${rootName}.zip`,
            indeterminate: false,
        });
    } catch (error) {
        console.error(error);
        sendProgress({
            phase: "error",
            percent: 0,
            status: "Erreur",
            detail: error instanceof Error ? error.message : String(error),
            indeterminate: false,
        });
    }
}

runtime.onMessage.addListener(({ command }) => {
    if (command === "startDownload") {
        startDownload();
    }
});