(function () {
  const $ = (id) => document.getElementById(id);

  function formatUptime(seconds) {
    if (!seconds) return "—";
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  async function refreshStatus() {
    try {
      const r = await fetch("/api/health");
      if (!r.ok) throw new Error("unhealthy");
      const data = await r.json();
      $("uptime").textContent = formatUptime(data.uptime);
      $("db").textContent =
        data.database === "connected"
          ? "Connected"
          : data.database === "skipped"
            ? "Skipped"
            : "Offline";
      $("mem").textContent = data.memory
        ? `${data.memory.used}/${data.memory.total} ${data.memory.unit}`
        : "—";
      $("timestamp").textContent = new Date().toLocaleTimeString();
    } catch (e) {
      $("uptime").textContent = "n/a";
      $("db").textContent = "Offline";
    }
  }

  // Fetch once on page load. No polling — the backend shouldn't spam its
  // own health endpoint every few seconds. Reload the page to get fresh stats.
  refreshStatus();
})();
