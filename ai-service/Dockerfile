# Stage 1: Base Setup
FROM python:3.10-slim

RUN echo "--- LOG: STARTING SYSTEM SETUP ---"
RUN apt-get update && apt-get install -y \
    libgl1 \
    libgomp1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Stage 2: Dependencies
WORKDIR /app
RUN echo "--- LOG: INSTALLING REQUIREMENTS ---"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 3: Pre-download AI Models
RUN echo "--- LOG: PRE-DOWNLOADING AI MODELS ---"
RUN python3 -c "from paddleocr import PaddleOCR; PaddleOCR(use_angle_cls=True, lang='en', ocr_version='PP-OCRv3')"

# Stage 4: Source Code
RUN echo "--- LOG: COPYING SOURCE CODE ---"
COPY . .

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=7860
ENV OMP_NUM_THREADS=1

# Expose
EXPOSE 7860

# CMD (Use python module for better logging capture)
CMD ["python3", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860", "--log-level", "info"]
