import ApiKeyForm from "./ApiKeyForm";
import { IconClose } from "./icons";

/** Dismissible modal for changing or removing an already-configured key. The first-run
 *  gate (no key yet) renders ApiKeyForm directly in App.jsx instead — there's nothing to
 *  dismiss to at that point. */
export default function ApiKeySettings({ config, onSave, onRemove, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/20 px-4">
      <div className="w-full max-w-[26rem] rounded-[4px] border border-rule-strong bg-paper p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-[1.0625rem] font-medium text-ink">API key</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 p-1 text-faint transition-colors hover:text-ink"
          >
            <IconClose size={16} />
          </button>
        </div>

        <div className="mt-5">
          <ApiKeyForm
            initialProvider={config?.provider}
            initialApiKey={config?.apiKey}
            onSave={onSave}
            onCancel={onClose}
            onRemove={config ? onRemove : undefined}
          />
        </div>
      </div>
    </div>
  );
}
