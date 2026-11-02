import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="ref-footer">
      <span>© WarrantyVault</span>
      <p>
        WarrantyVault tracks information you enter and does not guarantee warranty eligibility. Date convention: expiry
        = purchase date + duration, and the expiry date itself is still covered; a warranty is Expired the day after.
      </p>
    </footer>
  );
};
