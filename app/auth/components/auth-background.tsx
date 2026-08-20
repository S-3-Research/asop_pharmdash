"use client";

import { memo, type ReactNode } from "react";

/**
 * Shared dark "glass" backdrop for auth pages (login, forgot-password,
 * set-password/activate). Mirrors the visual language of the demo home
 * page: grid texture, soft top-right light beam, and a translucent
 * blurred card. Pass the form/content as children — this component only
 * owns the page chrome. The logo lives inside each page's card so it
 * scales with the card rather than floating separately above it.
 *
 * Wrapped in memo() because the parent (e.g. the login form) re-renders
 * on every keystroke. Without memo, this whole tree — including the
 * `<style>` tag and several stacked `filter: blur(...)` /
 * `backdrop-filter: blur(...)` layers covering most of the viewport —
 * was being reconciled on every keystroke. Re-touching those blur
 * layers that often is expensive to composite on mobile GPUs and,
 * combined with the viewport resize from the on-screen keyboard
 * opening, was enough to crash the tab on mobile Chrome/Safari
 * ("a problem occurred repeatedly").
 */
function AuthBackground({ children }: { children: ReactNode }) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes fadeInUp {
          0%   { opacity: 0; transform: translateY(28px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .auth-fade-in-up {
          opacity: 0;
          animation: fadeInUp 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        @keyframes beamFadeIn {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        .auth-beam {
          opacity: 0;
          animation: beamFadeIn 1.2s ease-out forwards;
          animation-delay: 0.4s;
        }

        .auth-glass-card {
          background: rgb(20, 24, 32, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 8px 40px rgba(0, 0, 0, 0.35);
        }

        .auth-bg-grid {
          background-size: 40px 40px;
          background-image:
            linear-gradient(to right,  rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
        }

        /* Mobile browsers (particularly Chrome/Safari on iOS/Android) can
         * crash the tab when several large, viewport-covering
         * backdrop-filter/filter blur layers have to be recomposited in
         * response to the on-screen keyboard resizing the viewport. Cut
         * the blur cost substantially on small screens — visually close
         * enough, and far cheaper for the GPU. */
        @media (max-width: 768px) {
          .auth-glass-card {
            backdrop-filter: blur(8px);
          }
          .auth-beam-layer-1 {
            filter: blur(24px) !important;
          }
          .auth-beam-layer-2 {
            filter: blur(32px) !important;
          }
        }
      `,
        }}
      />

      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black p-6 font-sans">
        {/* Backgrounds */}
        <div className="pointer-events-none absolute inset-0 auth-bg-grid" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-gradient-to-b from-blue-900/10 via-transparent to-transparent" />
        <div className="pointer-events-none absolute -bottom-1/2 inset-x-0 h-[600px] w-full bg-gradient-to-t from-purple-900/10 via-transparent to-transparent blur-3xl" />

        {/* Light beam (top-right origin, subtle) */}
        <div
          className="auth-beam pointer-events-none absolute right-[-100px] top-0"
          style={{ width: "70vw", height: "80vh" }}
        >
          <div
            className="auth-beam-layer-1"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: "100%",
              height: "100%",
              transform: "rotate(20deg)",
              transformOrigin: "top right",
              background:
                "radial-gradient(ellipse at top right, rgba(160,205,255,0.30) 0%, rgba(70,135,235,0.16) 40%, transparent 85%)",
              filter: "blur(48px)",
            }}
          />
          <div
            className="auth-beam-layer-2"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: "75%",
              height: "70%",
              transform: "rotate(12deg)",
              transformOrigin: "top right",
              background:
                "radial-gradient(ellipse at top right, rgba(160,205,255,0.18) 0%, rgba(70,135,235,0.08) 50%, transparent 85%)",
              filter: "blur(72px)",
            }}
          />
        </div>

        {/* Content — vertically centered in the viewport. */}
        <div className="relative z-10 w-full max-w-md">
          <div className="auth-fade-in-up" style={{ animationDelay: "0.12s" }}>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(AuthBackground);

