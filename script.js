gsap.registerPlugin(ScrollTrigger);

if (window.Flip) {
    gsap.registerPlugin(Flip);
}

const isInsideBlueprintFrame = window.self !== window.top;
let viewportRefreshTimer = null;
let lenis = null;
let barbaViewportPrefetchStarted = false;
let barbaHoverPrefetchStarted = false;

if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
}

ScrollTrigger.clearScrollMemory("manual");

function isWebDevCardHashLocation() {
    const pageName = window.location.pathname.split("/").pop().toLowerCase();
    const isHomePage = pageName === "" || pageName === "index.html";

    return isHomePage && window.location.hash === "#webdev-card";
}

function resetPageScroll() {
    if (isWebDevCardHashLocation()) return;

    if (lenis) {
        lenis.scrollTo(0, { immediate: true, force: true });
    }

    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
}

resetPageScroll();

window.addEventListener("beforeunload", resetPageScroll);
window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
        resetPageScroll();
    }

    requestAnimationFrame(resetPageScroll);
});

const scrollbarIndicator = document.createElement("div");
scrollbarIndicator.className = "scrollbar-indicator";
scrollbarIndicator.setAttribute("aria-hidden", "true");

const scrollbarIndicatorThumb = document.createElement("span");
scrollbarIndicatorThumb.className = "scrollbar-indicator-thumb";
scrollbarIndicator.appendChild(scrollbarIndicatorThumb);
document.body.appendChild(scrollbarIndicator);

let scrollbarDragState = null;

function getScrollbarMetrics() {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const travel = Math.max(1, scrollbarIndicator.clientHeight - scrollbarIndicatorThumb.clientHeight);

    return { maxScroll, travel };
}

function syncScrollbarIndicator() {
    const { maxScroll, travel } = getScrollbarMetrics();
    const progress = gsap.utils.clamp(0, 1, window.scrollY / maxScroll);

    scrollbarIndicatorThumb.style.transform = `translate3d(-50%, ${travel * progress}px, 0)`;
}

function scrollToScrollbarProgress(progress) {
    const { maxScroll } = getScrollbarMetrics();
    const targetScroll = gsap.utils.clamp(0, 1, progress) * maxScroll;

    if (lenis) {
        lenis.scrollTo(targetScroll, { immediate: true, force: true });
    } else {
        window.scrollTo(0, targetScroll);
    }

    syncScrollbarIndicator();
}

function updateScrollbarFromPointer(clientY) {
    if (!scrollbarDragState) return;

    const { travel } = getScrollbarMetrics();
    const nextThumbY = clientY - scrollbarDragState.trackTop - scrollbarDragState.pointerOffsetY;

    scrollToScrollbarProgress(nextThumbY / travel);
}

scrollbarIndicator.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const trackRect = scrollbarIndicator.getBoundingClientRect();
    const thumbRect = scrollbarIndicatorThumb.getBoundingClientRect();
    const pointerIsOnThumb = event.target === scrollbarIndicatorThumb;

    scrollbarDragState = {
        trackTop: trackRect.top,
        pointerOffsetY: pointerIsOnThumb
            ? event.clientY - thumbRect.top
            : scrollbarIndicatorThumb.clientHeight / 2
    };

    scrollbarIndicator.classList.add("is-dragging");
    scrollbarIndicator.setPointerCapture(event.pointerId);
    updateScrollbarFromPointer(event.clientY);
    event.preventDefault();
});

scrollbarIndicator.addEventListener("pointermove", (event) => {
    if (!scrollbarDragState) return;

    updateScrollbarFromPointer(event.clientY);
    event.preventDefault();
});

function stopScrollbarDrag(event) {
    if (!scrollbarDragState) return;

    scrollbarDragState = null;
    scrollbarIndicator.classList.remove("is-dragging");

    if (event && scrollbarIndicator.hasPointerCapture(event.pointerId)) {
        scrollbarIndicator.releasePointerCapture(event.pointerId);
    }
}

scrollbarIndicator.addEventListener("pointerup", stopScrollbarDrag);
scrollbarIndicator.addEventListener("pointercancel", stopScrollbarDrag);
scrollbarIndicator.addEventListener("lostpointercapture", stopScrollbarDrag);

window.addEventListener("scroll", syncScrollbarIndicator, { passive: true });
window.addEventListener("resize", syncScrollbarIndicator, { passive: true });
window.addEventListener("resize", scheduleViewportDrivenLayoutRefresh, { passive: true });
window.addEventListener("orientationchange", scheduleViewportDrivenLayoutRefresh, { passive: true });

if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleViewportDrivenLayoutRefresh, { passive: true });
}

requestAnimationFrame(syncScrollbarIndicator);

const aboutClientsWrapX = gsap.utils.wrap(-50, 0);
const aboutClientsRows = gsap.utils.toArray(".about-clients-track").map((track, index) => {
    const isReverseRow = track.classList.contains("about-clients-track-reverse");
    const row = {
        track,
        x: isReverseRow ? -50 : 0,
        direction: isReverseRow ? 1 : -1,
        baseDirection: isReverseRow ? 1 : -1,
        speed: 50 / (index === 1 ? 48 : 58)
    };

    gsap.set(track, { xPercent: row.x });

    return row;
});
let lastAboutClientsScrollY = window.scrollY;

function syncAboutClientsScrollDirection(scrollY = window.scrollY) {
    if (!aboutClientsRows.length) return;

    const delta = scrollY - lastAboutClientsScrollY;

    if (Math.abs(delta) < 1) return;

    const scrollDirection = delta < 0 ? -1 : 1;

    aboutClientsRows.forEach((row) => {
        gsap.to(row, {
            direction: row.baseDirection * scrollDirection,
            duration: 0.6,
            ease: "power2.out",
            overwrite: true
        });
    });

    lastAboutClientsScrollY = scrollY;
}

window.addEventListener("scroll", () => syncAboutClientsScrollDirection(), { passive: true });

if (aboutClientsRows.length) {
    gsap.ticker.add(() => {
        const deltaSeconds = gsap.ticker.deltaRatio(60) / 60;

        aboutClientsRows.forEach((row) => {
            row.x = aboutClientsWrapX(row.x + (row.direction * row.speed * deltaSeconds));
            gsap.set(row.track, { xPercent: row.x });
        });
    });
}

const shouldUseLenis = window.Lenis &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (shouldUseLenis) {
    lenis = new Lenis({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        smoothTouch: false,
        wheelMultiplier: 1,
        prevent: (node) => Boolean(node.closest && node.closest(".approach-card.is-scrollable, .menu-overlay, .contact-thank-modal"))
    });

    lenis.stop();
    lenis.on("scroll", ({ scroll }) => {
        syncScrollbarIndicator();
        syncAboutClientsScrollDirection(scroll);
        ScrollTrigger.update();
    });

    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
}

function refreshLenis() {
    if (!lenis) return;

    lenis.resize();

    if (!pageIsReady) {
        lenis.scrollTo(window.scrollY, { immediate: true, force: true });
    }
}

function refreshViewportDrivenLayout() {
    refreshLenis();

    if (!pageIsReady) return;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            refreshScrollTriggersPreservingMasterProgress();
            syncScrollbarIndicator();
            syncApproachMasks();
        });
    });
}

function scheduleViewportDrivenLayoutRefresh() {
    window.clearTimeout(viewportRefreshTimer);
    viewportRefreshTimer = window.setTimeout(refreshViewportDrivenLayout, 120);
}

function refreshScrollTriggersPreservingMasterProgress() {
    const trigger = masterTl && masterTl.scrollTrigger;
    const shouldRestoreProgress = Boolean(trigger && trigger.end > trigger.start);
    const progress = shouldRestoreProgress ? gsap.utils.clamp(0, 1, trigger.progress) : 0;

    ScrollTrigger.refresh();

    if (shouldRestoreProgress && masterTl.scrollTrigger) {
        const refreshedTrigger = masterTl.scrollTrigger;
        const targetScroll = refreshedTrigger.start + (progress * (refreshedTrigger.end - refreshedTrigger.start));

        if (lenis) {
            lenis.resize();
            lenis.scrollTo(targetScroll, { immediate: true, force: true });
        }

        if (typeof refreshedTrigger.scroll === "function") {
            refreshedTrigger.scroll(targetScroll);
        } else {
            window.scrollTo(0, targetScroll);
        }

        masterTl.progress(progress, false);
    }

    ScrollTrigger.update();
    syncApproachLayerState({ useScrollPosition: true, forceAboutVisible: true });
}

function setBlueprintFrameRuntimeActive(isActive) {
    if (!isInsideBlueprintFrame) return;

    window.__blueprintFrameActive = isActive;

    if (isActive) {
        gsap.ticker.wake();
        ScrollTrigger.getAll().forEach((trigger) => trigger.enable(false));

        if (lenis) {
            lenis.resize();
            lenis.start();
        }

        requestAnimationFrame(() => {
            ScrollTrigger.refresh();
            ScrollTrigger.update();
            syncScrollbarIndicator();
        });

        return;
    }

    if (lenis) {
        lenis.stop();
    }

    ScrollTrigger.getAll().forEach((trigger) => trigger.disable(false));
    gsap.ticker.sleep();
}

window.__blueprintSetFrameActive = setBlueprintFrameRuntimeActive;

function setBlueprintShellRuntimeActive(isActive) {
    if (isInsideBlueprintFrame) return;

    if (isActive) {
        gsap.ticker.wake();
        ScrollTrigger.getAll().forEach((trigger) => trigger.enable(false));

        if (!document.documentElement.classList.contains("is-frame-page-active") && lenis) {
            lenis.start();
        }

        return;
    }

    if (lenis) {
        lenis.stop();
    }

    ScrollTrigger.getAll().forEach((trigger) => trigger.disable(false));
    gsap.ticker.sleep();
}

let pageIsReady = false;
const currentPageName = window.location.pathname.split("/").pop().toLowerCase();
const isIndexPage = currentPageName === "" || currentPageName === "index.html";
const linkLoaderStorageKey = "blueprintUseLinkLoader";
const serviceDirectNavigationStorageKey = "blueprintServiceDirectNavigation";
const webDevReverseReturnStorageKey = "blueprintWebDevReverseReturn";
let shouldLandOnWebDevCard = isIndexPage && window.location.hash === "#webdev-card";
let shouldUseLinkLoader = false;
let shouldSkipIncomingLoader = false;
let shouldPlayWebDevReverseReturn = false;
let webDevReverseReturnStarted = false;

try {
    shouldUseLinkLoader = sessionStorage.getItem(linkLoaderStorageKey) === "true";
    shouldSkipIncomingLoader = sessionStorage.getItem(serviceDirectNavigationStorageKey) === "true";
    shouldPlayWebDevReverseReturn = isIndexPage && window.location.hash === "#webdev-card" && sessionStorage.getItem(webDevReverseReturnStorageKey) === "true";
    sessionStorage.removeItem(linkLoaderStorageKey);
    sessionStorage.removeItem(serviceDirectNavigationStorageKey);
    sessionStorage.removeItem(webDevReverseReturnStorageKey);
} catch (error) {
    shouldUseLinkLoader = false;
    shouldSkipIncomingLoader = false;
    shouldPlayWebDevReverseReturn = false;
}

if (isInsideBlueprintFrame) {
    shouldUseLinkLoader = true;
    shouldSkipIncomingLoader = false;
}

const loaderElement = document.getElementById('loader');

if (loaderElement && shouldSkipIncomingLoader) {
    loaderElement.style.display = "none";
}

if (loaderElement && shouldUseLinkLoader && !shouldSkipIncomingLoader) {
    loaderElement.classList.add("is-link-loader");
}

function setLinkLoaderFlag() {
    try {
        sessionStorage.setItem(linkLoaderStorageKey, "true");
    } catch (error) {
        // Storage can be unavailable in private browsing; the outgoing transition still works.
    }
}

function navigateWithLinkLoader(url) {
    const loader = document.getElementById('loader');

    setBlueprintShellRuntimeActive(true);

    if (isInsideBlueprintFrame) {
        prefetchBarbaPage(url);
    } else {
        getBlueprintPageFrame(url);
    }
    setLinkLoaderFlag();
    document.documentElement.classList.add("is-link-transition");
    document.documentElement.style.backgroundColor = "#000000";
    document.body.style.overflow = "hidden";
    if (lenis) {
        lenis.stop();
    }

    if (!loader) {
        window.location.href = url;
        return;
    }

    loader.classList.add("is-link-loader");
    loader.style.display = "flex";

    gsap.killTweensOf(".loader, .loader-logo .char, .loader-progress, .loader-progress-bar");
    gsap.set(".loader", { yPercent: 100, opacity: 1 });
    gsap.set(".loader-logo .char", { y: "140%" });
    gsap.set(".loader-progress, .loader-progress-bar", { opacity: 0 });

    gsap.timeline({
        onComplete: () => {
            completeBarbaPageSwap(url);
        }
    })
        .to(".loader", {
            yPercent: 0,
            duration: 0.65,
            ease: "expo.inOut"
        })
        .to(".loader-logo .char", {
            y: 0,
            stagger: 0.035,
            duration: 0.62,
            ease: "power4.out"
        }, "-=0.28")
        .to({}, { duration: 0.18 });
}

const blueprintPreloadPageList = [
    "index.html",
    "projects.html",
    "approach.html",
    "about.html",
    "contact.html",
    "service-webdev.html",
    "service-branding.html",
    "service-marketing.html",
    "service-architecture.html"
];
const blueprintPrefetchedPages = new Set();
const blueprintPageHtmlCache = new Map();
const blueprintPagePreloadPromises = new Map();
const blueprintPreloadedAssets = new Set();
const blueprintPageFrames = new Map();
let blueprintAllFramesPreloadStarted = false;
let blueprintFrameLayer = null;
let blueprintActiveFrameUrl = null;

function normalizeBlueprintPageUrl(rawUrl) {
    if (!rawUrl) return null;

    let targetUrl;

    try {
        targetUrl = new URL(rawUrl, window.location.href);
    } catch (error) {
        return null;
    }

    if (targetUrl.origin !== window.location.origin) return null;
    if (!/\.html$/i.test(targetUrl.pathname) && targetUrl.pathname !== "/" && targetUrl.pathname !== "") return null;

    targetUrl.hash = "";

    return targetUrl.href;
}

function getBarbaInternalPageUrl(rawUrl) {
    const pageUrl = normalizeBlueprintPageUrl(rawUrl);

    if (!pageUrl) return null;

    const targetUrl = new URL(pageUrl);
    const currentUrl = new URL(window.location.href);
    const isSameDocument = targetUrl.pathname === currentUrl.pathname &&
        targetUrl.search === currentUrl.search;

    if (isSameDocument) return null;

    return pageUrl;
}

function fetchBlueprintPage(rawUrl) {
    const url = normalizeBlueprintPageUrl(rawUrl);

    if (!url) return Promise.reject(new Error("Invalid Blueprint page URL"));
    if (blueprintPageHtmlCache.has(url)) return Promise.resolve(blueprintPageHtmlCache.get(url));
    if (blueprintPagePreloadPromises.has(url)) return blueprintPagePreloadPromises.get(url);

    const preloadPromise = fetch(url, {
        method: "GET",
        credentials: "same-origin",
        cache: "force-cache",
        priority: "high"
    })
        .then((response) => {
            if (!response.ok) throw new Error(`Unable to preload ${url}`);

            return response.text();
        })
        .then((html) => {
            blueprintPageHtmlCache.set(url, html);
            blueprintPrefetchedPages.add(url);
            warmBlueprintPageAssets(html, url);

            return html;
        })
        .catch((error) => {
            blueprintPagePreloadPromises.delete(url);
            blueprintPrefetchedPages.delete(url);
            throw error;
        });

    blueprintPagePreloadPromises.set(url, preloadPromise);

    return preloadPromise;
}

function warmBlueprintPageAssets(html, pageUrl) {
    // Keep page prefetch lightweight. Decoding every destination image up front
    // was pushing the home page into very high memory usage.
    if (!html || !pageUrl) return;
}

function prefetchBarbaPage(rawUrl) {
    const url = normalizeBlueprintPageUrl(rawUrl);

    if (!url || blueprintPrefetchedPages.has(url)) return Promise.resolve();

    blueprintPrefetchedPages.add(url);

    return fetchBlueprintPage(url).catch(() => {
        blueprintPrefetchedPages.delete(url);
    });
}

function collectBarbaInternalLinks(root = document) {
    return Array.from(root.querySelectorAll("a[href], button[onclick]"))
        .map((link) => getBarbaInternalPageUrl(getBarbaTargetFromElement(link)))
        .filter(Boolean);
}

function getBarbaTargetFromElement(element) {
    if (!element) return null;

    if (element.matches && element.matches("a[href]")) {
        return element.getAttribute("href");
    }

    const inlineHandler = element.getAttribute && element.getAttribute("onclick");
    const transitionMatch = inlineHandler && inlineHandler.match(/handlePageTransition\(\s*event\s*,\s*['"]([^'"]+)['"]\s*\)/);

    return transitionMatch ? transitionMatch[1] : null;
}

function syncBarbaDocumentState(nextHtml) {
    if (!nextHtml) return;

    const nextDocument = new DOMParser().parseFromString(nextHtml, "text/html");
    const nextTitle = nextDocument.querySelector("title");

    if (nextTitle) {
        document.title = nextTitle.textContent;
    }

    document.body.className = nextDocument.body.className;
}

function startViewportBarbaPrefetch() {
    if (!("IntersectionObserver" in window)) return;
    if (barbaViewportPrefetchStarted) return;

    barbaViewportPrefetchStarted = true;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const link = entry.target;

            observer.unobserve(link);
            const targetUrl = getBarbaTargetFromElement(link);

            prefetchBarbaPage(targetUrl);
        });
    }, {
        rootMargin: "360px 0px",
        threshold: 0.01
    });

    document.querySelectorAll("a[href], button[onclick]").forEach((link) => {
        if (getBarbaInternalPageUrl(getBarbaTargetFromElement(link))) {
            observer.observe(link);
        }
    });
}

function startHoverBarbaPrefetch() {
    if (barbaHoverPrefetchStarted) return;

    barbaHoverPrefetchStarted = true;

    ["pointerenter", "focusin", "touchstart"].forEach((eventName) => {
        document.addEventListener(eventName, (event) => {
            const link = event.target.closest && event.target.closest("a[href], button[onclick]");

            if (!link || link.target || link.hasAttribute("download") || link.dataset.noBarba === "true") return;

            const targetUrl = getBarbaTargetFromElement(link);

            prefetchBarbaPage(targetUrl);
        }, {
            capture: true,
            passive: true
        });
    });
}

function getBlueprintPreloadUrls() {
    return Array.from(new Set([
        ...blueprintPreloadPageList.map((page) => normalizeBlueprintPageUrl(page)),
        ...collectBarbaInternalLinks()
    ].filter(Boolean)));
}

function ensureBlueprintFrameLayer() {
    if (blueprintFrameLayer) return blueprintFrameLayer;

    blueprintFrameLayer = document.createElement("div");
    blueprintFrameLayer.className = "blueprint-frame-layer";
    blueprintFrameLayer.setAttribute("aria-hidden", "true");
    document.body.appendChild(blueprintFrameLayer);

    return blueprintFrameLayer;
}

function primeBlueprintFrame(frame, url) {
    let frameWindow;
    let frameDocument;

    try {
        frameWindow = frame.contentWindow;
        frameDocument = frame.contentDocument;
    } catch (error) {
        return;
    }

    if (!frameWindow || !frameDocument || frame.dataset.primed === "true") return;

    frame.dataset.primed = "true";

    frameWindow.__blueprintInsidePreloadedFrame = true;
    frameWindow.handlePageTransition = function(event, targetUrl) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const clickedTarget = event && event.currentTarget;

        if (clickedTarget && clickedTarget.closest && clickedTarget.closest(".service-card-web-dev") && isWebDevServiceUrl(targetUrl)) {
            playWebDevServiceCardImageTransition(clickedTarget, targetUrl);
            return;
        }

        window.__blueprintNavigatePreloadedFrame(targetUrl || url);
    };

    frameDocument.addEventListener("click", (event) => {
        const panel = event.target.closest && event.target.closest(".service-card-web-dev");

        if (!panel || event.defaultPrevented || event.target.closest("button, a, input, textarea, select")) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        playWebDevServiceCardImageTransition(panel, "service-webdev.html");
    }, true);

    frameDocument.addEventListener("click", (event) => {
        const link = event.target.closest && event.target.closest("a[href]");

        if (!link || event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (link.target || link.hasAttribute("download") || link.dataset.noBarba === "true") return;

        const targetUrl = getBarbaInternalPageUrl(link.getAttribute("href"));

        if (!targetUrl) return;

        event.preventDefault();
        event.stopPropagation();
        window.__blueprintNavigatePreloadedFrame(targetUrl);
    }, true);

    setBlueprintFrameRuntime(frame, blueprintActiveFrameUrl === url);
}

function setBlueprintFrameRuntime(frame, isActive) {
    try {
        if (frame.contentWindow && typeof frame.contentWindow.__blueprintSetFrameActive === "function") {
            frame.contentWindow.__blueprintSetFrameActive(isActive);
        }
    } catch (error) {}
}

function getBlueprintPageFrame(rawUrl) {
    const url = normalizeBlueprintPageUrl(rawUrl);

    if (!url) return null;
    if (blueprintPageFrames.has(url)) return blueprintPageFrames.get(url);

    const layer = ensureBlueprintFrameLayer();
    const frame = document.createElement("iframe");
    const frameState = { frame, ready: false, readyPromise: null };

    frame.className = "blueprint-page-frame";
    frame.dataset.blueprintFrameUrl = url;
    frame.loading = "eager";
    frame.setAttribute("title", `Blueprint page ${new URL(url).pathname.split("/").pop() || "home"}`);

    frameState.readyPromise = new Promise((resolve, reject) => {
        let didResolve = false;
        let readyCheckTimer = null;

        const resolveFrameReady = () => {
            if (didResolve) return;

            didResolve = true;
            window.clearInterval(readyCheckTimer);

            window.setTimeout(() => {
                primeBlueprintFrame(frame, url);
                frameState.ready = true;
                setBlueprintFrameRuntime(frame, blueprintActiveFrameUrl === url);
                resolve(frameState);
            }, 950);
        };

        readyCheckTimer = window.setInterval(() => {
            try {
                const frameDocument = frame.contentDocument;

                if (frameDocument && frameDocument.readyState !== "loading") {
                    resolveFrameReady();
                }
            } catch (error) {}
        }, 50);

        frame.addEventListener("load", resolveFrameReady, { once: true });

        frame.addEventListener("error", () => {
            window.clearInterval(readyCheckTimer);
            reject(new Error(`Unable to preload frame ${url}`));
        }, { once: true });
    });

    blueprintPageFrames.set(url, frameState);
    layer.appendChild(frame);
    frame.src = url;

    return frameState;
}

function preloadBlueprintPageFrames() {
    if (blueprintAllFramesPreloadStarted) return;

    blueprintAllFramesPreloadStarted = true;
    getBlueprintPreloadUrls().forEach((url, index) => {
        window.setTimeout(() => {
            getBlueprintPageFrame(url);
        }, index * 360);
    });
}

function scheduleBlueprintFramePreload() {
    // Intentionally disabled: preloading live iframes duplicates full pages,
    // scripts, animations, and decoded images. Frames are created on demand.
}

function syncBlueprintFrameTitle(frame) {
    try {
        const frameTitle = frame.contentDocument && frame.contentDocument.title;

        if (frameTitle) {
            document.title = frameTitle;
        }
    } catch (error) {}
}

function suppressBlueprintFrameLoader(frame) {
    try {
        const frameDocument = frame.contentDocument;
        const frameWindow = frame.contentWindow;
        const frameLoader = frameDocument && frameDocument.getElementById("loader");

        if (frameLoader) {
            frameLoader.style.display = "none";
        }

        if (frameDocument) {
            frameDocument.documentElement.classList.remove("is-link-transition");
            frameDocument.documentElement.classList.remove("is-service-direct-transition");
            frameDocument.documentElement.style.backgroundColor = "";
            frameDocument.body.style.overflow = "";
        }

        if (frameWindow && frameWindow.gsap) {
            frameWindow.gsap.killTweensOf(".loader, .loader-logo .char, .loader-progress, .loader-progress-bar");
        }
    } catch (error) {}
}

function showPreloadedBlueprintFrame(rawUrl, options = {}) {
    const url = normalizeBlueprintPageUrl(rawUrl);
    const frameState = getBlueprintPageFrame(url);

    if (!url || !frameState) return Promise.reject(new Error("Invalid frame page URL"));

    return frameState.readyPromise.then(({ frame }) => {
        const layer = ensureBlueprintFrameLayer();

        if (options.skipLoaderExit) {
            suppressBlueprintFrameLoader(frame);
        }

        Array.from(layer.children).forEach((child) => {
            const isActiveFrame = child === frame;

            child.classList.toggle("is-active", isActiveFrame);
            setBlueprintFrameRuntime(child, isActiveFrame);
        });

        layer.classList.add("is-active");
        layer.setAttribute("aria-hidden", "false");
        document.documentElement.classList.add("is-frame-page-active");
        document.body.style.overflow = "hidden";
        blueprintActiveFrameUrl = url;

        if (lenis) {
            lenis.stop();
        }

        if (options.updateHistory !== false && window.location.href !== url) {
            window.history.pushState({ blueprintFrameUrl: url }, "", url);
        }

        syncBlueprintFrameTitle(frame);
        primeBlueprintFrame(frame, url);

        try {
            frame.contentWindow.scrollTo(0, 0);
            frame.contentWindow.focus();
        } catch (error) {}

        if (options.skipLoaderExit) {
            document.documentElement.classList.remove("is-link-transition");
            document.documentElement.style.backgroundColor = "";
            setBlueprintShellRuntimeActive(false);
            return Promise.resolve();
        }

        return animateBarbaLoaderOut().then(() => {
            setBlueprintShellRuntimeActive(false);
        });
    });
}

window.__blueprintNavigatePreloadedFrame = function(rawUrl) {
    navigateWithLinkLoader(rawUrl);
};

window.addEventListener("popstate", () => {
    const url = normalizeBlueprintPageUrl(window.location.href);

    if (!url || (!blueprintActiveFrameUrl && !document.documentElement.classList.contains("is-frame-page-active"))) {
        return;
    }

    document.documentElement.classList.add("is-link-transition");
    document.documentElement.style.backgroundColor = "#000000";
    document.body.style.overflow = "hidden";

    showPreloadedBlueprintFrame(url, { updateHistory: false }).catch(() => {
        window.location.href = url;
    });
});

function completeBarbaPageSwap(url) {
    showPreloadedBlueprintFrame(url).catch(() => {
        window.location.href = url;
    });
}

function animateBarbaLoaderOut() {
    const loader = document.getElementById("loader");

    if (!loader || !window.gsap) {
        document.documentElement.classList.remove("is-link-transition");
        if (!document.documentElement.classList.contains("is-frame-page-active")) {
            document.body.style.overflow = "";
        }
        return Promise.resolve();
    }

    loader.classList.add("is-link-loader");
    loader.style.display = "flex";
    gsap.killTweensOf(".loader, .loader-logo .char, .loader-progress, .loader-progress-bar");
    gsap.set(".loader-logo .char", { y: 0 });
    gsap.set(".loader-progress, .loader-progress-bar", { opacity: 0 });

    return new Promise((resolve) => {
        gsap.to(".loader", {
            yPercent: -100,
            duration: 0.82,
            ease: "expo.inOut",
            onComplete: () => {
                loader.style.display = "none";
                document.documentElement.classList.remove("is-link-transition");
                document.documentElement.style.backgroundColor = "";
                if (!document.documentElement.classList.contains("is-frame-page-active")) {
                    document.body.style.overflow = "";
                }
                resolve();
            }
        });
    });
}

function refreshBarbaPage(nextContainer) {
    if (!nextContainer) return;

    splitBlueprintText(nextContainer);
    initRollingLinkHovers();
    initProjectPreviewImages();
    initStandaloneProjectCursorPreview();
    initPremiumAboutPage();
    startStandalonePageAnimation();
    initMobilePageTextReveals();
}

function initBlueprintBarbaOptimizer() {
    if (!window.barba || window.__blueprintBarbaReady) return;

    const barbaPrefetchPlugin = window.barbaPrefetch && (window.barbaPrefetch.default || window.barbaPrefetch);

    if (barbaPrefetchPlugin && typeof window.barba.use === "function") {
        window.barba.use(barbaPrefetchPlugin);
    }

    window.barba.hooks.beforeLeave(() => {
        if (lenis) {
            lenis.stop();
        }
    });

    window.barba.hooks.beforeEnter(({ next }) => {
        syncBarbaDocumentState(next && next.html);
        resetPageScroll();
    });

    window.barba.hooks.afterEnter(() => {
        requestAnimationFrame(() => {
            if (lenis) {
                lenis.resize();
                lenis.scrollTo(0, { immediate: true, force: true });
                lenis.start();
            }

            syncScrollbarIndicator();
            startViewportBarbaPrefetch();
        });
    });

    try {
        window.barba.init({
            cacheIgnore: false,
            cacheFirstPage: true,
            prefetchIgnore: false,
            preventRunning: true,
            timeout: 8000,
            prevent: () => true,
            transitions: [{
                name: "blueprint-loader-covered-swap",
                sync: true,
                beforeEnter({ next }) {
                    refreshBarbaPage(next && next.container);
                },
                afterEnter() {
                    return animateBarbaLoaderOut();
                }
            }]
        });
    } catch (error) {
        return;
    }

    window.__blueprintBarbaReady = true;
    document.documentElement.classList.add("has-barba-transitions");

    startHoverBarbaPrefetch();
    startViewportBarbaPrefetch();
}

initBlueprintBarbaOptimizer();

if (!isInsideBlueprintFrame) {
    scheduleBlueprintFramePreload();

    document.addEventListener("click", (event) => {
        const link = event.target.closest && event.target.closest("a[href]");

        if (!link || event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (link.target || link.hasAttribute("download") || link.dataset.noBarba === "true") return;

        const targetUrl = getBarbaInternalPageUrl(link.getAttribute("href"));

        if (!targetUrl) return;

        event.preventDefault();
        event.stopPropagation();
        navigateWithLinkLoader(targetUrl);
    }, true);
}

function navigateDirectlyToService(url, options = {}) {
    return showPreloadedBlueprintFrame(url, options).catch(() => {
        window.location.href = url;
    });
}

function isWebDevServiceUrl(url) {
    const targetUrl = normalizeBlueprintPageUrl(url);

    return Boolean(targetUrl && targetUrl.endsWith("/service-webdev.html"));
}

function getServiceCardTransitionOptions(url) {
    return {
        skipLoaderExit: isWebDevServiceUrl(url)
    };
}

let webDevServiceImageTransitionRunning = false;

function getWebDevHeroMediaTargetRect(url) {
    const targetUrl = normalizeBlueprintPageUrl(url);
    const frameState = targetUrl ? blueprintPageFrames.get(targetUrl) : null;
    const frame = frameState && frameState.frame;

    try {
        const media = frame && frame.contentDocument && frame.contentDocument.querySelector(".webdev-hero-media");
        const mediaRect = media && media.getBoundingClientRect();

        if (mediaRect && mediaRect.width > 0 && mediaRect.height > 0) {
            const frameRect = frame.getBoundingClientRect();

            return {
                left: frameRect.left + mediaRect.left,
                top: frameRect.top + mediaRect.top,
                width: mediaRect.width,
                height: mediaRect.height
            };
        }
    } catch (error) {}

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isMobile = viewportWidth <= 760;
    const width = isMobile
        ? Math.min(viewportWidth * 0.72, 368)
        : gsap.utils.clamp(280, 448, viewportWidth * 0.35);
    const height = width * 9 / 16;
    const yShift = isMobile ? 0.58 : 0.47;

    return {
        left: (viewportWidth - width) / 2,
        top: (viewportHeight / 2) - (height * yShift),
        width,
        height
    };
}

function createWebDevTransitionImage(image) {
    const rect = image.getBoundingClientRect();
    const transitionImage = image.cloneNode(true);

    transitionImage.classList.add("webdev-service-transition-image");
    document.body.appendChild(transitionImage);
    gsap.set(transitionImage, {
        position: "fixed",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        margin: 0,
        zIndex: 13000,
        objectFit: "cover",
        objectPosition: "center",
        pointerEvents: "none",
        transformOrigin: "center center",
        willChange: "transform,width,height,left,top"
    });

    return transitionImage;
}

function animateWebDevImageToFullscreen(transitionImage) {
    const supportsFlip = window.Flip && typeof Flip.getState === "function" && typeof Flip.from === "function";

    if (!supportsFlip) {
        return gsap.to(transitionImage, {
            left: 0,
            top: 0,
            width: window.innerWidth,
            height: window.innerHeight,
            duration: 1,
            ease: "power3.inOut"
        });
    }

    const imageState = Flip.getState(transitionImage);

    gsap.set(transitionImage, {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight
    });

    return Flip.from(imageState, {
        duration: 1,
        ease: "power3.inOut",
        absolute: true,
        scale: true
    });
}

function setWebDevHeroMediaHidden(url, isHidden) {
    const targetUrl = normalizeBlueprintPageUrl(url);
    const frameState = targetUrl ? blueprintPageFrames.get(targetUrl) : null;
    const frame = frameState && frameState.frame;

    try {
        const media = frame && frame.contentDocument && frame.contentDocument.querySelector(".webdev-hero-media");

        if (media) {
            media.style.visibility = isHidden ? "hidden" : "";
        }
    } catch (error) {}
}

function getWebDevReverseTransitionImage(image) {
    const bootImage = document.querySelector(".webdev-reverse-boot-image");

    if (bootImage) {
        gsap.set(bootImage, {
            display: "block",
            position: "fixed",
            left: 0,
            top: 0,
            width: window.innerWidth,
            height: window.innerHeight,
            margin: 0,
            zIndex: 13000,
            objectFit: "cover",
            objectPosition: "center",
            pointerEvents: "none",
            transformOrigin: "center center",
            willChange: "transform,width,height,left,top,opacity",
            autoAlpha: 1
        });

        return bootImage;
    }

    return createWebDevTransitionImage(image);
}

function playWebDevServiceCardImageTransition(clickedBtn, url) {
    if (webDevServiceImageTransitionRunning) return;

    webDevServiceImageTransitionRunning = true;
    const frameState = getBlueprintPageFrame(url);
    const panel = clickedBtn.closest(".panel");
    const content = panel ? panel.querySelector(".reveal-content") : null;
    const image = panel ? panel.querySelector(".card-img-unified") : null;
    const info = panel ? panel.querySelector(".card-info") : null;

    if (!panel || !content || !image || !info) {
        webDevServiceImageTransitionRunning = false;
        navigateDirectlyToService(url, getServiceCardTransitionOptions(url));
        return;
    }

    const panelRect = panel.getBoundingClientRect();
    const computedPanelStyle = window.getComputedStyle(panel);
    const transitionImage = createWebDevTransitionImage(image);

    document.body.style.overflow = "hidden";
    panel.classList.add("is-service-transitioning");

    if (lenis) {
        lenis.stop();
    }

    gsap.killTweensOf([panel, content, info, info.children, image, transitionImage, clickedBtn]);
    gsap.set(transitionImage, { autoAlpha: 0 });
    gsap.set(panel, {
        position: "fixed",
        left: panelRect.left,
        top: panelRect.top,
        width: panelRect.width,
        height: panelRect.height,
        x: 0,
        y: 0,
        xPercent: 0,
        yPercent: 0,
        margin: 0,
        zIndex: 12990,
        borderTopLeftRadius: computedPanelStyle.borderTopLeftRadius,
        borderTopRightRadius: computedPanelStyle.borderTopRightRadius,
        borderBottomLeftRadius: computedPanelStyle.borderBottomLeftRadius,
        borderBottomRightRadius: computedPanelStyle.borderBottomRightRadius
    });

    const transitionTl = gsap.timeline({
        defaults: { ease: "power3.inOut" },
        onComplete: () => {
            navigateDirectlyToService(url, getServiceCardTransitionOptions(url))
                .then(() => {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            gsap.ticker.wake();
                            setWebDevHeroMediaHidden(url, true);

                            // Phase 4: after the destination page is visible, morph into its hero media frame.
                            gsap.to(transitionImage, {
                                left: () => getWebDevHeroMediaTargetRect(url).left,
                                top: () => getWebDevHeroMediaTargetRect(url).top,
                                width: () => getWebDevHeroMediaTargetRect(url).width,
                                height: () => getWebDevHeroMediaTargetRect(url).height,
                                duration: 0.95,
                                ease: "power3.inOut",
                                onComplete: () => {
                                    setWebDevHeroMediaHidden(url, false);
                                    transitionImage.remove();
                                    webDevServiceImageTransitionRunning = false;
                                }
                            });
                        });
                    });
                })
                .catch(() => {
                    transitionImage.remove();
                    webDevServiceImageTransitionRunning = false;
                });
        },
        onInterrupt: () => {
            transitionImage.remove();
            setWebDevHeroMediaHidden(url, false);
            gsap.set(image, { autoAlpha: 1 });
            gsap.set(panel, { clearProps: "position,left,top,width,height,x,y,xPercent,yPercent,margin,zIndex,borderRadius,autoAlpha" });
            webDevServiceImageTransitionRunning = false;
        }
    });

    // Phase 1: pin the whole card and move it into the viewport so it covers the view.
    transitionTl
        .to(panel, {
            left: 0,
            top: 0,
            width: window.innerWidth,
            height: window.innerHeight,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            duration: 0.72
        }, 0);

    // Phase 2: slide the lower content down, turning the card into a full image stage.
    transitionTl
        .to(info.children, {
            y: 42,
            autoAlpha: 0,
            stagger: 0.035,
            duration: 0.42,
            ease: "power3.in"
        }, 0.58)
        .to(info, {
            yPercent: 112,
            duration: 0.72
        }, 0.64)
        .to(content, {
            gridTemplateRows: "100% 0%",
            duration: 0.78
        }, 0.66);

    // Phase 3: clone the now-fullscreen image, hide the card, then morph into the Web Dev hero media frame.
    transitionTl.add(() => {
        const imageRect = image.getBoundingClientRect();
        gsap.set(transitionImage, {
            left: imageRect.left,
            top: imageRect.top,
            width: imageRect.width,
            height: imageRect.height,
            autoAlpha: 1
        });
        gsap.set(image, { autoAlpha: 0 });
        gsap.set(panel, { autoAlpha: 0 });
    }, 1.48);

    if (frameState && frameState.readyPromise) {
        frameState.readyPromise.catch(() => {});
    }
}

function playServiceCardExit(clickedBtn, url) {
    getBlueprintPageFrame(url);

    const panel = clickedBtn.closest(".panel");
    const content = panel ? panel.querySelector(".reveal-content") : null;
    const image = panel ? panel.querySelector(".card-img-unified") : null;
    const info = panel ? panel.querySelector(".card-info") : null;

    if (!panel || !content || !image || !info) {
        navigateDirectlyToService(url, getServiceCardTransitionOptions(url));
        return;
    }

    const rect = panel.getBoundingClientRect();
    const computedPanelStyle = window.getComputedStyle(panel);

    panel.classList.add("is-service-transitioning");
    document.body.style.overflow = "hidden";
    if (lenis) {
        lenis.stop();
    }

    gsap.killTweensOf([panel, content, image, info, info.children, clickedBtn]);
    gsap.set(panel, {
        position: "fixed",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        x: 0,
        y: 0,
        xPercent: 0,
        yPercent: 0,
        margin: 0,
        borderTopLeftRadius: computedPanelStyle.borderTopLeftRadius,
        borderTopRightRadius: computedPanelStyle.borderTopRightRadius,
        borderBottomLeftRadius: computedPanelStyle.borderBottomLeftRadius,
        borderBottomRightRadius: computedPanelStyle.borderBottomRightRadius
    });

    gsap.timeline({
        defaults: { ease: "expo.inOut" },
        onComplete: () => navigateDirectlyToService(url, getServiceCardTransitionOptions(url))
    })
        .to(panel, {
            left: 0,
            top: 0,
            width: window.innerWidth,
            height: window.innerHeight,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            duration: 0.74
        }, 0)
        .to(clickedBtn, {
            scale: 0.92,
            opacity: 0,
            duration: 0.28,
            ease: "power2.in"
        }, 0.48)
        .to(info.children, {
            y: 34,
            opacity: 0,
            stagger: 0.035,
            duration: 0.42,
            ease: "power3.in"
        }, 0.5)
        .to(info, {
            yPercent: 112,
            duration: 0.78
        }, 0.62)
        .to(content, {
            gridTemplateRows: "100% 0%",
            duration: 0.95
        }, 0.62)
        .to(image, {
            scale: 1,
            duration: 0.95
        }, 0.62);
}

function getCurrentServiceCardIndex() {
    const serviceCardMap = {
        "service-webdev.html": 0,
        "service-branding.html": 1,
        "service-marketing.html": 2,
        "service-architecture.html": 3
    };

    return serviceCardMap[currentPageName];
}

window.handlePageTransition = function(e, url) {
    e.preventDefault();
    const clickedBtn = e.currentTarget;
    let siblingsToHide = [];
    const redirectToTarget = () => {
        navigateWithLinkLoader(url);
    };

    if (isIndexPage && clickedBtn.closest(".service-card-web-dev") && isWebDevServiceUrl(url)) {
        playWebDevServiceCardImageTransition(clickedBtn, url);
        return;
    }

    if (isIndexPage && (clickedBtn.classList.contains("icon-btn") || clickedBtn.classList.contains("card-image-button")) && clickedBtn.closest(".panel")) {
        playServiceCardExit(clickedBtn, url);
        return;
    }

    if (clickedBtn.classList.contains('logo-button')) {
        siblingsToHide = Array.from(document.querySelectorAll('.nav-links button, .menu-overlay-link'));
    } else if (clickedBtn.classList.contains('menu-overlay-link')) {
        siblingsToHide = Array.from(document.querySelectorAll('.menu-overlay-link')).filter(btn => btn !== clickedBtn);
    } else {
        siblingsToHide = Array.from(document.querySelectorAll('.nav-links button')).filter(btn => btn !== clickedBtn);
    }

    if (siblingsToHide.length > 0) {
        gsap.to(siblingsToHide, {
            opacity: 0,
            y: -10,
            duration: 0.3,
            stagger: 0.05,
            ease: "power2.in",
            onComplete: () => {
                redirectToTarget();
            }
        });
    } else {
        redirectToTarget();
    }
};

if (isIndexPage) {
    document.addEventListener("click", (event) => {
        const panel = event.target.closest(".service-card-web-dev");

        if (!panel || event.defaultPrevented || event.target.closest("button, a, input, textarea, select")) {
            return;
        }

        event.preventDefault();
        playWebDevServiceCardImageTransition(panel, "service-webdev.html");
    });
}

// 1. SPLIT TYPE
function splitBlueprintText(root = document) {
    const splitTypes = root.querySelectorAll('.reveal-text, .bottom-logo, .loader-logo, .logo-button, .menu-overlay-blueprint');

    splitTypes.forEach((textElement) => {
        if (textElement.dataset.blueprintSplit === "true") return;

        textElement.dataset.blueprintSplit = "true";
        const usesLineMask =
            textElement.classList.contains('hero-description') ||
            textElement.classList.contains('card-desc') ||
            textElement.classList.contains('masking-overlay-copy') ||
            textElement.classList.contains('masking-overlay-description') ||
            textElement.classList.contains('masking-overlay-about-copy') ||
            textElement.classList.contains('about-section-statement') ||
            textElement.classList.contains('about-section-label') ||
            textElement.classList.contains('about-section-body') ||
            textElement.classList.contains('about-section-fact') ||
            textElement.classList.contains('about-section-link') ||
            textElement.classList.contains('about-laptop-services-word') ||
            textElement.classList.contains('contact-section-eyebrow') ||
            textElement.classList.contains('contact-section-statement') ||
            textElement.classList.contains('contact-section-label') ||
            textElement.classList.contains('contact-section-link') ||
            textElement.classList.contains('contact-section-button') ||
            textElement.classList.contains('project-category-title') ||
            textElement.classList.contains('project-list-link') ||
            textElement.classList.contains('link-page-kicker') ||
            textElement.classList.contains('link-page-title') ||
            textElement.classList.contains('link-page-subline') ||
            textElement.classList.contains('link-page-intro') ||
            textElement.classList.contains('link-project-service-title') ||
            textElement.classList.contains('link-project-item') ||
            textElement.classList.contains('projects-bridge-copy') ||
            textElement.classList.contains('site-footer-label') ||
            textElement.classList.contains('site-footer-title') ||
            textElement.classList.contains('site-footer-meta-text') ||
            textElement.classList.contains('approach-eyebrow') ||
            textElement.classList.contains('approach-kicker') ||
            textElement.classList.contains('approach-title') ||
            textElement.classList.contains('approach-copy') ||
            textElement.classList.contains('approach-step-title') ||
            textElement.classList.contains('approach-step-copy') ||
            textElement.closest('.service-hero') ||
            textElement.closest('.about-story-page');

        const split = new SplitType(textElement, { types: usesLineMask ? 'lines' : 'lines,words,chars' });

        if (usesLineMask) {
            const usesRoomyLineMask = Boolean(textElement.closest && textElement.closest(".link-page-hero-approach"));
            const maskPadTop = usesRoomyLineMask ? '0.32em' : '0.18em';
            const maskPadBottom = usesRoomyLineMask ? '0.34em' : '0.2em';

            split.lines.forEach(line => {
                const wrapper = document.createElement('div');
                wrapper.classList.add('line-mask');
                wrapper.style.transform = 'translate3d(0, 140%, 0)';
                wrapper.style.display = 'block';
                wrapper.style.willChange = 'transform';

                while (line.firstChild) {
                    wrapper.appendChild(line.firstChild);
                }
                line.appendChild(wrapper);
                line.style.overflow = 'hidden';
                line.style.paddingTop = maskPadTop;
                line.style.paddingBottom = maskPadBottom;
                line.style.marginTop = `-${maskPadTop}`;
                line.style.marginBottom = `-${maskPadBottom}`;
            });
        }
    });
}

splitBlueprintText();

function createHoverChars(text, useRevealChars = false) {
    return Array.from(text).map(char => {
        const span = document.createElement("span");
        span.className = useRevealChars ? "char link-hover-char" : "link-hover-char";
        span.textContent = char === " " ? "\u00a0" : char;
        return span;
    });
}

function initRollingLinkHovers() {
    const hoverTargets = document.querySelectorAll([
        ".logo-button",
        ".nav-links button",
        ".menu-overlay-link",
        ".menu-info-link",
        ".site-footer-group a",
        ".site-footer-group button",
        ".contact-section-link"
    ].join(","));

    hoverTargets.forEach(target => {
        const textHost = target.classList.contains("menu-line-reveal")
            ? target.querySelector(":scope > span")
            : target;

        if (!textHost || textHost.classList.contains("is-rolling-link")) return;

        const label = textHost.textContent.trim().replace(/\s+/g, " ");

        if (!label) return;

        textHost.textContent = "";
        textHost.classList.add("is-rolling-link");
        target.setAttribute("data-hover-label", label);

        const initialWrap = document.createElement("span");
        initialWrap.className = "rolling-link-wrap rolling-link-initial";

        const hoverWrap = document.createElement("span");
        hoverWrap.className = "rolling-link-wrap rolling-link-hover";
        hoverWrap.setAttribute("aria-hidden", "true");

        const shouldUseRevealChars = target.matches(".nav-links button, .logo-button");

        createHoverChars(label, shouldUseRevealChars).forEach(char => initialWrap.appendChild(char));
        createHoverChars(label).forEach(char => hoverWrap.appendChild(char));

        textHost.append(initialWrap, hoverWrap);

        gsap.set(hoverWrap.querySelectorAll(".link-hover-char"), { yPercent: 100 });

        let hoverTween;

        const playHover = (isEntering) => {
            if (hoverTween) hoverTween.kill();

            const initialChars = initialWrap.querySelectorAll(".link-hover-char");
            const hoverChars = hoverWrap.querySelectorAll(".link-hover-char");

            hoverTween = gsap.timeline();

            hoverTween
                .to(initialChars, {
                    yPercent: isEntering ? -100 : 0,
                    duration: 0.38,
                    stagger: 0.014,
                    ease: "power3.inOut"
                }, 0)
                .to(hoverChars, {
                    yPercent: isEntering ? 0 : 100,
                    duration: 0.38,
                    stagger: 0.014,
                    ease: "power3.inOut"
                }, 0.03);
        };

        target.addEventListener("pointerenter", () => playHover(true));
        target.addEventListener("pointerleave", () => playHover(false));
        target.addEventListener("touchstart", () => playHover(true), { passive: true });
        target.addEventListener("touchend", () => playHover(false), { passive: true });
        target.addEventListener("touchcancel", () => playHover(false), { passive: true });
        target.addEventListener("focus", () => playHover(true));
        target.addEventListener("blur", () => playHover(false));
    });
}

initRollingLinkHovers();

if (!isIndexPage) {
    gsap.set(".logo-button, .menu-button", {
        opacity: 1,
        visibility: "visible",
        pointerEvents: "all"
    });
    gsap.set(".logo-button .char", { y: 0 });
    gsap.set(".menu-button", { scale: 1 });
}

if (shouldUseLinkLoader) {
    gsap.set(".loader-logo .char", { y: 0 });
}

gsap.set(".approach-title .line-mask, .approach-copy .line-mask", { y: "-140%" });
gsap.set(".masking-overlay-about-copy .line-mask, .about-laptop-services-word .line-mask", { y: "-140%" });
gsap.set(".about-section-link .line-mask", { y: "140%" });

function initMobileAboutScrollReveals() {
    if (!isIndexPage || !window.matchMedia("(max-width: 767px)").matches) return;

    const titleTargets = gsap.utils.toArray(".masking-overlay-about-copy, .about-laptop-services-word");
    const bodyTargets = gsap.utils.toArray(".about-section-statement, .about-section-label, .about-section-body");

    titleTargets.forEach((item) => {
        const masks = item.querySelectorAll(".line-mask");
        if (!masks.length) return;

        gsap.set(masks, { y: "-140%" });

        ScrollTrigger.create({
            trigger: item,
            start: "top 88%",
            once: true,
            onEnter: () => {
                gsap.to(masks, {
                    y: 0,
                    stagger: 0.08,
                    duration: 0.8,
                    ease: "power4.out"
                });
            }
        });
    });

    bodyTargets.forEach((item) => {
        const masks = item.querySelectorAll(".line-mask");
        if (!masks.length) return;

        gsap.set(masks, { y: "140%" });

        ScrollTrigger.create({
            trigger: item,
            start: "top 88%",
            once: true,
            onEnter: () => {
                gsap.to(masks, {
                    y: 0,
                    stagger: 0.06,
                    duration: 0.72,
                    ease: "power4.out"
                });
            }
        });
    });

}

initMobileAboutScrollReveals();

function initMobilePageTextReveals() {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const masks = gsap.utils.toArray([
        ".scroll-container .line-mask",
        ".link-page-main .line-mask",
        ".link-page-reveal-footer .line-mask"
    ].join(",")).filter((mask) => {
        if (mask.dataset.mobileRevealInit === "true") return false;
        if (mask.closest(".loader, .menu-overlay, .navbar, .hero-section, .link-page-hero, .projects-showcase-hero")) return false;
        if (mask.closest(".masking-overlay-about-copy, .about-laptop-services-word, .about-section-statement, .about-section-label, .about-section-body")) return false;
        return true;
    });

    if (!masks.length) return;

    masks.forEach((mask) => {
        mask.dataset.mobileRevealInit = "true";
    });

    gsap.set(masks, { y: "140%" });

    ScrollTrigger.batch(masks, {
        start: "top 90%",
        once: true,
        onEnter: (batch) => {
            gsap.to(batch, {
                y: 0,
                stagger: 0.045,
                duration: 0.78,
                ease: "power4.out"
            });
        }
    });
}

initMobilePageTextReveals();

function initProjectsShowcaseAnimation() {
    const projectsShowcase = document.querySelector(".projects-showcase-hero");

    if (!projectsShowcase) return null;

    const projectServices = [
        {
            label: "Web development",
            projects: [
                { name: "Meridian launch system", year: "2026", image: "./web_img/webp-output/web_1.webp" },
                { name: "Atlas platform rebuild", year: "2025", image: "./web_img/webp-output/web_2.webp" },
                { name: "Northline commerce flow", year: "2025", image: "./web_img/webp-output/web_3.webp" },
                { name: "Forma booking portal", year: "2024", image: "./web_img/webp-output/web_4.webp" },
                { name: "Signal dashboard suite", year: "2024", image: "./web_img/webp-output/web_5.webp" },
                { name: "Cobalt product site", year: "2023", image: "./web_img/webp-output/web_6.webp" },
                { name: "Arc web experience", year: "2023", image: "./web_img/webp-output/web_7.webp" }
            ]
        },
        {
            label: "Branding",
            projects: [
                { name: "Northline identity", year: "2026", image: "./branding_img/webp-output/branding_1.webp" },
                { name: "Forma brand system", year: "2025", image: "./branding_img/webp-output/branding_2.webp" },
                { name: "Civic mark refresh", year: "2025", image: "./branding_img/webp-output/branding_3.webp" },
                { name: "Vessel packaging set", year: "2024", image: "./branding_img/webp-output/branding_4.webp" },
                { name: "Oakroom visual language", year: "2024", image: "./branding_img/webp-output/branding_5.webp" },
                { name: "Arcade identity kit", year: "2023", image: "./branding_img/webp-output/branding_6.webp" },
                { name: "Summit launch identity", year: "2023", image: "./branding_img/webp-output/branding_7.webp" }
            ]
        },
        {
            label: "Digital marketing",
            projects: [
                { name: "Signal campaign rollout", year: "2026", image: "./marketing_img/webp-output/marketing_1.webp" },
                { name: "Horizon paid media", year: "2025", image: "./marketing_img/webp-output/marketing_2.webp" },
                { name: "Meridian launch ads", year: "2025", image: "./marketing_img/webp-output/marketing_3.webp" },
                { name: "Northline content system", year: "2024", image: "./marketing_img/webp-output/marketing_4.webp" },
                { name: "Atlas growth funnel", year: "2024", image: "./marketing_img/webp-output/marketing_5.webp" },
                { name: "Forma social direction", year: "2023", image: "./marketing_img/webp-output/marketing_6.webp" },
                { name: "Cobalt email series", year: "2023", image: "./marketing_img/webp-output/marketing_7.webp" }
            ]
        },
        {
            label: "Architecture",
            projects: [
                { name: "Monolith architecture visuals", year: "2026", image: "./architecture_img/webp-output/architecture_1.webp" },
                { name: "Fieldhouse retail concept", year: "2025", image: "./architecture_img/webp-output/architecture_2.webp" },
                { name: "Stonegate interior study", year: "2025", image: "./architecture_img/webp-output/architecture_3.webp" },
                { name: "Oakroom spatial package", year: "2024", image: "./architecture_img/webp-output/architecture_4.webp" },
                { name: "Horizon facade direction", year: "2024", image: "./architecture_img/webp-output/architecture_5.webp" },
                { name: "Vessel showroom layout", year: "2023", image: "./architecture_img/webp-output/architecture_6.webp" },
                { name: "Civic wayfinding system", year: "2023", image: "./architecture_img/webp-output/architecture_7.webp" }
            ]
        }
    ];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const showcaseContainer = projectsShowcase.querySelector(".projects-template-container");
    const showcaseDragArea = projectsShowcase.querySelector(".projects-showcase-items");
    const showcaseCards = gsap.utils.toArray(projectsShowcase.querySelectorAll(".projects-showcase-item"));
    const prevButton = projectsShowcase.querySelector(".projects-showcase-prev");
    const nextButton = projectsShowcase.querySelector(".projects-showcase-next");
    const serviceTabs = gsap.utils.toArray(projectsShowcase.querySelectorAll(".projects-service-tab"));
    const showcaseLetters = projectsShowcase.querySelectorAll(".projects-showcase-word > span > span");
    const showcaseCopy = projectsShowcase.querySelectorAll(".projects-showcase-copy > span > span");
    const mainImage = projectsShowcase.querySelector(".projects-showcase-item-main .projects-showcase-img img");
    const sideImages = projectsShowcase.querySelectorAll(".projects-showcase-item-side .projects-showcase-img");
    const showcaseTitle = projectsShowcase.querySelector(".projects-showcase-title");
    const showcaseControls = projectsShowcase.querySelector(".projects-showcase-controls");
    const serviceNav = projectsShowcase.querySelector(".projects-service-nav");
    const leftWord = projectsShowcase.querySelector(".projects-showcase-word-left");
    const rightWord = projectsShowcase.querySelector(".projects-showcase-word-right");
    const mobileDots = gsap.utils.toArray(projectsShowcase.querySelectorAll(".projects-mobile-dots span"));
    const mobileMetaName = projectsShowcase.querySelector(".projects-mobile-meta-name");
    const mobileMetaYear = projectsShowcase.querySelector(".projects-mobile-meta-year");
    const mobileDetailTitle = projectsShowcase.querySelector(".projects-mobile-detail h1");
    const mobileDetailCopy = projectsShowcase.querySelector(".projects-mobile-detail p");
    const navbar = document.querySelector(".navbar");

    if (!showcaseLetters.length || !mainImage || !showcaseTitle || !leftWord || !rightWord) return null;

    gsap.killTweensOf([showcaseLetters, showcaseCopy, mainImage, sideImages, showcaseTitle, showcaseControls, serviceNav, leftWord, rightWord]);

    let projectOffset = 0;
    let activeServiceIndex = 0;
    let isProjectSwapAnimating = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let liveDragX = 0;
    let dragPointerId = null;

    function getActiveProjects() {
        return projectServices[activeServiceIndex].projects;
    }

    function getCurrentProject(index) {
        const projects = getActiveProjects();
        return projects[gsap.utils.wrap(0, projects.length, index)];
    }

    function setActiveServiceTab() {
        serviceTabs.forEach((tab, index) => {
            tab.classList.toggle("is-active", index === activeServiceIndex);
        });
    }

    function setShowcaseCard(card, project) {
        const textLines = card.querySelectorAll(".projects-showcase-copy > span > span");
        const image = card.querySelector(".projects-showcase-img img");

        if (textLines[0]) textLines[0].textContent = project.name;
        if (textLines[1]) textLines[1].textContent = project.year;

        if (image) {
            image.src = project.image;
            image.alt = `${project.name} preview`;
        }
    }

    function getMobileProjectDescription(project) {
        const descriptions = {
            "Forma booking portal": "A streamlined booking experience designed for clarity, speed, and seamless management.",
            "Meridian launch system": "A clean launch experience built to move visitors from first impression to action.",
            "Atlas platform rebuild": "A sharper platform rebuild focused on structure, speed, and product confidence.",
            "Northline commerce flow": "A refined commerce flow designed for easier browsing and faster decisions.",
            "Signal dashboard suite": "A focused dashboard system shaped around visibility, rhythm, and daily use.",
            "Cobalt product site": "A product site designed to make complex value feel clear and immediate.",
            "Arc web experience": "An immersive web experience built around pace, clarity, and visual restraint."
        };

        return descriptions[project.name] || "A focused project experience shaped for clarity, rhythm, and confident everyday use.";
    }

    function updateMobileProjectInfo() {
        const centerIndex = Math.floor(showcaseCards.length / 2);
        const project = getCurrentProject(projectOffset + centerIndex);

        if (!project) return;
        if (mobileDetailTitle) mobileDetailTitle.textContent = project.name;
        if (mobileDetailCopy) mobileDetailCopy.textContent = getMobileProjectDescription(project);
        if (mobileMetaName) mobileMetaName.textContent = project.name;
        if (mobileMetaYear) mobileMetaYear.textContent = project.year;

        if (mobileDots.length) {
            const activeDotIndex = gsap.utils.clamp(0, mobileDots.length - 1, projectOffset + 1);
            mobileDots.forEach((dot, index) => {
                if (dot.classList.contains("projects-mobile-meta-name") || dot.classList.contains("projects-mobile-meta-year")) return;
                dot.classList.toggle("is-active", index === activeDotIndex);
            });
        }
    }

    function getMainTitleMasks() {
        return projectsShowcase.querySelectorAll(".projects-showcase-item-main .projects-showcase-copy > span");
    }

    function getMainTitleCopy() {
        return projectsShowcase.querySelector(".projects-showcase-item-main .projects-showcase-copy");
    }

    function getMainTitleText() {
        return projectsShowcase.querySelectorAll(".projects-showcase-item-main .projects-showcase-copy > span > span");
    }

    function hideMainTitleMasks() {
        gsap.set(getMainTitleCopy(), { autoAlpha: 1, x: 0, y: 0 });
        gsap.set(getMainTitleText(), { autoAlpha: 0 });
        gsap.set(getMainTitleMasks(), {
            "--project-title-cover-x": "0%",
            "--project-title-cover-scale": 0
        });
    }

    function revealMainTitleMasks(delay = 0) {
        const titleCopy = getMainTitleCopy();
        const titleMasks = getMainTitleMasks();
        const titleText = getMainTitleText();

        gsap.timeline({ delay })
            .set(titleCopy, { autoAlpha: 1, x: 0, y: 0 })
            .set(titleText, { autoAlpha: 0 })
            .set(titleMasks, {
                "--project-title-cover-x": "0%",
                "--project-title-cover-scale": 0
            })
            .to(titleMasks, {
                "--project-title-cover-scale": 1,
                duration: 0.48,
                stagger: 0.06,
                ease: "power3.inOut"
            }, 0)
            .set(titleText, { autoAlpha: 1 })
            .to(titleMasks, {
                "--project-title-cover-x": "101%",
                duration: 0.82,
                stagger: 0.06,
                ease: "power3.inOut"
            }, ">");
    }

    function populateShowcaseCards() {
        showcaseCards.forEach((card, index) => {
            setShowcaseCard(card, getCurrentProject(projectOffset + index));
        });
        updateMobileProjectInfo();
    }

    function revealServiceImages(onComplete) {
        const imageWraps = gsap.utils.toArray(projectsShowcase.querySelectorAll(".projects-showcase-img"));

        if (!imageWraps.length) {
            if (onComplete) onComplete();
            return;
        }

        if (reduceMotion) {
            gsap.set(imageWraps, {
                autoAlpha: 1,
                y: 0,
                clipPath: "inset(0% 0% 0% 0%)"
            });
            if (onComplete) onComplete();
            return;
        }

        gsap.killTweensOf(imageWraps);
        gsap.fromTo(imageWraps, {
            autoAlpha: 0,
            y: 18,
            clipPath: "inset(0% 0% 100% 0%)"
        }, {
            autoAlpha: 1,
            y: 0,
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 0.64,
            stagger: 0.055,
            ease: "power3.out",
            onComplete
        });
    }

    function updateShowcaseControlPosition() {
        if (!showcaseContainer || !showcaseControls || !showcaseTitle) return;

        const containerRect = showcaseContainer.getBoundingClientRect();
        const imageRects = gsap.utils.toArray(projectsShowcase.querySelectorAll(".projects-showcase-img"))
            .map((imageWrap) => imageWrap.getBoundingClientRect())
            .filter((rect) => rect.width > 0 && rect.height > 0);

        if (!imageRects.length) return;

        const imageBottom = Math.max(...imageRects.map((rect) => rect.bottom));
        const titleTop = showcaseTitle.getBoundingClientRect().top;
        const controlsHeight = showcaseControls.getBoundingClientRect().height;
        const controlsCenter = imageBottom + ((titleTop - imageBottom) / 2);

        showcaseContainer.style.setProperty("--projects-controls-y", `${controlsCenter - containerRect.top - (controlsHeight / 2) - 28}px`);
    }

    function createShowcaseProjectTransition(delta, options = {}) {
        if (isProjectSwapAnimating || !showcaseCards.length || delta === 0) return;

        isProjectSwapAnimating = true;
        const sign = Math.sign(delta);
        const stepCount = Math.max(1, Math.abs(delta));
        const isScrubbed = Boolean(options.scrub);
        const transitionDuration = isScrubbed ? 1 : (options.duration || Math.max(0.3, 0.62 - ((stepCount - 1) * 0.055)));
        const transitionEase = isScrubbed ? "none" : (options.ease || "power3.inOut");
        const startOffset = projectOffset;

        const cardRects = showcaseCards.map(card => card.getBoundingClientRect());
        const cardClones = showcaseCards.map((card, index) => {
            const rect = cardRects[index];
            const clone = card.cloneNode(true);
            clone.classList.add("projects-showcase-item-clone");
            gsap.set(clone, {
                position: "fixed",
                left: rect.left,
                top: rect.top,
                x: 0,
                y: 0,
                width: rect.width,
                height: rect.height,
                margin: 0,
                zIndex: 18,
                pointerEvents: "none",
                force3D: true,
                willChange: "transform,width,height,opacity"
            });
            document.body.appendChild(clone);
            return { clone, oldIndex: index };
        });

        gsap.set(showcaseCards, { autoAlpha: 0 });

        projectOffset = gsap.utils.wrap(0, getActiveProjects().length, projectOffset + delta);
        populateShowcaseCards();

        const incomingClones = [];
        showcaseCards.forEach((card, newIndex) => {
            const oldIndex = newIndex + delta;
            if (oldIndex < 0 || oldIndex >= showcaseCards.length) {
                const incomingRect = cardRects[newIndex];
                const clone = card.cloneNode(true);
                clone.classList.add("projects-showcase-item-clone");
                
                const startX = sign > 0 ? window.innerWidth + (newIndex * 50) : -incomingRect.width - ((showcaseCards.length - newIndex) * 50);
                
                gsap.set(clone, {
                    position: "fixed",
                    left: startX,
                    top: incomingRect.top,
                    x: 0,
                    y: 0,
                    width: incomingRect.width,
                    height: incomingRect.height,
                    autoAlpha: 1,
                    margin: 0,
                    zIndex: 18,
                    pointerEvents: "none",
                    force3D: true,
                    willChange: "transform,width,height,opacity"
                });
                document.body.appendChild(clone);
                incomingClones.push({ clone, newIndex });
            }
        });

        const allClones = [...cardClones.map(c => c.clone), ...incomingClones.map(c => c.clone)];

        const finishTransition = (shouldCommit) => {
            allClones.forEach(clone => clone.remove());
            if (!shouldCommit) {
                projectOffset = startOffset;
                populateShowcaseCards();
            }
            gsap.set(showcaseCards, { autoAlpha: 1 });
            updateShowcaseControlPosition();
            if (shouldCommit) revealMainTitleMasks();
            isProjectSwapAnimating = false;
        };

        const transitionTimelineOptions = {
            paused: true,
            defaults: { duration: transitionDuration, ease: transitionEase }
        };

        if (!isScrubbed && !options.paused) {
            transitionTimelineOptions.onComplete = () => finishTransition(true);
        }

        const transitionTimeline = gsap.timeline(transitionTimelineOptions)
        .to(cardClones.map(c => c.clone), {
            y: (i) => {
                const oldIndex = cardClones[i].oldIndex;
                const newIndex = oldIndex - delta;
                const targetTop = (newIndex >= 0 && newIndex < showcaseCards.length) ? cardRects[newIndex].top : cardRects[oldIndex].top;
                return targetTop - cardRects[oldIndex].top;
            },
            x: (i) => {
                const oldIndex = cardClones[i].oldIndex;
                const newIndex = oldIndex - delta;
                const targetLeft = (newIndex >= 0 && newIndex < showcaseCards.length)
                    ? cardRects[newIndex].left
                    : (sign > 0 ? -cardRects[0].width * 2 : window.innerWidth + cardRects[0].width);
                return targetLeft - cardRects[oldIndex].left;
            },
            width: (i) => {
                const oldIndex = cardClones[i].oldIndex;
                const newIndex = oldIndex - delta;
                if (newIndex >= 0 && newIndex < showcaseCards.length) return cardRects[newIndex].width;
                return cardRects[oldIndex].width;
            },
            height: (i) => {
                const oldIndex = cardClones[i].oldIndex;
                const newIndex = oldIndex - delta;
                if (newIndex >= 0 && newIndex < showcaseCards.length) return cardRects[newIndex].height;
                return cardRects[oldIndex].height;
            },
            autoAlpha: (i) => {
                const oldIndex = cardClones[i].oldIndex;
                const newIndex = oldIndex - delta;
                return (newIndex >= 0 && newIndex < showcaseCards.length) ? 1 : 0;
            }
        }, 0)
        .to(incomingClones.map(c => c.clone), {
            x: (i) => {
                const newIndex = incomingClones[i].newIndex;
                const startLeft = sign > 0 ? window.innerWidth + (newIndex * 50) : -cardRects[newIndex].width - ((showcaseCards.length - newIndex) * 50);
                return cardRects[newIndex].left - startLeft;
            },
            y: 0,
            width: (i) => cardRects[incomingClones[i].newIndex].width,
            height: (i) => cardRects[incomingClones[i].newIndex].height,
            autoAlpha: 1
        }, 0);

        return {
            delta,
            timeline: transitionTimeline,
            commit: () => finishTransition(true),
            cancel: () => finishTransition(false)
        };
    }

    function changeShowcaseProject(delta, options = {}) {
        const transition = createShowcaseProjectTransition(delta, options);

        if (!transition) return null;
        if (!options.scrub && !options.paused) transition.timeline.play(0);

        return transition;
    }

    populateShowcaseCards();
    setActiveServiceTab();
    projectsShowcase.querySelectorAll(".projects-showcase-img img").forEach((image) => {
        image.draggable = false;
    });

    if (prevButton) {
        prevButton.addEventListener("click", () => changeShowcaseProject(-1));
    }

    if (nextButton) {
        nextButton.addEventListener("click", () => changeShowcaseProject(1));
    }

    serviceTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            const nextServiceIndex = Number(tab.dataset.serviceIndex);

            if (Number.isNaN(nextServiceIndex) || nextServiceIndex === activeServiceIndex || isProjectSwapAnimating) return;

            isProjectSwapAnimating = true;
            activeServiceIndex = nextServiceIndex;
            projectOffset = 0;
            setActiveServiceTab();
            hideMainTitleMasks();
            populateShowcaseCards();
            updateShowcaseControlPosition();
            revealMainTitleMasks(0.08);
            revealServiceImages(() => {
                updateShowcaseControlPosition();
                isProjectSwapAnimating = false;
            });
        });
    });

    window.addEventListener("resize", () => {
        updateShowcaseControlPosition();
    });

    if (showcaseDragArea && showcaseContainer) {
        const scrollSpeed = 1;
        const scrollEase = 0.18;
        const dragEase = 0.35;
        const friction = 0.95;
        let dragTargetX = 0;
        let dragCurrentX = 0;
        let dragVelocityX = 0;
        let lastDragX = 0;
        let dragTransition = null;
        let dragReleaseTween = null;
        let dragProgressTween = null;
        let dragTargetProgress = 0;
        const dragStartDeadzone = 8;
        const dragCommitProgress = 0.34;
        const dragMomentum = 0.018;
        const dragReleaseVelocity = 4;
        const dragReleaseMinDuration = 0.18;
        const dragReleaseMaxDuration = 0.38;
        const dragMomentumMaxSlides = 2;
        const dragMomentumFriction = 0.54;
        const dragMomentumStopVelocity = 4.2;
        const dragMomentumMinDuration = 0.16;
        const dragMomentumMaxDuration = 0.46;
        const projectsPhoneSwipeQuery = window.matchMedia("(max-width: 767px)");
        const projectsLaptopSwipeQuery = window.matchMedia("(min-width: 768px) and (pointer: fine)");
        let phoneSwipeActive = false;
        let phoneSwipeX = 0;
        let phoneSwipeTween = null;

        const getDragStepThreshold = () => {
            const mainCard = projectsShowcase.querySelector(".projects-showcase-item-main");
            const mainWidth = mainCard ? mainCard.getBoundingClientRect().width : 0;

            return Math.max(72, Math.min(132, mainWidth * 0.34 || window.innerWidth * 0.14));
        };

        const getPhoneSwipeStepDistance = () => {
            const cardRects = showcaseCards
                .map((card) => card.getBoundingClientRect())
                .filter((rect) => rect.width > 0 && rect.height > 0)
                .sort((a, b) => a.left - b.left);

            if (cardRects.length > 1) {
                return Math.abs(cardRects[1].left - cardRects[0].left);
            }

            return Math.max(120, (cardRects[0] ? cardRects[0].width : window.innerWidth * 0.54) + (window.innerWidth * 0.072));
        };

        const getMaxPhoneMomentumSlides = () => Math.min(5, Math.max(1, getActiveProjects().length - 1));
        const shouldUseDirectProjectSwipe = () => projectsPhoneSwipeQuery.matches || projectsLaptopSwipeQuery.matches;

        const setPhoneSwipeX = (x) => {
            phoneSwipeX = x;
            gsap.set(showcaseDragArea, {
                x,
                force3D: true
            });
        };

        const resetPhoneSwipe = () => {
            if (phoneSwipeTween) {
                phoneSwipeTween.kill();
                phoneSwipeTween = null;
            }

            phoneSwipeActive = false;
            phoneSwipeX = 0;
            gsap.set(showcaseDragArea, {
                x: 0,
                clearProps: "transform"
            });
        };

        const fullShowcaseImageClipPath = "polygon(0% 100%, 100% 100%, 100% 0%, 0% 0%)";

        const setShowcaseImageFinalState = (image) => {
            if (!image) return;

            gsap.set(image, {
                clearProps: "position,inset,width,height,zIndex"
            });
            gsap.set(image, {
                autoAlpha: 1,
                scale: 1,
                xPercent: 0,
                yPercent: 0,
                clipPath: fullShowcaseImageClipPath,
                transformOrigin: "center center",
                force3D: true
            });
        };

        const setMainImageFinalState = (image) => {
            setShowcaseImageFinalState(image);
        };

        const changeShowcaseImagesInPlace = (delta, options = {}) => {
            if (isProjectSwapAnimating || !showcaseCards.length || delta === 0) return;

            isProjectSwapAnimating = true;
            const sign = Math.sign(delta);
            const stepCount = Math.max(1, Math.abs(delta));
            const duration = options.duration || Math.max(0.34, 0.5 - ((stepCount - 1) * 0.025));
            const nextOffset = gsap.utils.wrap(0, getActiveProjects().length, projectOffset + delta);
            const centerIndex = Math.floor(showcaseCards.length / 2);
            const imageSwaps = showcaseCards.map((card, index) => {
                const imageWrap = card.querySelector(".projects-showcase-img");
                const outgoingImage = imageWrap ? imageWrap.querySelector("img") : null;
                const nextProject = getCurrentProject(nextOffset + index);

                if (!imageWrap || !outgoingImage || !nextProject) return null;

                const incomingImage = outgoingImage.cloneNode(true);
                incomingImage.src = nextProject.image;
                incomingImage.alt = `${nextProject.name} preview`;
                incomingImage.draggable = false;

                return {
                    card,
                    index,
                    imageWrap,
                    outgoingImage,
                    incomingImage
                };
            }).filter(Boolean);

            if (!imageSwaps.length) {
                projectOffset = nextOffset;
                populateShowcaseCards();
                setMainImageFinalState(projectsShowcase.querySelector(".projects-showcase-item-main .projects-showcase-img img"));
                updateShowcaseControlPosition();
                revealMainTitleMasks(0.03);
                isProjectSwapAnimating = false;
                return;
            }

            gsap.killTweensOf(imageSwaps.flatMap(({ outgoingImage, incomingImage }) => [outgoingImage, incomingImage]));

            imageSwaps.forEach(({ imageWrap, outgoingImage, incomingImage }) => {
                gsap.set(imageWrap, {
                    position: "relative",
                    overflow: "hidden"
                });
                gsap.set(outgoingImage, {
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    zIndex: 1,
                    autoAlpha: 1,
                    xPercent: 0,
                    yPercent: 0,
                    scale: 1,
                    clipPath: fullShowcaseImageClipPath,
                    transformOrigin: "center center",
                    force3D: true
                });
                gsap.set(incomingImage, {
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    zIndex: 2,
                    autoAlpha: 0,
                    xPercent: sign > 0 ? 102 : -102,
                    yPercent: 0,
                    scale: 1,
                    clipPath: fullShowcaseImageClipPath,
                    transformOrigin: "center center",
                    force3D: true
                });

                imageWrap.appendChild(incomingImage);
            });

            const swapTimeline = gsap.timeline({
                onComplete: () => {
                    projectOffset = nextOffset;
                    populateShowcaseCards();
                    imageSwaps.forEach(({ outgoingImage, incomingImage }) => {
                        incomingImage.remove();
                        setShowcaseImageFinalState(outgoingImage);
                    });
                    setMainImageFinalState(projectsShowcase.querySelector(".projects-showcase-item-main .projects-showcase-img img"));
                    updateShowcaseControlPosition();
                    revealMainTitleMasks(0.03);
                    isProjectSwapAnimating = false;
                }
            });

            imageSwaps.forEach(({ index, outgoingImage, incomingImage }) => {
                const distanceFromCenter = Math.abs(index - centerIndex);
                const localDuration = duration + (distanceFromCenter * 0.025);
                const slideDistance = 102 - (distanceFromCenter * 3);

                swapTimeline
                    .to(outgoingImage, {
                        xPercent: sign > 0 ? -slideDistance : slideDistance,
                        autoAlpha: 0,
                        duration: localDuration,
                        ease: options.ease || "power3.inOut",
                        overwrite: true
                    }, 0)
                    .to(incomingImage, {
                        xPercent: 0,
                        autoAlpha: 1,
                        duration: localDuration,
                        ease: options.ease || "power3.inOut",
                        overwrite: true
                    }, 0);
            });
        };

        const resetLiveDragX = (onComplete) => {
            if (dragProgressTween) {
                dragProgressTween.kill();
                dragProgressTween = null;
            }
            if (phoneSwipeTween) {
                phoneSwipeTween.kill();
                phoneSwipeTween = null;
            }
            phoneSwipeActive = false;
            phoneSwipeX = 0;
            gsap.set(showcaseDragArea, {
                x: 0,
                clearProps: "transform"
            });
            liveDragX = 0;
            dragTargetX = 0;
            dragCurrentX = 0;
            dragVelocityX = 0;
            dragTargetProgress = 0;
            gsap.set(showcaseCards, {
                x: 0,
                y: 0,
                rotateZ: 0,
                scale: 1,
                clearProps: "zIndex"
            });
            if (onComplete) onComplete();
        };

        const getDragProjectDirection = (deltaX) => deltaX < 0 ? 1 : -1;

        const completePhoneSwipe = (deltaX, deltaY) => {
            if (!phoneSwipeActive) return false;

            if (phoneSwipeTween) {
                phoneSwipeTween.kill();
                phoneSwipeTween = null;
            }

            const stepDistance = getPhoneSwipeStepDistance();
            const direction = Math.abs(deltaX) > 2 ? getDragProjectDirection(deltaX) : (dragVelocityX < 0 ? 1 : -1);
            const directionVelocity = direction > 0 ? -dragVelocityX : dragVelocityX;
            const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
            const shouldCommit = isHorizontalSwipe && (Math.abs(deltaX) >= stepDistance * 0.22 || directionVelocity > dragReleaseVelocity);
            const distanceSlides = Math.max(1, Math.round(Math.abs(deltaX) / stepDistance));
            const velocitySlides = directionVelocity > dragReleaseVelocity
                ? Math.ceil((directionVelocity - dragReleaseVelocity) / 5) + 1
                : 1;
            const slideCount = shouldCommit
                ? gsap.utils.clamp(1, getMaxPhoneMomentumSlides(), Math.max(distanceSlides, velocitySlides))
                : 0;
            const targetX = shouldCommit ? -direction * stepDistance * slideCount : 0;
            const remainingDistance = Math.max(0, Math.abs(targetX - phoneSwipeX));
            const slideDuration = shouldCommit
                ? gsap.utils.clamp(0.18, 0.7, remainingDistance / Math.max(900, directionVelocity * 120))
                : 0.3;

            isProjectSwapAnimating = true;

            if (!shouldCommit) {
                phoneSwipeTween = gsap.to(showcaseDragArea, {
                    x: targetX,
                    duration: slideDuration,
                    ease: "back.out(1.1)",
                    overwrite: true,
                    force3D: true,
                    onComplete: () => {
                        gsap.set(showcaseDragArea, {
                            x: 0,
                            clearProps: "transform"
                        });
                        phoneSwipeTween = null;
                        phoneSwipeActive = false;
                        phoneSwipeX = 0;
                        isProjectSwapAnimating = false;
                        updateShowcaseControlPosition();
                    }
                });

                return true;
            }

            const finishPhoneMomentum = () => {
                projectOffset = gsap.utils.wrap(0, getActiveProjects().length, projectOffset + (direction * slideCount));
                populateShowcaseCards();
                gsap.set(showcaseDragArea, {
                    x: 0,
                    clearProps: "transform"
                });
                phoneSwipeTween = null;
                phoneSwipeActive = false;
                phoneSwipeX = 0;
                isProjectSwapAnimating = false;
                updateShowcaseControlPosition();
            };

            phoneSwipeTween = gsap.to(showcaseDragArea, {
                x: targetX,
                duration: slideDuration,
                ease: "power3.out",
                overwrite: true,
                force3D: true,
                onUpdate: () => {
                    phoneSwipeX = Number(gsap.getProperty(showcaseDragArea, "x")) || 0;
                },
                onComplete: finishPhoneMomentum
            });

            return true;
        };

        const getDragTransitionDistance = (deltaX) => {
            if (!dragTransition) return 0;

            return dragTransition.delta > 0 ? -deltaX : deltaX;
        };

        const startDragTransition = (direction) => {
            if (dragReleaseTween) {
                dragReleaseTween.kill();
                dragReleaseTween = null;
            }
            if (dragProgressTween) {
                dragProgressTween.kill();
                dragProgressTween = null;
            }

            dragTransition = createShowcaseProjectTransition(direction, { scrub: true });
            if (dragTransition) dragTransition.timeline.progress(0).pause();
            dragTargetProgress = 0;

            return dragTransition;
        };

        const setDragTransitionProgress = (progress, immediate = false) => {
            if (!dragTransition) return;

            dragTargetProgress = gsap.utils.clamp(0, 1, progress);

            if (dragProgressTween) {
                dragProgressTween.kill();
                dragProgressTween = null;
            }

            if (immediate || reduceMotion) {
                dragTransition.timeline.progress(dragTargetProgress).pause();
                return;
            }

            dragProgressTween = gsap.to(dragTransition.timeline, {
                progress: dragTargetProgress,
                duration: 0.16,
                ease: "power3.out",
                overwrite: true,
                onComplete: () => {
                    dragProgressTween = null;
                }
            });
        };

        const completeLiveDragTransition = () => {
            if (!dragTransition) return;

            if (dragProgressTween) {
                dragProgressTween.kill();
                dragProgressTween = null;
            }
            const completedTransition = dragTransition;
            dragTransition = null;
            completedTransition.timeline.progress(1).pause();
            completedTransition.commit();
            resetLiveDragX();
        };

        const cancelLiveDragTransition = () => {
            if (!dragTransition) return;

            if (dragProgressTween) {
                dragProgressTween.kill();
                dragProgressTween = null;
            }
            const canceledTransition = dragTransition;
            dragTransition = null;
            canceledTransition.timeline.progress(0).pause();
            canceledTransition.cancel();
            resetLiveDragX();
        };

        const continueReleaseMomentum = (direction, velocity) => {
            let momentumVelocity = Math.abs(velocity);
            const startVelocity = momentumVelocity;
            const momentumSlides = momentumVelocity > dragReleaseVelocity
                ? gsap.utils.clamp(1, dragMomentumMaxSlides, Math.ceil(momentumVelocity / 10))
                : 0;

            if (!momentumSlides) return false;

            let completedSlides = 0;

            const runNextMomentumSlide = () => {
                if (completedSlides >= momentumSlides || momentumVelocity <= dragMomentumStopVelocity) {
                    dragTransition = null;
                    dragReleaseTween = null;
                    resetLiveDragX();
                    return;
                }

                const momentumTransition = createShowcaseProjectTransition(direction, { scrub: true });

                if (!momentumTransition) {
                    dragTransition = null;
                    dragReleaseTween = null;
                    resetLiveDragX();
                    return;
                }

                dragTransition = momentumTransition;
                momentumTransition.timeline.progress(0).pause();

                const slowdownProgress = 1 - gsap.utils.clamp(
                    0,
                    1,
                    (momentumVelocity - dragMomentumStopVelocity) / Math.max(startVelocity - dragMomentumStopVelocity, 1)
                );
                const momentumDuration = gsap.utils.interpolate(
                    dragMomentumMinDuration,
                    dragMomentumMaxDuration,
                    slowdownProgress
                );

                dragReleaseTween = gsap.to(momentumTransition.timeline, {
                    progress: 1,
                    duration: momentumDuration,
                    ease: completedSlides === 0 ? "power2.out" : "power3.out",
                    onComplete: () => {
                        momentumTransition.commit();
                        if (dragTransition === momentumTransition) dragTransition = null;
                        completedSlides += 1;
                        momentumVelocity *= dragMomentumFriction;
                        runNextMomentumSlide();
                    }
                });
            };

            runNextMomentumSlide();
            return true;
        };

        gsap.ticker.add(() => {
            if (showcaseContainer.classList.contains("is-dragging") || dragTransition || dragReleaseTween) return;

            dragVelocityX *= friction;
            if (Math.abs(dragVelocityX) < 0.02 && Math.abs(dragTargetX) < 0.5 && Math.abs(dragCurrentX) < 0.5) {
                resetLiveDragX();
            }
        });

        showcaseDragArea.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || isProjectSwapAnimating) return;
            if (!event.target.closest(".projects-showcase-img")) return;

            dragStartX = event.clientX;
            dragStartY = event.clientY;
            lastDragX = event.clientX;
            dragTargetX = 0;
            dragCurrentX = 0;
            dragVelocityX = 0;
            phoneSwipeActive = shouldUseDirectProjectSwipe();
            phoneSwipeX = 0;
            if (phoneSwipeTween) {
                phoneSwipeTween.kill();
                phoneSwipeTween = null;
            }
            gsap.set(showcaseDragArea, {
                x: 0,
                clearProps: "transform"
            });
            dragPointerId = event.pointerId;
            showcaseContainer.classList.add("is-dragging");
            showcaseDragArea.setPointerCapture(event.pointerId);
            event.preventDefault();
        });

        showcaseDragArea.addEventListener("pointermove", (event) => {
            if (!showcaseContainer.classList.contains("is-dragging")) return;
            if (dragPointerId !== null && event.pointerId !== dragPointerId) return;
            if (isProjectSwapAnimating && !dragTransition) return;

            const deltaX = event.clientX - dragStartX;
            const deltaY = event.clientY - dragStartY;

            if (Math.abs(deltaX) < Math.abs(deltaY)) return;

            const pointerDeltaX = event.clientX - lastDragX;
            lastDragX = event.clientX;
            dragVelocityX = pointerDeltaX * scrollSpeed;

            if (phoneSwipeActive && shouldUseDirectProjectSwipe()) {
                const stepDistance = getPhoneSwipeStepDistance();
                const maxSwipeDistance = stepDistance * getMaxPhoneMomentumSlides();
                const easedX = gsap.utils.clamp(-maxSwipeDistance, maxSwipeDistance, deltaX);

                setPhoneSwipeX(easedX);
                event.preventDefault();
                return;
            }

            if (!dragTransition && Math.abs(deltaX) >= dragStartDeadzone) {
                startDragTransition(getDragProjectDirection(deltaX));
            }

            if (dragTransition) {
                const dragDistance = getDragTransitionDistance(deltaX);

                if (dragDistance < -dragStartDeadzone) {
                    cancelLiveDragTransition();
                    dragStartX = event.clientX;
                    lastDragX = event.clientX;
                    event.preventDefault();
                    return;
                }

                const dragProgress = gsap.utils.clamp(0, 1, dragDistance / getDragStepThreshold());
                setDragTransitionProgress(dragProgress);
                dragCurrentX = dragDistance;
                dragTargetX = dragDistance;
                liveDragX = dragDistance;

                if (dragProgress >= 1) {
                    completeLiveDragTransition();
                    dragStartX = event.clientX;
                    lastDragX = event.clientX;
                }
            }

            event.preventDefault();
        });

        const finishProjectDrag = (event) => {
            if (!showcaseContainer.classList.contains("is-dragging")) return;
            if (dragPointerId !== null && event.pointerId !== dragPointerId) return;

            const deltaX = event.clientX - dragStartX;
            const deltaY = event.clientY - dragStartY;

            showcaseContainer.classList.remove("is-dragging");
            if (showcaseDragArea.hasPointerCapture(event.pointerId)) {
                showcaseDragArea.releasePointerCapture(event.pointerId);
            }
            dragPointerId = null;

            if (!dragTransition) {
                if (phoneSwipeActive && completePhoneSwipe(deltaX, deltaY)) {
                    return;
                }
                resetLiveDragX();
                return;
            }

            const activeTransition = dragTransition;
            if (dragProgressTween) {
                dragProgressTween.kill();
                dragProgressTween = null;
            }
            const currentProgress = activeTransition.timeline.progress();
            const decisionProgress = Math.max(currentProgress, dragTargetProgress);
            const directionVelocity = activeTransition.delta > 0 ? -dragVelocityX : dragVelocityX;
            const momentumProgress = gsap.utils.clamp(-0.22, 0.34, directionVelocity * dragMomentum);
            const projectedProgress = gsap.utils.clamp(0, 1, decisionProgress + momentumProgress);
            const shouldCommit = projectedProgress >= dragCommitProgress || directionVelocity > dragReleaseVelocity;
            const targetProgress = shouldCommit ? 1 : 0;
            const remainingProgress = Math.abs(targetProgress - currentProgress);
            const releaseDuration = gsap.utils.clamp(
                dragReleaseMinDuration + 0.06,
                dragReleaseMaxDuration + 0.16,
                0.24 + (remainingProgress * 0.24)
            );

            dragReleaseTween = gsap.to(activeTransition.timeline, {
                progress: targetProgress,
                duration: releaseDuration,
                ease: shouldCommit ? "power3.out" : "back.out(1.2)",
                onComplete: () => {
                    if (shouldCommit) {
                        activeTransition.commit();
                    } else {
                        activeTransition.cancel();
                    }

                    if (dragTransition === activeTransition) dragTransition = null;
                    if (shouldCommit && continueReleaseMomentum(activeTransition.delta, directionVelocity)) return;

                    dragReleaseTween = null;
                    resetLiveDragX();
                }
            });
        };

        showcaseDragArea.addEventListener("pointerup", finishProjectDrag);
        window.addEventListener("pointerup", finishProjectDrag);

        showcaseDragArea.addEventListener("pointercancel", (event) => {
            showcaseContainer.classList.remove("is-dragging");
            if (dragPointerId !== null && showcaseDragArea.hasPointerCapture(event.pointerId)) {
                showcaseDragArea.releasePointerCapture(event.pointerId);
            }
            dragPointerId = null;
            if (dragProgressTween) {
                dragProgressTween.kill();
                dragProgressTween = null;
            }
            resetPhoneSwipe();
            if (dragReleaseTween) {
                dragReleaseTween.kill();
                dragReleaseTween = null;
            }
            cancelLiveDragTransition();
            resetLiveDragX();
        });
    }

    const isProjectsPhoneIntro = window.matchMedia("(max-width: 767px)").matches;

    if (reduceMotion) {
        gsap.set(showcaseLetters, { y: 0 });
        gsap.set(showcaseCopy, { y: 0 });
        gsap.set(getMainTitleCopy(), { autoAlpha: 1 });
        gsap.set(getMainTitleText(), { autoAlpha: 1 });
        gsap.set(getMainTitleMasks(), {
            "--project-title-cover-x": "101%",
            "--project-title-cover-scale": 1
        });
        gsap.set(showcaseControls, { autoAlpha: 1, y: 0 });
        gsap.set(serviceNav, { autoAlpha: 1, y: 0 });
        gsap.set(mainImage, {
            scale: 1,
            clipPath: "polygon(0% 100%, 100% 100%, 100% 0%, 0% 0%)"
        });
        gsap.set(sideImages, {
            clipPath: "polygon(0% 100%, 100% 100%, 100% 0%, 0% 0%)"
        });
        gsap.set([leftWord, rightWord], { left: 0, right: 0, scale: 1 });
        gsap.set(showcaseTitle, { bottom: "0.1em" });
        updateShowcaseControlPosition();
        return null;
    }

    if (isProjectsPhoneIntro) {
        const phoneUiElements = [
            navbar,
            serviceNav,
            projectsShowcase.querySelector(".projects-mobile-dots")
        ].filter(Boolean);
        const phoneImageWraps = gsap.utils.toArray(projectsShowcase.querySelectorAll(".projects-showcase-img"));
        const createPhoneIntroWord = (wordElement, text) => {
            if (!wordElement) {
                return {
                    chars: [],
                    remove() {}
                };
            }

            wordElement.querySelectorAll(".projects-phone-intro-word").forEach((node) => node.remove());
            const wrapper = document.createElement("span");
            wrapper.className = "projects-phone-intro-word";
            const chars = [];

            Array.from(text).forEach((letter) => {
                const mask = document.createElement("span");
                mask.className = "projects-phone-intro-char-mask";

                const char = document.createElement("span");
                char.className = "projects-phone-intro-char";
                char.textContent = letter;

                mask.appendChild(char);
                wrapper.appendChild(mask);
                chars.push(char);
            });

            wordElement.appendChild(wrapper);

            return {
                chars,
                keep() {
                    wrapper.classList.add("is-phone-intro-final");
                },
                remove() {
                    wrapper.remove();
                }
            };
        };
        const leftIntro = createPhoneIntroWord(leftWord, "Our");
        const rightIntro = createPhoneIntroWord(rightWord, "Work");
        const leftIntroChars = leftIntro.chars;
        const rightIntroChars = rightIntro.chars;
        const allIntroChars = [...leftIntroChars, ...rightIntroChars];

        showcaseTitle?.classList.add("is-phone-intro-active");
        gsap.set(showcaseContainer, {
            "--projects-bottom-title-opacity": 0,
            "--projects-bottom-title-y": "1.25rem",
            "--projects-final-word-opacity": 0
        });
        gsap.set(allIntroChars, {
            "--projects-phone-letter-y": "140%"
        });
        gsap.set(phoneUiElements, {
            autoAlpha: 0,
            y: (index, target) => target === navbar ? -26 : 18
        });
        gsap.set(showcaseDragArea, {
            autoAlpha: 1,
            scale: 1,
            clipPath: "none",
            clearProps: "visibility"
        });
        gsap.set(phoneImageWraps, {
            autoAlpha: 0,
            scale: 0.74,
            clipPath: "inset(18% 18% 18% 18%)",
            transformOrigin: "center center",
            force3D: true
        });
        gsap.set(showcaseTitle, {
            autoAlpha: 1
        });
        gsap.set(leftWord, {
            autoAlpha: 1,
            y: "18.4svh",
            scale: 0.94,
            transformOrigin: "center center"
        });
        gsap.set(rightWord, {
            autoAlpha: 1,
            y: "-20.8svh",
            scale: 0.94,
            transformOrigin: "center center"
        });
        gsap.set([mainImage, ...sideImages], {
            scale: 1,
            clipPath: "polygon(0% 100%, 100% 100%, 100% 0%, 0% 0%)"
        });
        hideMainTitleMasks();
        updateShowcaseControlPosition();

        return gsap.timeline({
            paused: true,
            defaults: {
                ease: "power4.out"
            }
        })
            .to(leftIntroChars, {
                "--projects-phone-letter-y": "0%",
                duration: 0.8,
                stagger: 0.05
            })
            .to(rightIntroChars, {
                "--projects-phone-letter-y": "0%",
                duration: 0.8,
                stagger: 0.05
            }, "-=0.34")
            .to([leftWord, rightWord], {
                y: (index) => index === 0 ? "13.2svh" : "-15.2svh",
                duration: 0.72,
                stagger: 0.08
            }, "-=0.18")
            .to(phoneImageWraps, {
                autoAlpha: 1,
                scale: 1,
                clipPath: "inset(0% 0% 0% 0%)",
                duration: 1.06,
                stagger: 0.035,
                ease: "expo.out"
            }, "-=0.16")
            .to(leftWord, {
                y: 0,
                scale: 1,
                duration: 0.95,
                ease: "expo.out"
            }, "-=0.72")
            .to(rightWord, {
                y: 0,
                scale: 1,
                duration: 0.95,
                ease: "expo.out"
            }, "<")
            .add(() => {
                leftIntro.keep();
                rightIntro.keep();
            })
            .to(showcaseContainer, {
                "--projects-bottom-title-opacity": 1,
                "--projects-bottom-title-y": "0rem",
                duration: 0.58,
                ease: "power3.out"
            }, "-=0.24")
            .to(projectsShowcase.querySelector(".projects-mobile-dots") || [], {
                autoAlpha: 1,
                y: 0,
                duration: 0.48,
                ease: "power3.out"
            }, "<")
            .to(navbar || [], {
                autoAlpha: 1,
                y: 0,
                duration: 0.58,
                ease: "power3.out"
            }, ">-0.12")
            .to(serviceNav || [], {
                autoAlpha: 1,
                y: 0,
                duration: 0.58,
                ease: "power3.out"
            }, "<0.12")
            .set(phoneImageWraps, {
                autoAlpha: 1,
                scale: 1,
                clipPath: "inset(0% 0% 0% 0%)"
            })
            .call(updateShowcaseControlPosition);
    }

    gsap.set(showcaseLetters, { y: 400 });
    gsap.set(showcaseCopy, { y: 50 });
    hideMainTitleMasks();
    gsap.set(showcaseControls, { autoAlpha: 0, y: 14 });
    gsap.set(serviceNav, { autoAlpha: 0, y: 14 });
    gsap.set(showcaseTitle, { bottom: "50%" });
    gsap.set(leftWord, { left: "18vw", scale: 0.25 });
    gsap.set(rightWord, { right: "18vw", scale: 0.25 });
    gsap.set(mainImage, {
        scale: 0.5,
        clipPath: "polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)"
    });
    gsap.set(sideImages, {
        clipPath: "polygon(0 0, 100% 0, 100% 0, 0 0)"
    });
    if (navbar) {
        gsap.set(navbar, { y: -100 });
    }

    return gsap.timeline({
        paused: true,
        defaults: {
            duration: 1,
            ease: "power3.out"
        }
    })
        .to(showcaseLetters, {
            y: 0,
            stagger: 0.1
        })
        .to(leftWord, {
            left: "12vw"
        })
        .to(rightWord, {
            right: "8vw"
        }, "<")
        .to(mainImage, {
            clipPath: "polygon(0% 100%, 100% 100%, 100% 0%, 0% 0%)"
        }, "<")
        .to(leftWord, {
            left: 0,
            scale: 1
        })
        .to(rightWord, {
            right: 0,
            scale: 1
        }, "<")
        .to(mainImage, {
            scale: 1
        }, "<")
        .to(sideImages, {
            clipPath: "polygon(0% 100%, 100% 100%, 100% 0%, 0% 0%)",
            stagger: 0.1
        }, "<")
        .to(showcaseTitle, {
            bottom: "0.1em"
        }, "<")
        .call(updateShowcaseControlPosition)
        .to(showcaseCopy, {
            y: 0,
            stagger: 0.05
        }, "<")
        .to(navbar || [], {
            y: 0
        }, "<")
        .to(showcaseControls, {
            autoAlpha: 1,
            y: 0,
            duration: 0.28,
            ease: "power3.out"
        }, "<0.18")
        .to(serviceNav, {
            autoAlpha: 1,
            y: 0,
            duration: 0.28,
            ease: "power3.out"
        }, "<")
        .set(getMainTitleCopy(), {
            autoAlpha: 1,
            x: 0
        }, ">")
        .set(getMainTitleText(), {
            autoAlpha: 0
        }, "<")
        .set(getMainTitleMasks(), {
            "--project-title-cover-x": "0%",
            "--project-title-cover-scale": 0
        }, "<")
        .to(getMainTitleMasks(), {
            "--project-title-cover-scale": 1,
            duration: 0.48,
            stagger: 0.06,
            ease: "power3.inOut"
        }, ">")
        .set(getMainTitleText(), {
            autoAlpha: 1
        })
        .to(getMainTitleMasks(), {
            "--project-title-cover-x": "101%",
            duration: 0.82,
            stagger: 0.06,
            ease: "power3.inOut"
        }, ">")
        .call(updateShowcaseControlPosition);
}

const projectsShowcaseTl = initProjectsShowcaseAnimation();

function startStandalonePageAnimation() {
    const linkPage = document.querySelector(".link-page-main");

    if (!linkPage) return;

    const pageTl = gsap.timeline();
    const approachHero = document.querySelector(".link-page-hero-approach");
    const aboutStoryPage = document.querySelector(".about-story-page");
    let aboutHeroLines = [];
    if (projectsShowcaseTl) {
        projectsShowcaseTl.pause(0);
        gsap.delayedCall(0.5, () => {
            projectsShowcaseTl.restart();
        });
    }

    if (approachHero) {
        gsap.set(".link-page-hero-approach > div, .link-page-hero-approach .link-page-hero-copy", {
            y: 34,
            autoAlpha: 0
        });
        gsap.set(".approach-hero-rule", {
            scaleX: 0,
            transformOrigin: "center"
        });
        gsap.set(".link-page-hero-approach .link-page-cta", {
            y: 18,
            autoAlpha: 0
        });
    }

    if (aboutStoryPage) {
        aboutHeroLines = gsap.utils.toArray(".about-story-divider");
        const aboutPageRule = document.querySelector(".about-page-rule");
        const aboutHeroRule = document.querySelector(".about-hero-rule");
        const aboutPageHeroImage = document.querySelector(".about-page-hero-image");
        const aboutScrollTextItems = gsap.utils.toArray(".about-story-hero .reveal-text, .about-services-showcase .reveal-text, .about-clients-intro .reveal-text, .about-clients-bottom .reveal-text, .about-client-reasons .reveal-text, .about-team-showcase .reveal-text");
        const aboutScrollMediaItems = gsap.utils.toArray(".about-story-image-frame");
        const aboutServiceRows = gsap.utils.toArray(".about-services-list article");
        const aboutTeamCategories = gsap.utils.toArray(".about-team-category");
        const aboutTeamCardDetails = gsap.utils.toArray(".about-team-card > div");

        gsap.set(aboutHeroLines, { scaleX: 0, transformOrigin: "left" });
        gsap.set(aboutPageRule, { scaleX: 0, transformOrigin: "left" });
        gsap.set(aboutHeroRule, {
            scaleX: 0,
            transformOrigin: "center"
        });
        gsap.set(".about-page-kicker-word-about .line-mask", { y: "140%" });
        gsap.set(".about-page-kicker-word-blueprint .line-mask", { y: "-140%" });
        gsap.set(aboutPageHeroImage, { y: 24, autoAlpha: 0 });
        aboutScrollTextItems.forEach(item => {
            item.removeAttribute("data-revealed");
            gsap.set(item.querySelectorAll(".line-mask"), { y: "140%" });
        });
        aboutServiceRows.forEach(row => {
            row.removeAttribute("data-line-revealed");
        });
        aboutTeamCategories.forEach(category => {
            category.removeAttribute("data-line-revealed");
        });
        aboutTeamCardDetails.forEach(detail => {
            detail.removeAttribute("data-line-revealed");
        });
        gsap.set(aboutServiceRows, {
            "--about-line-scale": "0%"
        });
        gsap.set(aboutTeamCategories, { "--about-category-line-scale": "0%" });
        gsap.set(aboutTeamCardDetails, { "--about-team-card-line-scale": "0%" });
        gsap.set(aboutScrollMediaItems, { y: 24, autoAlpha: 0 });

        if (aboutScrollTextItems.length) {
            ScrollTrigger.batch(aboutScrollTextItems, {
                start: "top 88%",
                once: true,
                onEnter: (batch) => {
                    batch.forEach(item => {
                        if (item.dataset.revealed === "true") return;

                        item.dataset.revealed = "true";
                        const usesCategoryTiming = item.matches(".about-story-title, .about-services-intro h2, .about-clients-intro h2, .about-client-reasons-heading h2, .about-team-heading h2");

                        gsap.to(item.querySelectorAll(".line-mask"), {
                            y: 0,
                            stagger: usesCategoryTiming ? 0.1 : 0.035,
                            duration: usesCategoryTiming ? 0.8 : 0.65,
                            ease: "power4.out"
                        });

                        const serviceRow = item.closest(".about-services-list article");
                        const teamCategory = item.closest(".about-team-category");
                        const teamCardDetail = item.closest(".about-team-card > div");

                        if (serviceRow && serviceRow.dataset.lineRevealed !== "true") {
                            serviceRow.dataset.lineRevealed = "true";
                            gsap.to(serviceRow, {
                                "--about-line-scale": "100%",
                                duration: 0.75,
                                ease: "expo.out"
                            });
                        }

                        if (teamCategory && teamCategory.dataset.lineRevealed !== "true") {
                            teamCategory.dataset.lineRevealed = "true";
                            gsap.to(teamCategory, {
                                "--about-category-line-scale": "100%",
                                duration: 0.75,
                                ease: "expo.out"
                            });
                        }

                        if (teamCardDetail && teamCardDetail.dataset.lineRevealed !== "true") {
                            teamCardDetail.dataset.lineRevealed = "true";
                            gsap.to(teamCardDetail, {
                                "--about-team-card-line-scale": "100%",
                                duration: 0.75,
                                ease: "expo.out"
                            });
                        }
                    });
                }
            });
        }

        if (aboutScrollMediaItems.length) {
            ScrollTrigger.batch(aboutScrollMediaItems, {
                start: "top 88%",
                once: true,
                onEnter: (batch) => {
                    gsap.to(batch, {
                        y: 0,
                        autoAlpha: 1,
                        stagger: 0.06,
                        duration: 0.72,
                        ease: "power3.out"
                    });
                }
            });
        }
    }

    const heroRevealTargets = document.querySelectorAll(aboutStoryPage ? ".link-page-hero:not(.about-story-hero) .char, .link-page-hero:not(.about-story-hero) .line-mask" : ".link-page-hero .char, .link-page-hero .line-mask");

    if (approachHero) {
        pageTl.to(".approach-hero-rule", {
            scaleX: 1,
            duration: 1.2,
            ease: "expo.inOut"
        }, "-=0.72");

        pageTl.to(".link-page-hero-approach > div, .link-page-hero-approach .link-page-hero-copy", {
            y: 0,
            autoAlpha: 1,
            stagger: 0.12,
            duration: 0.72,
            ease: "power3.out"
        }, "-=0.44");
    }

    if (aboutStoryPage) {
        pageTl.to(".about-hero-rule", {
            scaleX: 1,
            duration: 1.2,
            ease: "expo.inOut"
        }, "-=0.72");
    }

    if (heroRevealTargets.length) {
        pageTl.to(heroRevealTargets, {
            y: 0,
            stagger: approachHero || aboutStoryPage ? 0.04 : 0.025,
            duration: approachHero || aboutStoryPage ? 1.02 : 0.82,
            ease: "power4.out"
        }, approachHero || aboutStoryPage ? "-=0.5" : undefined);
    }

    if (aboutStoryPage) {
        pageTl.to(".about-page-rule", {
            scaleX: 1,
            duration: 0.75,
            ease: "expo.out"
        }, "-=0.58")
            .to(".about-page-hero-image", {
                y: 0,
                autoAlpha: 1,
                duration: 0.9,
                ease: "power3.out"
            }, "-=0.55");

        ScrollTrigger.create({
            trigger: ".about-story-hero",
            start: "top 78%",
            once: true,
            onEnter: () => {
                gsap.to(aboutHeroLines, {
                    scaleX: 1,
                    duration: 0.75,
                    stagger: 0.12,
                    ease: "expo.out"
                });
            }
        });
    }

    if (approachHero) {
        pageTl.to(".link-page-hero-approach .link-page-cta", {
            y: 0,
            autoAlpha: 1,
            duration: 0.6,
            ease: "power3.out"
        }, "-=0.38");
    }

    const projectRevealTargets = gsap.utils.toArray(".link-project-service-title .line-mask, .link-project-item .line-mask");

    if (projectRevealTargets.length) {
        ScrollTrigger.batch(projectRevealTargets, {
            start: "top 88%",
            once: true,
            onEnter: (batch) => {
                gsap.to(batch, {
                    y: 0,
                    stagger: 0.035,
                    duration: 0.72,
                    ease: "power4.out"
                });
            }
        });
    }

    const projectsBridgeLines = gsap.utils.toArray(".projects-bridge-copy .line-mask");

    if (projectsBridgeLines.length) {
        gsap.set(projectsBridgeLines, { y: "140%" });

        ScrollTrigger.create({
            trigger: ".projects-bridge-section",
            start: "top 78%",
            once: true,
            onEnter: () => {
                gsap.to(projectsBridgeLines, {
                    y: 0,
                    stagger: 0.09,
                    duration: 0.86,
                    ease: "power4.out"
                });
            }
        });
    }

    const processCards = gsap.utils.toArray(".link-process-grid article");

    if (processCards.length) {
        gsap.set(processCards, {
            yPercent: 0,
            y: 0,
            scale: 1,
            autoAlpha: 1,
            clipPath: "inset(0% 0% 0% 0%)",
            clearProps: "rotate,rotateX,rotateY"
        });

        processCards.forEach((card, index) => {
            gsap.set(card, {
                zIndex: index + 1,
                "--process-index-scale": 0
            });
            const textMasks = card.querySelectorAll(".process-text-mask");
            const titleMask = card.querySelector("h2 .process-text-mask");
            const paragraphMasks = card.querySelectorAll("p .process-text-mask");

            gsap.set(textMasks, { "--process-text-cover": "0%" });
            gsap.timeline({
                scrollTrigger: {
                    trigger: card,
                    start: "top 62%",
                    once: true
                }
            })
                .to(titleMask, {
                    "--process-text-cover": "101%",
                    duration: 1.15,
                    ease: "power4.inOut"
                }, 0)
                .to(paragraphMasks, {
                    "--process-text-cover": "101%",
                    stagger: 0.12,
                    duration: 0.95,
                    ease: "power4.inOut"
                }, 0.28)
                .to(card, {
                    "--process-index-scale": 1,
                    duration: 0.55,
                    ease: "power3.out"
                }, 0.18);
        });
    }

    const footer = document.querySelector(".link-page-reveal-footer");

    if (footer) {
        gsap.set(footer, { y: 0, autoAlpha: 1 });
    }

    initPremiumAboutPage();
}

function initPremiumAboutPage() {
    const aboutPage = document.querySelector(".about-premium-page");

    if (!aboutPage) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealItems = gsap.utils.toArray(".about-premium-reveal");

    gsap.set(revealItems, { y: reduceMotion ? 0 : 54, autoAlpha: reduceMotion ? 1 : 0 });

    if (!reduceMotion && revealItems.length) {
        ScrollTrigger.batch(revealItems, {
            start: "top 84%",
            once: true,
            onEnter: (batch) => {
                gsap.to(batch, {
                    y: 0,
                    autoAlpha: 1,
                    duration: 0.95,
                    stagger: 0.08,
                    ease: "power4.out"
                });
            }
        });
    }

    if (!reduceMotion) {
        gsap.to(".about-hero-orbit span", {
            yPercent: (index) => [-24, 18, -12][index] || 0,
            rotate: (index) => [18, -12, 24][index] || 0,
            ease: "none",
            scrollTrigger: {
                trigger: ".about-premium-hero",
                start: "top top",
                end: "bottom top",
                scrub: true
            }
        });

        gsap.set(".about-hero-meta p", { x: -18, autoAlpha: 0 });
        gsap.to(".about-hero-meta p", {
            x: 0,
            autoAlpha: 1,
            stagger: 0.08,
            duration: 0.8,
            ease: "power3.out",
            delay: 0.35
        });

        gsap.utils.toArray(".about-service-panel").forEach((panel) => {
            gsap.fromTo(panel, {
                "--service-orb-scale": 0.72
            }, {
                "--service-orb-scale": 1.08,
                ease: "none",
                scrollTrigger: {
                    trigger: panel,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: true
                }
            });

            gsap.fromTo(panel.querySelectorAll("h2, p, li, .about-case-preview"), {
                y: 44,
                autoAlpha: 0
            }, {
                y: 0,
                autoAlpha: 1,
                duration: 0.9,
                stagger: 0.07,
                ease: "power4.out",
                scrollTrigger: {
                    trigger: panel,
                    start: "top 62%",
                    once: true
                }
            });
        });

        const proofMarquee = document.querySelector(".about-proof-marquee");

        if (proofMarquee) {
            const marqueeState = {
                x: 0,
                baseSpeed: -84,
                idleSpeed: -84,
                speed: -84,
                targetSpeed: -84,
                lastScrollTime: 0
            };

            const getMarqueeLoopWidth = () => {
                const firstItem = proofMarquee.querySelector("span");
                return firstItem ? firstItem.offsetWidth : proofMarquee.scrollWidth / 2;
            };

            gsap.set(proofMarquee, { x: 0, willChange: "transform" });

            gsap.ticker.add((time, deltaTime) => {
                const loopWidth = getMarqueeLoopWidth();

                if (!loopWidth) return;

                if (performance.now() - marqueeState.lastScrollTime > 70) {
                    marqueeState.targetSpeed = marqueeState.idleSpeed;
                }

                marqueeState.speed += (marqueeState.targetSpeed - marqueeState.speed) * 0.22;
                marqueeState.x += marqueeState.speed * (deltaTime / 1000);
                marqueeState.x = gsap.utils.wrap(-loopWidth, 0, marqueeState.x);

                gsap.set(proofMarquee, { x: marqueeState.x });
            });

            ScrollTrigger.create({
                trigger: ".about-proof-section",
                start: "top bottom",
                end: "bottom top",
                onUpdate: (self) => {
                    const scrollSpeed = Math.abs(self.getVelocity()) * 0.44;
                    const boostedSpeed = gsap.utils.clamp(320, 1800, scrollSpeed);

                    marqueeState.lastScrollTime = performance.now();
                    marqueeState.idleSpeed = self.direction === -1
                        ? Math.abs(marqueeState.baseSpeed)
                        : -Math.abs(marqueeState.baseSpeed);
                    marqueeState.targetSpeed = self.direction === -1 ? boostedSpeed : -boostedSpeed;
                }
            });
        }
    }

    const magneticItems = gsap.utils.toArray(".about-magnetic");

    magneticItems.forEach((item) => {
        let activeTween;

        item.addEventListener("pointermove", (event) => {
            if (reduceMotion) return;

            const rect = item.getBoundingClientRect();
            const x = event.clientX - rect.left - rect.width / 2;
            const y = event.clientY - rect.top - rect.height / 2;

            if (activeTween) activeTween.kill();

            activeTween = gsap.to(item, {
                x: x * 0.08,
                y: y * 0.08,
                rotate: x * 0.012,
                duration: 0.45,
                ease: "power3.out"
            });
        });

        item.addEventListener("pointerleave", () => {
            if (activeTween) activeTween.kill();

            activeTween = gsap.to(item, {
                x: 0,
                y: 0,
                rotate: 0,
                duration: 0.7,
                ease: "elastic.out(1, 0.55)"
            });
        });
    });
}

function fitMenuBlueprintToDivider() {
    const menuBlueprint = document.querySelector(".menu-overlay-blueprint");
    const menuBottom = document.querySelector(".menu-overlay-bottom");

    if (!menuBlueprint || !menuBottom) return;

    const targetWidth = menuBottom.clientWidth;

    if (targetWidth <= 0) return;

    menuBlueprint.style.fontSize = "10px";

    const measuredWidth = menuBlueprint.scrollWidth;

    if (measuredWidth <= 0) return;

    menuBlueprint.style.fontSize = `${(targetWidth / measuredWidth) * 10}px`;
}

let menuBlueprintFitFrame;

function scheduleMenuBlueprintFit() {
    cancelAnimationFrame(menuBlueprintFitFrame);
    menuBlueprintFitFrame = requestAnimationFrame(fitMenuBlueprintToDivider);
}

scheduleMenuBlueprintFit();

if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleMenuBlueprintFit);
}

window.addEventListener("resize", scheduleMenuBlueprintFit, { passive: true });

// 2. HERO ANIMATION (Includes Nav Reveal)

// Hide cards above screen initially so they don't show when loader slides up
gsap.set(".panel:not(.hero-section)", { yPercent: -100 });

function runPageLoadSequence() {
    resetPageScroll();

    if (shouldLandOnWebDevCard) {
        document.body.style.overflow = '';
        if (lenis) {
            lenis.resize();
            lenis.scrollTo(0, { immediate: true, force: true });
            lenis.start();
        }

        prepareNaturalWebCardHashLanding();
        initMobilePageTextReveals();
        pageIsReady = true;
        ScrollTrigger.refresh();
        scrollToWebDevCardHashIfRequested();
        syncNavState();
        document.documentElement.classList.remove("is-link-transition");
        document.documentElement.classList.remove("is-service-direct-transition");
        document.documentElement.classList.remove("is-webdev-card-landing");
        document.documentElement.style.backgroundColor = "";

        if (loaderElement) {
            loaderElement.style.display = "none";
        }

        return;
    }

    // Hide scrollbar during load
    document.body.style.overflow = 'hidden';

    if (loaderElement && shouldUseLinkLoader && !shouldSkipIncomingLoader) {
        loaderElement.classList.add("is-link-loader");
    }

    if (shouldSkipIncomingLoader) {
        document.body.style.overflow = '';
        if (lenis) {
            lenis.resize();
            lenis.scrollTo(0, { immediate: true, force: true });
            lenis.start();
        }

        if (isIndexPage) {
            if (shouldLandOnWebDevCard) {
                prepareNaturalWebCardHashLanding();
            } else {
                startHeroAnimation();
            }
        } else {
            startStandalonePageAnimation();
        }

        initMobilePageTextReveals();
        pageIsReady = true;
        ScrollTrigger.refresh();
        syncNavState();
        scrollToWebDevCardHashIfRequested();
        document.documentElement.classList.remove("is-link-transition");
        document.documentElement.classList.remove("is-service-direct-transition");
        document.documentElement.classList.remove("is-webdev-card-landing");
        document.documentElement.style.backgroundColor = "";

        if (loaderElement) {
            loaderElement.style.display = "none";
        }

        return;
    }

    const loaderTl = gsap.timeline({
        onComplete: () => {
            document.body.style.overflow = '';
            if (lenis) {
                lenis.resize();
                lenis.scrollTo(0, { immediate: true, force: true });
                lenis.start();
            }

            if (isIndexPage) {
                if (shouldLandOnWebDevCard) {
                    prepareNaturalWebCardHashLanding();
                } else {
                    startHeroAnimation();
                }
            } else {
                startStandalonePageAnimation();
            }
            initMobilePageTextReveals();
            pageIsReady = true;
            ScrollTrigger.refresh();
            syncNavState();
            scrollToWebDevCardHashIfRequested();
            document.documentElement.classList.remove("is-link-transition");
            document.documentElement.classList.remove("is-service-direct-transition");
            document.documentElement.classList.remove("is-webdev-card-landing");
            document.documentElement.style.backgroundColor = "";
            document.getElementById('loader').style.display = 'none';
        }
    });

    if (shouldUseLinkLoader) {
        loaderTl.set(".loader-logo .char", {
            y: 0
        })
            .to({}, {
                duration: 0.18
            })
            .to(".loader", {
                yPercent: -100,
                duration: 0.72,
                ease: "expo.inOut"
            });
    } else {
        loaderTl.to(".loader-logo .char", {
            y: 0,
            stagger: 0.05,
            duration: 0.8,
            ease: "power4.out",
            delay: 0.2
        })
            .to(".loader-progress-bar", {
                scaleX: 1,
                duration: 1.5,
                ease: "power2.inOut"
            }, "-=0.2")
            .to(".loader-logo .char", {
                y: "-140%",
                stagger: 0.02,
                duration: 0.5,
                ease: "power4.in"
            }, "+=0.5")
            .to(".loader-progress", {
                opacity: 0,
                duration: 0.3
            }, "<")
            .to(".loader", {
                yPercent: -100,
                duration: 0.8,
                ease: "expo.inOut"
            }, "-=0.2");
    }

    function startHeroAnimation() {
        const heroTl = gsap.timeline();

        // 1. Cards drop down one by one
        heroTl.to(".panel:not(.hero-section)", {
            yPercent: 0,
            duration: 0.8,
            stagger: 0.15,
            ease: "power3.out"
        })

            // 2. Animate Nav characters and Hero Title characters together
            .to(".nav-links .char, .hero-title .char, .highlight-container .char", {
                y: 0,
                stagger: 0.02,
                duration: 0.8,
                ease: "power4.out"
            }, "-=0.2")
            // 3. Animate Hero Description line-by-line
            .to(".hero-description .line-mask", {
                y: 0,
                stagger: 0.1,
                duration: 0.8,
                ease: "power4.out"
            }, "-=0.6")
            .add(() => {
                const el = document.querySelector('.highlight-container');
                if (el) el.classList.add('active');
            }, "-=0.3")
            .to(".bottom-logo .char", {
                y: 0,
                stagger: 0.02,
                duration: 0.8,
                ease: "power4.out"
            }, "-=0.6")
            .fromTo(".hero-line", {
                scaleX: 0,
                transformOrigin: "left"
            }, {
                scaleX: 1,
                duration: 1.5,
                ease: "expo.out"
            }, "-=0.6");
    }
}

if (shouldUseLinkLoader || shouldSkipIncomingLoader) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", runPageLoadSequence, { once: true });
    } else {
        runPageLoadSequence();
    }
} else {
    window.addEventListener("load", runPageLoadSequence, { once: true });
}

// 3. MAIN SCROLL LOGIC
const panels = gsap.utils.toArray(".panel:not(.hero-section)");
const hero = document.querySelector(".hero-section");
const phoneBreakpoint = 600;
const mobileServiceCardQuery = window.matchMedia("(max-width: 767px)");
const serviceCardRevealTimelines = new Map();

function isPhoneViewport() {
    return getViewportWidth() <= phoneBreakpoint;
}

function getViewportWidth() {
    return document.documentElement.clientWidth || window.innerWidth;
}

function getViewportHeight() {
    return document.documentElement.clientHeight || window.innerHeight;
}

function getOverlayMetrics() {
    const card = document.querySelector(".masking-overlay-card");
    const copy = document.querySelector(".masking-overlay-copy");

    if (!card || !copy) {
        return { startY: 0, endY: 0, overflow: 0 };
    }

    const cardStyles = window.getComputedStyle(card);
    const paddingTop = parseFloat(cardStyles.paddingTop) || 0;
    const paddingBottom = parseFloat(cardStyles.paddingBottom) || 0;
    const availableHeight = card.clientHeight - paddingTop - paddingBottom;
    const contentBottom = Math.max(...Array.from(card.children).map(child => {
        return child.offsetTop + child.offsetHeight;
    }));
    const contentHeight = contentBottom - paddingTop;
    const overflow = Math.max(0, contentHeight - availableHeight);
    const startY = 0;
    const endY = overflow > 0 ? -overflow : 0;

    return { startY, endY, overflow };
}

function getOverlayReadDuration() {
    const overflow = getOverlayMetrics().overflow;

    return overflow > 1 ? Math.min(5, Math.max(1.5, 1.5 + overflow / window.innerHeight)) : 0;
}

function getAboutMetrics() {
    const card = document.querySelector(".masking-overlay-card-about");
    const inner = document.querySelector(".about-section-inner");

    if (!card || !inner) {
        return { endY: 0, overflow: 0 };
    }

    const cardStyles = window.getComputedStyle(card);
    const paddingTop = parseFloat(cardStyles.paddingTop) || 0;
    const paddingBottom = parseFloat(cardStyles.paddingBottom) || 0;
    const availableHeight = card.clientHeight - paddingTop - paddingBottom;
    const overflow = Math.max(0, inner.scrollHeight - availableHeight);
    const endY = overflow > 0 ? -overflow : 0;

    return { endY, overflow };
}

function getAboutReadDuration() {
    const overflow = getAboutMetrics().overflow;

    return overflow > 1 ? Math.min(2.8, Math.max(0.9, 0.8 + overflow / window.innerHeight)) : 0;
}

function getApproachPanelMetrics() {
    const card = document.querySelector(".approach-card");
    const panel = document.querySelector(".approach-articles-mask");
    const divider = document.querySelector(".approach-copy-block > hr");

    if (!card || !panel) {
        return { startY: 0, lineY: 0, coverY: 0, endY: 0, pushY: 0, overflow: 0 };
    }

    const cardHeight = card.clientHeight || window.innerHeight;
    const panelStyles = window.getComputedStyle(panel);
    const panelPaddingBottom = parseFloat(panelStyles.paddingBottom) || 0;
    const contentBottom = Math.max(...Array.from(panel.children).map(child => {
        const childStyles = window.getComputedStyle(child);
        const marginBottom = parseFloat(childStyles.marginBottom) || 0;

        return child.offsetTop + child.offsetHeight + marginBottom;
    }));
    const panelHeight = Math.max(panel.scrollHeight, panel.offsetHeight, contentBottom + panelPaddingBottom);
    const revealBuffer = Math.min(cardHeight * 0.16, 140);
    const overflow = Math.max(0, panelHeight + revealBuffer - cardHeight);
    const cardRect = card.getBoundingClientRect();
    const dividerRect = divider ? divider.getBoundingClientRect() : null;
    const dividerTop = dividerRect ? dividerRect.top - cardRect.top : cardHeight * 0.45;
    const lineTop = gsap.utils.clamp(0, cardHeight, dividerTop);
    const lineY = lineTop - cardHeight;
    const coverY = -cardHeight;

    return {
        startY: 0,
        lineY,
        coverY,
        endY: coverY - overflow,
        pushY: coverY - lineY,
        overflow
    };
}

function getApproachReadDuration() {
    const overflow = getApproachPanelMetrics().overflow;

    return overflow > 1 ? Math.min(3.4, Math.max(0.9, 0.8 + overflow / (window.innerHeight * 1.45))) : 0;
}

function getApproachStepFoldOffset() {
    return getViewportHeight() / 4;
}

function getApproachDeckPeek(index) {
    if (getViewportWidth() <= 760) {
        return [112, 84, 56, 28][index] || 28;
    }

    return [400, 300, 200, 100][index] || 100;
}

function getApproachDeckX(index) {
    return getViewportWidth() - getApproachDeckPeek(index);
}

function getApproachDeckRadius() {
    return getViewportWidth() <= 760 ? "34px" : "60px";
}

function getApproachStepsOffset() {
    const panel = document.querySelector(".approach-articles-mask");
    const steps = document.querySelector(".approach-steps");

    if (!panel || !steps) return 0;

    const panelRect = panel.getBoundingClientRect();
    const stepsRect = steps.getBoundingClientRect();

    return Math.max(0, stepsRect.top - panelRect.top);
}

const overlayReadDuration = getOverlayReadDuration();
const overlayHoldDuration = 0;
const projectMeetDuration = 0.7;
const projectPushDuration = 0.95;
const projectTransitionDuration = projectMeetDuration + projectPushDuration;
const approachStepCards = gsap.utils.toArray(".approach-step");
const approachMeetDuration = 0.7;
const approachPushDuration = 0.95;
const approachTransitionDuration = approachMeetDuration + approachPushDuration;
const approachHoldDuration = 0.35;
const approachMaskMeetDuration = 0.46;
const approachMaskPushDuration = 0.44;
const approachMaskDuration = approachMaskMeetDuration + approachMaskPushDuration;
const approachIntroFadeDuration = 0.12;
const approachDiscoverPushDuration = 0.9;
const approachStepFoldDuration = 0.9;
const approachStepFoldTotalDuration = Math.max(0, approachStepCards.length - 1) * approachStepFoldDuration;
const approachDeckDuration = 0.86;
const approachDeckStagger = 0.14;
const approachDeckTotalDuration = approachDeckDuration + (Math.max(0, approachStepCards.length - 1) * approachDeckStagger);
const approachStepHorizontalDuration = 1;
const approachStepOverlap = 24;
const approachStepHorizontalTotalDuration = approachStepCards.length * approachStepHorizontalDuration;
const approachReadDuration = approachDiscoverPushDuration + approachStepFoldTotalDuration + approachDeckTotalDuration + approachStepHorizontalTotalDuration;
const aboutTransitionDuration = 1.25;
const aboutHoldDuration = 0.25;
const aboutReadDuration = getAboutReadDuration();
const contactTransitionDuration = 1.25;
const footerRevealDuration = 1.1;
const scrollSpeed = 140;
const approachPushedContentSelector = ".approach-fg-video, .approach-kicker, .approach-copy-block > hr, .approach-title, .approach-copy";
const approachIntroLayerSelector = ".approach-fg-video, .approach-copy-block, .approach-eyebrow-cover";

gsap.set(".masking-overlay-card", { y: () => getViewportHeight(), yPercent: 0 });
gsap.set(".masking-overlay-copy", { y: () => getOverlayMetrics().startY });
gsap.set(".approach-card", { x: () => getViewportWidth(), xPercent: 0 });
gsap.set(".masking-overlay-card-about", { y: () => getViewportHeight(), yPercent: 0 });
gsap.set(".about-section-inner", { y: 0 });
gsap.set(".contact-card", { x: () => getViewportWidth(), xPercent: 0 });
gsap.set(".site-footer", { y: 0, autoAlpha: isIndexPage ? 0 : 1 });
gsap.set(".approach-articles-mask", { y: () => getApproachPanelMetrics().startY, yPercent: 0 });
gsap.set(".approach-steps", { y: 0 });
gsap.set(approachStepCards, { x: 0, xPercent: 0, z: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1, zIndex: (index) => index + 1, force3D: true, borderTopLeftRadius: "0px", borderBottomLeftRadius: "0px", transformPerspective: 1200 });
gsap.set(approachStepCards.slice(1), { y: () => getViewportHeight(), yPercent: 0 });
gsap.set(approachPushedContentSelector, { y: 0 });
gsap.set(approachIntroLayerSelector, { autoAlpha: 1 });
gsap.set(".approach-eyebrow-cover", { y: 0 });

const overlayTextTl = gsap.timeline({ paused: true });
overlayTextTl
    .to(".masking-overlay-copy .line-mask", {
        y: 0,
        stagger: 0.1,
        duration: 0.8,
        ease: "power4.out"
    })
    .to(".masking-overlay-description .line-mask", {
        y: 0,
        stagger: 0.1,
        duration: 0.8,
        ease: "power4.out"
    }, "-=0.55");

let overlayTextRevealed = false;
let aboutTextRevealed = false;
let contactTextRevealed = false;

function getArchitectureCardImageBottomEdge() {
    const architecturePanel = document.querySelector(".service-card-architecture");
    const architectureImage = architecturePanel ? architecturePanel.querySelector(".card-img-unified") : null;

    if (!architecturePanel || !architectureImage) {
        return window.innerHeight;
    }

    const panelStyles = window.getComputedStyle(architecturePanel);
    const imageStyles = window.getComputedStyle(architectureImage);
    const panelPaddingTop = parseFloat(panelStyles.paddingTop) || 0;
    const imageMarginTop = parseFloat(imageStyles.marginTop) || 0;
    const imageBottom = panelPaddingTop + imageMarginTop + architectureImage.offsetHeight;

    return gsap.utils.clamp(0, window.innerHeight, imageBottom);
}

function getArchitectureImageRightEdge() {
    const overlayCard = document.querySelector(".masking-overlay-card");
    const architecturePreview = document.querySelector(".project-category:nth-child(4) .project-category-preview");

    if (!overlayCard || !architecturePreview) {
        return window.innerWidth;
    }

    const overlayRect = overlayCard.getBoundingClientRect();
    const previewRect = architecturePreview.getBoundingClientRect();
    const previewRightInsideOverlay = previewRect.right - overlayRect.left;

    return gsap.utils.clamp(0, window.innerWidth, previewRightInsideOverlay);
}

const aboutTextTl = gsap.timeline({ paused: true });
aboutTextTl
    .to(".masking-overlay-about-copy .line-mask", {
        y: 0,
        stagger: 0.1,
        duration: 0.8,
        ease: "power4.out"
    })
    .to(".about-section-statement .line-mask", {
        y: 0,
        stagger: 0.08,
        duration: 0.8,
        ease: "power4.out"
    }, "-=0.48")
    .to(".about-section-label .line-mask, .about-section-body .line-mask", {
        y: 0,
        stagger: 0.055,
        duration: 0.7,
        ease: "power4.out"
    }, "-=0.38");

const contactTextTl = gsap.timeline({ paused: true });
contactTextTl
    .to(".contact-section-eyebrow .line-mask", {
        y: 0,
        stagger: 0.1,
        duration: 0.8,
        ease: "power4.out"
    })
    .to(".contact-section-statement .line-mask", {
        y: 0,
        stagger: 0.08,
        duration: 0.8,
        ease: "power4.out"
    }, "-=0.48")
    .to(".contact-section-label .line-mask, .contact-section-link .line-mask, .contact-section-button .line-mask", {
        y: 0,
        stagger: 0.06,
        duration: 0.7,
        ease: "power4.out"
    }, "-=0.4");

const approachTextTl = gsap.timeline({ paused: true });
approachTextTl
    .to(".approach-copy-block > hr", {
        scaleX: 1,
        opacity: 1,
        duration: 0.85,
        ease: "expo.out"
    })
    .to(".approach-eyebrow .line-mask, .approach-kicker .line-mask", {
        y: 0,
        stagger: 0.08,
        duration: 0.55,
        ease: "power4.out"
    }, "-=0.35")
    .to(".approach-title .line-mask, .approach-copy .line-mask", {
        y: 0,
        stagger: 0.1,
        duration: 0.8,
        ease: "power4.out"
    }, "-=0.4")
    .to(".approach-step-title .line-mask", {
        y: 0,
        stagger: 0.055,
        duration: 0.65,
        ease: "power4.out"
    }, "-=0.45")
    .to(".approach-step", {
        "--approach-line-top-scale": "100%",
        stagger: 0.045,
        duration: 0.75,
        ease: "expo.out"
    }, "-=0.62")
    .to(".approach-step:last-child", {
        "--approach-line-bottom-scale": "100%",
        duration: 0.75,
        ease: "expo.out"
    }, "<")
    .to(".approach-step > span", {
        opacity: 1,
        y: 0,
        stagger: 0.04,
        duration: 0.5,
        ease: "power3.out"
    }, "-=0.55");

let approachTextRevealed = false;
const approachCard = document.querySelector(".approach-card");
const approachFgVideo = document.querySelector(".approach-fg-video");
const approachEyebrowCover = document.querySelector(".approach-eyebrow-cover");

function setApproachEyebrowMask(top = 0, bottom = 100) {
    if (!approachEyebrowCover) return;

    approachEyebrowCover.style.setProperty("--approach-eyebrow-mask-top", `${top}%`);
    approachEyebrowCover.style.setProperty("--approach-eyebrow-mask-bottom", `${bottom}%`);
}

function syncApproachEyebrowMask() {
    const panel = document.querySelector(".approach-articles-mask");

    if (!approachEyebrowCover || !panel) return;

    const eyebrowRect = approachEyebrowCover.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const intersection = getIntersectionRect(eyebrowRect, panelRect);

    if (!intersection) {
        setApproachEyebrowMask();
        return;
    }

    const top = gsap.utils.clamp(0, 100, ((intersection.top - eyebrowRect.top) / eyebrowRect.height) * 100);
    const bottom = gsap.utils.clamp(0, 100, ((eyebrowRect.bottom - intersection.bottom) / eyebrowRect.height) * 100);

    setApproachEyebrowMask(top, bottom);
}

function syncApproachMasks() {
    syncApproachEyebrowMask();
}

if (approachFgVideo && typeof approachFgVideo.play === "function") {
    approachFgVideo.play().catch(() => {
        // Muted autoplay can still be delayed until the browser is ready.
    });
}

function setApproachScrollable(isScrollable) {
    if (!approachCard) return;

    approachCard.classList.toggle("is-scrollable", isScrollable);

    if (!isScrollable) {
        approachCard.scrollTop = 0;
    }
}

const projectRevealItems = gsap.utils.toArray(".project-category-title, .project-list-link");
let unrevealedProjectItems = projectRevealItems.slice();
let projectRevealCheckQueued = false;
const pointerPosition = { x: window.innerWidth / 2, y: window.innerHeight / 2, active: false };
let activeProjectHoverLink = null;
let projectHoverCheckQueued = false;
const getUnsplashImage = (photoId) => `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=1200&q=80`;
const projectPreviewImageSets = [
    [
        "./web_img/webp-output/web_1.webp",
        "./web_img/webp-output/web_2.webp",
        "./web_img/webp-output/web_3.webp",
        "./web_img/webp-output/web_4.webp",
        "./web_img/webp-output/web_5.webp",
        "./web_img/webp-output/web_6.webp",
        "./web_img/webp-output/web_7.webp",
        "./web_img/webp-output/web_8.webp",
        "./web_img/webp-output/web_9.webp",
        "./web_img/webp-output/web_10.webp"
    ],
    [
        "./branding_img/webp-output/branding_1.webp",
        "./branding_img/webp-output/branding_2.webp",
        "./branding_img/webp-output/branding_3.webp",
        "./branding_img/webp-output/branding_4.webp",
        "./branding_img/webp-output/branding_5.webp",
        "./branding_img/webp-output/branding_6.webp",
        "./branding_img/webp-output/branding_7.webp",
        "./branding_img/webp-output/branding_8.webp",
        "./branding_img/webp-output/branding_9.webp",
        "./branding_img/webp-output/branding_10.webp",
        "./branding_img/webp-output/branding_1.webp",
        "./branding_img/webp-output/branding_2.webp"
    ],
    [
        "./marketing_img/webp-output/marketing_1.webp",
        "./marketing_img/webp-output/marketing_2.webp",
        "./marketing_img/webp-output/marketing_3.webp",
        "./marketing_img/webp-output/marketing_4.webp",
        "./marketing_img/webp-output/marketing_5.webp",
        "./marketing_img/webp-output/marketing_6.webp",
        "./marketing_img/webp-output/marketing_7.webp",
        "./marketing_img/webp-output/marketing_8.webp",
        "./marketing_img/webp-output/marketing_9.webp",
        "./marketing_img/webp-output/marketing_10.webp",
        "./marketing_img/webp-output/marketing_1.webp",
        "./marketing_img/webp-output/marketing_2.webp",
        "./marketing_img/webp-output/marketing_3.webp",
        "./marketing_img/webp-output/marketing_4.webp",
        "./marketing_img/webp-output/marketing_5.webp",
        "./marketing_img/webp-output/marketing_6.webp"
    ],
    [
        "./architecture_img/webp-output/architecture_1.webp",
        "./architecture_img/webp-output/architecture_2.webp",
        "./architecture_img/webp-output/architecture_3.webp",
        "./architecture_img/webp-output/architecture_4.webp",
        "./architecture_img/webp-output/architecture_5.webp",
        "./architecture_img/webp-output/architecture_6.webp",
        "./architecture_img/webp-output/architecture_7.webp",
        "./architecture_img/webp-output/architecture_8.webp",
        "./architecture_img/webp-output/architecture_9.webp"
    ]
];
const projectPreviewPositions = [
    "50% 50%",
    "35% 50%",
    "65% 50%",
    "50% 35%",
    "50% 65%",
    "32% 35%",
    "68% 35%",
    "32% 65%",
    "68% 65%",
    "45% 45%"
];
const projectPreviewStates = new WeakMap();
const menuCarouselImages = projectPreviewImageSets.flat();

function isLastProjectLink(item) {
    return item.parentElement && item === item.parentElement.lastElementChild;
}

function resetProjectRevealItems() {
    unrevealedProjectItems = projectRevealItems.slice();
    projectRevealItems.forEach(item => {
        item.removeAttribute("data-revealed");
        gsap.set(item.querySelectorAll(".line-mask"), { y: "140%" });

        if (item.classList.contains("project-list-link")) {
            gsap.set(item, {
                "--project-line-top-scale": "0%",
                "--project-line-bottom-scale": "0%"
            });
        }
    });
}

function revealVisibleProjectItems() {
    projectRevealCheckQueued = false;

    if (!unrevealedProjectItems.length) return;

    const revealTop = window.innerHeight * 0.88;
    const revealBottom = window.innerHeight * 0.08;

    for (let i = unrevealedProjectItems.length - 1; i >= 0; i -= 1) {
        const item = unrevealedProjectItems[i];
        const rect = item.getBoundingClientRect();
        const isVisible = rect.top < revealTop && rect.bottom > revealBottom;

        if (!isVisible) continue;

        item.dataset.revealed = "true";
        unrevealedProjectItems.splice(i, 1);
        const isCategoryTitle = item.classList.contains("project-category-title");
        gsap.to(item.querySelectorAll(".line-mask"), {
            y: 0,
            stagger: isCategoryTitle ? 0.1 : 0.035,
            duration: isCategoryTitle ? 0.8 : 0.65,
            ease: "power4.out"
        });

        if (item.classList.contains("project-list-link")) {
            gsap.to(item, {
                "--project-line-top-scale": "100%",
                "--project-line-bottom-scale": isLastProjectLink(item) ? "100%" : "0%",
                duration: 0.75,
                ease: "expo.out"
            });
        }
    }
}

function scheduleProjectRevealCheck() {
    if (projectRevealCheckQueued) return;

    projectRevealCheckQueued = true;
    gsap.ticker.add(revealVisibleProjectItems, true);
}

function clearProjectScrollHover(shouldResetPreview = true) {
    if (!activeProjectHoverLink) return;

    const activeCategory = activeProjectHoverLink.closest(".project-category");
    activeProjectHoverLink.classList.remove("is-scroll-hover");
    activeProjectHoverLink = null;

    if (shouldResetPreview) {
        resetProjectPreviewImage(activeCategory);
    }
}

function syncProjectScrollHover() {
    projectHoverCheckQueued = false;

    if (!pointerPosition.active) {
        clearProjectScrollHover();
        return;
    }

    const elementAtPointer = document.elementFromPoint(pointerPosition.x, pointerPosition.y);
    const nextHoverLink = elementAtPointer ? elementAtPointer.closest(".project-list-link") : null;

    if (nextHoverLink === activeProjectHoverLink) return;

    clearProjectScrollHover(!nextHoverLink);

    if (nextHoverLink) {
        activeProjectHoverLink = nextHoverLink;
        activeProjectHoverLink.classList.add("is-scroll-hover");
        setProjectPreviewImage(activeProjectHoverLink);
    }
}

function scheduleProjectScrollHover() {
    if (projectHoverCheckQueued) return;

    projectHoverCheckQueued = true;
    gsap.ticker.add(syncProjectScrollHover, true);
}

document.addEventListener("pointermove", (event) => {
    pointerPosition.x = event.clientX;
    pointerPosition.y = event.clientY;
    pointerPosition.active = true;
    scheduleProjectScrollHover();
}, { passive: true });

document.addEventListener("pointerleave", () => {
    pointerPosition.active = false;
    clearProjectScrollHover();
});

function setProjectPreviewImage(link) {
    const category = link.closest(".project-category");
    const state = category ? projectPreviewStates.get(category) : null;
    const nextSrc = link.dataset.previewImage;
    const nextPosition = link.dataset.previewPosition || "50% 50%";
    const nextKey = `${nextSrc}|${nextPosition}`;

    if (!category || !state || !nextSrc) return;

    if (state.enteringImage) {
        state.enteringImage.remove();
        state.enteringImage = null;
    }

    if (state.tween) {
        state.tween.kill();
        state.tween = null;
    }

    if (nextKey === state.activeKey) return;

    const nextImage = document.createElement("img");
    nextImage.className = "project-preview-image is-entering";
    nextImage.src = nextSrc;
    nextImage.alt = "";
    nextImage.decoding = "async";
    nextImage.style.objectPosition = nextPosition;
    state.preview.appendChild(nextImage);
    state.enteringImage = nextImage;

    gsap.set(nextImage, {
        clipPath: "inset(100% 0% 0% 0%)",
        scale: 1.04
    });

    state.tween = gsap.timeline({
        onComplete: () => {
            state.activeImage.remove();
            nextImage.classList.remove("is-entering");
            nextImage.classList.add("is-active");
            gsap.set(nextImage, { clearProps: "clipPath,scale" });
            state.activeImage = nextImage;
            state.activeSrc = nextSrc;
            state.activeKey = nextKey;
            state.enteringImage = null;
            state.tween = null;
        }
    });

    state.tween.to(nextImage, {
        clipPath: "inset(0% 0% 0% 0%)",
        scale: 1,
        duration: 0.16,
        ease: "power4.inOut"
    });
}

function resetProjectPreviewImage(category) {
    const firstLink = category ? category.querySelector(".project-list-link") : null;

    if (firstLink) {
        setProjectPreviewImage(firstLink);
    }
}

function initProjectPreviewImages() {
    const categories = gsap.utils.toArray(".project-category");

    categories.forEach((category, categoryIndex) => {
        const preview = category.querySelector(".project-category-preview");
        const activeImage = preview ? preview.querySelector(".project-preview-image") : null;
        const links = gsap.utils.toArray(category.querySelectorAll(".project-list-link"));
        const previewImages = projectPreviewImageSets[categoryIndex] || projectPreviewImageSets[0];

        if (!preview || !activeImage || !links.length) return;

        links.forEach((link, linkIndex) => {
            link.dataset.previewImage = previewImages[linkIndex % previewImages.length];
            link.dataset.previewPosition = projectPreviewPositions[(categoryIndex * 3 + linkIndex) % projectPreviewPositions.length];
            link.addEventListener("pointerenter", () => setProjectPreviewImage(link));
            link.addEventListener("focus", () => setProjectPreviewImage(link));
        });

        activeImage.src = links[0].dataset.previewImage;
        activeImage.style.objectPosition = links[0].dataset.previewPosition;
        projectPreviewStates.set(category, {
            preview,
            activeImage,
            activeSrc: activeImage.getAttribute("src"),
            activeKey: `${activeImage.getAttribute("src")}|${links[0].dataset.previewPosition}`,
            enteringImage: null,
            tween: null
        });

        category.addEventListener("pointerleave", () => resetProjectPreviewImage(category));
        category.addEventListener("focusout", (event) => {
            if (!category.contains(event.relatedTarget)) {
                resetProjectPreviewImage(category);
            }
        });
    });
}

initProjectPreviewImages();

function initStandaloneProjectCursorPreview() {
    const preview = document.querySelector(".link-project-cursor-preview");
    const previewImage = preview ? preview.querySelector("img") : null;
    const links = gsap.utils.toArray(".link-project-item");

    if (!preview || !previewImage || !links.length) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let frame;

    function renderPreview() {
        currentX += (targetX - currentX) * 0.22;
        currentY += (targetY - currentY) * 0.22;

        preview.style.left = `${currentX}px`;
        preview.style.top = `${currentY}px`;

        if (preview.classList.contains("is-visible")) {
            frame = requestAnimationFrame(renderPreview);
            return;
        }

        frame = null;
    }

    function startPreview(event, link) {
        const src = link.dataset.previewImage;

        if (src && previewImage.src !== src) {
            previewImage.src = src;
        }

        targetX = event.clientX + 28;
        targetY = event.clientY;
        currentX = targetX;
        currentY = targetY;
        preview.style.left = `${currentX}px`;
        preview.style.top = `${currentY}px`;
        preview.classList.add("is-visible");

        if (!frame) {
            frame = requestAnimationFrame(renderPreview);
        }
    }

    function movePreview(event) {
        targetX = event.clientX + 28;
        targetY = event.clientY;
    }

    function stopPreview() {
        preview.classList.remove("is-visible");
    }

    links.forEach((link) => {
        link.addEventListener("pointerenter", (event) => startPreview(event, link));
        link.addEventListener("pointermove", movePreview);
        link.addEventListener("pointerleave", stopPreview);
        link.addEventListener("focus", (event) => {
            const rect = link.getBoundingClientRect();
            startPreview({
                clientX: rect.right,
                clientY: rect.top + rect.height / 2
            }, link);
        });
        link.addEventListener("blur", stopPreview);
    });
}

initStandaloneProjectCursorPreview();

function initServiceImageCursor() {
    const supportsFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    if (!supportsFinePointer) return;

    const cursor = document.createElement("div");
    cursor.className = "service-image-cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML = `
        <svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.144 9.444v1.11H18.66L9.393 19.821a0.555 0.555 0 1 0 0.786 0.786L19.443 11.34v6.516h1.11V9.444z" />
        </svg>
    `;
    document.body.appendChild(cursor);

    let activeTarget = null;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let animationFrame = null;

    function isServiceCardImage(element) {
        return Boolean(element && element.closest(".panel") && element.matches(".card-img-unified"));
    }

    function renderCursor() {
        currentX += (targetX - currentX) * 0.2;
        currentY += (targetY - currentY) * 0.2;

        cursor.style.setProperty("--cursor-x", `${currentX}px`);
        cursor.style.setProperty("--cursor-y", `${currentY}px`);

        if (activeTarget) {
            animationFrame = requestAnimationFrame(renderCursor);
            return;
        }

        animationFrame = null;
    }

    function showCursor(event, target) {
        activeTarget = target;
        targetX = event.clientX;
        targetY = event.clientY;
        currentX = targetX;
        currentY = targetY;
        cursor.style.setProperty("--cursor-x", `${currentX}px`);
        cursor.style.setProperty("--cursor-y", `${currentY}px`);
        cursor.classList.add("is-visible");

        if (!animationFrame) {
            animationFrame = requestAnimationFrame(renderCursor);
        }
    }

    function hideCursor() {
        activeTarget = null;
        cursor.classList.remove("is-visible");
    }

    // Delegate pointer events so all current and future service card images share one cursor.
    document.addEventListener("pointerover", (event) => {
        const target = event.target.closest && event.target.closest(".card-img-unified");

        if (!isServiceCardImage(target)) return;

        showCursor(event, target);
    });

    document.addEventListener("pointermove", (event) => {
        if (!activeTarget) return;

        targetX = event.clientX;
        targetY = event.clientY;
    }, { passive: true });

    document.addEventListener("pointerout", (event) => {
        if (!activeTarget) return;

        const nextTarget = event.relatedTarget;

        if (nextTarget && activeTarget.contains(nextTarget)) return;

        hideCursor();
    });

    window.addEventListener("blur", hideCursor);
}

initServiceImageCursor();

function initProjectsShowcaseDragCursor() {
    const supportsFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    if (!supportsFinePointer || document.querySelector(".projects-showcase-drag-cursor")) return;

    const cursor = document.createElement("div");
    cursor.className = "projects-showcase-drag-cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML = `
        <i class="fa-light fa-arrows-left-right" aria-hidden="true">
            <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 8 4 16l7 8" />
                <path d="M21 8l7 8-7 8" />
                <path d="M5 16h22" />
            </svg>
        </i>
    `;
    document.body.appendChild(cursor);

    let activeTarget = null;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let animationFrame = null;
    let isPointerDown = false;

    function isProjectShowcaseImage(element) {
        return Boolean(
            element &&
            element.matches(".projects-showcase-img") &&
            (element.closest(".projects-showcase-items") || element.closest(".projects-showcase-item-clone"))
        );
    }

    function renderCursor() {
        currentX += (targetX - currentX) * 0.2;
        currentY += (targetY - currentY) * 0.2;

        cursor.style.setProperty("--cursor-x", `${currentX}px`);
        cursor.style.setProperty("--cursor-y", `${currentY}px`);

        if (activeTarget) {
            animationFrame = requestAnimationFrame(renderCursor);
            return;
        }

        animationFrame = null;
    }

    function showCursor(event, target) {
        activeTarget = target;
        targetX = event.clientX;
        targetY = event.clientY;
        currentX = targetX;
        currentY = targetY;
        cursor.style.setProperty("--cursor-x", `${currentX}px`);
        cursor.style.setProperty("--cursor-y", `${currentY}px`);
        cursor.classList.add("is-visible");

        if (!animationFrame) {
            animationFrame = requestAnimationFrame(renderCursor);
        }
    }

    function hideCursor() {
        activeTarget = null;
        isPointerDown = false;
        cursor.classList.remove("is-visible", "is-dragging");
    }

    document.addEventListener("pointerover", (event) => {
        const target = event.target.closest && event.target.closest(".projects-showcase-img");

        if (!isProjectShowcaseImage(target)) return;

        showCursor(event, target);
    });

    document.addEventListener("pointermove", (event) => {
        if (!activeTarget) return;

        targetX = event.clientX;
        targetY = event.clientY;
    }, { passive: true });

    document.addEventListener("pointerout", (event) => {
        if (!activeTarget) return;
        if (isPointerDown) return;

        const nextTarget = event.relatedTarget;

        if (nextTarget && (activeTarget.contains(nextTarget) || isProjectShowcaseImage(nextTarget.closest && nextTarget.closest(".projects-showcase-img")))) return;

        hideCursor();
    });

    document.addEventListener("pointerdown", (event) => {
        if (!activeTarget || event.target.closest(".projects-showcase-img") !== activeTarget) return;

        isPointerDown = true;
        cursor.classList.add("is-dragging");
    });

    document.addEventListener("pointerup", () => {
        isPointerDown = false;
        cursor.classList.remove("is-dragging");

        const elementAtCursor = document.elementFromPoint(targetX, targetY);
        const nextTarget = elementAtCursor && elementAtCursor.closest ? elementAtCursor.closest(".projects-showcase-img") : null;

        if (!isProjectShowcaseImage(nextTarget)) {
            hideCursor();
            return;
        }

        activeTarget = nextTarget;
    });

    document.addEventListener("pointercancel", hideCursor);
    window.addEventListener("blur", hideCursor);
}

initProjectsShowcaseDragCursor();

// 4. AUTOMATIC NAVBAR SWAP LOGIC
const navTl = gsap.timeline({ paused: true });
const navHideTl = gsap.timeline({ paused: true });

navTl.set(".logo-button, .menu-button", {
    opacity: 1,
    visibility: "visible",
    pointerEvents: "all"
})
    .set(".menu-button", {
        color: "#000000"
    })
    .set(".logo-button .char", {
        y: "140%"
    })
    .set(".menu-button", {
        scale: 0
    })
    .to(".logo-button .char", {
        y: 0,
        stagger: 0.05,
        duration: 0.6,
        ease: "power3.out"
    })
    .to(".menu-button",
        { scale: 1, duration: 0.5, ease: "power3.out" },
        "<"
    );

navHideTl.to(".logo-button .char", {
    y: "-140%",
    stagger: 0.035,
    duration: 0.45,
    ease: "power3.in"
})
    .to(".menu-button", {
        scale: 0,
        duration: 0.35,
        ease: "power3.in"
    }, "<")
    .set(".logo-button, .menu-button", {
        opacity: 0,
        visibility: "hidden",
        pointerEvents: "none"
    })
    .set(".logo-button .char", {
        y: "140%"
    });

let masterTl;
let aboutStartTime = null;
let navIsRevealed = false;
const navRevealTime = 1;
const logoButton = document.querySelector(".logo-button");

function getIntersectionRect(rectA, rectB) {
    const left = Math.max(rectA.left, rectB.left);
    const right = Math.min(rectA.right, rectB.right);
    const top = Math.max(rectA.top, rectB.top);
    const bottom = Math.min(rectA.bottom, rectB.bottom);

    if (right <= left || bottom <= top) return null;

    return { left, right, top, bottom };
}

function syncLogoContrast() {
    if (!logoButton) return;

    if (document.body.classList.contains("menu-active") || document.body.classList.contains("menu-mask-active")) {
        logoButton.style.color = "#ffffff";
        return;
    }

    const logoRect = logoButton.getBoundingClientRect();
    const probeX = logoRect.left + (logoRect.width / 2);
    const probeY = logoRect.top + (logoRect.height / 2);
    const elementsAtLogo = document.elementsFromPoint(probeX, probeY);
    let backgroundColor = window.getComputedStyle(document.body).backgroundColor;

    if (elementsAtLogo.some(element => element.closest && element.closest(".masking-overlay-card-about"))) {
        logoButton.style.color = "#000000";
        return;
    }

    for (const element of elementsAtLogo) {
        if (!element.closest || element.closest(".navbar")) continue;

        const computedColor = window.getComputedStyle(element).backgroundColor;
        const match = computedColor.match(/rgba?\(([^)]+)\)/);

        if (!match) continue;

        const colorParts = match[1].split(",").map(value => parseFloat(value.trim()));
        const alpha = colorParts.length > 3 ? colorParts[3] : 1;

        if (alpha > 0.08) {
            backgroundColor = computedColor;
            break;
        }
    }

    const match = backgroundColor.match(/rgba?\(([^)]+)\)/);

    if (!match) {
        logoButton.style.color = "#ffffff";
        return;
    }

    const [red, green, blue] = match[1].split(",").map(value => parseFloat(value.trim()));
    const luminance = ((0.2126 * red) + (0.7152 * green) + (0.0722 * blue)) / 255;

    logoButton.style.color = luminance > 0.72 ? "#000000" : "#ffffff";
}

function revealNav() {
    navHideTl.pause(0);
    gsap.set(".logo-button, .menu-button", {
        opacity: 1,
        visibility: "visible",
        pointerEvents: "all"
    });
    navTl.restart(true, false);
    navIsRevealed = true;
    syncLogoContrast();
}

function hideNav() {
    navTl.pause();
    navHideTl.invalidate().restart();
    navIsRevealed = false;
}

function syncNavState() {
    if (!isIndexPage) {
        navTl.pause();
        navHideTl.pause();
        gsap.set(".logo-button, .menu-button", {
            opacity: 1,
            visibility: "visible",
            pointerEvents: "all"
        });
        gsap.set(".logo-button .char", { y: 0 });
        gsap.set(".menu-button", { scale: 1 });
        navIsRevealed = true;
        syncLogoContrast();
        return;
    }

    if (!pageIsReady) return;
    if (!masterTl) return;

    const shouldRevealNav = masterTl.time() >= navRevealTime - 0.001;

    if (shouldRevealNav && !navIsRevealed) {
        revealNav();
    } else if (!shouldRevealNav && navIsRevealed) {
        hideNav();
    }

    syncLogoContrast();
}

function syncApproachLayerState({ useScrollPosition = false, forceAboutVisible = false } = {}) {
    if (!masterTl || !Number.isFinite(aboutStartTime)) return;

    const trigger = masterTl.scrollTrigger;
    const timelineDuration = masterTl.duration();
    const currentTimelineTime = useScrollPosition && trigger && trigger.end > trigger.start && timelineDuration
        ? timelineDuration * gsap.utils.clamp(0, 1, ((typeof trigger.scroll === "function" ? trigger.scroll() : window.scrollY) - trigger.start) / (trigger.end - trigger.start))
        : masterTl.time();
    const isAboutFullyInView = currentTimelineTime >= aboutStartTime + aboutTransitionDuration - 0.001;

    gsap.set(".approach-card", {
        autoAlpha: isAboutFullyInView ? 0 : 1,
        pointerEvents: isAboutFullyInView ? "none" : "auto"
    });

    gsap.set(approachStepCards, {
        autoAlpha: 1,
        pointerEvents: "auto"
    });

    if (forceAboutVisible && isAboutFullyInView) {
        gsap.set(".masking-overlay-card-about", {
            y: 0,
            yPercent: 0
        });
    }
}

masterTl = gsap.timeline({
    scrollTrigger: {
        trigger: ".scroll-container",
        start: "top top",
        end: () => `+=${(panels.length + projectTransitionDuration + overlayHoldDuration + overlayReadDuration + approachTransitionDuration + approachHoldDuration + approachMaskDuration + approachReadDuration + aboutTransitionDuration + aboutHoldDuration + aboutReadDuration + contactTransitionDuration + footerRevealDuration) * scrollSpeed}%`,
        scrub: 1,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: () => {
            syncNavState();
            syncApproachLayerState();
            syncApproachMasks();
            scheduleProjectRevealCheck();
            scheduleProjectScrollHover();
        },
        onRefresh: () => {
            gsap.set(".approach-steps", { y: 0 });
            gsap.set(approachStepCards, { x: 0, xPercent: 0, z: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1, zIndex: (index) => index + 1, force3D: true, borderTopLeftRadius: "0px", borderBottomLeftRadius: "0px", transformPerspective: 1200 });
            gsap.set(approachStepCards.slice(1), { y: getViewportHeight(), yPercent: 0 });
            gsap.set(".masking-overlay-card-about", { y: getViewportHeight(), yPercent: 0 });
            gsap.set(".about-section-inner", { y: 0 });
            gsap.set(".contact-card", { x: getViewportWidth(), xPercent: 0 });
            gsap.set(".site-footer", { y: 0, autoAlpha: isIndexPage ? 0 : 1 });
            syncNavState();
            syncApproachLayerState({ useScrollPosition: true, forceAboutVisible: true });
            syncApproachMasks();
            resetProjectRevealItems();
            scheduleProjectRevealCheck();
            scheduleProjectScrollHover();
        }
    }
});

panels.forEach((panel, i) => {
    const content = panel.querySelector(".reveal-content");
    const revealChars = panel.querySelectorAll('.char');
    const hrLine = panel.querySelector('hr');
    const svgIcon = panel.querySelector('.icon-btn svg');

    let cardTl = gsap.timeline({ paused: true });

    cardTl.to(content, { opacity: 1, visibility: "visible", y: 0, duration: 0.4 })
        .to(panel.querySelectorAll('.card-title .char'), { y: 0, stagger: 0.015, duration: 0.6, ease: "power3.out" }, "-=0.2")
        .to(panel.querySelectorAll('.card-desc .line-mask'), { y: 0, stagger: 0.1, duration: 0.6, ease: "power3.out" }, "-=0.4")
        .to(hrLine, { scaleX: 1, opacity: 1, duration: 0.6, ease: "expo.out" }, "-=0.4")
        .to(svgIcon, { scale: 1, rotate: 0, opacity: 1, duration: 0.5, ease: "back.out(1.7)" }, "-=0.5");
    serviceCardRevealTimelines.set(panel, cardTl);

    if (i === 0) {
        masterTl.to(hero, { xPercent: -100, ease: "none", duration: 1 }, i);
        masterTl.to(panels.slice(1), {
            x: "100vw",
            borderTopLeftRadius: "0px",
            borderBottomLeftRadius: "0px",
            ease: "none",
            duration: 1
        }, i);

        // Slide nav-links out to the left simultaneously with the hero
        masterTl.to(".nav-links", { x: "-100vw", ease: "none", duration: 1 }, i);

    } else {
        masterTl.to(panels[i - 1], { xPercent: -100, ease: "none", duration: 1 }, i);
    }

    let prevProgress = 0;
    let isRevealed = false;

    masterTl.to(panel, {
        x: "0%",
        borderTopLeftRadius: "0px",
        borderBottomLeftRadius: "0px",
        ease: "none",
        duration: 1,
        onUpdate: function () {
            const progress = this.progress();

            if (mobileServiceCardQuery.matches) {
                prevProgress = progress;
                return;
            }

            const scrollingDown = progress > prevProgress;
            const scrollingUp = progress < prevProgress;

            // 1. Reveal content when scrolling down and 20% of the card is visible (progress >= 0.20)
            if (scrollingDown && progress >= 0.20 && !isRevealed) {
                cardTl.play();
                isRevealed = true;
            }
            // 2. Hide content when scrolling back up and more than 50% is hidden (progress <= 0.50)
            else if (scrollingUp && progress <= 0.90 && isRevealed) {
                cardTl.reverse();
                isRevealed = false;
            }

            prevProgress = progress;

        }
    }, i);
});

function initMobileServiceCardRevealObserver() {
    const serviceCards = panels.slice();
    let observer = null;
    let isActive = false;

    function setCardHidden(panel) {
        const content = panel.querySelector(".reveal-content");
        const titleChars = panel.querySelectorAll(".card-title .char");
        const descMasks = panel.querySelectorAll(".card-desc .line-mask");
        const divider = panel.querySelector(".card-info hr");
        const iconSvg = panel.querySelector(".icon-btn svg");

        const timeline = serviceCardRevealTimelines.get(panel);
        if (timeline) {
            timeline.pause(0);
        }

        gsap.set(content, { autoAlpha: 0, y: 20 });
        gsap.set(titleChars, { y: "140%" });
        gsap.set(descMasks, { y: "140%" });
        gsap.set(divider, { scaleX: 0, opacity: 0, transformOrigin: "left" });
        gsap.set(iconSvg, { scale: 0, rotate: -45, opacity: 0 });
    }

    function activate() {
        if (isActive) return;
        isActive = true;

        serviceCards.forEach(setCardHidden);

        if (!("IntersectionObserver" in window)) {
            serviceCards.forEach(panel => serviceCardRevealTimelines.get(panel)?.progress(1).pause());
            return;
        }

        observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const timeline = serviceCardRevealTimelines.get(entry.target);
                if (!timeline) return;

                if (entry.isIntersecting && entry.intersectionRatio >= 0.24) {
                    timeline.play();
                } else if (entry.boundingClientRect.top > 0) {
                    timeline.reverse();
                }
            });
        }, {
            threshold: [0, 0.24, 0.5, 0.75],
            rootMargin: "0px 0px -14% 0px"
        });

        serviceCards.forEach(panel => observer.observe(panel));
    }

    function deactivate() {
        if (!isActive) return;
        isActive = false;

        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    function sync() {
        if (mobileServiceCardQuery.matches) {
            activate();
        } else {
            deactivate();
        }
    }

    sync();

    if (mobileServiceCardQuery.addEventListener) {
        mobileServiceCardQuery.addEventListener("change", sync);
    } else if (mobileServiceCardQuery.addListener) {
        mobileServiceCardQuery.addListener(sync);
    }
}

initMobileServiceCardRevealObserver();

function initMobileServiceCardRadiusSync() {
    const serviceCards = panels.slice();
    const scrollContainer = document.querySelector(".scroll-container");
    let isActive = false;
    let ticking = false;

    function setRadiusForScrollPosition() {
        ticking = false;

        if (!mobileServiceCardQuery.matches) return;

        const viewportHeight = getViewportHeight();
        const flattenStart = viewportHeight;
        const flattenEnd = viewportHeight * 0.5;
        const maxRadius = 28;

        serviceCards.forEach((panel) => {
            const rect = panel.getBoundingClientRect();
            const progress = gsap.utils.clamp(0, 1, (flattenStart - rect.top) / (flattenStart - flattenEnd));
            const radius = Math.round((maxRadius * (1 - progress)) * 100) / 100;
            const peekOpacity = Math.round((1 - progress) * 100) / 100;

            panel.style.setProperty("--mobile-service-card-radius", `${radius}px`);
            panel.style.setProperty("--mobile-service-card-peek-opacity", `${peekOpacity}`);
        });
    }

    function requestSync() {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(setRadiusForScrollPosition);
    }

    function activate() {
        if (isActive) return;
        isActive = true;
        setRadiusForScrollPosition();
        window.addEventListener("scroll", requestSync, { passive: true });
        scrollContainer?.addEventListener("scroll", requestSync, { passive: true });
        window.addEventListener("resize", requestSync);
        window.addEventListener("orientationchange", requestSync);
    }

    function deactivate() {
        if (!isActive) return;
        isActive = false;
        ticking = false;
        window.removeEventListener("scroll", requestSync);
        scrollContainer?.removeEventListener("scroll", requestSync);
        window.removeEventListener("resize", requestSync);
        window.removeEventListener("orientationchange", requestSync);
        serviceCards.forEach((panel) => {
            panel.style.removeProperty("--mobile-service-card-radius");
            panel.style.removeProperty("--mobile-service-card-peek-opacity");
        });
    }

    function sync() {
        if (mobileServiceCardQuery.matches) {
            activate();
        } else {
            deactivate();
        }
    }

    sync();

    if (mobileServiceCardQuery.addEventListener) {
        mobileServiceCardQuery.addEventListener("change", sync);
    } else if (mobileServiceCardQuery.addListener) {
        mobileServiceCardQuery.addListener(sync);
    }
}

initMobileServiceCardRadiusSync();

masterTl.fromTo(".masking-overlay-card", {
    y: () => getViewportHeight(),
    yPercent: 0
}, {
    y: () => getArchitectureCardImageBottomEdge(),
    yPercent: 0,
    ease: "none",
    duration: projectMeetDuration
}, panels.length);

masterTl.to(".service-card-architecture", {
    y: () => -getArchitectureCardImageBottomEdge(),
    ease: "none",
    duration: projectPushDuration
}, panels.length + projectMeetDuration);

masterTl.fromTo(".masking-overlay-card", {
    y: () => getArchitectureCardImageBottomEdge(),
    yPercent: 0
}, {
    y: 0,
    yPercent: 0,
    ease: "none",
    duration: projectPushDuration,
    onUpdate: function () {
        const progress = this.progress();

        if (progress >= 0.9 && !overlayTextRevealed) {
            overlayTextTl.play();
            overlayTextRevealed = true;
            scheduleProjectRevealCheck();
        } else if (progress < 0.45 && overlayTextRevealed) {
            overlayTextTl.reverse();
            overlayTextRevealed = false;
            resetProjectRevealItems();
        }
    }
}, panels.length + projectMeetDuration);

if (overlayHoldDuration > 0) {
    masterTl.to({}, {
        duration: overlayHoldDuration
    }, panels.length + projectTransitionDuration);
}

if (overlayReadDuration > 0) {
    masterTl.to(".masking-overlay-card > *", {
        y: () => getOverlayMetrics().endY,
        ease: "none",
        duration: overlayReadDuration,
        onUpdate: () => {
            scheduleProjectRevealCheck();
            scheduleProjectScrollHover();
        }
    }, panels.length + projectTransitionDuration + overlayHoldDuration);
}

const approachStartTime = panels.length + projectTransitionDuration + overlayHoldDuration + overlayReadDuration;

masterTl.fromTo(".approach-card", {
    x: () => getViewportWidth(),
    xPercent: 0
}, {
    x: () => getArchitectureImageRightEdge(),
    xPercent: 0,
    ease: "none",
    duration: approachMeetDuration,
    onStart: () => {
        setApproachScrollable(false);
    },
    onUpdate: function () {
        const progress = this.progress();

        if (progress > 0.05) {
            clearProjectScrollHover(false);
        }
    }
}, approachStartTime);

masterTl.to(".masking-overlay-card", {
    x: () => -getArchitectureImageRightEdge(),
    xPercent: 0,
    ease: "none",
    duration: approachPushDuration
}, approachStartTime + approachMeetDuration);

masterTl.fromTo(".approach-card", {
    x: () => getArchitectureImageRightEdge(),
    xPercent: 0
}, {
    x: 0,
    xPercent: 0,
    ease: "none",
    duration: approachPushDuration,
    onUpdate: function () {
        const progress = this.progress();

        if (progress >= 0.98 && !approachTextRevealed) {
            approachTextTl.play();
            approachTextRevealed = true;
            setApproachScrollable(false);
        } else if (progress < 0.85 && approachTextRevealed) {
            setApproachScrollable(false);
            approachTextTl.reverse();
            approachTextRevealed = false;
        }
    }
}, approachStartTime + approachMeetDuration);

if (approachHoldDuration > 0) {
    masterTl.to({}, {
        duration: approachHoldDuration
    }, approachStartTime + approachTransitionDuration);
}

const approachMaskStartTime = approachStartTime + approachTransitionDuration + approachHoldDuration;

masterTl.to(".approach-articles-mask", {
    y: () => getApproachPanelMetrics().lineY,
    yPercent: 0,
    ease: "none",
    duration: approachMaskMeetDuration,
    onUpdate: syncApproachMasks
}, approachMaskStartTime);

masterTl.to(".approach-articles-mask", {
    y: () => getApproachPanelMetrics().coverY,
    yPercent: 0,
    ease: "none",
    duration: approachMaskPushDuration,
    onUpdate: syncApproachMasks
}, approachMaskStartTime + approachMaskMeetDuration);

masterTl.to(approachPushedContentSelector, {
    y: () => getApproachPanelMetrics().pushY,
    ease: "none",
    duration: approachMaskPushDuration,
    onUpdate: syncApproachMasks
}, approachMaskStartTime + approachMaskMeetDuration);

const approachFoldStartTime = approachMaskStartTime + approachMaskDuration;

masterTl.to(approachIntroLayerSelector, {
    autoAlpha: 0,
    duration: approachIntroFadeDuration,
    ease: "none",
    onUpdate: syncApproachMasks
}, approachFoldStartTime);

masterTl.to(".approach-steps", {
    y: 0,
    ease: "none",
    duration: approachDiscoverPushDuration
}, approachFoldStartTime);

approachStepCards.slice(1).forEach((step, index) => {
    const stepIndex = index + 1;

    masterTl.fromTo(step, {
        y: () => getViewportHeight(),
        yPercent: 0
    }, {
        y: () => stepIndex * getApproachStepFoldOffset(),
        yPercent: 0,
        ease: "none",
        duration: approachStepFoldDuration
    }, approachFoldStartTime + approachDiscoverPushDuration + (index * approachStepFoldDuration));
});

const approachDeckStartTime = approachFoldStartTime + approachDiscoverPushDuration + approachStepFoldTotalDuration;

approachStepCards.forEach((step, index) => {
    const deckStartTime = approachDeckStartTime + (index * approachDeckStagger);

    masterTl.to(step, {
        x: () => isPhoneViewport() ? 0 : getApproachDeckX(index),
        y: () => isPhoneViewport() ? 0 : 0,
        yPercent: 0,
        z: 0,
        rotateX: 0,
        rotateY: 0,
        rotateZ: 0,
        scale: 1,
        zIndex: index + 2,
        force3D: true,
        borderTopLeftRadius: () => isPhoneViewport() ? "0px" : getApproachDeckRadius(),
        borderBottomLeftRadius: () => isPhoneViewport() ? "0px" : getApproachDeckRadius(),
        ease: "power2.inOut",
        duration: approachDeckDuration
    }, deckStartTime);
});

const approachHorizontalStartTime = approachDeckStartTime + approachDeckTotalDuration;

masterTl.to(approachStepCards.slice(1), {
    x: 0,
    xPercent: () => isPhoneViewport() ? 0 : 100,
    y: () => isPhoneViewport() ? getViewportHeight() : 0,
    yPercent: 0,
    z: 0,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    scale: 1,
    force3D: true,
    borderTopLeftRadius: "0px",
    borderBottomLeftRadius: "0px",
    ease: "none",
    duration: approachStepHorizontalDuration
}, approachHorizontalStartTime);

approachStepCards.forEach((step, index) => {
    const cardScrollTime = approachHorizontalStartTime + (index * approachStepHorizontalDuration);

    if (index > 0) {
        masterTl.to(approachStepCards[index - 1], isPhoneViewport()
            ? {
                yPercent: -100,
                y: approachStepOverlap,
                force3D: true,
                ease: "none",
                duration: approachStepHorizontalDuration
            }
            : {
                xPercent: -100,
                x: approachStepOverlap,
                force3D: true,
                ease: "none",
                duration: approachStepHorizontalDuration
            }, cardScrollTime);
    }

    masterTl.to(step, {
        x: 0,
        xPercent: 0,
        y: 0,
        yPercent: 0,
        z: 0,
        rotateX: 0,
        rotateY: 0,
        rotateZ: 0,
        scale: 1,
        force3D: true,
        borderTopLeftRadius: "0px",
        borderBottomLeftRadius: "0px",
        ease: "none",
        duration: approachStepHorizontalDuration
    }, cardScrollTime);

    masterTl.to(step.querySelectorAll(".approach-step-copy .line-mask"), {
        y: 0,
        stagger: 0.08,
        ease: "power3.out",
        duration: 0.42
    }, cardScrollTime + 0.18);
});

aboutStartTime = approachHorizontalStartTime + approachStepHorizontalTotalDuration;

masterTl.fromTo(".masking-overlay-card-about", {
    y: () => getViewportHeight(),
    yPercent: 0
}, {
    y: 0,
    yPercent: 0,
    ease: "none",
    duration: aboutTransitionDuration,
    onUpdate: function () {
        const progress = this.progress();

        if (progress >= 0.9 && !aboutTextRevealed) {
            aboutTextTl.play();
            aboutTextRevealed = true;
        } else if (progress < 0.45 && aboutTextRevealed) {
            aboutTextTl.reverse();
            aboutTextRevealed = false;
        }
    }
}, aboutStartTime);

if (aboutHoldDuration > 0) {
    masterTl.to({}, {
        duration: aboutHoldDuration
    }, aboutStartTime + aboutTransitionDuration);
}

if (aboutReadDuration > 0) {
    masterTl.to(".about-laptop-services-word .line-mask", {
        y: 0,
        stagger: 0.08,
        duration: Math.min(0.8, aboutReadDuration * 0.42),
        ease: "power4.out"
    }, aboutStartTime + aboutTransitionDuration + aboutHoldDuration + (aboutReadDuration * 0.34));

    masterTl.to(".about-section-link .line-mask", {
        y: 0,
        stagger: 0.055,
        duration: Math.min(0.65, aboutReadDuration * 0.34),
        ease: "power4.out"
    }, aboutStartTime + aboutTransitionDuration + aboutHoldDuration + (aboutReadDuration * 0.48));

    masterTl.to(".about-section-inner", {
        y: () => getAboutMetrics().endY,
        ease: "none",
        duration: aboutReadDuration
    }, aboutStartTime + aboutTransitionDuration + aboutHoldDuration);
}

const contactStartTime = aboutStartTime + aboutTransitionDuration + aboutHoldDuration + aboutReadDuration;

masterTl.fromTo(".contact-card", {
    x: () => getViewportWidth(),
    xPercent: 0
}, {
    x: 0,
    xPercent: 0,
    ease: "none",
    duration: contactTransitionDuration,
    onUpdate: function () {
        const progress = this.progress();

        if (progress >= 0.86 && !contactTextRevealed) {
            contactTextTl.play();
            contactTextRevealed = true;
        } else if (progress < 0.45 && contactTextRevealed) {
            contactTextTl.reverse();
            contactTextRevealed = false;
        }
    }
}, contactStartTime);

masterTl.set(".site-footer", {
    autoAlpha: 1
}, contactStartTime + contactTransitionDuration);

masterTl.to(".contact-card", {
    y: () => -(getViewportHeight() * 0.78),
    ease: "none",
    duration: footerRevealDuration
}, contactStartTime + contactTransitionDuration);

function prepareNaturalWebCardHashLanding() {
    const panel = document.querySelector(".service-card-web-dev");

    gsap.set(".panel:not(.hero-section)", { yPercent: 0 });
    gsap.set(".nav-links .char, .hero-title .char, .highlight-container .char, .bottom-logo .char", { y: 0 });
    gsap.set(".hero-description .line-mask", { y: 0 });
    gsap.set(".hero-line", {
        scaleX: 1,
        transformOrigin: "left"
    });
    document.querySelector(".highlight-container")?.classList.add("active");

    if (!panel) return;

    panel.classList.remove("is-service-transitioning");
    gsap.set(panel, {
        clearProps: "position,left,top,width,height,margin,zIndex,pointerEvents,borderTopLeftRadius,borderTopRightRadius,borderBottomLeftRadius,borderBottomRightRadius"
    });
}

function playWebDevCardReturnTransition(webPanel) {
    const content = webPanel ? webPanel.querySelector(".reveal-content") : null;
    const image = webPanel ? webPanel.querySelector(".card-img-unified") : null;
    const info = webPanel ? webPanel.querySelector(".card-info") : null;
    const descMasks = info ? info.querySelectorAll(".card-desc .line-mask") : [];
    const titleChars = info ? info.querySelectorAll(".card-title .char") : [];
    const divider = info ? info.querySelector("hr") : null;
    const iconSvg = info ? info.querySelector(".icon-btn svg") : null;

    if (!webPanel || !content || !image || !info) return;

    const transitionImage = getWebDevReverseTransitionImage(image);

    gsap.killTweensOf([content, image, info, info.children, descMasks, titleChars, divider, iconSvg, transitionImage]);
    webPanel.classList.add("is-service-transitioning");
    gsap.set(webPanel, {
        x: 0,
        xPercent: 0,
        y: 0,
        yPercent: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0
    });

    // Start the home page exactly where the forward transition left it: card covers the view, image fills it.
    gsap.set(content, { gridTemplateRows: "100% 0%" });
    gsap.set(info, { yPercent: 112, autoAlpha: 1 });
    gsap.set(info.children, { y: 0, autoAlpha: 1 });
    gsap.set(descMasks, { y: "140%" });
    gsap.set(titleChars, { y: "140%" });
    gsap.set(divider, { scaleX: 0, opacity: 0, transformOrigin: "left" });
    gsap.set(iconSvg, { scale: 0, rotate: -45, opacity: 0 });
    gsap.set(image, { autoAlpha: 1 });
    gsap.set(transitionImage, {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        autoAlpha: 1
    });

    document.documentElement.classList.remove("is-webdev-reverse-return");
    document.documentElement.style.backgroundColor = "";
    try {
        window.history.replaceState(window.history.state, document.title, `${window.location.pathname}${window.location.search}`);
    } catch (error) {}

    const returnTl = gsap.timeline({
        defaults: { ease: "power3.inOut" },
        onComplete: () => {
            transitionImage.remove();
            applyWebDevCardFullViewScrollPosition();
            webPanel.classList.remove("is-service-transitioning");
            webPanel.classList.add("is-webdev-returned");
            gsap.set(webPanel, {
                x: 0,
                xPercent: 0,
                y: 0,
                yPercent: 0,
                width: window.innerWidth,
                height: window.innerHeight,
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0
            });
            gsap.set(content, { gridTemplateRows: "70% 30%", autoAlpha: 1, y: 0 });
            gsap.set(image, { autoAlpha: 1 });
            gsap.set(info, { yPercent: 0, autoAlpha: 1 });
            gsap.set(info.children, { y: 0, autoAlpha: 1 });
            gsap.set(descMasks, { y: 0 });
            gsap.set(titleChars, { y: 0 });
            gsap.set(divider, { scaleX: 1, opacity: 1, transformOrigin: "left" });
            gsap.set(iconSvg, { scale: 1, rotate: 0, opacity: 1 });
        }
    });

    // Phase 1: remove the fullscreen curtain in one frame after the real card image is ready behind it.
    returnTl
        .set(transitionImage, {
            autoAlpha: 0,
            onComplete: () => transitionImage.remove()
        }, 0.24);

    // Phase 2: slide the content back into place, letting the real image shrink with the card layout.
    returnTl
        .to(content, {
            gridTemplateRows: "70% 30%",
            duration: 0.86
        }, 0.42)
        .to(info, {
            yPercent: 0,
            duration: 0.78
        }, 0.48)
        .to(titleChars, {
            y: 0,
            stagger: 0.015,
            duration: 0.6,
            ease: "power3.out"
        }, 0.48)
        .to(descMasks, {
            y: 0,
            stagger: 0.1,
            duration: 0.6,
            ease: "power3.out"
        }, 0.5)
        .to(divider, {
            scaleX: 1,
            opacity: 1,
            duration: 0.6,
            ease: "expo.out"
        }, 0.56)
        .to(iconSvg, {
            scale: 1,
            rotate: 0,
            opacity: 1,
            duration: 0.5,
            ease: "back.out(1.7)"
        }, 0.64);
}

function applyWebDevCardFullViewScrollPosition() {
    if (!masterTl || !masterTl.scrollTrigger) return false;

    ScrollTrigger.refresh();

    const trigger = masterTl.scrollTrigger;
    const timelineDuration = masterTl.duration();
    const targetTime = 1;

    if (!timelineDuration) return false;

    const targetScroll = trigger.start + ((targetTime / timelineDuration) * (trigger.end - trigger.start));

    if (lenis) {
        lenis.resize();
        lenis.scrollTo(targetScroll, {
            immediate: true,
            force: true
        });
    }

    if (typeof trigger.scroll === "function") {
        trigger.scroll(targetScroll);
    }

    window.scrollTo(0, targetScroll);
    document.documentElement.scrollTop = targetScroll;
    document.body.scrollTop = targetScroll;
    ScrollTrigger.update();
    masterTl.time(targetTime, false);
    ScrollTrigger.update();
    syncNavState();

    return true;
}

function scrollToWebDevCardHashIfRequested() {
    if (!shouldLandOnWebDevCard || !masterTl || !masterTl.scrollTrigger) return;

    if (!applyWebDevCardFullViewScrollPosition()) return;

    prepareNaturalWebCardHashLanding();

    const webPanel = document.querySelector(".service-card-web-dev");
    const webRevealTl = webPanel ? serviceCardRevealTimelines.get(webPanel) : null;
    const finishLanding = () => {
        applyWebDevCardFullViewScrollPosition();

        if (shouldPlayWebDevReverseReturn) {
            if (webPanel && !webDevReverseReturnStarted) {
                webDevReverseReturnStarted = true;
                playWebDevCardReturnTransition(webPanel);
            } else if (!webPanel) {
                document.documentElement.classList.remove("is-webdev-reverse-return");
                document.documentElement.style.backgroundColor = "";
            }

            return;
        }

        if (webRevealTl) {
            webRevealTl.restart();
        }
    };

    if (shouldPlayWebDevReverseReturn) {
        requestAnimationFrame(() => {
            applyWebDevCardFullViewScrollPosition();
            requestAnimationFrame(finishLanding);
        });

        return;
    }

    finishLanding();
}

// 5. FULL-SCREEN MENU
const menuOverlay = document.querySelector(".menu-overlay");
const menuButton = document.querySelector(".menu-button");
const menuOverlayLinks = document.querySelectorAll(".menu-overlay-link");
const menuPlaceholderLinks = document.querySelectorAll('.menu-info-link[href="#"]');
const contactForm = document.querySelector(".contact-section-form, .link-contact-form");
const contactThankModal = document.querySelector(".contact-thank-modal");
const contactThankClose = document.querySelector(".contact-thank-close");

function openContactThankModal() {
    if (!contactThankModal) return;

    if (contactThankModal.parentElement !== document.body) {
        document.body.appendChild(contactThankModal);
    }

    contactThankModal.classList.add("is-open");
    contactThankModal.setAttribute("aria-hidden", "false");
    contactThankClose?.focus();
}

function closeContactThankModal() {
    if (!contactThankModal) return;

    contactThankModal.classList.remove("is-open");
    contactThankModal.setAttribute("aria-hidden", "true");
}

// Personal inbox that receives every form submission. FormSubmit.co delivers
// here with no monthly send limit. On the very first submission FormSubmit
// emails this address a one-time confirmation link — click it once and every
// future submission arrives automatically, forever.
const CONTACT_FORM_EMAIL = "erblinkasumaj0@gmail.com";

if (contactForm && contactThankModal) {
    const contactSubmitButton = contactForm.querySelector('button[type="submit"]');
    const contactSubmitDefaultText = contactSubmitButton?.querySelector("span")?.textContent || "Send";
    let contactErrorEl = null;
    let contactIsSending = false;

    function setContactError(message) {
        if (!message) {
            contactErrorEl?.remove();
            contactErrorEl = null;
            return;
        }
        if (!contactErrorEl) {
            contactErrorEl = document.createElement("p");
            contactErrorEl.className = "contact-form-error";
            contactErrorEl.setAttribute("role", "alert");
            contactForm.appendChild(contactErrorEl);
        }
        contactErrorEl.textContent = message;
    }

    function setContactButtonText(text) {
        if (!contactSubmitButton) return;
        const span = contactSubmitButton.querySelector("span");
        if (span) span.textContent = text;
        else contactSubmitButton.textContent = text;
    }

    contactForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (contactIsSending) return;

        // Native HTML5 validation (required fields + valid email format).
        if (!contactForm.checkValidity()) {
            contactForm.reportValidity();
            return;
        }

        setContactError("");
        contactIsSending = true;
        if (contactSubmitButton) contactSubmitButton.disabled = true;
        setContactButtonText("Sending…");

        try {
            const formData = new FormData(contactForm);
            // FormSubmit configuration fields.
            formData.append("_subject", "New Blueprint enquiry");
            formData.append("_template", "table");
            formData.append("_captcha", "false");

            const response = await fetch(
                "https://formsubmit.co/ajax/" + encodeURIComponent(CONTACT_FORM_EMAIL),
                {
                    method: "POST",
                    headers: { Accept: "application/json" },
                    body: formData
                }
            );

            const result = await response.json().catch(() => ({}));

            if (response.ok && (result.success === "true" || result.success === true)) {
                openContactThankModal();
                contactForm.reset();
            } else if (result.message && /activat/i.test(result.message)) {
                // One-time FormSubmit state before the inbox owner clicks the
                // "Activate Form" link. Surface it so it isn't mistaken for a failure.
                setContactError("Almost there — this form needs to be activated once. Please check your inbox for the activation link.");
            } else {
                throw new Error(result.message || "Request failed");
            }
        } catch (error) {
            setContactError("Sorry, something went wrong sending your message. Please try again or email us directly.");
        } finally {
            contactIsSending = false;
            if (contactSubmitButton) contactSubmitButton.disabled = false;
            setContactButtonText(contactSubmitDefaultText);
        }
    });

    contactThankClose?.addEventListener("click", closeContactThankModal);

    contactThankModal.addEventListener("click", (event) => {
        if (event.target === contactThankModal) {
            closeContactThankModal();
        }
    });
}

if (menuOverlay && menuButton) {
    let menuIsOpen = false;
    let menuCloseTimer;
    let menuCarouselIndex = 0;
    let menuCarouselTimer;
    let menuImageTween;
    const navbar = document.querySelector(".navbar");
    const menuImageFrame = document.querySelector(".menu-image-frame");
    const menuImage = document.querySelector(".menu-image");
    const menuIconTopLines = gsap.utils.toArray(".menu-icon-line-top");
    const menuIconBottomLines = gsap.utils.toArray(".menu-icon-line-bottom");
    const menuIconShape = { progress: 0 };
    const menuIconClosed = {
        top: { x1: 4, y1: 9.5, x2: 20, y2: 9.5 },
        bottom: { x1: 4, y1: 14.5, x2: 20, y2: 14.5 }
    };
    const menuIconOpen = {
        top: { x1: 6.35, y1: 6.35, x2: 17.65, y2: 17.65 },
        bottom: { x1: 17.65, y1: 6.35, x2: 6.35, y2: 17.65 }
    };

    const menuTl = gsap.timeline({
        paused: true,
        defaults: { ease: "power4.out" }
    });
    const menuMaskDirections = [
        {
            enterClip: "inset(100% 0% 0% 0%)",
            exitClip: "inset(0% 0% 100% 0%)",
            enterOffset: { xPercent: 0, yPercent: 8 },
            exitOffset: { xPercent: 0, yPercent: -8 }
        },
        {
            enterClip: "inset(0% 100% 0% 0%)",
            exitClip: "inset(0% 0% 0% 100%)",
            enterOffset: { xPercent: -8, yPercent: 0 },
            exitOffset: { xPercent: 8, yPercent: 0 }
        },
        {
            enterClip: "inset(0% 0% 100% 0%)",
            exitClip: "inset(100% 0% 0% 0%)",
            enterOffset: { xPercent: 0, yPercent: -8 },
            exitOffset: { xPercent: 0, yPercent: 8 }
        },
        {
            enterClip: "inset(0% 0% 0% 100%)",
            exitClip: "inset(0% 100% 0% 0%)",
            enterOffset: { xPercent: 8, yPercent: 0 },
            exitOffset: { xPercent: -8, yPercent: 0 }
        }
    ];

    function setMenuCarouselImage(index, shouldAnimate = true) {
        if (!menuImage || !menuCarouselImages.length) return;

        menuCarouselIndex = (index + menuCarouselImages.length) % menuCarouselImages.length;
        const nextSrc = menuCarouselImages[menuCarouselIndex];
        const nextPosition = projectPreviewPositions[menuCarouselIndex % projectPreviewPositions.length];
        const menuMask = menuMaskDirections[menuCarouselIndex % menuMaskDirections.length];

        if (!shouldAnimate) {
            gsap.set(menuImage, {
                attr: { src: nextSrc },
                objectPosition: nextPosition,
                clipPath: "inset(0% 0% 0% 0%)",
                opacity: 1,
                xPercent: 0,
                yPercent: 0
            });
            return;
        }

        if (menuImageTween) {
            menuImageTween.kill();
        }

        menuImageTween = gsap.timeline({
            onComplete: () => {
                menuImageTween = null;
            }
        });

        menuImageTween
            .to(menuImage, {
                clipPath: menuMask.exitClip,
                opacity: 0.2,
                xPercent: menuMask.exitOffset.xPercent,
                yPercent: menuMask.exitOffset.yPercent,
                duration: 0.35,
                ease: "power3.in"
            })
            .set(menuImage, {
                attr: { src: nextSrc },
                objectPosition: nextPosition,
                clipPath: menuMask.enterClip,
                xPercent: menuMask.enterOffset.xPercent,
                yPercent: menuMask.enterOffset.yPercent
            })
            .to(menuImage, {
                clipPath: "inset(0% 0% 0% 0%)",
                opacity: 1,
                xPercent: 0,
                yPercent: 0,
                duration: 0.55,
                ease: "power4.out"
            });
    }

    function startMenuCarousel() {
        if (!menuImageFrame || !menuImage || !menuCarouselImages.length) return;

        clearInterval(menuCarouselTimer);
        setMenuCarouselImage(menuCarouselIndex, false);
        menuCarouselTimer = setInterval(() => {
            setMenuCarouselImage(menuCarouselIndex + 1, true);
        }, 2300);
    }

    function stopMenuCarousel() {
        clearInterval(menuCarouselTimer);

        if (menuImageTween) {
            menuImageTween.kill();
            menuImageTween = null;
        }
    }

    function drawMenuIconLine(lines, closedAttrs, openAttrs) {
        const progress = menuIconShape.progress;

        lines.forEach(line => {
            Object.keys(closedAttrs).forEach(attr => {
                const value = gsap.utils.interpolate(closedAttrs[attr], openAttrs[attr], progress);
                line.setAttribute(attr, value.toFixed(3));
            });
        });
    }

    function renderMenuIcon() {
        drawMenuIconLine(menuIconTopLines, menuIconClosed.top, menuIconOpen.top);
        drawMenuIconLine(menuIconBottomLines, menuIconClosed.bottom, menuIconOpen.bottom);
    }

    function animateMenuIcon(isOpen) {
        gsap.killTweensOf(menuIconShape);
        gsap.to(menuIconShape, {
            progress: isOpen ? 1 : 0,
            duration: isOpen ? 0.42 : 0.36,
            ease: "expo.inOut",
            onUpdate: renderMenuIcon,
            onComplete: renderMenuIcon
        });
    }

    function getNavMaskValue(property) {
        const value = gsap.getProperty(navbar, property);
        const parsedValue = parseFloat(value);
        return Number.isFinite(parsedValue) ? parsedValue : 0;
    }

    function resetNavMask() {
        gsap.set(navbar, {
            "--nav-mask-top": "0%",
            "--nav-mask-bottom": "100%"
        });
    }

    function animateNavMask(isOpen) {
        if (!navbar) return;

        gsap.killTweensOf(navbar);

        if (isOpen) {
            gsap.to(navbar, {
                "--nav-mask-top": "0%",
                "--nav-mask-bottom": "0%",
                duration: 0.8,
                ease: "expo.inOut",
                overwrite: true
            });
            return;
        }

        const currentBottom = getNavMaskValue("--nav-mask-bottom");
        const hiddenTop = Math.max(0, Math.min(100, 100 - currentBottom));

        gsap.to(navbar, {
            "--nav-mask-top": `${hiddenTop}%`,
            duration: 0.8,
            ease: "expo.inOut",
            overwrite: true,
            onComplete: () => {
                if (!menuIsOpen) {
                    resetNavMask();
                }
            }
        });
    }

    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open menu");
    renderMenuIcon();

    menuTl
        .to(".menu-line-reveal > span", {
            y: 0,
            stagger: 0.08,
            duration: 0.8,
            ease: "power4.out"
        }, 0.35)
        .to(".menu-image-frame", {
            opacity: 1,
            y: 0,
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 0.8,
            ease: "power4.out"
        }, 0.4)
        .to(".menu-overlay-divider", {
            scaleX: 1,
            duration: 0.9,
            ease: "expo.out"
        }, 0.45)
        .to(".menu-overlay-blueprint .char", {
            y: 0,
            stagger: 0.035,
            duration: 0.8,
            ease: "power4.out"
        }, 0.55);

    function openMenu() {
        if (menuIsOpen) return;

        clearTimeout(menuCloseTimer);
        menuTl.pause(0);
        menuIsOpen = true;
        document.body.classList.add("menu-active");
        document.body.classList.add("menu-mask-active");
        syncLogoContrast();
        menuOverlay.classList.remove("is-reset");
        menuOverlay.classList.remove("is-closing");
        menuOverlay.classList.add("is-open");
        menuOverlay.setAttribute("aria-hidden", "false");
        menuButton.setAttribute("aria-expanded", "true");
        menuButton.setAttribute("aria-label", "Close menu");
        fitMenuBlueprintToDivider();
        animateMenuIcon(true);
        animateNavMask(true);
        startMenuCarousel();
        gsap.set(".menu-line-reveal > span", { y: "140%" });
        gsap.set(".menu-image-frame", { opacity: 0, y: 24, clipPath: "inset(100% 0% 0% 0%)" });
        gsap.set(".menu-overlay-divider", { scaleX: 0 });
        gsap.set(".menu-overlay-blueprint .char", { y: "-140%" });
        menuTl.restart();
    }

    function closeMenu() {
        if (!menuIsOpen) return;

        clearTimeout(menuCloseTimer);
        menuIsOpen = false;
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Open menu");
        stopMenuCarousel();
        animateMenuIcon(false);
        menuOverlay.classList.remove("is-open");
        menuOverlay.classList.add("is-closing");
        document.body.classList.remove("menu-active");
        animateNavMask(false);
        menuTl.reverse();

        menuCloseTimer = setTimeout(() => {
            menuTl.pause(0);
            gsap.set(".menu-line-reveal > span", { y: "140%" });
            gsap.set(".menu-image-frame", { opacity: 0, y: 24, clipPath: "inset(100% 0% 0% 0%)" });
            gsap.set(".menu-overlay-divider", { scaleX: 0 });
            gsap.set(".menu-overlay-blueprint .char", { y: "-140%" });
            document.body.classList.remove("menu-mask-active");
            menuOverlay.classList.add("is-reset");
            menuOverlay.classList.remove("is-closing");
            menuOverlay.setAttribute("aria-hidden", "true");
            syncLogoContrast();

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    menuOverlay.classList.remove("is-reset");
                    syncLogoContrast();
                });
            });
        }, 850);
    }

    menuButton.addEventListener("click", () => {
        if (menuIsOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    });
    menuOverlayLinks.forEach((link) => {
        link.addEventListener("click", closeMenu);
    });
    menuPlaceholderLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeContactThankModal();
            closeMenu();
        }
    });
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeContactThankModal();
    }
});
