from langchain_openai import ChatOpenAI

from app.core.prompts import CONTEXTUALIZE_PROMPT, SYSTEM_PROMPT
from app.core.retriever import retrieve_chunks


# Groq exposes an OpenAI-compatible chat endpoint, so the same ChatOpenAI client works for
# both providers — only the base_url and model differ. There is no server-side key: every
# call is built from the key the user supplied with the request.
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "groq": "llama-3.3-70b-versatile",
}


def build_llm(provider: str, api_key: str, model: str | None = None) -> ChatOpenAI:
    """Build a chat client from a user-supplied key. `provider` selects which API it talks to."""
    if provider not in DEFAULT_MODELS:
        raise ValueError(f"Unsupported provider: {provider}")

    kwargs = {"model": model or DEFAULT_MODELS[provider], "temperature": 0, "api_key": api_key}
    if provider == "groq":
        kwargs["base_url"] = GROQ_BASE_URL
    return ChatOpenAI(**kwargs)


def contextualize_question(llm: ChatOpenAI, question: str, chat_history: list[dict]) -> str:
    """
    Rewrites a follow-up question into a standalone one using chat history, so retrieval
    isn't blind to references like "it"/"that" — retrieve_chunks() only ever sees the raw
    question text, so "tell me more about it" embeds and searches as-is otherwise.
    """
    if not chat_history:
        return question

    history_text = "\n".join(f"{m['role']}: {m['content']}" for m in chat_history[-6:])
    prompt = CONTEXTUALIZE_PROMPT.format(history=history_text, question=question)
    response = llm.invoke([{"role": "user", "content": prompt}])
    return response.content.strip()


def answer_question(
    question: str,
    document_ids: list[str],
    provider: str,
    api_key: str,
    chat_history: list[dict] | None = None,
    document_filenames: dict[str, str] | None = None,
    model: str | None = None,
) -> dict:
    """
    Answer a question based on the context retrieved across all documents attached to
    the conversation. document_filenames (document_id -> filename) disambiguates context
    and citations when more than one document is attached — without it, two attached PDFs
    that both have e.g. a "page 3" would be indistinguishable to the model and to the user.
    """
    document_filenames = document_filenames or {}
    llm = build_llm(provider, api_key, model)

    # Resolve references from chat history before embedding, so retrieval targets what the
    # question actually means rather than its literal (possibly pronoun-only) wording.
    search_question = contextualize_question(llm, question, chat_history or [])

    # Retrieve relevant chunks for the (contextualized) question across the attached documents
    chunks = retrieve_chunks(search_question, document_ids)

    def label(chunk):
        filename = document_filenames.get(chunk["document_id"])
        return f"[{filename}, page {chunk['page_number']}]" if filename else f"[Page {chunk['page_number']}]"

    # Prepare the context for the system prompt
    context = "\n\n".join(f"{label(chunk)} {chunk['chunk_text']}" for chunk in chunks)


    # Format the system prompt with the retrieved context
    system_prompt = SYSTEM_PROMPT.format(context=context)

    # Prepare messages for the LLM
    messages = [{"role": "system", "content": system_prompt}]

    if chat_history:
        messages.extend(chat_history[-6:])

    messages.append({"role": "user", "content": question})

    # Get the answer from the LLM
    response = llm.invoke(messages)

    sources = [
        {
            "page_number": chunk["page_number"],
            "chunk_text": chunk["chunk_text"],
            "filename": document_filenames.get(chunk["document_id"]),
        }
        for chunk in chunks
    ]

    return {
        "answer": response.content,
        "sources": sources,
    }