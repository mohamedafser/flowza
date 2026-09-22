"use client";

import { useEffect } from "react";

/**
 * Enables native smooth scrolling on the landing page and clears any
 * leftover body scroll locks from dashboard shells.
 */
export function LandingScrollFix() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const prevHtmlBehavior = html.style.scrollBehavior;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;

    html.style.scrollBehavior = "smooth";
    html.style.overflow = "";
    html.style.overflowX = "hidden";
    html.style.overflowY = "auto";
    body.style.overflow = "";
    body.style.overflowX = "hidden";
    body.style.overflowY = "auto";
    body.style.overscrollBehavior = "auto";

    return () => {
      html.style.scrollBehavior = prevHtmlBehavior;
      html.style.overflow = prevHtmlOverflow;
      html.style.overflowX = "";
      html.style.overflowY = "";
      body.style.overflow = prevBodyOverflow;
      body.style.overflowX = "";
      body.style.overflowY = "";
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, []);

  return null;
}
