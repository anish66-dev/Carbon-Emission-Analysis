from pymongo import MongoClient
from datetime import datetime

def seed_carbon_tracker():
    # 1. Connect to MongoDB Atlas or Localhost
    client = MongoClient("mongodb+srv://anish_db_user:Anish66_Anish66@cluster0.hzztdck.mongodb.net/")
    db = client["carbon_tracker_db"]
    
    print("Connecting to 'carbon_tracker_db'...")
    
    # Define our single explicit Tenant ID to securely link all collections
    TARGET_TENANT_ID = "660d1a2b3c4d5e6f7a8b9c01"
    
    # ---------------------------------------------------------
    # COLLECTION 1: tenants (Company Context Profile)
    # ---------------------------------------------------------
    print("Seeding 'tenants' collection...")
    db.tenants.drop()
    
    tenant_document = {
        "_id": TARGET_TENANT_ID,
        "company_name": "Apex Garments Ltd",
        "industry_sector": "Textiles",
        "region": "IN-GJ",  # Gujarat Region
        "employee_count": 45,
        "facility_sqft": 22000,
        "created_at": datetime.strptime("2026-01-01T00:00:00Z", "%Y-%m-%dT%H:%M:%SZ")
    }
    db.tenants.insert_one(tenant_document)

    # ---------------------------------------------------------
    # COLLECTION 2: emission_factors (The Math Directory)
    # ---------------------------------------------------------
    print("Seeding 'emission_factors' collection...")
    db.emission_factors.drop()
    
    factors_list = [
        {
            "category": "Electricity",
            "unit": "kWh",
            "scope": 2,
            "co2e_per_unit": 0.82,
            "region": "IN-GJ",
            "source": "Central Electricity Authority (CEA) India 2025"
        },
        {
            "category": "Electricity",
            "unit": "kWh",
            "scope": 2,
            "co2e_per_unit": 0.78,
            "region": "IN-MH",
            "source": "Central Electricity Authority (CEA) India 2025"
        },
        {
            "category": "Diesel",
            "unit": "Liters",
            "scope": 1,
            "co2e_per_unit": 2.68,
            "region": "Universal",
            "source": "GHG Protocol Corporate Accounting Standard"
        },
        {
            "category": "Petrol",
            "unit": "Liters",
            "scope": 1,
            "co2e_per_unit": 2.31,
            "region": "Universal",
            "source": "GHG Protocol Corporate Accounting Standard"
        }
    ]
    db.emission_factors.insert_many(factors_list)
# ---------------------------------------------------------
    # COLLECTION 3: carbon_logs (Fixed Relational Nested Structure)
    # ---------------------------------------------------------
    print("Seeding 'carbon_logs' collection with nested structure...")
    db.carbon_logs.drop()
    
    historical_logs = [
        # January 2026
        {
            "tenant_id": TARGET_TENANT_ID,
            "facility_id": "fac_01",
            "billing_period": "2026-01",
            "scope": 2,
            "category": "Electricity",
            "input_data": {
                "raw_value": 16500.0,
                "unit": "kWh",
                "cost": 132000.0
            },
            "calculated_emissions": {
                "co2e_metric_tons": 13.5300
            },
            "created_at": datetime.utcnow()
        },
        {
            "tenant_id": TARGET_TENANT_ID,
            "facility_id": "fac_01",
            "billing_period": "2026-01",
            "scope": 1,
            "category": "Diesel",
            "input_data": {
                "raw_value": 150.0,
                "unit": "Liters",
                "cost": 13500.0
            },
            "calculated_emissions": {
                "co2e_metric_tons": 0.4020
            },
            "created_at": datetime.utcnow()
        },
        # February 2026
        {
            "tenant_id": TARGET_TENANT_ID,
            "facility_id": "fac_01",
            "billing_period": "2026-02",
            "scope": 2,
            "category": "Electricity",
            "input_data": {
                "raw_value": 15800.0,
                "unit": "kWh",
                "cost": 126400.0
            },
            "calculated_emissions": {
                "co2e_metric_tons": 12.9560
            },
            "created_at": datetime.utcnow()
        },
        # March 2026
        {
            "tenant_id": TARGET_TENANT_ID,
            "facility_id": "fac_01",
            "billing_period": "2026-03",
            "scope": 2,
            "category": "Electricity",
            "input_data": {
                "raw_value": 14200.0,
                "unit": "kWh",
                "cost": 113600.0
            },
            "calculated_emissions": {
                "co2e_metric_tons": 11.6440
            },
            "created_at": datetime.utcnow()
        },
        {
            "tenant_id": TARGET_TENANT_ID,
            "facility_id": "fac_01",
            "billing_period": "2026-03",
            "scope": 1,
            "category": "Diesel",
            "input_data": {
                "raw_value": 450.0,
                "unit": "Liters",
                "cost": 40500.0
            },
            "calculated_emissions": {
                "co2e_metric_tons": 1.2060
            },
            "created_at": datetime.utcnow()
        },
        # April 2026
        {
            "tenant_id": TARGET_TENANT_ID,
            "facility_id": "fac_01",
            "billing_period": "2026-04",
            "scope": 2,
            "category": "Electricity",
            "input_data": {
                "raw_value": 13100.0,
                "unit": "kWh",
                "cost": 104800.0
            },
            "calculated_emissions": {
                "co2e_metric_tons": 10.7420
            },
            "created_at": datetime.utcnow()
        },
        {
            "tenant_id": TARGET_TENANT_ID,
            "facility_id": "fac_01",
            "billing_period": "2026-04",
            "scope": 1,
            "category": "Diesel",
            "input_data": {
                "raw_value": 200.0,
                "unit": "Liters",
                "cost": 18000.0
            },
            "calculated_emissions": {
                "co2e_metric_tons": 0.5360
            },
            "created_at": datetime.utcnow()
        },
        # May 2026
        {
            "tenant_id": TARGET_TENANT_ID,
            "facility_id": "fac_01",
            "billing_period": "2026-05",
            "scope": 2,
            "category": "Electricity",
            "input_data": {
                "raw_value": 12500.0,
                "unit": "kWh",
                "cost": 100000.0
            },
            "calculated_emissions": {
                "co2e_metric_tons": 10.2500
            },
            "created_at": datetime.utcnow()
        }
    ]
    db.carbon_logs.insert_many(historical_logs)

    # ---------------------------------------------------------
    # COLLECTION 4: ai_recommendations (Active State Task Memory)
    # ---------------------------------------------------------
    print("Seeding 'ai_recommendations' collection...")
    db.ai_recommendations.drop()
    
    recommendation_cards = [
        {
            "tenant_id": TARGET_TENANT_ID,
            "task_key": "led_upgrade_001",
            "title": "Upgrade Weaving Hall to High-Efficiency Smart LEDs",
            "estimated_upfront_cost": 35000.0,
            "estimated_monthly_savings": 6200.0,
            "estimated_carbon_reduction_pct": 8.5,
            "status": "To-Do"
        },
        {
            "tenant_id": TARGET_TENANT_ID,
            "task_key": "hvac_tune_002",
            "title": "Optimize Facility HVAC Smart Compressor Cycle Controls",
            "estimated_upfront_cost": 18000.0,
            "estimated_monthly_savings": 4100.0,
            "estimated_carbon_reduction_pct": 5.0,
            "status": "In-Progress"
        },
        {
            "tenant_id": TARGET_TENANT_ID,
            "task_key": "boiler_insulation_003",
            "title": "Install Thermal Insulation Jackets on Steam Distribution Pipelines",
            "estimated_upfront_cost": 22000.0,
            "estimated_monthly_savings": 3500.0,
            "estimated_carbon_reduction_pct": 4.2,
            "status": "Completed"
        }
    ]
    db.ai_recommendations.insert_many(recommendation_cards)
    
    print("\nInitialization Complete! Database successfully updated with facility structural contexts.")

if __name__ == "__main__":
    seed_carbon_tracker()