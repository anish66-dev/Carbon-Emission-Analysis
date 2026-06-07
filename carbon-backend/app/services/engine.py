from fastapi import HTTPException, status
from pymongo.database import Database

class CarbonEngine:
    @staticmethod
    def calculate_emissions(db: Database, region: str, category: str, unit: str, value: float) -> float:
        """
        Formula: (Activity Raw Input Value * Carbon Conversion Coefficient) / 1000
        Returns computed output scaled cleanly into Metric Tons of CO2e.
        """
        # Look up the match criteria from your static emission factors directory collection
        query = {"category": category, "unit": unit}
        if category == "Electricity":
            query["region"] = region
            
        factor_record = db.emission_factors.find_one(query)
        
        if not factor_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Math logic halt: Conversion factor not found for {category} ({unit}) in region {region}"
            )
            
        coefficient = factor_record["co2e_per_unit"]
        total_kg_co2e = value * coefficient
        metric_tons = total_kg_co2e / 1000.0
        
        return round(metric_tons, 4)