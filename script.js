gsap.registerPlugin(ScrollTrigger);

let viewportRefreshTimer = null;
let lenis = null;

if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
}

ScrollTrigger.clearScrollMemory("manual");

function resetPageScroll() {
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

function syncScrollbarIndicator() {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = gsap.utils.clamp(0, 1, window.scrollY / maxScroll);
    const travel = scrollbarIndicator.clientHeight - scrollbarIndicatorThumb.clientHeight;

    scrollbarIndicatorThumb.style.transform = `translate3d(0, ${travel * progress}px, 0)`;
}

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
            ScrollTrigger.refresh();
            ScrollTrigger.update();
            syncScrollbarIndicator();
            syncApproachMasks();
        });
    });
}

function scheduleViewportDrivenLayoutRefresh() {
    window.clearTimeout(viewportRefreshTimer);
    viewportRefreshTimer = window.setTimeout(refreshViewportDrivenLayout, 120);
}

let pageIsReady = false;
const currentPageName = window.location.pathname.split("/").pop().toLowerCase();
const isIndexPage = currentPageName === "" || currentPageName === "index.html";
const shouldLandOnWebDevCard = isIndexPage && window.location.hash === "#webdev-card";
const linkLoaderStorageKey = "blueprintUseLinkLoader";
const serviceDirectNavigationStorageKey = "blueprintServiceDirectNavigation";
let shouldUseLinkLoader = false;
let shouldSkipIncomingLoader = false;

try {
    shouldUseLinkLoader = sessionStorage.getItem(linkLoaderStorageKey) === "true";
    shouldSkipIncomingLoader = sessionStorage.getItem(serviceDirectNavigationStorageKey) === "true";
    sessionStorage.removeItem(linkLoaderStorageKey);
    sessionStorage.removeItem(serviceDirectNavigationStorageKey);
} catch (error) {
    shouldUseLinkLoader = false;
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
            window.location.href = url;
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

function navigateDirectlyToService(url) {
    try {
        sessionStorage.setItem(serviceDirectNavigationStorageKey, "true");
    } catch (error) {
        // The transition still works when session storage is unavailable.
    }

    window.location.href = url;
}

function playServiceCardExit(clickedBtn, url) {
    const panel = clickedBtn.closest(".panel");
    const content = panel ? panel.querySelector(".reveal-content") : null;
    const image = panel ? panel.querySelector(".card-img-unified") : null;
    const info = panel ? panel.querySelector(".card-info") : null;

    if (!panel || !content || !image || !info) {
        navigateDirectlyToService(url);
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
        onComplete: () => navigateDirectlyToService(url)
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
                navigateWithLinkLoader(url);
            }
        });
    } else {
        navigateWithLinkLoader(url);
    }
};

function initCardImageCursor() {
    const imageButtons = gsap.utils.toArray(".card-image-button");

    if (!imageButtons.length || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const cursor = document.createElement("div");
    cursor.className = "card-image-cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML = `
        <svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 0C6.729 0 0 6.729 0 15s6.729 15 15 15 15 -6.729 15 -15S23.271 0 15 0m0 28.89C7.341 28.89 1.11 22.659 1.11 15S7.341 1.11 15 1.11 28.89 7.341 28.89 15 22.659 28.89 15 28.89" />
            <path d="M12.144 9.444v1.11H18.66L9.393 19.821a0.555 0.555 0 1 0 0.786 0.786L19.443 11.34v6.516h1.11V9.444z" />
        </svg>
    `;
    document.body.appendChild(cursor);

    gsap.set(cursor, {
        xPercent: -50,
        yPercent: -50,
        scale: 0.78
    });

    const moveX = gsap.quickTo(cursor, "x", { duration: 0.22, ease: "power3.out" });
    const moveY = gsap.quickTo(cursor, "y", { duration: 0.22, ease: "power3.out" });

    function moveCursor(event) {
        moveX(event.clientX);
        moveY(event.clientY);
    }

    imageButtons.forEach((button) => {
        button.addEventListener("pointerenter", (event) => {
            moveCursor(event);
            gsap.to(cursor, {
                autoAlpha: 1,
                scale: 1,
                duration: 0.28,
                ease: "back.out(1.7)",
                overwrite: true
            });
        });
        button.addEventListener("pointermove", moveCursor);
        button.addEventListener("pointerleave", () => {
            gsap.to(cursor, {
                autoAlpha: 0,
                scale: 0.78,
                duration: 0.2,
                ease: "power2.out",
                overwrite: true
            });
        });
    });
}

initCardImageCursor();

// 1. SPLIT TYPE
const splitTypes = document.querySelectorAll('.reveal-text, .bottom-logo, .loader-logo, .logo-button, .menu-overlay-blueprint');
splitTypes.forEach((textElement) => {
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
    const navbar = document.querySelector(".navbar");

    if (!showcaseLetters.length || !mainImage || !showcaseTitle || !leftWord || !rightWord) return null;

    gsap.killTweensOf([showcaseLetters, showcaseCopy, mainImage, sideImages, showcaseTitle, showcaseControls, serviceNav, leftWord, rightWord]);

    let projectOffset = 0;
    let activeServiceIndex = 0;
    let isProjectSwapAnimating = false;
    let dragStartX = 0;
    let dragStartY = 0;

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

    function changeShowcaseProject(delta) {
        if (isProjectSwapAnimating || !showcaseCards.length || delta === 0) return;

        isProjectSwapAnimating = true;
        const sign = Math.sign(delta);

        const cardRects = showcaseCards.map(card => card.getBoundingClientRect());
        const cardClones = showcaseCards.map((card, index) => {
            const rect = cardRects[index];
            const clone = card.cloneNode(true);
            clone.classList.add("projects-showcase-item-clone");
            gsap.set(clone, { position: "fixed", left: rect.left, top: rect.top, width: rect.width, height: rect.height, margin: 0, zIndex: 18, pointerEvents: "none" });
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
                
                gsap.set(clone, { position: "fixed", left: startX, top: incomingRect.top, width: incomingRect.width, height: incomingRect.height, autoAlpha: 1, margin: 0, zIndex: 18, pointerEvents: "none" });
                document.body.appendChild(clone);
                incomingClones.push({ clone, newIndex });
            }
        });

        const allClones = [...cardClones.map(c => c.clone), ...incomingClones.map(c => c.clone)];

        gsap.timeline({
            defaults: { duration: 0.72, ease: "power4.inOut" },
            onComplete: () => {
                allClones.forEach(clone => clone.remove());
                gsap.set(showcaseCards, { autoAlpha: 1 });
                updateShowcaseControlPosition();
                revealMainTitleMasks();
                isProjectSwapAnimating = false;
            }
        })
        .to(cardClones.map(c => c.clone), {
            left: (i) => {
                const oldIndex = cardClones[i].oldIndex;
                const newIndex = oldIndex - delta;
                if (newIndex >= 0 && newIndex < showcaseCards.length) return cardRects[newIndex].left;
                return sign > 0 ? -cardRects[0].width * 2 : window.innerWidth + cardRects[0].width;
            },
            top: (i) => {
                const oldIndex = cardClones[i].oldIndex;
                const newIndex = oldIndex - delta;
                if (newIndex >= 0 && newIndex < showcaseCards.length) return cardRects[newIndex].top;
                return cardRects[oldIndex].top;
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
            left: (i) => cardRects[incomingClones[i].newIndex].left,
            top: (i) => cardRects[incomingClones[i].newIndex].top,
            width: (i) => cardRects[incomingClones[i].newIndex].width,
            height: (i) => cardRects[incomingClones[i].newIndex].height,
            autoAlpha: 1
        }, 0);
    }

    populateShowcaseCards();
    setActiveServiceTab();

    if (prevButton) {
        prevButton.addEventListener("click", () => changeShowcaseProject(-1));
    }

    if (nextButton) {
        nextButton.addEventListener("click", () => changeShowcaseProject(1));
    }

    const columns = projectsShowcase.querySelectorAll(".projects-showcase-col:not(.projects-showcase-col-main)");
    if (columns.length >= 2) {
        // Remove the old column listeners
    }

    showcaseCards.forEach((card, index) => {
        card.addEventListener("click", () => {
            const centerIndex = Math.floor(showcaseCards.length / 2);
            const delta = index - centerIndex;
            if (delta !== 0) changeShowcaseProject(delta);
        });
    });

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

    if (showcaseContainer) {
        showcaseContainer.addEventListener("pointerdown", (event) => {
            if (event.target.closest("button, a")) return;

            dragStartX = event.clientX;
            dragStartY = event.clientY;
            showcaseContainer.classList.add("is-dragging");
        });

        showcaseContainer.addEventListener("touchstart", (event) => {
            if (event.target.closest("button, a")) return;

            dragStartX = event.touches[0].clientX;
            dragStartY = event.touches[0].clientY;
            showcaseContainer.classList.add("is-dragging");
        }, { passive: true });

        const finishProjectDrag = (event) => {
            if (!showcaseContainer.classList.contains("is-dragging")) return;

            const endX = event.changedTouches ? event.changedTouches[0].clientX : event.clientX;
            const endY = event.changedTouches ? event.changedTouches[0].clientY : event.clientY;

            const deltaX = endX - dragStartX;
            const deltaY = endY - dragStartY;

            showcaseContainer.classList.remove("is-dragging");

            if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY)) return;

            changeShowcaseProject(deltaX < 0 ? 1 : -1);
        };

        showcaseContainer.addEventListener("pointerup", finishProjectDrag);
        window.addEventListener("pointerup", finishProjectDrag);
        showcaseContainer.addEventListener("touchend", finishProjectDrag);

        showcaseContainer.addEventListener("pointercancel", () => {
            showcaseContainer.classList.remove("is-dragging");
        });
        showcaseContainer.addEventListener("touchcancel", () => {
            showcaseContainer.classList.remove("is-dragging");
        });
    }

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

window.addEventListener('load', () => {
    resetPageScroll();

    if (shouldLandOnWebDevCard) {
        document.body.style.overflow = '';
        if (lenis) {
            lenis.resize();
            lenis.scrollTo(0, { immediate: true, force: true });
            lenis.start();
        }

        prepareNaturalWebCardHashLanding();
        pageIsReady = true;
        ScrollTrigger.refresh();
        scrollToWebDevCardHashIfRequested();
        syncNavState();
        document.documentElement.classList.remove("is-link-transition");
        document.documentElement.classList.remove("is-service-direct-transition");
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

        pageIsReady = true;
        ScrollTrigger.refresh();
        syncNavState();
        scrollToWebDevCardHashIfRequested();
        document.documentElement.classList.remove("is-link-transition");
        document.documentElement.classList.remove("is-service-direct-transition");
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
            pageIsReady = true;
            ScrollTrigger.refresh();
            syncNavState();
            scrollToWebDevCardHashIfRequested();
            document.documentElement.classList.remove("is-link-transition");
            document.documentElement.classList.remove("is-service-direct-transition");
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
            /* ONLY ADDED THIS LOGO ANIMATION BELOW */
            .to(".bottom-logo .char", {
                y: 0,
                stagger: 0.02,
                duration: 0.8,
                ease: "power4.out"
            }, "-=0.6")
            /* ------------------------------------ */
            .fromTo(".hero-line", {
                scaleX: 0,
                transformOrigin: "left"
            }, {
                scaleX: 1,
                duration: 1.5,
                ease: "expo.out"
            }, "-=0.6");
    }
});

// 3. MAIN SCROLL LOGIC
const panels = gsap.utils.toArray(".panel:not(.hero-section)");
const hero = document.querySelector(".hero-section");
const phoneBreakpoint = 600;
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
    }, "-=0.42")
    .to(".about-section-fact .line-mask, .about-section-link .line-mask", {
        y: 0,
        stagger: 0.06,
        duration: 0.65,
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
let navIsRevealed = false;
const navRevealTime = 1;
const logoButton = document.querySelector(".logo-button");
const coloredSurfaceSelector = ".service-card-web-dev, .service-card-branding, .service-card-marketing, .service-card-architecture, .approach-card, .contact-card";
const lightSurfaceSelector = ".hero-section, .masking-overlay-card, .masking-overlay-card-about";

function setLogoMask(top = 0, right = 0, bottom = 100, left = 0) {
    if (!logoButton) return;

    logoButton.style.setProperty("--logo-mask-top", `${top}%`);
    logoButton.style.setProperty("--logo-mask-right", `${right}%`);
    logoButton.style.setProperty("--logo-mask-bottom", `${bottom}%`);
    logoButton.style.setProperty("--logo-mask-left", `${left}%`);
}

function getIntersectionRect(rectA, rectB) {
    const left = Math.max(rectA.left, rectB.left);
    const right = Math.min(rectA.right, rectB.right);
    const top = Math.max(rectA.top, rectB.top);
    const bottom = Math.min(rectA.bottom, rectB.bottom);

    if (right <= left || bottom <= top) return null;

    return { left, right, top, bottom };
}

function isTopColoredSurface(surface, intersection) {
    const probeX = (intersection.left + intersection.right) / 2;
    const probeY = (intersection.top + intersection.bottom) / 2;
    const elementsAtProbe = document.elementsFromPoint(probeX, probeY);

    for (const element of elementsAtProbe) {
        if (!element.closest) continue;
        if (element.closest(".navbar")) continue;
        if (element.closest(".menu-overlay.is-open, .menu-overlay.is-closing")) return false;
        if (element.closest(lightSurfaceSelector)) return false;

        const coloredSurface = element.closest(coloredSurfaceSelector);

        if (coloredSurface) {
            return coloredSurface === surface;
        }
    }

    return false;
}

function getLogoApproachCoverIntersection(logoRect) {
    const approachPanel = document.querySelector(".approach-articles-mask");

    if (!approachPanel) return null;

    const panelRect = approachPanel.getBoundingClientRect();
    const intersection = getIntersectionRect(logoRect, panelRect);

    if (!intersection) return null;

    const probeX = (intersection.left + intersection.right) / 2;
    const probeY = (intersection.top + intersection.bottom) / 2;
    const elementsAtProbe = document.elementsFromPoint(probeX, probeY);
    const panelIsVisible = elementsAtProbe.some(element => {
        return element.closest && element.closest(".approach-articles-mask") === approachPanel;
    });

    return panelIsVisible ? intersection : null;
}

function syncLogoContrast() {
    if (!logoButton) return;

    if (document.body.classList.contains("menu-active") || document.body.classList.contains("menu-mask-active")) {
        return;
    }

    const logoRect = logoButton.getBoundingClientRect();
    const coloredSurfaces = gsap.utils.toArray(coloredSurfaceSelector);
    let activeIntersection = null;
    let activeZIndex = -Infinity;

    coloredSurfaces.forEach(surface => {
        const surfaceRect = surface.getBoundingClientRect();
        const intersection = getIntersectionRect(logoRect, surfaceRect);

        if (!intersection || !isTopColoredSurface(surface, intersection)) return;

        const zIndex = parseFloat(window.getComputedStyle(surface).zIndex) || 0;

        if (zIndex >= activeZIndex) {
            activeZIndex = zIndex;
            activeIntersection = intersection;
        }
    });

    if (!activeIntersection) {
        setLogoMask();
        return;
    }

    const toPercent = value => gsap.utils.clamp(0, 100, value);
    let top = toPercent(((activeIntersection.top - logoRect.top) / logoRect.height) * 100);
    const right = toPercent(((logoRect.right - activeIntersection.right) / logoRect.width) * 100);
    let bottom = toPercent(((logoRect.bottom - activeIntersection.bottom) / logoRect.height) * 100);
    const left = toPercent(((activeIntersection.left - logoRect.left) / logoRect.width) * 100);
    const approachCoverIntersection = getLogoApproachCoverIntersection(logoRect);

    if (approachCoverIntersection) {
        if (approachCoverIntersection.top <= logoRect.top && approachCoverIntersection.bottom >= logoRect.bottom) {
            setLogoMask(0, right, 100, left);
            return;
        }

        if (approachCoverIntersection.bottom >= logoRect.bottom) {
            bottom = Math.max(bottom, toPercent(((logoRect.bottom - approachCoverIntersection.top) / logoRect.height) * 100));
        } else if (approachCoverIntersection.top <= logoRect.top) {
            top = Math.max(top, toPercent(((approachCoverIntersection.bottom - logoRect.top) / logoRect.height) * 100));
        }
    }

    setLogoMask(top, right, bottom, left);
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

const aboutStartTime = approachHorizontalStartTime + approachStepHorizontalTotalDuration;

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

function scrollToWebDevCardHashIfRequested() {
    if (!shouldLandOnWebDevCard || !masterTl || !masterTl.scrollTrigger) return;

    ScrollTrigger.refresh();

    const trigger = masterTl.scrollTrigger;
    const timelineDuration = masterTl.duration();
    const targetTime = 1;

    if (!timelineDuration) return;

    const targetScroll = trigger.start + ((targetTime / timelineDuration) * (trigger.end - trigger.start));

    if (typeof trigger.scroll === "function") {
        trigger.scroll(targetScroll);
    } else if (lenis) {
        lenis.scrollTo(targetScroll, {
            immediate: true,
            force: true
        });
    } else {
        window.scrollTo(0, targetScroll);
    }

    ScrollTrigger.update();
    masterTl.time(targetTime, false);
    ScrollTrigger.update();
    syncNavState();
    prepareNaturalWebCardHashLanding();

    const webPanel = document.querySelector(".service-card-web-dev");
    const webRevealTl = webPanel ? serviceCardRevealTimelines.get(webPanel) : null;

    if (webRevealTl) {
        webRevealTl.restart();
    }
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

    contactThankModal.classList.add("is-open");
    contactThankModal.setAttribute("aria-hidden", "false");
    contactThankClose?.focus();
}

function closeContactThankModal() {
    if (!contactThankModal) return;

    contactThankModal.classList.remove("is-open");
    contactThankModal.setAttribute("aria-hidden", "true");
}

if (contactForm && contactThankModal) {
    contactForm.addEventListener("submit", (event) => {
        event.preventDefault();
        openContactThankModal();
        contactForm.reset();
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
