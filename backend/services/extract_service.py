import pdfplumber
from docx import Document


def extract_text(file_path: str, file_type: str) -> str:
    """根据文件类型抽取纯文本"""
    if file_type == "pdf":
        return _extract_pdf(file_path)
    elif file_type == "docx":
        return _extract_docx(file_path)
    elif file_type in ("txt", "md"):
        return _extract_txt(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def _extract_pdf(file_path: str) -> str:
    texts = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                texts.append(text)
    return "\n".join(texts)


def _extract_docx(file_path: str) -> str:
    doc = Document(file_path)
    texts = [para.text for para in doc.paragraphs if para.text.strip()]
    return "\n".join(texts)


def _extract_txt(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()
