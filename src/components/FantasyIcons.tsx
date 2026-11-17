import { CustomizationCategoryKey } from '../types/game';

interface CategoryIconProps {
  category: CustomizationCategoryKey;
  className?: string;
}

export function FantasyCategoryIcon({ category, className = 'w-5 h-5' }: CategoryIconProps) {
  switch (category) {
    case 'costume':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M8.5 3.5L12 6l3.5-2.5L20 6.5l-2 4.5-2-1V20.5H8V10l-2 1-2-4.5L8.5 3.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M9.5 4.2L12 11l2.5-6.8" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 13.5h8" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case 'hair':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M6.5 18.5C5.2 14.5 5.8 8.2 10 5.4c2.8-1.9 6.6-1.4 8.5 1.3 1.4 2 1.2 5.4.1 8.8-.6 1.8-1.6 3.5-2.6 4.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M10 6.2c.5 3.2-.6 6.8-2.6 9.6M13.8 5.2c1.2 3.8.5 8.5-1.6 12.8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path d="M12 2.5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'sword':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M19.5 3.5L15.8 4.2 6.8 14.2l2.6 2.6 9.9-9.1.2-4.2Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M5.2 12.8l5.8 5.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M7.5 16.5L4 20" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );
    case 'archery':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M15.5 3.5c3.8 4.2 3.8 12.8 0 17"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="M15.5 3.5v17" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
          <path d="M4.5 12h15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path
            d="M16.8 9.5L20 12l-3.2 2.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M6.5 10.2L4.5 12l2 1.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'superpower':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M12 2.8l2.2 5.4 5.8 1.2-4.4 4 1.1 5.8L12 16.3 7.3 19.2l1.1-5.8-4.4-4 5.8-1.2L12 2.8Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        </svg>
      );
    case 'skinTone':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M12 3.5c3.5 4.3 6 7.8 6 11a6 6 0 1 1-12 0c0-3.2 2.5-6.7 6-11Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 15.2a2.8 2.8 0 0 0 2.8 2.6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}
