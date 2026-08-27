import React from 'react';

const environmentLabel = import.meta.env.VITE_ENV_LABEL?.trim();

const EnvironmentBadge: React.FC = () => {
  if (!environmentLabel) return null;

  return (
    <div
      className="environment-badge"
      data-environment-marker={environmentLabel.toLowerCase()}
      role="status"
      aria-label={`Environment: ${environmentLabel}`}
    >
      {environmentLabel}
    </div>
  );
};

export default EnvironmentBadge;
