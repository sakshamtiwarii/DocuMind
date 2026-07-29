import os

from pypdf import PdfReader

def extract_pages(file_path: str) -> list[dict]:
    """
    Extracts text from each page of a PDF file.

    Args:
        file_path (str): The path to the PDF file.  

    Returns:
        list[dict]: A list of dictionaries, each containing the page number and extracted text.
    """
    if not file_path:
        raise ValueError("File path is empty.")

    if(not file_path.lower().endswith('.pdf')):
        raise ValueError("The provided file is not a PDF.")

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"The file {file_path} does not exist.")

    reader = PdfReader(file_path)
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text.strip():
            pages.append({"page_number": i + 1, "text": text})
    return pages