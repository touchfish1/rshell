import { useI18n } from "../i18n-context";

interface Props {
  message: string;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: Props) {
  const { tr } = useI18n();
  return (
    <div className="error-banner error-banner-dismissible" role="alert">
      <span className="error-banner-text">{message}</span>
      <button
        type="button"
        className="error-banner-dismiss"
        onClick={onDismiss}
        aria-label={tr("error.dismiss")}
      >
        ×
      </button>
    </div>
  );
}
