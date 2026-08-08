from types import SimpleNamespace

from app.core.chain import answer_question


def test_answer_question_labels_context_and_sources_by_filename(mocker):
    """With more than one document attached to a conversation, two chunks that happen to
    share a page number must stay distinguishable — both in what the LLM sees and in what
    gets cited back to the user."""
    mocker.patch(
        "app.core.chain.retrieve_chunks",
        return_value=[
            {"page_number": 3, "chunk_text": "Alpha content", "document_id": "doc-a", "chunk_index": 0, "score": 0.9},
            {"page_number": 3, "chunk_text": "Beta content", "document_id": "doc-b", "chunk_index": 0, "score": 0.8},
        ],
    )
    captured = {}

    def fake_invoke(messages):
        captured["messages"] = messages
        return SimpleNamespace(content="synthesized answer")

    mocker.patch("app.core.chain.ChatOpenAI.invoke", side_effect=fake_invoke)

    result = answer_question(
        "what's on page 3?",
        ["doc-a", "doc-b"],
        "openai",
        "test-key",
        chat_history=None,
        document_filenames={"doc-a": "alpha.pdf", "doc-b": "beta.pdf"},
    )

    system_prompt = captured["messages"][0]["content"]
    assert "[alpha.pdf, page 3] Alpha content" in system_prompt
    assert "[beta.pdf, page 3] Beta content" in system_prompt

    assert result["answer"] == "synthesized answer"
    assert result["sources"] == [
        {"page_number": 3, "chunk_text": "Alpha content", "filename": "alpha.pdf"},
        {"page_number": 3, "chunk_text": "Beta content", "filename": "beta.pdf"},
    ]


def test_answer_question_falls_back_without_filenames(mocker):
    """Single-document conversations (or callers that don't pass document_filenames) should
    still work — no filename tag, just the page number, same as before this fix."""
    mocker.patch(
        "app.core.chain.retrieve_chunks",
        return_value=[
            {"page_number": 5, "chunk_text": "Some content", "document_id": "doc-a", "chunk_index": 0, "score": 0.9},
        ],
    )
    mocker.patch("app.core.chain.ChatOpenAI.invoke", return_value=SimpleNamespace(content="answer"))

    result = answer_question("a question", ["doc-a"], "openai", "test-key")

    assert result["sources"] == [{"page_number": 5, "chunk_text": "Some content", "filename": None}]
