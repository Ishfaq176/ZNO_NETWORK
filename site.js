(() => {
  const doc = document;
  const root = doc.documentElement;
  const header = doc.getElementById("site-header");
  const menuButton = doc.getElementById("menu-button");
  const navigation = doc.getElementById("primary-nav");
  const progress = doc.getElementById("scroll-progress-bar");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const closeMenu = (returnFocus = false) => {
    if (!menuButton || !navigation) return;
    navigation.classList.remove("open");
    doc.body.classList.remove("nav-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation");
    if (returnFocus) menuButton.focus();
  };

  if (menuButton && navigation) {
    menuButton.addEventListener("click", () => {
      const open = menuButton.getAttribute("aria-expanded") !== "true";
      navigation.classList.toggle("open", open);
      doc.body.classList.toggle("nav-open", open);
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    });
    navigation.addEventListener("click", event => {
      if (event.target.closest("a")) closeMenu();
    });
    doc.addEventListener("click", event => {
      if (!event.target.closest(".site-header")) closeMenu();
    });
    doc.addEventListener("keydown", event => {
      if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") closeMenu(true);
    });
    matchMedia("(min-width: 1121px)").addEventListener("change", () => closeMenu());
  }

  const updateScroll = () => {
    const y = window.scrollY;
    header?.classList.toggle("scrolled", y > 12);
    if (progress) {
      const available = doc.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = `${available > 0 ? Math.min(100, (y / available) * 100) : 0}%`;
    }
  };
  window.addEventListener("scroll", updateScroll, { passive: true });
  updateScroll();

  if (!reduceMotion && "IntersectionObserver" in window) {
    root.classList.add("motion-ready");
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: "0px 0px -30px" });

    const registerReveals = (scope = doc) => {
      const elements = [...scope.querySelectorAll(".reveal:not([data-reveal-ready])")];
      elements.forEach(element => {
        element.dataset.revealReady = "true";
        const revealSiblings = element.parentElement
          ? [...element.parentElement.children].filter(child => child.classList.contains("reveal"))
          : [];
        const index = Math.max(0, revealSiblings.indexOf(element));
        element.style.setProperty("--reveal-delay", `${Math.min(index, 4) * 70}ms`);
        observer.observe(element);
      });
    };
    registerReveals();
    window.registerZenoReveals = registerReveals;
  } else {
    window.registerZenoReveals = () => {};
  }

  const knownCopy = {
    "com.zenonetwork.zenoapp": "Earn Zeno Points through community activities, follow official updates and explore ZNO ecosystem features in one Android app.",
    "com.zenonetwork.zenonotes": "Securely organize passwords, cards, private notes, personal media and ledger records with premium privacy tools.",
  };

  const playIconSvg = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#69d89f" d="M3.5 2.7a2 2 0 0 1 .9-.5l10.4 9.7-3.1 3L3.5 2.7Z"/>
      <path fill="#6bd7e7" d="m15.7 12.7 2.7 2.5-3.7 2.1-2.2-1.8 3.2-2.8Z"/>
      <path fill="#d7b773" d="m4.1 21.6 7.7-5.5 2.2 2-9.5 4.5c-.2-.3-.3-.6-.4-1Z"/>
      <path fill="#8a8bf2" d="M3 4.1v16c0 .4.1.8.3 1.1l7.8-5.7L3 4.1Z"/>
    </svg>`;

  function safeHttpUrl(value) {
    try {
      const parsed = new URL(value, location.href);
      return parsed.protocol === "https:" ? parsed.href : "";
    } catch {
      return "";
    }
  }

  function buildPlayCard(app) {
    const article = doc.createElement("article");
    article.className = "play-app-card reveal";

    const iconFrame = doc.createElement("div");
    iconFrame.className = "play-app-icon";
    const image = doc.createElement("img");
    image.src = safeHttpUrl(app.icon);
    image.alt = `${app.name || "Zeno app"} icon`;
    image.width = 92;
    image.height = 92;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      if (!image.src.endsWith("/zno.svg")) image.src = "zno.svg";
    });
    iconFrame.append(image);

    const content = doc.createElement("div");
    content.className = "play-app-content";
    const meta = doc.createElement("div");
    meta.className = "play-app-meta";
    const live = doc.createElement("span");
    live.textContent = "Live on Google Play";
    const developer = doc.createElement("small");
    developer.textContent = app.developer || "Zeno Network Labs";
    meta.append(live, developer);

    const title = doc.createElement("h3");
    title.textContent = app.name || "Zeno App";
    const description = doc.createElement("p");
    description.textContent = knownCopy[app.packageName] || app.description || "Official Android app by Zeno Network Labs.";
    const link = doc.createElement("a");
    link.className = "store-link";
    link.href = safeHttpUrl(app.url) || "https://play.google.com/store/apps/developer?id=Zeno+Network+Labs";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `Get ${title.textContent} on Google Play`);
    link.innerHTML = `${playIconSvg}<span>Get it on Google Play</span><b>↗</b>`;

    content.append(meta, title, description, link);
    article.append(iconFrame, content);
    return article;
  }

  async function loadPlayApps() {
    const fullGrid = doc.getElementById("play-apps-grid");
    const previewGrid = doc.getElementById("play-apps-preview");
    if (!fullGrid && !previewGrid) return;
    try {
      const response = await fetch("data/play-apps.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`App catalogue returned ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.apps) || !data.apps.length) throw new Error("App catalogue is empty");

      const countTargets = [doc.getElementById("official-app-count"), doc.getElementById("directory-app-count")];
      countTargets.forEach(target => { if (target) target.textContent = String(data.apps.length); });
      const syncLabel = doc.getElementById("play-sync-label");
      if (syncLabel) syncLabel.textContent = `${data.apps.length} official app${data.apps.length === 1 ? "" : "s"} found · Automatic sync checks every 6 hours`;

      if (fullGrid) {
        fullGrid.replaceChildren(...data.apps.map(buildPlayCard));
        window.registerZenoReveals(fullGrid);
      }
      if (previewGrid) {
        previewGrid.replaceChildren(...data.apps.slice(0, 4).map(buildPlayCard));
        window.registerZenoReveals(previewGrid);
      }
    } catch (error) {
      console.error("Unable to load Google Play apps", error);
      [fullGrid, previewGrid].filter(Boolean).forEach(grid => {
        const message = doc.createElement("p");
        message.className = "app-load-error";
        message.innerHTML = `The official app list could not load right now. <a href="https://play.google.com/store/apps/developer?id=Zeno+Network+Labs" target="_blank" rel="noopener noreferrer">View Zeno Network Labs on Google Play ↗</a>`;
        grid.replaceChildren(message);
      });
      const syncLabel = doc.getElementById("play-sync-label");
      if (syncLabel) syncLabel.textContent = "Google Play link available";
    }
  }
  loadPlayApps();

  const copyButton = doc.getElementById("copy-contract");
  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      const address = doc.getElementById("contract-address")?.textContent.trim() || "";
      const status = doc.getElementById("copy-status");
      try {
        await navigator.clipboard.writeText(address);
        if (status) status.textContent = "Address copied to clipboard.";
        copyButton.textContent = "Copied ✓";
      } catch {
        if (status) status.textContent = "Select the contract address above and copy it manually.";
      }
      setTimeout(() => { copyButton.textContent = "Copy address"; if (status) status.textContent = ""; }, 3000);
    });
  }

  const year = doc.getElementById("current-year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
