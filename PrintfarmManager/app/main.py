from fastapi import FastAPI

app = FastAPI()

# Api routes

@app.get("/health")
def health():
    return {"status": "ok"}