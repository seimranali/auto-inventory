import { useId } from 'react';

// Brand mark: car on a blue→indigo tile (same artwork as public/favicon.svg)
export default function Logo({ size = 34, className = '' }) {
  const id = useId();
  return (
    <svg className={`logo ${className}`} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Auto Inventory">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#${id})`} />
      <path d="M10 13.5h28" stroke="#fff" strokeOpacity=".35" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M7.5 30.2v-3c0-1.3.9-2.4 2.2-2.7l4.4-1 3.6-4.5c.8-1 2-1.6 3.3-1.6h7.6c1.2 0 2.4.6 3.2 1.5l3.8 4.6 3 .6c1.4.3 2.4 1.5 2.4 2.9v3.2c0 .9-.7 1.6-1.6 1.6H9.1c-.9 0-1.6-.7-1.6-1.6z" fill="#fff" />
      <path d="M19.2 20.3c.4-.5 1-.8 1.6-.8h3.5v4.6h-7.9zM27 19.5h3.2c.6 0 1.2.3 1.6.7l3.1 3.9H27z" fill="#4f46e5" fillOpacity=".55" />
      <circle cx="15" cy="32" r="3.8" fill="#1e1b4b" stroke="#fff" strokeWidth="2" />
      <circle cx="33" cy="32" r="3.8" fill="#1e1b4b" stroke="#fff" strokeWidth="2" />
      <path d="M10 39h28" stroke="#fff" strokeOpacity=".35" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
