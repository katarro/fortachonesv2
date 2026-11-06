export default function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <symbol id="i-heart" viewBox="0 0 24 24">
        <path d="M12 21C5 15.5 2 12 2 8a5.5 5.5 0 0 1 10-3.2A5.5 5.5 0 0 1 22 8c0 4-3 7.5-10 13z"/>
      </symbol>
      <symbol id="i-check" viewBox="0 0 24 24">
        <path d="M5 12.5l4.5 4.5L19 7.5"/>
      </symbol>
      <symbol id="i-clock" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 7v5l3 2"/>
      </symbol>
      <symbol id="i-camera" viewBox="0 0 24 24">
        <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
        <circle cx="12" cy="13.5" r="3.5"/>
      </symbol>
      <symbol id="i-sun" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>
      </symbol>
      <symbol id="i-moon" viewBox="0 0 24 24">
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>
      </symbol>
      <symbol id="i-menu" viewBox="0 0 24 24">
        <path d="M4 7h16M4 12h16M4 17h16"/>
      </symbol>
      <symbol id="i-close" viewBox="0 0 24 24">
        <path d="M6 6l12 12M18 6L6 18"/>
      </symbol>
      <symbol id="i-left" viewBox="0 0 24 24">
        <path d="M15 5l-7 7 7 7"/>
      </symbol>
      <symbol id="i-right" viewBox="0 0 24 24">
        <path d="M9 5l7 7-7 7"/>
      </symbol>
      <symbol id="i-plus" viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14"/>
      </symbol>
      <symbol id="i-bell" viewBox="0 0 24 24">
        <path d="M6 10a6 6 0 0 1 12 0c0 6 2.5 7 2.5 7h-17S6 16 6 10zM10 20.5a2.2 2.2 0 0 0 4 0"/>
      </symbol>
      <symbol id="i-exit" viewBox="0 0 24 24">
        <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M19 12H9"/>
      </symbol>
      <symbol id="i-image" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <path d="M21 15l-5-5L5 21"/>
      </symbol>

      <symbol id="face-a" viewBox="0 0 120 120">
        <path fill="var(--hair-a)" d="M56 10C24 10 6 36 9 68c1 16-3 28-6 40 14 7 32 4 42-6h20V30z"/>
        <circle cx="60" cy="62" r="42" fill="var(--skin-a)"/>
        <path fill="var(--hair-a)" d="M19 56C22 30 42 15 66 19c17 3 30 15 34 33-13-12-30-17-46-13-13 3-25 8-35 17z"/>
        <path d="M67 59q8 7 17 0" fill="none" stroke="var(--hair-a)" strokeWidth="3.5" strokeLinecap="round"/>
        <circle cx="75" cy="76" r="8" fill="var(--blush)" opacity=".65"/>
        <ellipse cx="102" cy="78" rx="6" ry="4.5" fill="var(--lip)"/>
        <ellipse cx="102" cy="85" rx="6" ry="4.5" fill="var(--lip)"/>
      </symbol>

      <symbol id="face-b" viewBox="0 0 120 120">
        <g transform="translate(120 0) scale(-1 1)">
          <circle cx="60" cy="62" r="42" fill="var(--skin-b)"/>
          <path fill="var(--hair-b)" d="M15 62C10 30 34 10 62 12c22 1 38 16 40 38-10-9-22-14-36-13-16 1-27 3-34 11-5 5-11 8-17 14z"/>
          <path d="M66 49q9-5 18-1" fill="none" stroke="var(--hair-b)" strokeWidth="4.5" strokeLinecap="round"/>
          <path d="M67 60q8 7 17 0" fill="none" stroke="var(--hair-b)" strokeWidth="3.5" strokeLinecap="round"/>
          <circle cx="75" cy="76" r="7" fill="var(--blush)" opacity=".4"/>
          <ellipse cx="102" cy="78" rx="6" ry="4.5" fill="var(--lip)"/>
          <ellipse cx="102" cy="85" rx="6" ry="4.5" fill="var(--lip)"/>
        </g>
      </symbol>
    </svg>
  );
}
