"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./HomePage.module.css";

export type HomeHeroRace = {
  id: string;
  slug: string;
  title: string;
  challenge: string;
  status: string;
  cover: string;
  riders: number;
  works: number;
};

const AUTOPLAY_DELAY = 5_000;
const TRANSITION_DURATION = 520;

function label(status: string) {
  if (status === "running") return "进行中";
  if (status === "completed") return "已结束";
  if (status === "published") return "已发布";
  return status;
}

export function HomeHeroCarousel({ races }: { races: HomeHeroRace[] }) {
  const hasLoop = races.length > 1;
  const slides = useMemo(() => hasLoop ? [races[races.length - 1], ...races, races[0]] : races, [hasLoop, races]);
  const [position, setPosition] = useState(hasLoop ? 1 : 0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [autoplayRevision, setAutoplayRevision] = useState(0);
  const lockedRef = useRef(false);
  const settleTimerRef = useRef<number | null>(null);
  const reenableTimerRef = useRef<number | null>(null);
  const pointerInteractionRef = useRef(false);
  const paused = hovered || focused || documentHidden;

  const settle = useCallback((target: number) => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = null;

    if (hasLoop && target === 0) {
      setTransitionEnabled(false);
      setPosition(races.length);
    } else if (hasLoop && target === races.length + 1) {
      setTransitionEnabled(false);
      setPosition(1);
    }

    lockedRef.current = false;
    if (reenableTimerRef.current !== null) window.clearTimeout(reenableTimerRef.current);
    reenableTimerRef.current = window.setTimeout(() => setTransitionEnabled(true), reducedMotion ? 0 : 32);
  }, [hasLoop, races.length, reducedMotion]);

  const scheduleSettle = useCallback((target: number) => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => settle(target), reducedMotion ? 0 : TRANSITION_DURATION + 80);
  }, [reducedMotion, settle]);

  const moveTo = useCallback((targetPosition: number, targetIndex: number, manual: boolean) => {
    if (lockedRef.current || !hasLoop) return;
    lockedRef.current = true;
    setTransitionEnabled(true);
    setPosition(targetPosition);
    setActiveIndex(targetIndex);
    scheduleSettle(targetPosition);
    if (manual) setAutoplayRevision((value) => value + 1);
  }, [hasLoop, scheduleSettle]);

  const move = useCallback((delta: -1 | 1, manual = false) => {
    const nextIndex = (activeIndex + delta + races.length) % races.length;
    moveTo(position + delta, nextIndex, manual);
  }, [activeIndex, moveTo, position, races.length]);

  const choose = useCallback((index: number) => {
    if (index === activeIndex || lockedRef.current || !hasLoop) return;
    moveTo(index + 1, index, true);
  }, [activeIndex, hasLoop, moveTo]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const update = () => setDocumentHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (paused || !hasLoop) return;
    const timer = window.setTimeout(() => move(1), AUTOPLAY_DELAY);
    return () => window.clearTimeout(timer);
  }, [activeIndex, autoplayRevision, hasLoop, move, paused]);

  useEffect(() => () => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    if (reenableTimerRef.current !== null) window.clearTimeout(reenableTimerRef.current);
  }, []);

  if (!races.length) return null;

  return (
    <section
      aria-label="精选赛事"
      aria-roledescription="carousel"
      className={styles.heroWrap}
      data-testid="home-hero-carousel"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onFocusCapture={() => {
        if (!pointerInteractionRef.current) setFocused(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          move(-1, true);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          move(1, true);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerCancelCapture={() => { pointerInteractionRef.current = false; }}
      onPointerDownCapture={() => { pointerInteractionRef.current = true; }}
      onPointerUpCapture={() => { pointerInteractionRef.current = false; }}
    >
      <p aria-live="polite" className={styles.visuallyHidden}>当前精选赛事：{races[activeIndex]?.title}</p>
      <div className={styles.carouselViewport}>
        <div
          className={styles.carouselTrack}
          data-testid="home-hero-track"
          onTransitionEnd={(event) => {
            if (event.currentTarget === event.target && event.propertyName === "transform") settle(position);
          }}
          style={{
            transform: `translate3d(-${position * 100}%, 0, 0)`,
            transitionDuration: transitionEnabled && !reducedMotion ? `${TRANSITION_DURATION}ms` : "0ms"
          }}
        >
          {slides.map((race, slideIndex) => {
            const isVisible = slideIndex === position;
            const originalIndex = hasLoop ? (slideIndex - 1 + races.length) % races.length : 0;
            return (
              <article
                aria-hidden={!isVisible}
                aria-label={`${originalIndex + 1} / ${races.length}：${race.title}`}
                aria-roledescription="slide"
                className={styles.hero}
                data-carousel-slide={originalIndex}
                key={`${race.id}-${slideIndex}`}
              >
                <div className={styles.heroContent}>
                  <p className={styles.eyebrow}>Agent Racing Yard · Featured Race</p>
                  <h1>{race.title}</h1>
                  <p className={styles.lead}>{race.challenge}</p>
                  <div className={styles.heroMetrics}>
                    <span><strong>{race.riders}</strong>Riders</span>
                    <span><strong>{race.works}</strong>公开 Works</span>
                    <span><strong>{label(race.status)}</strong>赛事状态</span>
                  </div>
                  <div className={styles.actions}>
                    <Link className={styles.primary} href={`/races/${race.slug}/live`} tabIndex={isVisible ? 0 : -1}>进入 Live Hall</Link>
                    <Link className={styles.secondary} href={`/races/${race.slug}`} tabIndex={isVisible ? 0 : -1}>查看 Race 详情</Link>
                  </div>
                </div>
                <div className={styles.heroMedia}>
                  <Image
                    alt={`${race.title} 赛事封面`}
                    fill
                    priority={slideIndex === (hasLoop ? 1 : 0)}
                    sizes="(max-width: 900px) 100vw, 50vw"
                    src={race.cover}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {hasLoop ? (
        <>
          <button className={`${styles.carouselArrow} ${styles.carouselPrevious}`} onClick={() => move(-1, true)} type="button" aria-label="上一场赛事">‹</button>
          <button className={`${styles.carouselArrow} ${styles.carouselNext}`} onClick={() => move(1, true)} type="button" aria-label="下一场赛事">›</button>
          <div className={styles.carouselDots} role="tablist" aria-label="选择精选赛事">
            {races.map((race, index) => (
              <button
                aria-label={`显示 ${race.title}`}
                aria-selected={index === activeIndex}
                className={index === activeIndex ? styles.carouselDotActive : undefined}
                key={race.id}
                onClick={() => choose(index)}
                role="tab"
                tabIndex={index === activeIndex ? 0 : -1}
                type="button"
              />
            ))}
          </div>
          <p className={styles.carouselHint}>{paused ? "自动轮播已暂停" : "自动轮播中 · 每 5 秒切换"}</p>
        </>
      ) : null}
    </section>
  );
}
