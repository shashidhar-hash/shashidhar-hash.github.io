const fileInput = document.getElementById("data-file");
const backendButton = document.getElementById("fetch-backend");
const alertsContainer = document.getElementById("alerts");
const statusText = document.getElementById("server-status");

const POLL_INTERVAL_MS = 15000;
let pollHandle = null;
let lastAlertSignature = null;

const CONDITIONS = [
  {
    label: "Temp_C above 40 °C",
    column: "Temp_C",
    check: (value) => value > 40,
  },
  {
    label: "Vib_Mag_g above 1.2 g",
    column: "Vib_Mag_g",
    check: (value) => value > 1.2,
  },
  {
    label: "Sound_dBr louder than −15 dBr",
    column: "Sound_dBr",
    check: (value) => value > -15,
  },
];

const updateStatus = (message) => {
  if (statusText) {
    statusText.textContent = message;
  }
};

const renderAlerts = (messages, { prefix, emptyMessage } = {}) => {
  alertsContainer.innerHTML = "";

  if (prefix) {
    const meta = document.createElement("p");
    meta.textContent = prefix;
    alertsContainer.appendChild(meta);
  }

  if (!messages.length) {
    const ok = document.createElement("div");
    ok.className = "alert ok";
    ok.textContent = emptyMessage ?? "All good — no thresholds exceeded.";
    alertsContainer.appendChild(ok);
    return;
  }

  messages.forEach((msg) => {
    const alert = document.createElement("div");
    alert.className = "alert";
    alert.textContent = msg;
    alertsContainer.appendChild(alert);
  });
};

const parseCsv = (text) => {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];

  const headers = lines
    .shift()
    .split(",")
    .map((header) => header.trim());

  return lines
    .filter((line) => line.trim().length)
    .map((line) => {
      const cells = line.split(",");
      return headers.reduce((row, header, index) => {
        const raw = cells[index]?.trim() ?? "";
        const numeric = Number(raw);
        row[header] = Number.isNaN(numeric) ? raw : numeric;
        return row;
      }, {});
    });
};

const evaluateConditions = (rows) => {
  const messages = [];

  rows.forEach((row, idx) => {
    CONDITIONS.forEach(({ label, column, check }) => {
      if (typeof row[column] === "number" && check(row[column])) {
        const time = row.Time ?? row["time"] ?? `Row ${idx + 1}`;
        messages.push(
          `${label} at ${time}: observed ${row[column]}`
        );
      }
    });
  });

  return messages;
};

fileInput?.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ({ target }) => {
    try {
      const rows = parseCsv(target.result);
      if (!rows.length) {
        renderAlerts(["No data rows found. Check your CSV export."]);
        return;
      }
      const messages = evaluateConditions(rows);
      renderAlerts(messages, {
        prefix: "Alerts generated from uploaded CSV.",
        emptyMessage: "All good — uploaded data is within range.",
      });
    } catch (error) {
      renderAlerts([`Unable to read file: ${error.message}`]);
    }
  };

  reader.readAsText(file);
});

const fetchServerAlerts = async ({ manual } = {}) => {
  if (!backendButton) return;
  const defaultLabel = backendButton.textContent;
  if (manual) {
    backendButton.disabled = true;
    backendButton.textContent = "Checking…";
  }
  updateStatus("Checking server data…");
  try {
    const response = await fetch("/api/alerts");
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    const data = await response.json();
    const alerts = data.alerts ?? [];
    const signature = JSON.stringify(alerts);
    const updatedAt = data.updatedAt ? `Server check ${data.updatedAt}` : "Server alerts";
    if (signature !== lastAlertSignature) {
      lastAlertSignature = signature;
      renderAlerts(alerts, {
        prefix: updatedAt,
        emptyMessage: "All good — server data is within range.",
      });
      updateStatus(
        data.sourceUpdatedAt
          ? `Source updated at ${data.sourceUpdatedAt}. Latest alerts shown above.`
          : "Server data refreshed."
      );
    } else {
      updateStatus(
        data.sourceUpdatedAt
          ? `No alert changes. Last source update at ${data.sourceUpdatedAt}.`
          : "No alert changes detected."
      );
    }
  } catch (error) {
    renderAlerts([`Unable to fetch from server: ${error.message}`]);
    updateStatus("Server fetch failed. Check the backend.");
  } finally {
    if (manual) {
      backendButton.disabled = false;
      backendButton.textContent = defaultLabel;
    }
  }
};

const startAutoRefresh = () => {
  if (pollHandle) {
    clearInterval(pollHandle);
  }
  pollHandle = setInterval(() => fetchServerAlerts({ manual: false }), POLL_INTERVAL_MS);
};

backendButton?.addEventListener("click", () => fetchServerAlerts({ manual: true }));

fetchServerAlerts({ manual: false });
startAutoRefresh();

