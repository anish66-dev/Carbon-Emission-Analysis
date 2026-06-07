from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    #DB
    MONGO_URI: str
    DATABASE_NAME: str

    #AI
    GROQ_API_KEY: str
    GROQ_API_MODEL: str
    GROQ_API_SIMPE_MODEL: str
    GROQ_API_VISION_MODEL: str

    #JWT
    JWT_ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    SECRET_KEY: str

    # Automatically loads variables directly from the root .env file
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()