import Image from "next/image";

/**
 * The wide lockup — lion mark plus "Tax Advisory Growth".
 *
 * No wordmark alongside it. The lockup already contains the company name set
 * in the brand's own type; repeating it in system sans next door would say the
 * same thing twice in two different voices, which reads as a placeholder that
 * nobody finished.
 *
 * Two assets, on purpose:
 *   `/lockup.png`  2.29:1 — the rail and sign-in
 *   `/lion.png`    1:1    — the favicon, declared in layout.tsx
 *
 * They cannot be one file. A 2.29:1 lockup rendered into a 16px favicon is an
 * illegible smear, and the square mark stretched across the rail would lose the
 * name. Different shapes, different jobs.
 *
 * `priority` because this sits in the rail on every authenticated route — it is
 * always above the fold, and lazy-loading produces a visible pop-in on first
 * paint of every navigation.
 */

const LOCKUP_W = 1574;
const LOCKUP_H = 688;
const LOCKUP_RATIO = LOCKUP_H / LOCKUP_W;

/**
 * `fluid` fills the container instead of taking a pixel width, so the lockup
 * tracks whatever it sits above — on sign-in that is the input and button, and
 * a fixed width would drift out of alignment the moment the card's width or
 * breakpoints change. The rail keeps the fixed form: it has a stable width and
 * a logo that stretched with it would be doing something nobody asked for.
 */
export function Logo({
  width = 200,
  fluid = false,
}: {
  width?: number;
  fluid?: boolean;
}) {
  return (
    <Image
      src="/lockup.png"
      alt="Tax Advisory Growth"
      /**
       * When fluid these are the intrinsic dimensions, not the rendered ones —
       * CSS decides the size, and Next only needs the ratio to reserve space
       * and avoid a layout shift on first paint.
       */
      width={fluid ? LOCKUP_W : width}
      height={fluid ? LOCKUP_H : Math.round(width * LOCKUP_RATIO)}
      priority
      sizes={fluid ? "(max-width: 24rem) 100vw, 24rem" : undefined}
      className={fluid ? "h-auto w-full" : "h-auto"}
    />
  );
}
