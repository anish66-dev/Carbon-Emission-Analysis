from pydantic import BaseModel, Field

class UserLogin(BaseModel):
    email: str
    password:str

class LogInputDetails(BaseModel):
    raw_value: float = Field(..., gt=0, description="Absolute resource utility number consumed")
    unit: str = Field(..., description="Measurement type token: kWh or Liters")
    cost: float = Field(0.0, ge=0)

class CarbonLogCreate(BaseModel):
    tenant_id: str
    facility_id: str
    billing_period: str = Field(..., pattern=r"^\d{4}-\d{2}$", description="Strict format template: YYYY-MM")
    scope: int = Field(..., ge=1, le=2)
    category: str = Field(..., description="Electricity, Diesel, or Petrol")
    input_data: LogInputDetails

class StatusUpdateSchema(BaseModel):
    status: str # Expected: "To-Do", "In-Progress", or "Completed"