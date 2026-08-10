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

const LOCKUP_RATIO = 688 / 1574;

export function Logo({ width = 200 }: { width?: number }) {
  return (
    <Image
      src="/lockup.png"
      alt="Tax Advisory Growth"
      width={width}
      height={Math.round(width * LOCKUP_RATIO)}
      priority
      className="h-auto"
    />
  );
}
