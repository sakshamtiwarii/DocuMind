from langchain.text_splitter import RecursiveCharacterTextSplitter  
from app.config import settings

def chunk_pages(pages: list[dict]) -> list[dict]:
    """
    Splits the text of each page into smaller chunks.

    Args:
        pages (list[dict]): A list of dictionaries, each containing the page number and extracted text.

    Returns:
        list[dict]: A list of dictionaries, each containing the page number and a chunk of text.
    """
    text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=settings.chunk_size,
    chunk_overlap=settings.chunk_overlap,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""],
    )


    chunks = []
    for page in pages:
        page_number = page["page_number"]
        text = page["text"]
        page_chunks = text_splitter.split_text(text)
        for idx, chunk_text in enumerate(page_chunks):
            chunks.append({"page_number": page_number, "chunk_index": idx, "chunk_text": chunk_text})
    return chunks