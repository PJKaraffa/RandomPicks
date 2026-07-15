let rows = [];
let headers = [];
let excludedNames = [];
let selectedThisPull = [];

const fileInput = document.getElementById("fileInput");
const nameColumn = document.getElementById("nameColumn");
const pullNumber = document.getElementById("pullNumber");
const pullButton = document.getElementById("pullButton");
const resetButton = document.getElementById("resetButton");
const restoreAllButton = document.getElementById("restoreAllButton");
const selectedList = document.getElementById("selectedList");
const excludedList = document.getElementById("excludedList");
const message = document.getElementById("message");

fileInput.addEventListener("change", loadFile);
pullButton.addEventListener("click", pullNames);
resetButton.addEventListener("click", resetEverything);
restoreAllButton.addEventListener("click", restoreAll);

async function loadFile(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  const text = await file.text();
  const parsed = parseCSV(text);

  if (parsed.length < 2) {
    showMessage("The file must have a heading row and at least one name.", "red");
    return;
  }

  headers = parsed[0].map(value => value.trim());

  rows = parsed
    .slice(1)
    .filter(row => row.some(value => value.trim() !== ""));

  nameColumn.innerHTML = "";

  headers.forEach((header, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = header || `Column ${index + 1}`;
    nameColumn.appendChild(option);
  });

  const suggestedIndex = headers.findIndex(header =>
    header.toLowerCase().includes("name")
  );

  if (suggestedIndex >= 0) {
    nameColumn.value = suggestedIndex;
  }

  excludedNames = [];
  selectedThisPull = [];

  pullButton.disabled = false;
  restoreAllButton.disabled = true;

  renderLists();
  showMessage(`${rows.length} records loaded.`, "green");
}

function pullNames() {
  const columnIndex = Number(nameColumn.value);
  const amount = Number(pullNumber.value);

  if (!Number.isInteger(amount) || amount < 1) {
    showMessage("Enter a valid number to pull.", "red");
    return;
  }

  const availableNames = rows
    .map(row => (row[columnIndex] || "").trim())
    .filter(name => name !== "")
    .filter(name => !excludedNames.includes(name));

  const uniqueAvailable = [...new Set(availableNames)];

  if (amount > uniqueAvailable.length) {
    showMessage(
      `Only ${uniqueAvailable.length} name(s) are still available.`,
      "red"
    );
    return;
  }

  shuffle(uniqueAvailable);
  selectedThisPull = uniqueAvailable.slice(0, amount);

  selectedThisPull.forEach(name => {
    if (!excludedNames.includes(name)) {
      excludedNames.push(name);
    }
  });

  renderLists();
  showMessage(`${amount} name(s) selected.`, "green");
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function renderLists() {
  selectedList.innerHTML = "";

  if (selectedThisPull.length === 0) {
    selectedList.innerHTML = "<li>No names selected yet.</li>";
  } else {
    selectedThisPull.forEach(name => {
      const li = document.createElement("li");
      li.textContent = name;
      selectedList.appendChild(li);
    });
  }

  excludedList.innerHTML = "";

  if (excludedNames.length === 0) {
    excludedList.innerHTML = "<li>No excluded names.</li>";
    restoreAllButton.disabled = true;
  } else {
    excludedNames.forEach(name => {
      const li = document.createElement("li");
      li.textContent = name;

      const restoreButton = document.createElement("button");
      restoreButton.textContent = "Restore";
      restoreButton.style.width = "auto";
      restoreButton.style.marginLeft = "10px";
      restoreButton.style.padding = "5px 10px";

      restoreButton.addEventListener("click", () => restoreName(name));

      li.appendChild(restoreButton);
      excludedList.appendChild(li);
    });

    restoreAllButton.disabled = false;
  }
}

function restoreName(name) {
  excludedNames = excludedNames.filter(item => item !== name);
  selectedThisPull = selectedThisPull.filter(item => item !== name);
  renderLists();
  showMessage(`${name} was restored.`, "green");
}

function restoreAll() {
  excludedNames = [];
  selectedThisPull = [];
  renderLists();
  showMessage("All names were restored.", "green");
}

function resetEverything() {
  rows = [];
  headers = [];
  excludedNames = [];
  selectedThisPull = [];

  fileInput.value = "";
  nameColumn.innerHTML = '<option value="">Upload a file first</option>';
  nameColumn.disabled = true;
  pullButton.disabled = true;
  restoreAllButton.disabled = true;
  pullNumber.value = 1;

  renderLists();
  showMessage("System reset.", "green");
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    const nextCharacter = text[i + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        value += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === "," && !insideQuotes) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        i++;
      }

      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value !== "" || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function showMessage(text, color) {
  message.textContent = text;
  message.style.color = color;
}
