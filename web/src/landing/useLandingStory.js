import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const PROGRESS_EPSILON = 0.001;

function numericScene(element) {
  const value = Number(element?.dataset?.scene);
  return Number.isInteger(value) ? value : 0;
}

function composerDestination({ carrier, composer, mobile, source, sticky, target }) {
  const sourceRect = source.getBoundingClientRect();
  const stickyRect = sticky.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const stickyTop = Number.parseFloat(getComputedStyle(sticky).top) || (mobile ? 76 : 98);
  const pinnedTop = window.innerHeight * (mobile ? 0.48 : 0.52);
  const composerWidth = composer.offsetWidth || sourceRect.width || 1;
  const targetWidth = targetRect.width || Math.min(550, composerWidth);
  const currentPinnedBottom = pinnedTop + carrier.offsetHeight;
  const targetPinnedBottom = stickyTop + targetRect.bottom - stickyRect.top;
  return {
    scale: Math.min(1, targetWidth / composerWidth),
    x: targetRect.left - sourceRect.left,
    y: targetPinnedBottom - currentPinnedBottom,
  };
}

function liveComposerDestination({ carrier, composer, target }) {
  const carrierRect = carrier.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const composerWidth = composer.offsetWidth || carrierRect.width || 1;
  const targetWidth = targetRect.width || Math.min(550, composerWidth);
  return {
    scale: Math.min(1, targetWidth / composerWidth),
    x: targetRect.left - carrierRect.left,
    y: targetRect.bottom - carrierRect.bottom,
  };
}

function bridgeBeat(progress) {
  if (progress < 0.18) return "hidden";
  if (progress < 0.78) return "surface";
  return "docked";
}

function viewBeat(progress) {
  if (progress < 0.26) return "viewsListRoute";
  if (progress < 0.48) return "viewsListDescription";
  if (progress < 0.72) return "viewsCalendar";
  return "viewsRoutes";
}

function characterCount(prompt, progress) {
  return Math.max(0, Math.min(prompt.length, Math.round(prompt.length * progress)));
}

export function useLandingStory(rootRef, {
  heroPrompt,
  modificationPrompt,
  onComposerDockChange,
  onCreateBeatChange,
  onCreateScene,
  onShareScene,
  queryPrompt,
}) {
  const callbacksRef = useRef({ onComposerDockChange, onCreateBeatChange, onCreateScene, onShareScene });
  callbacksRef.current = { onComposerDockChange, onCreateBeatChange, onCreateScene, onShareScene };

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const media = gsap.matchMedia();
    let alive = true;

    const context = gsap.context(() => {
      media.add(
        {
          desktop: "(min-width: 821px)",
          mobile: "(max-width: 820px)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        ({ conditions }) => {
          root.dataset.motion = conditions.reduce ? "reduced" : conditions.mobile ? "mobile" : "desktop";
          const activeScenes = new Map();

          const composerSource = root.querySelector("[data-composer-source]");
          const composerCarrier = root.querySelector("[data-composer-carrier]");
          const composer = root.querySelector("[data-composer-morph]");
          const composerInput = root.querySelector("[data-composer-text]");
          const composerTarget = root.querySelector("[data-composer-target]");
          const composerCue = root.querySelector("[data-composer-cue]");
          const heroCta = root.querySelector("[data-hero-cta]");
          const heroTransitionItems = [heroCta, composerCue].filter(Boolean);
          const conversation = root.querySelector("[data-create-conversation]");
          const createStage = root.querySelector("[data-create-stage]");
          const createGrid = root.querySelector("#crear .landing-story-grid");
          const createSticky = root.querySelector("#crear .landing-story-sticky");
          const createSteps = Array.from(root.querySelectorAll('[data-story-step="create"]'));
          const shareSteps = Array.from(root.querySelectorAll('[data-story-step="share"]'));
          const sharePanels = Array.from(root.querySelectorAll("[data-share-panel]"));
          const shareBadges = Array.from(root.querySelectorAll("[data-share-badge]"));
          const shareCaptions = Array.from(root.querySelectorAll("[data-share-caption]"));

          let bridgeEndY = 0;
          let bridgeProgress = 0;
          let composerWasDocked = false;
          let composerFollowFrame;
          let composerTargetObserver;
          let currentBeat = "";
          let heroTween;
          let introObserver;
          let narrativeProgress = 0;
          let previousNarrativeProgress = 0;
          let narrativeTrigger;
          let narrativeTween;
          let bridgeTimeline;
          let sceneWeights = [];
          let totalSceneWeight = 1;
          let shareProgress = 0;
          let shareTrigger;
          let shareTween;
          let shareWeights = [];
          let totalShareWeight = 1;

          const emitBeat = (beat) => {
            if (!beat || beat === currentBeat) return;
            currentBeat = beat;
            callbacksRef.current.onCreateBeatChange?.(beat);
          };

          const activateScene = (story, scene) => {
            if (activeScenes.get(story) === scene) return;
            activeScenes.set(story, scene);
            const callback = story === "share"
              ? callbacksRef.current.onShareScene
              : callbacksRef.current.onCreateScene;
            callback?.(scene);
          };

          const resizeComposer = () => {
            if (!composerInput || !composer) return;
            composerInput.style.height = "0px";
            const maximum = conditions.mobile ? (window.innerWidth <= 300 ? 168 : 146) : 102;
            composerInput.style.height = String(Math.min(maximum, Math.max(70, composerInput.scrollHeight))) + "px";
            composer.classList.toggle("is-empty", !composerInput.value);
          };

          const setComposerValue = (value, state = "complete") => {
            if (composerInput) {
              composerInput.value = value;
              composerInput.dataset.typewriterState = state;
              resizeComposer();
            }
          };

          const setInteraction = (kind, state) => {
            if (!conversation) return;
            conversation.dataset.demoInteraction = kind;
            conversation.dataset.interactionState = state;
          };

          const setComposerDocked = (docked) => {
            if (docked === composerWasDocked) return;
            composerWasDocked = docked;
            if (docked && composer?.contains(document.activeElement)) document.activeElement?.blur?.();
            callbacksRef.current.onComposerDockChange?.(docked);
          };

          const syncComposerToDock = () => {
            if (bridgeProgress < 0.995 || !composerCarrier || !composer || !composerTarget) return;
            gsap.set(composer, {
              ...liveComposerDestination({ carrier: composerCarrier, composer, target: composerTarget }),
              autoAlpha: 1,
              transformOrigin: "bottom left",
            });
          };

          const scheduleComposerDockSync = () => {
            if (bridgeProgress < 0.995) return;
            if (composerFollowFrame) window.cancelAnimationFrame(composerFollowFrame);
            composerFollowFrame = window.requestAnimationFrame(() => {
              composerFollowFrame = undefined;
              syncComposerToDock();
            });
          };

          const typeHeroPrompt = () => {
            if (!composerInput || heroTween || !alive) return;
            const cursor = { length: 0 };
            setComposerValue("", "typing");
            heroTween = gsap.to(cursor, {
              duration: 2.45,
              ease: "none",
              length: heroPrompt.length,
              onComplete: () => setComposerValue(heroPrompt, "complete"),
              onUpdate: () => setComposerValue(heroPrompt.slice(0, Math.round(cursor.length)), "typing"),
            });
          };

          const beginTypewriterAfterIntro = () => {
            const introState = document.documentElement.dataset.intro;
            if (introState === "done" || introState === "skip") {
              typeHeroPrompt();
              return;
            }
            introObserver = new MutationObserver(() => {
              if (document.documentElement.dataset.intro !== "done") return;
              introObserver?.disconnect();
              introObserver = undefined;
              typeHeroPrompt();
            });
            introObserver.observe(document.documentElement, { attributeFilter: ["data-intro"], attributes: true });
          };

          const syncContext = (progress) => {
            if (progress < 0.2) {
              setComposerValue(heroPrompt, "complete");
              setInteraction("initial", "typed");
              emitBeat("docked");
              return;
            }

            setComposerValue("", "waiting");
            if (progress < 0.4) {
              setInteraction("initial", "sent");
              emitBeat("initialSent");
            } else if (progress < 0.64) {
              setInteraction("initial", "thinking");
              emitBeat("initialThinking");
            } else {
              setInteraction("initial", "answered");
              emitBeat("initialReply");
            }
          };

          const syncPlanning = (progress) => {
            setComposerValue("", "waiting");
            if (progress <= PROGRESS_EPSILON) {
              setInteraction("planning", "idle");
              emitBeat("initialReply");
            } else if (progress < 0.28) {
              setInteraction("planning", "thinking");
              emitBeat("planningResearch");
            } else if (progress < 0.52) {
              setInteraction("planning", "thinking");
              emitBeat("planningSchedule");
            } else if (progress < 0.76) {
              setInteraction("planning", "thinking");
              emitBeat("planningRoutes");
            } else {
              setInteraction("planning", "answered");
              emitBeat("itineraryReady");
            }
          };

          const syncPromptSequence = ({ answeredBeat, prefix, prompt, progress, reversed, startBeat }) => {
            if (progress <= PROGRESS_EPSILON) {
              setComposerValue("", "waiting");
              setInteraction(prefix, "idle");
              emitBeat(startBeat);
              return;
            }
            if (progress < 0.36) {
              const length = characterCount(prompt, progress / 0.36);
              setComposerValue(prompt.slice(0, length), reversed ? "deleting" : "typing");
              setInteraction(prefix, reversed ? "deleting" : "typing");
              emitBeat(prefix + "Typing");
              return;
            }
            if (progress < 0.46) {
              setComposerValue(prompt, "complete");
              setInteraction(prefix, "typed");
              emitBeat(prefix + "Typing");
              return;
            }

            setComposerValue("", "waiting");
            if (progress < 0.6) {
              setInteraction(prefix, "sent");
              emitBeat(prefix + "Sent");
            } else if (progress < 0.78) {
              setInteraction(prefix, "thinking");
              emitBeat(prefix + "Thinking");
            } else {
              setInteraction(prefix, "answered");
              emitBeat(answeredBeat);
            }
          };

          const measureSceneWeights = () => {
            sceneWeights = createSteps.map((step) => Math.max(1, step.offsetHeight));
            totalSceneWeight = Math.max(1, sceneWeights.reduce((total, weight) => total + weight, 0));
          };

          const sceneAtNarrativeProgress = (progress) => {
            const distance = gsap.utils.clamp(0, 1, progress) * totalSceneWeight;
            let offset = 0;

            for (let index = 0; index < createSteps.length; index += 1) {
              const weight = sceneWeights[index] || 1;
              const isLast = index === createSteps.length - 1;
              if (distance <= offset + weight || isLast) {
                return {
                  progress: gsap.utils.clamp(0, 1, (distance - offset) / weight),
                  scene: numericScene(createSteps[index]),
                };
              }
              offset += weight;
            }

            return { progress: 1, scene: Math.max(0, createSteps.length - 1) };
          };

          const renderNarrativeAt = (overallProgress) => {
            narrativeProgress = gsap.utils.clamp(0, 1, overallProgress);
            const reversed = narrativeProgress < previousNarrativeProgress - PROGRESS_EPSILON;
            previousNarrativeProgress = narrativeProgress;
            root.dataset.narrativeProgress = narrativeProgress.toFixed(4);

            if (narrativeProgress <= PROGRESS_EPSILON && bridgeProgress < 0.995) {
              activateScene("create", 0);
              return;
            }

            const position = sceneAtNarrativeProgress(narrativeProgress);
            const scene = position.scene;
            const progress = position.progress;
            root.dataset.narrativeScene = String(scene);
            activateScene("create", scene);

            if (scene === 0) {
              syncContext(progress);
            } else if (scene === 1) {
              syncPlanning(progress);
            } else if (scene === 2) {
              setComposerValue("", "waiting");
              setInteraction("planning", "answered");
              emitBeat(viewBeat(progress));
            } else if (scene === 3) {
              setComposerValue("", "waiting");
              setInteraction("planning", "answered");
              emitBeat("routeFocus");
            } else if (scene === 4) {
              setComposerValue("", "waiting");
              setInteraction("planning", "answered");
              emitBeat("reservations");
            } else if (scene === 5) {
              syncPromptSequence({
                answeredBeat: "queryAnswered",
                prefix: "query",
                prompt: queryPrompt,
                progress,
                reversed,
                startBeat: "reservations",
              });
            } else {
              syncPromptSequence({
                answeredBeat: "changeApplied",
                prefix: "change",
                prompt: modificationPrompt,
                progress,
                reversed,
                startBeat: "queryAnswered",
              });
            }
          };

          const measureShareWeights = () => {
            shareWeights = shareSteps.map((step) => Math.max(1, step.offsetHeight));
            totalShareWeight = Math.max(1, shareWeights.reduce((total, weight) => total + weight, 0));
          };

          const shareSceneAtProgress = (progress) => {
            const distance = gsap.utils.clamp(0, 1, progress) * totalShareWeight;
            let offset = 0;

            for (let index = 0; index < shareSteps.length; index += 1) {
              const weight = shareWeights[index] || 1;
              const isLast = index === shareSteps.length - 1;
              if (distance <= offset + weight || isLast) {
                return {
                  index,
                  progress: gsap.utils.clamp(0, 1, (distance - offset) / weight),
                  scene: numericScene(shareSteps[index]),
                };
              }
              offset += weight;
            }

            return { index: Math.max(0, shareSteps.length - 1), progress: 1, scene: Math.max(0, shareSteps.length - 1) };
          };

          const renderShareAt = (overallProgress) => {
            shareProgress = gsap.utils.clamp(0, 1, overallProgress);
            const position = shareSceneAtProgress(shareProgress);
            const lastIndex = Math.max(0, sharePanels.length - 1);
            const currentIndex = Math.min(lastIndex, position.index);
            const nextIndex = Math.min(lastIndex, currentIndex + 1);
            const blend = currentIndex === nextIndex
              ? 0
              : gsap.utils.clamp(0, 1, (position.progress - 0.76) / 0.24);
            const dominantIndex = blend >= 0.5 ? nextIndex : currentIndex;

            root.dataset.shareProgress = shareProgress.toFixed(4);
            root.dataset.shareScene = String(dominantIndex);
            activateScene("share", numericScene(shareSteps[dominantIndex]));

            for (let index = 0; index < sharePanels.length; index += 1) {
              const isCurrent = index === currentIndex;
              const isNext = index === nextIndex && nextIndex !== currentIndex;
              const opacity = isCurrent ? 1 - blend : isNext ? blend : 0;
              const y = isCurrent ? -10 * blend : isNext ? 14 * (1 - blend) : 14;
              const scale = isCurrent ? 1 - (0.01 * blend) : isNext ? 0.985 + (0.015 * blend) : 0.985;
              gsap.set(sharePanels[index], { autoAlpha: opacity, scale, y });
            }

            for (const layers of [shareBadges, shareCaptions]) {
              for (let index = 0; index < layers.length; index += 1) {
                const isCurrent = index === currentIndex;
                const isNext = index === nextIndex && nextIndex !== currentIndex;
                const opacity = isCurrent ? 1 - blend : isNext ? blend : 0;
                const y = isCurrent ? -5 * blend : isNext ? 7 * (1 - blend) : 7;
                gsap.set(layers[index], { autoAlpha: opacity, y });
              }
            }
          };

          if (conditions.reduce) {
            setComposerValue("", "waiting");
            setInteraction("planning", "answered");
            gsap.set(root.querySelectorAll("[data-story-reveal], [data-create-stage]"), { clearProps: "all" });
            gsap.set(composer, { clearProps: "all" });
            gsap.set(heroTransitionItems, { clearProps: "all" });
            gsap.set([...sharePanels, ...shareBadges, ...shareCaptions], { clearProps: "all" });
            callbacksRef.current.onComposerDockChange?.(false);
            emitBeat("viewsListRoute");
            callbacksRef.current.onCreateScene?.(2);
            callbacksRef.current.onShareScene?.(1);
            root.dataset.scrollSync = "reduced";
            return () => {
              heroTween?.kill();
              introObserver?.disconnect();
              delete root.dataset.scrollSync;
            };
          }

          root.dataset.scrollSync = "scrubbed";
          root.dataset.scrollState = "native";
          beginTypewriterAfterIntro();

          if (composerSource && composerCarrier && composer && composerTarget && createGrid && createSticky) {
            ScrollTrigger.create({
              anticipatePin: 1,
              end: () => {
                const stickyTop = Number.parseFloat(getComputedStyle(createSticky).top) || (conditions.mobile ? 76 : 98);
                return "bottom " + String(stickyTop + createSticky.offsetHeight) + "px";
              },
              endTrigger: createGrid,
              invalidateOnRefresh: true,
              pin: composerCarrier,
              pinSpacing: false,
              refreshPriority: 1,
              start: conditions.mobile ? "top 48%" : "top 52%",
              trigger: composerSource,
            });

            gsap.set(createStage, { autoAlpha: 0 });

            const syncBridge = (progress) => {
              bridgeProgress = progress;
              setComposerDocked(progress >= 0.78);
              if (progress >= 0.995) scheduleComposerDockSync();
              else if (composerFollowFrame) {
                window.cancelAnimationFrame(composerFollowFrame);
                composerFollowFrame = undefined;
              }
              if (narrativeProgress <= PROGRESS_EPSILON) emitBeat(bridgeBeat(progress));
              if (progress > 0.08 && heroTween) {
                heroTween.progress(1);
                heroTween.kill();
                heroTween = undefined;
                setComposerValue(heroPrompt, "complete");
              }
            };

            bridgeTimeline = gsap.timeline({
              defaults: { ease: "none" },
              scrollTrigger: {
                end: () => {
                  const stickyTop = Number.parseFloat(getComputedStyle(createSticky).top) || (conditions.mobile ? 76 : 98);
                  const absoluteGridTop = window.scrollY + createGrid.getBoundingClientRect().top;
                  bridgeEndY = absoluteGridTop - stickyTop + window.innerHeight * (conditions.mobile ? 0.14 : 0.4);
                  return bridgeEndY;
                },
                invalidateOnRefresh: true,
                onScrubComplete: (self) => syncBridge(self.progress),
                onUpdate: (self) => syncBridge(self.progress),
                scrub: conditions.mobile ? true : 0.16,
                start: conditions.mobile ? "top 48%" : "top 52%",
                trigger: composerSource,
              },
            });

            bridgeTimeline
              .to({}, { duration: 1 }, 0)
              .to(heroTransitionItems, { autoAlpha: 0, duration: 0.18, y: -10 }, 0)
              .to(createStage, { autoAlpha: 1, duration: 0.25 }, 0.12)
              .to(composer, {
                duration: 0.7,
                scale: () => composerDestination({ carrier: composerCarrier, composer, mobile: conditions.mobile, source: composerSource, sticky: createSticky, target: composerTarget }).scale,
                transformOrigin: "bottom left",
                x: () => composerDestination({ carrier: composerCarrier, composer, mobile: conditions.mobile, source: composerSource, sticky: createSticky, target: composerTarget }).x,
                y: () => composerDestination({ carrier: composerCarrier, composer, mobile: conditions.mobile, source: composerSource, sticky: createSticky, target: composerTarget }).y,
              }, 0.13);

            if (window.ResizeObserver) {
              composerTargetObserver = new ResizeObserver(scheduleComposerDockSync);
              for (const element of [conversation, composerTarget, createSticky, composerCarrier]) {
                if (element) composerTargetObserver.observe(element);
              }
            }
          }

          if (createSteps.length) {
            measureSceneWeights();
            const playhead = { progress: 0 };
            narrativeTween = gsap.to(playhead, {
              ease: "none",
              onUpdate: () => renderNarrativeAt(playhead.progress),
              paused: true,
              progress: 1,
            });

            const firstStep = createSteps[0];
            const lastStep = createSteps[createSteps.length - 1];
            narrativeTrigger = ScrollTrigger.create({
              animation: narrativeTween,
              end: "bottom 50%",
              endTrigger: lastStep,
              invalidateOnRefresh: true,
              onEnter: () => { root.dataset.scrollState = "scrubbing"; },
              onEnterBack: () => { root.dataset.scrollState = "scrubbing"; },
              onLeave: () => { root.dataset.scrollState = "native"; },
              onLeaveBack: () => { root.dataset.scrollState = "native"; },
              onRefresh: measureSceneWeights,
              refreshPriority: 0,
              scrub: conditions.mobile ? true : 0.16,
              start: () => bridgeEndY || (window.scrollY + firstStep.getBoundingClientRect().top - (window.innerHeight * 0.5)),
              trigger: firstStep,
            });
          }

          if (shareSteps.length && sharePanels.length) {
            measureShareWeights();
            renderShareAt(0);
            const sharePlayhead = { progress: 0 };
            shareTween = gsap.to(sharePlayhead, {
              ease: "none",
              onUpdate: () => renderShareAt(sharePlayhead.progress),
              paused: true,
              progress: 1,
            });

            shareTrigger = ScrollTrigger.create({
              animation: shareTween,
              end: "bottom 50%",
              endTrigger: shareSteps[shareSteps.length - 1],
              invalidateOnRefresh: true,
              onRefresh: () => {
                measureShareWeights();
                renderShareAt(shareProgress);
              },
              scrub: conditions.mobile ? true : 0.16,
              start: "top 50%",
              trigger: shareSteps[0],
            });
          }

          for (const element of root.querySelectorAll("[data-story-reveal]")) {
            gsap.fromTo(
              element,
              { opacity: 0, y: conditions.mobile ? 18 : 34 },
              {
                duration: conditions.mobile ? 0.42 : 0.72,
                ease: "power3.out",
                opacity: 1,
                scrollTrigger: { once: true, start: "top 86%", trigger: element },
                y: 0,
              },
            );
          }

          return () => {
            heroTween?.kill();
            introObserver?.disconnect();
            narrativeTrigger?.kill();
            narrativeTween?.kill();
            shareTrigger?.kill();
            shareTween?.kill();
            bridgeTimeline?.kill();
            composerTargetObserver?.disconnect();
            if (composerFollowFrame) window.cancelAnimationFrame(composerFollowFrame);
            callbacksRef.current.onComposerDockChange?.(false);
            gsap.set(composer, { clearProps: "all" });
            gsap.set(heroTransitionItems, { clearProps: "all" });
            gsap.set([...sharePanels, ...shareBadges, ...shareCaptions], { clearProps: "all" });
            gsap.set(createStage, { clearProps: "all" });
            if (composerInput) composerInput.style.removeProperty("height");
            if (conversation) {
              delete conversation.dataset.demoInteraction;
              delete conversation.dataset.interactionState;
            }
            delete root.dataset.narrativeProgress;
            delete root.dataset.narrativeScene;
            delete root.dataset.shareProgress;
            delete root.dataset.shareScene;
            delete root.dataset.scrollState;
            delete root.dataset.scrollSync;
          };
        },
      );
    }, root);

    document.fonts?.ready?.then(() => {
      if (alive) ScrollTrigger.refresh(true);
    });

    const refreshAfterRestore = (event) => {
      if (event.persisted) ScrollTrigger.refresh(true);
    };
    window.addEventListener("pageshow", refreshAfterRestore);

    return () => {
      alive = false;
      window.removeEventListener("pageshow", refreshAfterRestore);
      media.revert();
      context.revert();
      callbacksRef.current.onComposerDockChange?.(false);
      delete root.dataset.motion;
    };
  }, [heroPrompt, modificationPrompt, queryPrompt, rootRef]);
}
