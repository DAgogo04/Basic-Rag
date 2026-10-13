import re


def clean_text(text: str) -> str:
    """文本清洗：删除多余换行、页码、合并空格、删除噪音字符"""
    # 删除页码模式（如 "第1页"、"Page 1"、"- 1 -" 等）
    text = re.sub(r"第\s*\d+\s*页", "", text)
    text = re.sub(r"[Pp]age\s*\d+", "", text)
    text = re.sub(r"-\s*\d+\s*-", "", text)

    # 删除噪音字符（不可见控制字符，保留换行和空格）
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # 删除多余换行（3个以上连续换行合并为2个）
    text = re.sub(r"\n{3,}", "\n\n", text)

    # 合并多余空格（连续多个空格合并为一个）
    text = re.sub(r"[ \t]{2,}", " ", text)

    # 去除每行首尾空格
    lines = [line.strip() for line in text.split("\n")]
    text = "\n".join(lines)

    return text.strip()
