// ==== CONFIG-DRIVEN APP ====
// See config.js for SHEET_ID and MISSIONS.

const loginSection = document.getElementById("login-section");
const boardSection = document.getElementById("board-section");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const studentNameInput = document.getElementById("studentName");
const loginCodeInput = document.getElementById("loginCode");
const welcomeEl = document.getElementById("welcome");
const tilesEl = document.getElementById("tiles");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const unlockInput = document.getElementById("unlockInput");
const cancelBtn = document.getElementById("cancelBtn");
const submitCodeBtn = document.getElementById("submitCodeBtn");
const modalMsg = document.getElementById("modalMsg");

let currentStudent = null; // { name, tab, rowIndex, loginCode, missions: [true/false], codes: [string] }
let pendingMissionIndex = null;

// ---- Helper to fetch published JSON from Google Sheets ----
// Expect a structure from a published Apps Script webapp OR a published-sheet-to-JSON adapter.
// For simplicity, this sample expects a GET endpoint returning { tabs: [ {name, rows: [...] } ] }.
// We'll provide a Google Apps Script snippet to power this.
async function fetchSheetData() {
  const url = CONFIG.SHEET_JSON_URL; // e.g., your Apps Script web-app URL
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch sheet data");
  return await res.json();
}

// ---- Render tiles ----
function renderTiles() {
  tilesEl.innerHTML = "";
  CONFIG.MISSIONS.forEach((m, idx) => {
    const isUnlocked = currentStudent.missions[idx] === true;
    const tile = document.createElement("div");
    tile.className = "tile " + (isUnlocked ? "unlocked" : "locked");
    const img = document.createElement("img");
    img.src = isUnlocked ? `./assets/mission${idx+1}_unlocked.png` : `./assets/mission${idx+1}_locked.png`;
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = m;
    tile.appendChild(img);
    tile.appendChild(label);

    if (!isUnlocked) {
      tile.addEventListener("click", () => openUnlockModal(idx));
    } else {
      tile.style.cursor = "default";
    }
    tilesEl.appendChild(tile);
  });
}

function openUnlockModal(idx) {
  pendingMissionIndex = idx;
  modalTitle.textContent = `Enter unlock code for: ${CONFIG.MISSIONS[idx]}`;
  unlockInput.value = "";
  modalMsg.textContent = "";
  modal.classList.remove("hidden");
  unlockInput.focus();
}

function closeModal() {
  modal.classList.add("hidden");
  pendingMissionIndex = null;
}

cancelBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

submitCodeBtn.addEventListener("click", async () => {
  const code = (unlockInput.value || "").trim();
  if (!code) {
    modalMsg.textContent = "Please enter a code.";
    return;
  }
  try {
    // Verify code against the student's row data
    const correct = currentStudent.codes[pendingMissionIndex];
    if (code.toUpperCase() !== String(correct).toUpperCase()) {
      modalMsg.textContent = "Incorrect code. Please try again.";
      return;
    }
    // Mark as unlocked via a POST to Apps Script to update the sheet
    await fetch(CONFIG.SHEET_UPDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "unlock",
        tab: currentStudent.tab,
        rowIndex: currentStudent.rowIndex,
        missionIndex: pendingMissionIndex
      })
    });
    currentStudent.missions[pendingMissionIndex] = true;
    renderTiles();
    closeModal();
  } catch (err) {
    modalMsg.textContent = "Error updating. Please try again.";
    console.error(err);
  }
});

// ---- Login flow ----
loginBtn.addEventListener("click", async () => {
  const name = (studentNameInput.value || "").trim();
  const code = (loginCodeInput.value || "").trim();
  if (!name || !code) return alert("Please enter both name and login code.");

  try {
    const data = await fetchSheetData();
    // data.tabs: [ { name, rows: [ [Student Name, Login Code, M1, Code1, ..., M20, Code20], ... ] } ]
    let found = null;
    for (const tab of data.tabs) {
      for (let i = 0; i < tab.rows.length; i++) {
        const row = tab.rows[i];
        const sName = String(row[0] || "").trim();
        const sCode = String(row[1] || "").trim();
        if (sName.toLowerCase() === name.toLowerCase() && sCode.toLowerCase() === code.toLowerCase()) {
          // parse missions/codes
          const missions = [];
          const codes = [];
          // After column 1:name, 2:login code, columns alternate as [MissionX, CodeX]
          for (let m = 0; m < 20; m++) {
            const missionVal = row[2 + m*2];     // "✅" or "❌"
            const codeVal = row[3 + m*2];        // string code
            missions.push(String(missionVal || "❌").includes("✅"));
            codes.push(codeVal || "");
          }
          found = {
            name: sName,
            tab: tab.name,
            rowIndex: i,
            loginCode: sCode,
            missions,
            codes
          };
          break;
        }
      }
      if (found) break;
    }
    if (!found) {
      alert("No matching student found. Check your name and login code.");
      return;
    }
    currentStudent = found;
    welcomeEl.textContent = `Welcome, ${currentStudent.name}`;
    loginSection.classList.add("hidden");
    boardSection.classList.remove("hidden");
    renderTiles();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error(err);
    alert("Unable to load data. Please try again later.");
  }
});

logoutBtn.addEventListener("click", () => {
  currentStudent = null;
  loginSection.classList.remove("hidden");
  boardSection.classList.add("hidden");
});

