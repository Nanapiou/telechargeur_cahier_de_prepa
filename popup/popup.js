document.addEventListener("DOMContentLoaded", () => {
    const runtime = globalThis.browser?.runtime ?? globalThis.chrome?.runtime;
    const tabs = globalThis.browser?.tabs ?? globalThis.chrome?.tabs;

    const downloadButton = document.getElementById("downloadButton");
    const progressBar = document.getElementById("progressBar");
    const statusLabel = document.getElementById("statusLabel");
    const progressLabel = document.getElementById("progressLabel");
    const detailLabel = document.getElementById("detailLabel");

    function setProgress({ percent = 0, status = "Prêt", detail = "Aucune tâche en cours.", indeterminate = false }) {
        statusLabel.textContent = status;
        detailLabel.textContent = detail;
        progressLabel.textContent = indeterminate ? "…" : `${Math.max(0, Math.min(100, Math.round(percent)))}%`;

        if (indeterminate) {
            progressBar.removeAttribute("value");
        } else {
            progressBar.value = Math.max(0, Math.min(100, percent));
        }
    }

    function setBusy(isBusy) {
        downloadButton.disabled = isBusy;
        downloadButton.textContent = isBusy ? "Téléchargement..." : "Télécharger";
    }

    runtime.onMessage.addListener((message) => {
        if (!message || message.type !== "cdp-progress") {
            return;
        }

        setBusy(message.phase !== "done" && message.phase !== "error");
        setProgress(message);

        if (message.phase === "done") {
            downloadButton.disabled = false;
            downloadButton.textContent = "Télécharger";
        }
    });

    downloadButton.addEventListener("click", async () => {
        if (downloadButton.disabled) {
            return;
        }

        setBusy(true);
        setProgress({ indeterminate: true, status: "Préparation", detail: "Lecture de la page actuelle..." });

        const [tab] = await tabs.query({
            active: true,
            currentWindow: true,
        });

        try {
            await tabs.sendMessage(tab.id, {
                command: "startDownload"
            });
        } catch (error) {
            setBusy(false);
            setProgress({
                status: "Erreur",
                detail: error instanceof Error ? error.message : String(error),
                percent: 0,
                indeterminate: false,
            });
        }
    });
});