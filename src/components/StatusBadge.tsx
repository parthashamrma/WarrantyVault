import React from 'react';
import { WarrantyStatus } from '../types/database';

interface StatusBadgeProps {
  status: WarrantyStatus;
  daysRemaining?: number;
  className?: string;
  showDays?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  daysRemaining,
  className = '',
  showDays = false,
}) => {
  let badgeStyle = 'bg-[var(--g)] text-white';
  let label = 'Active';

  if (status === 'Expiring Soon') {
    badgeStyle = 'bg-[var(--a)] text-[#16130F] font-semibold';
    label = 'Expiring Soon';
  } else if (status === 'Expired') {
    badgeStyle = 'bg-[var(--r)] text-white';
    label = 'Expired';
  }

  const getDaysText = () => {
    if (daysRemaining === undefined) return '';
    if (daysRemaining < 0) {
      const absDays = Math.abs(daysRemaining);
      return ` • Expired ${absDays} ${absDays === 1 ? 'day' : 'days'} ago`;
    }
    if (daysRemaining === 0) {
      return ' • Expires today';
    }
    return ` • ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left`;
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[11px] tracking-wider uppercase px-2.5 py-0.5 rounded-full border border-[var(--ink)]/15 shadow-sm ${badgeStyle} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      <span>{label}</span>
      {showDays && daysRemaining !== undefined && (
        <span className="opacity-90 normal-case font-sans text-[11px] font-medium tracking-normal">
          {getDaysText()}
        </span>
      )}
    </span>
  );
};

