export function SleeveArt({ seed }: { seed: string }) {
  // A deterministic SVG fallback pattern for weekly digests without an image cover
  // Simple abstract generative art based on seed string
  const num = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue1 = num % 360;
  const hue2 = (num * 7) % 360;
  
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full object-cover" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${num}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={`hsl(${hue1}, 70%, 20%)`} />
          <stop offset="100%" stopColor={`hsl(${hue2}, 70%, 15%)`} />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#grad-${num})`} />
      <path
        d="M 0 300 C 150 150 250 150 400 300"
        fill="none"
        stroke={`hsl(${hue1}, 80%, 40%)`}
        strokeWidth="4"
        strokeDasharray="4 8"
      />
      <circle cx="200" cy="150" r="40" fill="none" stroke={`hsl(${hue2}, 80%, 50%)`} strokeWidth="1" />
      <circle cx="200" cy="150" r="30" fill="none" stroke={`hsl(${hue1}, 80%, 60%)`} strokeWidth="2" />
    </svg>
  );
}
