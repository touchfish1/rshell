function EyeOpenIcon() {
  return (
    <svg className="password-toggle-svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"
      />
      <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg className="password-toggle-svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"
      />
      <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" d="M5 5l14 14" />
    </svg>
  );
}

interface Props {
  visible: boolean;
  loading: boolean;
  showTitle: string;
  hideTitle: string;
  onClick: () => void;
}

export function PasswordVisibilityToggle({ visible, loading, showTitle, hideTitle, onClick }: Props) {
  return (
    <button
      type="button"
      className="password-toggle-btn"
      onClick={onClick}
      disabled={loading}
      title={visible ? hideTitle : showTitle}
      aria-label={visible ? hideTitle : showTitle}
    >
      {loading ? (
        <span className="password-toggle-loading" aria-hidden>
          …
        </span>
      ) : visible ? (
        <EyeOpenIcon />
      ) : (
        <EyeClosedIcon />
      )}
    </button>
  );
}
