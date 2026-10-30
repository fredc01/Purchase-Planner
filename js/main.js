// Starts the app: loading, tabs, sign-in (shared sheet only), and phone extras.
(() => {
  const { $ } = PP;
  PP.render = () => { PP.renderBoard(); PP.renderTab(); };
  PP.reload = async () => { try { PP.state = await Api.load(); PP.render(); } catch (e) { console.error(e); } };
  PP.save = async (fn, okMsg) => {
    try { await fn(); if (okMsg) PP.toast(okMsg); }
    catch (err) { PP.toast(err.code === "auth" ? "Wrong password. Please sign in again." : (err.message || "Couldn’t save. Check the connection.")); await PP.reload(); PP.updateSign(); }
  };

  /* tabs */
  PP.setTab = (name) => {
    PP.tab = name;
    document.querySelectorAll("#tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === name));
    document.querySelectorAll(".tab").forEach(s => { s.hidden = s.id !== "tab-" + name; });
    $("main").classList.toggle("wide", name === "board");   // the board uses the full width; the other tabs stay narrow
    PP.renderTab(); window.scrollTo({ top: 0 });
  };
  $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) PP.setTab(b.dataset.tab); });

  /* sign in (only used when the list lives in a Google Sheet) */
  const ld = $("#loginDialog"), lf = $("#loginForm"); let resolveLogin = null;
  PP.clearOnInput(lf);
  PP.gate = async () => !Api.needsPass || Api.hasPass() || new Promise((res) => { resolveLogin = res; lf.reset(); PP.clearAll(lf); $("#loginError").textContent = ""; ld.showModal(); });
  ld.addEventListener("close", () => { if (resolveLogin) { const r = resolveLogin; resolveLogin = null; r(ld.returnValue === "ok"); } });
  lf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inp = PP.field(lf, "password");
    if (!inp.value) { PP.showError(inp.closest("label"), "Type the password first."); inp.focus(); return; }
    const btn = $("#loginGo"); btn.disabled = true; btn.textContent = "Checking…";
    try { await Api.signIn(inp.value); ld.close("ok"); PP.updateSign(); }
    catch (err) { $("#loginError").textContent = err.message || "That didn’t work."; }
    finally { btn.disabled = false; btn.textContent = "Sign in"; }
  });
  PP.updateSign = () => {
    const b = $("#signBtn"); b.hidden = !Api.needsPass;
    b.textContent = Api.hasPass() ? "Sign out" : "Sign in";
  };
  $("#signBtn").addEventListener("click", async () => {
    if (Api.hasPass()) { Api.signOut(); PP.updateSign(); PP.toast("Signed out"); } else await PP.gate();
  });

  async function start() {
    $("#listTodo").innerHTML = $("#listBought").innerHTML = `<p class="empty">Opening your list…</p>`;
    try { PP.state = await Api.load(); PP.render(); PP.updateSign(); }
    catch (err) {
      $("#listTodo").innerHTML = `<div class="loadbanner"><p>${PP.esc(err.message || "Couldn’t open the list.")}</p><button class="btn small" id="retry" type="button">Try again</button></div>`;
      $("#listBought").innerHTML = ""; $("#retry").onclick = start;
    }
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && PP.state && Api.mode === "sheet" && !document.querySelector("dialog[open]")) PP.reload(); });

  // Android app: the back button closes an open window first, then leaves the app.
  const CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (CapApp) CapApp.addListener("backButton", () => { const open = [...document.querySelectorAll("dialog[open]")].pop(); if (open) open.close(); else if (PP.tab !== "board") PP.setTab("board"); else CapApp.exitApp(); });
  // On the web, let the browser offer "Add to Home screen".
  if ("serviceWorker" in navigator && !window.Capacitor && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
  start();
})();
