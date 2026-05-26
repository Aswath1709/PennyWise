import sys

try:
    import pdfplumber
    with pdfplumber.open('pnc.pdf') as pdf:
        text = ""
        for page in pdf.pages:
            text += page.extract_text() + "\n"
        print(text[:3000])
except ImportError:
    print("pdfplumber not found on host")
    try:
        import PyPDF2
        with open('pnc.pdf', 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            print(text[:3000])
    except ImportError:
        print("PyPDF2 not found either.")
