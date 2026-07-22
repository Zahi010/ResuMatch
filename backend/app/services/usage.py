import datetime
from sqlalchemy.orm import Session
from app.models.models import ModelUsage

def track_usage(db: Session, user_id: int, model_name: str) -> None:
    today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    if not model_name:
        model_name = "gemini-flash-lite-latest"
        
    usage = db.query(ModelUsage).filter(
        ModelUsage.user_id == user_id,
        ModelUsage.model_name == model_name,
        ModelUsage.date == today
    ).first()
    
    if not usage:
        usage = ModelUsage(user_id=user_id, model_name=model_name, date=today, count=1)
        db.add(usage)
    else:
        usage.count += 1
        
    db.commit()
