from langchain_openai import ChatOpenAI

from app.config import settings
from app.core.prompts import CONTEXTUALIZE_PROMPT, SYSTEM_PROMPT
from app.core.retriever import retrieve_chunks


llm = ChatOpenAI(model=settings.chat_model, temperature=0, openai_api_key=settings.openai_api_key)


def contextualize_question(question: str, chat_history: list[dict]) -> str:
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


def answer_question(question: str, document_id: str, chat_history: list[dict] | None = None) -> dict:
    """
    Answer a question based on the context retrieved from the document.
    """
    # Resolve references from chat history before embedding, so retrieval targets what the
    # question actually means rather than its literal (possibly pronoun-only) wording.
    search_question = contextualize_question(question, chat_history or [])

    # Retrieve relevant chunks for the (contextualized) question and document_id
    chunks = retrieve_chunks(search_question, document_id)

    # Prepare the context for the system prompt
    context = "\n\n".join(f"[Page {chunk['page_number']}] {chunk['chunk_text']}" for chunk in chunks)


    # Format the system prompt with the retrieved context
    system_prompt = SYSTEM_PROMPT.format(context=context)

    # Prepare messages for the LLM
    messages = [{"role": "system", "content": system_prompt}]
    
    if chat_history:
        messages.extend(chat_history[-6:])
    
    messages.append({"role": "user", "content": question})

    # Get the answer from the LLM
    response = llm.invoke(messages)

    return {
        "answer": response.content,
        "sources": chunks,
    }