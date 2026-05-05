// Load API key on page open
chrome.storage.local.get("apiKey", ({ apiKey }) => {
  if (apiKey) {
    document.getElementById("api-key").value = apiKey;
  }
});

// Save API key on form submit
document.getElementById("settings-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const apiKey = document.getElementById("api-key").value.trim();

  if (!apiKey) {
    showStatus("Please enter an API key", "error");
    return;
  }

  chrome.storage.local.set({ apiKey }, () => {
    showStatus("Settings saved!", "success");
    setTimeout(() => {
      document.getElementById("status").style.display = "none";
    }, 3000);
  });
});

function showStatus(message, type) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = `status ${type}`;
}
