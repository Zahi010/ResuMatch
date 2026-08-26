import httpx
from typing import Optional, List, Dict, Any
from app.core.config import settings

def query_llm(prompt: str, response_format_json: bool = False, user_api_key: Optional[str] = None, user_model: Optional[str] = None) -> str:
    # 1. Try Gemini API first
    api_key = user_api_key if user_api_key else settings.GEMINI_API_KEY
    if api_key:
        model = user_model if user_model else "gemini-flash-lite-latest"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.0
            }
        }
        if response_format_json:
            payload["generationConfig"]["responseMimeType"] = "application/json"
            
        import time
        max_retries = 3
        for attempt in range(max_retries):
            try:
                with httpx.Client(timeout=45.0) as client:
                    res = client.post(url, json=payload)
                    if res.status_code == 429:
                        print(f"Rate limited on attempt {attempt+1}, backing off...")
                        time.sleep(15 * (attempt + 1))
                        if attempt == max_retries - 1:
                            raise Exception("Gemini API Rate Limit Exceeded (429). Please wait a minute and try again.")
                        continue
                    res.raise_for_status()
                    data = res.json()
                    text_response = data["candidates"][0]["content"]["parts"][0]["text"]
                    return text_response
            except Exception as e:
                if "Rate Limit Exceeded" in str(e):
                    raise e
                if attempt == max_retries - 1:
                    print(f"Gemini API Error: {e}")
                time.sleep(2 ** attempt + 1)
                
    # 2. Fallback to OpenAI if no Gemini key
    if settings.OPENAI_API_KEY:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        kwargs = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant. Always return valid JSON." if response_format_json else "You are a helpful assistant."},
                {"role": "user", "content": prompt}
            ]
        }
        if response_format_json:
            kwargs["response_format"] = {"type": "json_object"}
            
        try:
            response = client.chat.completions.create(**kwargs)
            return response.choices[0].message.content
        except Exception as e:
            print(f"OpenAI API Error: {e}")
            
    # 3. Raise exception if no valid keys
    raise ValueError("No valid API keys found for LLM querying")

def query_llm_vision(prompt: str, base64_image: str, mime_type: str = "image/png", response_format_json: bool = False, user_api_key: Optional[str] = None, user_model: Optional[str] = None) -> str:
    # Use Gemini API for Vision
    api_key = user_api_key if user_api_key else settings.GEMINI_API_KEY
    if api_key:
        model = user_model if user_model else "gemini-flash-lite-latest"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload: Dict[str, Any] = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": base64_image
                        }
                    }
                ]
            }]
        }
        payload["generationConfig"] = {
            "temperature": 0.0
        }
        if response_format_json:
            payload["generationConfig"]["responseMimeType"] = "application/json"
            
        import time
        max_retries = 3
        for attempt in range(max_retries):
            try:
                with httpx.Client(timeout=60.0) as client:
                    res = client.post(url, json=payload)
                    res.raise_for_status()
                    data = res.json()
                    text_response = data["candidates"][0]["content"]["parts"][0]["text"]
                    return text_response
            except Exception as e:
                if attempt == max_retries - 1:
                    print(f"Gemini Vision API Error: {e}")
                time.sleep(2)
                
    raise ValueError("No valid Gemini API key found for Vision querying")
