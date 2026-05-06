gsap.registerPlugin(ScrollTrigger);

if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
}

ScrollTrigger.clearScrollMemory("manual");

function resetPageScroll() {
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
requestAnimationFrame(syncScrollbarIndicator);

let pageIsReady = false;
const currentPageName = window.location.pathname.split("/").pop().toLowerCase();
const isIndexPage = currentPageName === "" || currentPageName === "index.html";
const linkLoaderStorageKey = "blueprintUseLinkLoader";
let shouldUseLinkLoader = false;

try {
    shouldUseLinkLoader = sessionStorage.getItem(linkLoaderStorageKey) === "true";
    sessionStorage.removeItem(linkLoaderStorageKey);
} catch (error) {
    shouldUseLinkLoader = false;
}

const loaderElement = document.getElementById('loader');

if (loaderElement && shouldUseLinkLoader) {
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

window.handlePageTransition = function(e, url) {
    e.preventDefault();
    const clickedBtn = e.currentTarget;
    let siblingsToHide = [];

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
        textElement.classList.contains('approach-eyebrow') ||
        textElement.classList.contains('approach-kicker') ||
        textElement.classList.contains('approach-title') ||
        textElement.classList.contains('approach-copy') ||
        textElement.classList.contains('approach-step-title') ||
        textElement.classList.contains('approach-step-copy');

    const split = new SplitType(textElement, { types: usesLineMask ? 'lines' : 'lines,words,chars' });

    if (usesLineMask) {
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
            line.style.paddingTop = '0.18em';
            line.style.paddingBottom = '0.2em';
            line.style.marginTop = '-0.18em';
            line.style.marginBottom = '-0.2em';
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

        const shouldUseRevealChars = target.matches(".nav-links button");

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

    // Hide scrollbar during load
    document.body.style.overflow = 'hidden';

    if (loaderElement && shouldUseLinkLoader) {
        loaderElement.classList.add("is-link-loader");
    }

    const loaderTl = gsap.timeline({
        onComplete: () => {
            document.body.style.overflow = '';
            startHeroAnimation();
            pageIsReady = true;
            ScrollTrigger.refresh();
            syncNavState();
            document.documentElement.classList.remove("is-link-transition");
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

function isPhoneViewport() {
    return window.innerWidth <= phoneBreakpoint;
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
    return window.innerHeight / 4;
}

function getApproachDeckPeek(index) {
    if (window.innerWidth <= 760) {
        return [112, 84, 56, 28][index] || 28;
    }

    return [400, 300, 200, 100][index] || 100;
}

function getApproachDeckX(index) {
    return window.innerWidth - getApproachDeckPeek(index);
}

function getApproachDeckRadius() {
    return window.innerWidth <= 760 ? "34px" : "60px";
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
const overlayHoldDuration = overlayReadDuration > 0 ? 0.75 : 0;
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
const approachDiscoverPushDuration = 0.9;
const approachStepFoldDuration = 0.9;
const approachStepFoldTotalDuration = Math.max(0, approachStepCards.length - 1) * approachStepFoldDuration;
const approachDeckDuration = 0.86;
const approachDeckStagger = 0.14;
const approachDeckTotalDuration = approachDeckDuration + (Math.max(0, approachStepCards.length - 1) * approachDeckStagger);
const approachStepHorizontalDuration = 1;
const approachStepHorizontalTotalDuration = approachStepCards.length * approachStepHorizontalDuration;
const approachReadDuration = approachDiscoverPushDuration + approachStepFoldTotalDuration + approachDeckTotalDuration + approachStepHorizontalTotalDuration;
const aboutTransitionDuration = 1.25;
const aboutHoldDuration = 0.25;
const aboutReadDuration = getAboutReadDuration();
const contactTransitionDuration = 1.25;
const footerRevealDuration = 1.1;
const scrollSpeed = 140;
const approachPushedContentSelector = ".approach-fg-video, .approach-kicker, .approach-copy-block > hr, .approach-title, .approach-copy";

gsap.set(".masking-overlay-card", { y: () => window.innerHeight, yPercent: 0 });
gsap.set(".masking-overlay-copy", { y: () => getOverlayMetrics().startY });
gsap.set(".approach-card", { x: () => window.innerWidth, xPercent: 0 });
gsap.set(".masking-overlay-card-about", { y: () => window.innerHeight, yPercent: 0 });
gsap.set(".about-section-inner", { y: 0 });
gsap.set(".contact-card", { x: () => window.innerWidth, xPercent: 0 });
gsap.set(".site-footer", { y: 0, autoAlpha: 0 });
gsap.set(".approach-articles-mask", { y: () => getApproachPanelMetrics().startY, yPercent: 0 });
gsap.set(".approach-steps", { y: 0 });
gsap.set(approachStepCards, { x: 0, xPercent: 0, z: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1, zIndex: (index) => index + 1, force3D: true, borderTopLeftRadius: "0px", borderBottomLeftRadius: "0px", transformPerspective: 1200 });
gsap.set(approachStepCards.slice(1), { y: () => window.innerHeight, yPercent: 0 });
gsap.set(approachPushedContentSelector, { y: 0 });
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

if (approachFgVideo) {
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
        getUnsplashImage("photo-1547658719-da2b51169166"),
        getUnsplashImage("photo-1498050108023-c5249f4df085"),
        getUnsplashImage("photo-1457305237443-44c3d5a30b89"),
        getUnsplashImage("photo-1499951360447-b19be8fe80f5")
    ],
    [
        getUnsplashImage("photo-1548094990-c16ca90f1f0d"),
        getUnsplashImage("photo-1658863025658-4a259cc68fc9"),
        getUnsplashImage("photo-1561070791-2526d30994b5"),
        getUnsplashImage("photo-1561070791-36c11767b26a")
    ],
    [
        getUnsplashImage("photo-1599658880436-c61792e70672"),
        getUnsplashImage("photo-1686061592689-312bbfb5c055"),
        getUnsplashImage("photo-1759215524600-7971d6a4dac0"),
        getUnsplashImage("photo-1759661966728-4a02e3c6ed91")
    ],
    [
        getUnsplashImage("photo-1574848296471-28f79a036f79"),
        getUnsplashImage("photo-1519662978799-2f05096d3636"),
        getUnsplashImage("photo-1615406020658-6c4b805f1f30"),
        getUnsplashImage("photo-1614595737683-1740e41bfaac")
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
        scrub: 1.2,
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
            gsap.set(approachStepCards.slice(1), { y: window.innerHeight, yPercent: 0 });
            gsap.set(".masking-overlay-card-about", { y: window.innerHeight, yPercent: 0 });
            gsap.set(".about-section-inner", { y: 0 });
            gsap.set(".contact-card", { x: window.innerWidth, xPercent: 0 });
            gsap.set(".site-footer", { y: 0, autoAlpha: 0 });
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
    y: () => window.innerHeight,
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
    x: () => window.innerWidth,
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

masterTl.to(".approach-steps", {
    y: () => -getApproachStepsOffset(),
    ease: "none",
    duration: approachDiscoverPushDuration
}, approachFoldStartTime);

masterTl.to(".approach-eyebrow-cover", {
    y: () => -getApproachStepsOffset(),
    ease: "none",
    duration: approachDiscoverPushDuration,
    onUpdate: syncApproachMasks
}, approachFoldStartTime);

approachStepCards.slice(1).forEach((step, index) => {
    const stepIndex = index + 1;

    masterTl.fromTo(step, {
        y: () => window.innerHeight,
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
    x: () => isPhoneViewport() ? 0 : "100vw",
    xPercent: 0,
    y: () => isPhoneViewport() ? window.innerHeight : 0,
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
                force3D: true,
                ease: "none",
                duration: approachStepHorizontalDuration
            }
            : {
                xPercent: -100,
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
    y: () => window.innerHeight,
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
    x: () => window.innerWidth,
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
    y: () => -(window.innerHeight * 0.78),
    ease: "none",
    duration: footerRevealDuration
}, contactStartTime + contactTransitionDuration);

// 5. FULL-SCREEN MENU
const menuOverlay = document.querySelector(".menu-overlay");
const menuButton = document.querySelector(".menu-button");
const menuOverlayLinks = document.querySelectorAll(".menu-overlay-link");
const menuPlaceholderLinks = document.querySelectorAll('.menu-info-link[href="#"]');

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
            closeMenu();
        }
    });
}
