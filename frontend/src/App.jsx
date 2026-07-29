import { useState } from "react";
import ChatScreen from "./components/ChatScreen";
import ErrorBanner from "./components/ErrorBanner";
import Sidebar from "./components/Sidebar";
import Spinner from "./components/Spinner";
import Wordmark from "./components/Wordmark";
import { IconPanel, IconPlus } from "./components/icons";
import { useConversations } from "./hooks/useConversations";

export default function App() {
  const {
    conversations,
    isLoadingList,
    activeId,
    activeSession,
    activeTitle,
    isLoadingActive,
    isAsking,
    isUploading,
    error,
    selectConversation,
    createNewConversation,
    deleteConversation,
    sendMessage,
    addDocument,
    dismissError,
  } = useConversations();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        isLoading={isLoadingList}
        isOpen={isSidebarOpen}
        onSelect={(id) => {
          selectConversation(id);
          setIsSidebarOpen(false);
        }}
        onNew={() => {
          createNewConversation();
          setIsSidebarOpen(false);
        }}
        onDelete={deleteConversation}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {error && (
          <div className="mx-auto w-full max-w-[46rem] shrink-0 px-6 pt-5 sm:px-10">
            <ErrorBanner message={error} onDismiss={dismissError} />
          </div>
        )}

        {isLoadingList && !activeId && (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="size-5 text-clay" />
          </div>
        )}

        {!isLoadingList && !activeId && (
          <div className="flex flex-1 items-center justify-center px-8">
            <div className="w-full max-w-[30rem]">
              <Wordmark className="text-[2rem]" />
              <p className="mt-5 max-w-[36ch] font-serif text-[1.1875rem] leading-relaxed text-muted">
                Ask questions of your PDFs and get answers drawn only from what's inside — each
                one citing the page it came from.
              </p>

              <div className="mt-9 flex items-center gap-5">
                <button
                  type="button"
                  onClick={createNewConversation}
                  className="flex items-center gap-2 rounded-[3px] border border-rule-strong px-4 py-2 text-[0.8125rem] text-ink transition-colors hover:border-clay hover:text-clay"
                >
                  <IconPlus size={14} />
                  New conversation
                </button>

                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="flex items-center gap-2 text-[0.8125rem] text-muted transition-colors hover:text-ink md:hidden"
                >
                  <IconPanel size={15} />
                  Browse
                </button>
              </div>
            </div>
          </div>
        )}

        {activeId && (
          <ChatScreen
            title={activeTitle ?? "New conversation"}
            documents={activeSession?.documents ?? []}
            messages={activeSession?.messages ?? []}
            isLoadingActive={isLoadingActive}
            isAsking={isAsking}
            isUploading={isUploading}
            onSend={sendMessage}
            onAddDocument={addDocument}
            onOpenSidebar={() => setIsSidebarOpen(true)}
          />
        )}
      </div>
    </div>
  );
}
