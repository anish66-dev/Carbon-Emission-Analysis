from pymongo import MongoClient
from app.config import settings

# Initialize the global MongoDB client instance
client = MongoClient(settings.MONGO_URI)

def get_db():
    """
    Returns the target database connection namespace handler.
    Use this utility function across routes to read/write records.
    """
    return client[settings.DATABASE_NAME]