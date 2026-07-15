const STORAGE_KEY = "randomPullSystemStateV1";

let records = [];
let columns = [];
let uniqueColumn = "";
let displayColumn = "";
let excludedIds = new Set();
let currentSelection = [];
let pullHistory = [];

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
  bindEvents();
  restoreSavedState();
  renderAll();
}

function bindEvents() {
  $("fileInput").addEventListener("change", handleFileUpload);
  $("uniqueColumnSelect").addEventListener("change", handleColumnChange);
  $("displayColumnSelect").addEventListener("change", handleColumnChange);
  $("runPullButton").addEventListener("click", runRandomPull);
  $("clearCurrentPullButton").addEventListener("click", clearCurrentPull);
  $("excludeCheckedButton").addEventListener("click", excludeCheckedRecords);
  $("restoreAllButton").addEventListener("click", restoreAllExcluded);
  $("exportCurrentButton").addEventListener("click", exportCurrentSelection);
  $("exportHistoryButton").addEventListener("click", exportFullHistory);
  $("clearHistoryButton").addEventListener("click", clearHistory);
  $("resetEverythingButton").addEventListener("click", resetEverything);
  $("eligibleSearchInput").addEventListener("input", renderEligibleTable);
  $("excludedSearchInput").addEventListener("input", renderExcludedTable);
  $("confirmCancelButton").addEventListener("click", closeConfirmModal);
}

async function handleFileUpload(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    showFileStatus("Please select a CSV file.", "error");
    event.target.value = "";
    return;
  }

  try {
    const text = await file.text();
    const parsed = parseCSV(text);

    if (parsed.length < 2) {
      throw new Error("The CSV must contain a header row and at least one data row.");
    }

    const rawHeaders = parsed[0].map((header, index) => {
      const cleaned = String(header || "").trim();
      return cleaned || `Column ${index + 1}`;
    });

    columns = makeHeadersUnique(rawHeaders);

    records = parsed
      .slice(1)
      .filter((row) => row.some((value) => String(value).trim() !== ""))
      .map((row, rowIndex) => {
        const record = {};

        columns.forEach((column, index) => {
          record[column] = String(row[index] ?? "").trim();
        });

        record.__rowId = `row-${Date.now()}-${rowIndex}-${Math.random().toString(36).slice(2)}`;
        return record;
      });

    if (!records.length) {
      throw new Error("No usable data rows were found.");
    }

    const previousUnique = uniqueColumn;
    const previousDisplay = displayColumn;

    uniqueColumn =
      columns.includes(previousUnique)
        ? previousUnique
        : guessColumn(["id", "employee id", "student id", "sasid", "email"]) || columns[0];

    displayColumn =
      columns.includes(previousDisplay)
        ? previousDisplay
        : guessColumn(["name", "full name", "employee name", "student name", "last name"]) || columns[Math.min(1, columns.length - 1)];

    excludedIds = new Set();
    currentSelection = [];
    pullHistory = [];

    populateColumnSelectors();
    validateUniqueValues();

    showFileStatus(
      `${records.length.toLocaleString()} records loaded from ${file.name}.`,
      "success"
    );

    saveState();
    renderAll();
  } catch (error) {
    console.error(error);
    showFileStatus(error.message || "The CSV could not be loaded.", "error");
    event.target.value = "";
  }
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  const normalized = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i += 1;
      }

      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function makeHeadersUnique(headers) {
  const counts = {};

  return headers.map((header) => {
    counts[header] = (counts[header] || 0) + 1;
    return counts[header] === 1 ? header : `${header} (${counts[header]})`;
  });
}

function guessColumn(possibleNames) {
  const lowerColumns = columns.map((column) => column.toLowerCase());

  for (const possibleName of possibleNames) {
    const exactIndex = lowerColumns.indexOf(possibleName.toLowerCase());
    if (exactIndex >= 0) {
      return columns[exactIndex];
    }
  }

  for (const possibleName of possibleNames) {
    const partialIndex = lowerColumns.findIndex((column) =>
      column.includes(possibleName.toLowerCase())
    );

    if (partialIndex >= 0) {
      return columns[partialIndex];
    }
  }

  return "";
}

function populateColumnSelectors() {
  const uniqueSelect = $("uniqueColumnSelect");
  const displaySelect = $("displayColumnSelect");

  uniqueSelect.innerHTML = "";
  displaySelect.innerHTML = "";

  columns.forEach((column) => {
    uniqueSelect.add(new Option(column, column, false, column === uniqueColumn));
    displaySelect.add(new Option(column, column, false, column === displayColumn));
  });

  uniqueSelect.disabled = false;
  displaySelect.disabled = false;
}

function handleColumnChange() {
  uniqueColumn = $("uniqueColumnSelect").value;
  displayColumn = $("displayColumnSelect").value;

  validateUniqueValues();
  saveState();
  renderAll();
}

function validateUniqueValues() {
  if (!uniqueColumn || !records.length) {
    return;
  }

  const seen = new Set();
  let duplicateCount = 0;
  let blankCount = 0;

  records.forEach((record) => {
    const value = normalizeId(record[uniqueColumn]);

    if (!value) {
      blankCount += 1;
      return;
    }

    if (seen.has(value)) {
      duplicateCount += 1;
    }

    seen.add(value);
  });

  if (blankCount > 0 || duplicateCount > 0) {
    showFileStatus(
      `Warning: the selected unique column contains ${blankCount} blank value(s) and ${duplicateCount} duplicate value(s). The system will use an internal row ID when necessary.`,
      "error"
    );
  }
}

function getRecordId(record) {
  const preferredId = normalizeId(record[uniqueColumn]);
  return preferredId || record.__rowId;
}

function normalizeId(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getEligibleRecords() {
  return records.filter((record) => !excludedIds.has(getRecordId(record)));
}

function getExcludedRecords() {
  return records.filter((record) => excludedIds.has(getRecordId(record)));
}

function runRandomPull() {
  const eligible = getEligibleRecords();
  const requested = Number.parseInt($("pullCountInput").value, 10);

  if (!Number.isInteger(requested) || requested < 1) {
    showPullMessage("Enter a valid number greater than zero.", "error");
    return;
  }

  if (!eligible.length) {
    showPullMessage("There are no eligible records remaining.", "error");
    return;
  }

  if (requested > eligible.length) {
    showPullMessage(
      `You requested ${requested}, but only ${eligible.length} eligible record(s) remain.`,
      "error"
    );
    return;
  }

  currentSelection = shuffleArray([...eligible]).slice(0, requested);

  const pull = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    pulledAt: new Date().toISOString(),
    records: currentSelection.map((record) => copyRecord(record))
  };

  pullHistory.unshift(pull);

  if ($("autoExcludeCheckbox").checked) {
    currentSelection.forEach((record) => excludedIds.add(getRecordId(record)));
  }

  showPullMessage(
    `${requested} record(s) selected successfully.${$("autoExcludeCheckbox").checked ? " They were excluded from future pulls." : ""}`,
    "success"
  );

  saveState();
  renderAll();
}

function shuffleArray(array) {
  if (window.crypto && window.crypto.getRandomValues) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const randomValues = new Uint32Array(1);
      window.crypto.getRandomValues(randomValues);
      const j = randomValues[0] % (i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
  } else {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  return array;
}

function copyRecord(record) {
  const copy = {};
  columns.forEach((column) => {
    copy[column] = record[column] ?? "";
  });
  copy.__rowId = record.__rowId;
  return copy;
}

function clearCurrentPull() {
  currentSelection = [];
  saveState();
  renderAll();
  showPullMessage("The current pull display was cleared. Exclusions and history were not changed.", "info");
}

function excludeCheckedRecords() {
  const checked = document.querySelectorAll(".eligible-checkbox:checked");

  if (!checked.length) {
    showPullMessage("Select at least one eligible record to exclude.", "error");
    return;
  }

  checked.forEach((checkbox) => excludedIds.add(checkbox.dataset.recordId));

  saveState();
  renderAll();
  showPullMessage(`${checked.length} record(s) manually excluded.`, "success");
}

function restoreRecord(recordId) {
  excludedIds.delete(recordId);
  currentSelection = currentSelection.filter(
    (record) => getRecordId(record) !== recordId
  );

  saveState();
  renderAll();
}

function restoreAllExcluded() {
  openConfirmModal(
    "Restore All Records",
    "This will make every excluded record eligible for future pulls. Pull history will remain.",
    () => {
      excludedIds.clear();
      currentSelection = [];
      saveState();
      renderAll();
      showPullMessage("All excluded records were restored.", "success");
    }
  );
}

function clearHistory() {
  openConfirmModal(
    "Clear Pull History",
    "This will permanently remove all pull history. Excluded records will remain excluded.",
    () => {
      pullHistory = [];
      saveState();
      renderAll();
    }
  );
}

function resetEverything() {
  openConfirmModal(
    "Reset Everything",
    "This will remove the loaded data, exclusions, current selection, and pull history from this browser.",
    () => {
      records = [];
      columns = [];
      uniqueColumn = "";
      displayColumn = "";
      excludedIds = new Set();
      currentSelection = [];
      pullHistory = [];

      localStorage.removeItem(STORAGE_KEY);
      $("fileInput").value = "";
      $("uniqueColumnSelect").innerHTML = '<option value="">Load a file first</option>';
      $("displayColumnSelect").innerHTML = '<option value="">Load a file first</option>';
      $("uniqueColumnSelect").disabled = true;
      $("displayColumnSelect").disabled = true;
      $("eligibleSearchInput").value = "";
      $("excludedSearchInput").value = "";
      $("pullMessage").className = "status-message hidden";

      showFileStatus("No file loaded.", "info");
      renderAll();
    }
  );
}

function renderAll() {
  renderMetrics();
  renderEligibleTable();
  renderExcludedTable();
  renderCurrentSelection();
  renderHistory();
  updateButtons();
}

function renderMetrics() {
  $("totalLoadedCount").textContent = records.length.toLocaleString();
  $("eligibleCount").textContent = getEligibleRecords().length.toLocaleString();
  $("excludedCount").textContent = getExcludedRecords().length.toLocaleString();
  $("selectedCount").textContent = currentSelection.length.toLocaleString();
}

function renderEligibleTable() {
  const head = $("eligibleTableHead");
  const body = $("eligibleTableBody");
  const search = $("eligibleSearchInput").value.trim().toLowerCase();

  if (!records.length) {
    head.innerHTML = "";
    body.innerHTML = '<tr><td class="empty-state">No data loaded.</td></tr>';
    return;
  }

  const visibleColumns = getVisibleColumns();

  head.innerHTML = `
    <tr>
      <th class="checkbox-cell">
        <input id="selectAllEligible" type="checkbox" aria-label="Select all visible eligible records">
      </th>
      ${visibleColumns.map((column) => `<th>${escapeHTML(column)}</th>`).join("")}
    </tr>
  `;

  const filtered = getEligibleRecords().filter((record) =>
    matchesSearch(record, search)
  );

  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="${visibleColumns.length + 1}" class="empty-state">No eligible records match your search.</td></tr>`;
  } else {
    body.innerHTML = filtered
      .map((record) => {
        const recordId = getRecordId(record);

        return `
          <tr>
            <td class="checkbox-cell">
              <input
                class="eligible-checkbox"
                type="checkbox"
                data-record-id="${escapeAttribute(recordId)}"
                aria-label="Select record"
              >
            </td>
            ${visibleColumns
              .map((column) => `<td>${escapeHTML(record[column] || "")}</td>`)
              .join("")}
          </tr>
        `;
      })
      .join("");
  }

  const selectAll = $("selectAllEligible");

  if (selectAll) {
    selectAll.addEventListener("change", () => {
      document.querySelectorAll(".eligible-checkbox").forEach((checkbox) => {
        checkbox.checked = selectAll.checked;
      });
    });
  }
}

function renderExcludedTable() {
  const head = $("excludedTableHead");
  const body = $("excludedTableBody");
  const search = $("excludedSearchInput").value.trim().toLowerCase();

  if (!records.length) {
    head.innerHTML = "";
    body.innerHTML = '<tr><td class="empty-state">No excluded records.</td></tr>';
    return;
  }

  const visibleColumns = getVisibleColumns();

  head.innerHTML = `
    <tr>
      ${visibleColumns.map((column) => `<th>${escapeHTML(column)}</th>`).join("")}
      <th>Action</th>
    </tr>
  `;

  const filtered = getExcludedRecords().filter((record) =>
    matchesSearch(record, search)
  );

  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="${visibleColumns.length + 1}" class="empty-state">No excluded records match your search.</td></tr>`;
    return;
  }

  body.innerHTML = filtered
    .map((record) => {
      const recordId = getRecordId(record);

      return `
        <tr>
          ${visibleColumns
            .map((column) => `<td>${escapeHTML(record[column] || "")}</td>`)
            .join("")}
          <td class="action-cell">
            <button
              class="button button-secondary button-small restore-record-button"
              data-record-id="${escapeAttribute(recordId)}"
            >
              Restore
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  document.querySelectorAll(".restore-record-button").forEach((button) => {
    button.addEventListener("click", () => restoreRecord(button.dataset.recordId));
  });
}

function renderCurrentSelection() {
  const container = $("selectedResults");

  if (!currentSelection.length) {
    container.innerHTML = '<div class="empty-state-panel">No records selected yet.</div>';
    return;
  }

  container.innerHTML = currentSelection
    .map((record, index) => {
      const title =
        record[displayColumn] ||
        record[uniqueColumn] ||
        `Selection ${index + 1}`;

      return `
        <article class="selected-person" style="animation-delay:${index * 60}ms">
          <h3>${index + 1}. ${escapeHTML(title)}</h3>
          <div class="record-grid">
            ${columns
              .map(
                (column) => `
                  <div class="record-field">
                    <strong>${escapeHTML(column)}</strong>
                    <span>${escapeHTML(record[column] || "")}</span>
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderHistory() {
  const container = $("historyContainer");

  if (!pullHistory.length) {
    container.innerHTML = '<div class="empty-state-panel">No pull history yet.</div>';
    return;
  }

  container.innerHTML = pullHistory
    .map((pull, index) => {
      const names = pull.records
        .map(
          (record) =>
            record[displayColumn] ||
            record[uniqueColumn] ||
            "Unnamed record"
        )
        .join(", ");

      const pulledAt = new Date(pull.pulledAt);

      return `
        <article class="history-item">
          <div class="history-header">
            <strong>Pull ${pullHistory.length - index}</strong>
            <span>${escapeHTML(formatDateTime(pulledAt))}</span>
          </div>
          <div class="history-body">
            <p class="history-names">
              <strong>${pull.records.length} selected:</strong>
              ${escapeHTML(names)}
            </p>
          </div>
        </article>
      `;
    })
    .join("");
}

function getVisibleColumns() {
  const preferred = [];

  if (uniqueColumn && columns.includes(uniqueColumn)) {
    preferred.push(uniqueColumn);
  }

  if (
    displayColumn &&
    columns.includes(displayColumn) &&
    !preferred.includes(displayColumn)
  ) {
    preferred.push(displayColumn);
  }

  columns.forEach((column) => {
    if (!preferred.includes(column) && preferred.length < 4) {
      preferred.push(column);
    }
  });

  return preferred;
}

function matchesSearch(record, search) {
  if (!search) {
    return true;
  }

  return columns.some((column) =>
    String(record[column] || "").toLowerCase().includes(search)
  );
}

function updateButtons() {
  const eligibleCount = getEligibleRecords().length;
  const excludedCount = getExcludedRecords().length;

  $("runPullButton").disabled = eligibleCount === 0;
  $("clearCurrentPullButton").disabled = currentSelection.length === 0;
  $("excludeCheckedButton").disabled = eligibleCount === 0;
  $("restoreAllButton").disabled = excludedCount === 0;
  $("exportCurrentButton").disabled = currentSelection.length === 0;
  $("exportHistoryButton").disabled = pullHistory.length === 0;
  $("clearHistoryButton").disabled = pullHistory.length === 0;

  const pullCount = $("pullCountInput");
  pullCount.max = Math.max(eligibleCount, 1);

  if (Number(pullCount.value) > eligibleCount && eligibleCount > 0) {
    pullCount.value = eligibleCount;
  }
}

function exportCurrentSelection() {
  if (!currentSelection.length) {
    return;
  }

  downloadCSV(
    `random-pull-${fileDateStamp()}.csv`,
    columns,
    currentSelection.map((record) => columns.map((column) => record[column] || ""))
  );
}

function exportFullHistory() {
  if (!pullHistory.length) {
    return;
  }

  const headers = ["Pull Number", "Pulled At", ...columns];
  const rows = [];

  [...pullHistory].reverse().forEach((pull, pullIndex) => {
    pull.records.forEach((record) => {
      rows.push([
        pullIndex + 1,
        formatDateTime(new Date(pull.pulledAt)),
        ...columns.map((column) => record[column] || "")
      ]);
    });
  });

  downloadCSV(`random-pull-history-${fileDateStamp()}.csv`, headers, rows);
}

function downloadCSV(filename, headers, rows) {
  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(","))
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? "");

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function saveState() {
  const state = {
    records,
    columns,
    uniqueColumn,
    displayColumn,
    excludedIds: [...excludedIds],
    currentSelection,
    pullHistory
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Unable to save state:", error);
  }
}

function restoreSavedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return;
    }

    const state = JSON.parse(saved);

    records = Array.isArray(state.records) ? state.records : [];
    columns = Array.isArray(state.columns) ? state.columns : [];
    uniqueColumn = state.uniqueColumn || "";
    displayColumn = state.displayColumn || "";
    excludedIds = new Set(Array.isArray(state.excludedIds) ? state.excludedIds : []);
    currentSelection = Array.isArray(state.currentSelection)
      ? state.currentSelection
      : [];
    pullHistory = Array.isArray(state.pullHistory) ? state.pullHistory : [];

    if (records.length && columns.length) {
      populateColumnSelectors();
      showFileStatus(
        `${records.length.toLocaleString()} saved records restored from this browser.`,
        "success"
      );
    }
  } catch (error) {
    console.warn("Unable to restore saved state:", error);
    localStorage.removeItem(STORAGE_KEY);
  }
}

function openConfirmModal(title, text, onConfirm) {
  $("confirmTitle").textContent = title;
  $("confirmText").textContent = text;
  $("confirmModal").classList.remove("hidden");

  const confirmButton = $("confirmOkButton");
  const replacement = confirmButton.cloneNode(true);
  confirmButton.parentNode.replaceChild(replacement, confirmButton);

  replacement.addEventListener("click", () => {
    closeConfirmModal();
    onConfirm();
  });
}

function closeConfirmModal() {
  $("confirmModal").classList.add("hidden");
}

function showFileStatus(message, type) {
  const status = $("fileStatus");
  status.textContent = message;
  status.className = `status-message ${type}`;
}

function showPullMessage(message, type) {
  const status = $("pullMessage");
  status.textContent = message;
  status.className = `status-message ${type}`;
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function fileDateStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}-${hour}${minute}`;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value);
}
