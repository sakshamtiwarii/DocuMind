import ChatScreen from "./components/ChatScreen";
import ErrorBanner from "./components/ErrorBanner";
import ProcessingScreen from "./components/ProcessingScreen";
import Spinner from "./components/Spinner";
import UploadScreen from "./components/UploadScreen";
import { useDocuMind } from "./hooks/useDocuMind";

export default function App() {
  const {
    screen,
    document,
    messages,
    error,
    isAsking,
    uploadFile,
    sendMessage,
    newDocument,
    dismissError,
  } = useDocuMind();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {error && screen !== "chat" && (
        <div className="mx-auto max-w-lg px-6 pt-6">
          <ErrorBanner message={error} onDismiss={dismissError} />
        </div>
      )}

      {screen === "restoring" && (
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="h-6 w-6 text-indigo-600" />
        </div>
      )}

      {screen === "upload" && <UploadScreen onUpload={uploadFile} />}

      {screen === "processing" && (
        <ProcessingScreen document={document} onRetry={newDocument} />
      )}

      {screen === "chat" && (
        <>
          {error && (
            <div className="mx-auto max-w-3xl px-4 pt-4">
              <ErrorBanner message={error} onDismiss={dismissError} />
            </div>
          )}
          <ChatScreen
            document={document}
            messages={messages}
            isAsking={isAsking}
            onSend={sendMessage}
            onNewDocument={newDocument}
          />
        </>
      )}
    </div>
  );
}
