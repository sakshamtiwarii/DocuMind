from app.core.chunking import chunk_pages


def test_chunk_pages_splits_long_text_into_multiple_chunks():
    pages = [{"page_number": 1, "text": "word " * 500}]
    chunks = chunk_pages(pages)
    assert len(chunks) > 1
    assert all(c["page_number"] == 1 for c in chunks)


def test_chunk_pages_chunk_index_resets_per_page():
    pages = [
        {"page_number": 1, "text": "word " * 500},
        {"page_number": 2, "text": "short text"},
    ]
    chunks = chunk_pages(pages)
    page_2_chunks = [c for c in chunks if c["page_number"] == 2]
    assert page_2_chunks[0]["chunk_index"] == 0


def test_chunk_pages_empty_input_returns_empty_list():
    assert chunk_pages([]) == []


def test_chunk_pages_output_has_expected_keys():
    pages = [{"page_number": 1, "text": "hello world"}]
    chunks = chunk_pages(pages)
    assert set(chunks[0].keys()) == {"page_number", "chunk_index", "chunk_text"}
