// MongoDB initialization script for Driver Service database
// This script runs when the container starts for the first time

print('========================================');
print('Initializing UIT-Go Drivers Database');
print('========================================');

// Switch to the drivers database
db = db.getSiblingDB('uitgo_drivers');

print('✅ Switched to database: uitgo_drivers');

// Create drivers collection with validation
db.createCollection('drivers', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["userId", "licenseNumber", "vehicleInfo", "status", "createdAt"],
            properties: {
                userId: {
                    bsonType: "objectId",
                    description: "Reference to user ID from user service"
                },
                licenseNumber: {
                    bsonType: "string",
                    minLength: 5,
                    maxLength: 20,
                    description: "Driver's license number"
                },
                vehicleInfo: {
                    bsonType: "object",
                    required: ["make", "model", "year", "licensePlate", "color"],
                    properties: {
                        make: { bsonType: "string", description: "Vehicle manufacturer" },
                        model: { bsonType: "string", description: "Vehicle model" },
                        year: { bsonType: "int", minimum: 2000, maximum: 2030 },
                        licensePlate: { bsonType: "string", description: "Vehicle license plate" },
                        color: { bsonType: "string", description: "Vehicle color" },
                        type: {
                            bsonType: "string",
                            enum: ["SEDAN", "SUV", "HATCHBACK", "MOTORCYCLE"],
                            description: "Vehicle type"
                        },
                        seats: { bsonType: "int", minimum: 1, maximum: 8 }
                    }
                },
                status: {
                    bsonType: "string",
                    enum: ["ONLINE", "OFFLINE", "BUSY"],
                    description: "Driver availability status"
                },
                rating: {
                    bsonType: "double",
                    minimum: 1,
                    maximum: 5,
                    description: "Driver rating (1-5 stars)"
                },
                totalTrips: {
                    bsonType: "int",
                    minimum: 0,
                    description: "Total number of completed trips"
                },
                isVerified: {
                    bsonType: "bool",
                    description: "Driver verification status"
                },
                currentLocation: {
                    bsonType: "object",
                    properties: {
                        type: { bsonType: "string", enum: ["Point"] },
                        coordinates: {
                            bsonType: "array",
                            minItems: 2,
                            maxItems: 2,
                            items: { bsonType: "double" }
                        }
                    }
                },
                lastLocationUpdate: {
                    bsonType: "date",
                    description: "Timestamp of last location update"
                },
                createdAt: {
                    bsonType: "date",
                    description: "Registration timestamp"
                },
                updatedAt: {
                    bsonType: "date",
                    description: "Last update timestamp"
                }
            }
        }
    }
});

print('✅ Created drivers collection with validation schema');

// Create indexes for performance and geospatial queries
db.drivers.createIndex({ "userId": 1 }, { unique: true, name: "idx_driver_user_id_unique" });
db.drivers.createIndex({ "licenseNumber": 1 }, { unique: true, name: "idx_license_number_unique" });
db.drivers.createIndex({ "vehicleInfo.licensePlate": 1 }, { unique: true, name: "idx_license_plate_unique" });
db.drivers.createIndex({ "status": 1 }, { name: "idx_driver_status" });
db.drivers.createIndex({ "rating": -1 }, { name: "idx_driver_rating_desc" });
db.drivers.createIndex({ "currentLocation": "2dsphere" }, { name: "idx_driver_location_geo" });
db.drivers.createIndex({ "isVerified": 1 }, { name: "idx_driver_verified" });
db.drivers.createIndex({ "lastLocationUpdate": 1 }, { name: "idx_last_location_update" });

// Compound indexes for complex queries
db.drivers.createIndex({ "status": 1, "isVerified": 1 }, { name: "idx_status_verified_compound" });
db.drivers.createIndex({ "status": 1, "currentLocation": "2dsphere" }, { name: "idx_status_location_compound" });

print('✅ Created performance and geospatial indexes');

// Create driver_locations collection for real-time location tracking
db.createCollection('driver_locations', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["driverId", "location", "timestamp"],
            properties: {
                driverId: {
                    bsonType: "objectId",
                    description: "Reference to driver ID"
                },
                location: {
                    bsonType: "object",
                    required: ["type", "coordinates"],
                    properties: {
                        type: { bsonType: "string", enum: ["Point"] },
                        coordinates: {
                            bsonType: "array",
                            minItems: 2,
                            maxItems: 2,
                            items: { bsonType: "double" }
                        }
                    }
                },
                accuracy: {
                    bsonType: "double",
                    minimum: 0,
                    description: "GPS accuracy in meters"
                },
                speed: {
                    bsonType: "double",
                    minimum: 0,
                    description: "Speed in km/h"
                },
                heading: {
                    bsonType: "double",
                    minimum: 0,
                    maximum: 360,
                    description: "Direction in degrees"
                },
                timestamp: {
                    bsonType: "date",
                    description: "Location update timestamp"
                }
            }
        }
    }
});

// Create indexes for location history
db.driver_locations.createIndex({ "driverId": 1 }, { name: "idx_location_driver_id" });
db.driver_locations.createIndex({ "location": "2dsphere" }, { name: "idx_location_geo" });
db.driver_locations.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 86400, name: "idx_location_timestamp_ttl" }); // 24 hours TTL
db.driver_locations.createIndex({ "driverId": 1, "timestamp": -1 }, { name: "idx_driver_timestamp_compound" });

print('✅ Created driver_locations collection with TTL indexes');

// Create driver_reviews collection
db.createCollection('driver_reviews', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["driverId", "tripId", "passengerId", "rating", "createdAt"],
            properties: {
                driverId: {
                    bsonType: "objectId",
                    description: "Reference to driver ID"
                },
                tripId: {
                    bsonType: "objectId",
                    description: "Reference to trip ID"
                },
                passengerId: {
                    bsonType: "objectId",
                    description: "Reference to passenger user ID"
                },
                rating: {
                    bsonType: "int",
                    minimum: 1,
                    maximum: 5,
                    description: "Rating from 1 to 5 stars"
                },
                comment: {
                    bsonType: "string",
                    maxLength: 500,
                    description: "Review comment"
                },
                createdAt: {
                    bsonType: "date",
                    description: "Review creation timestamp"
                }
            }
        }
    }
});

// Create indexes for reviews
db.driver_reviews.createIndex({ "driverId": 1 }, { name: "idx_reviews_driver_id" });
db.driver_reviews.createIndex({ "tripId": 1 }, { unique: true, name: "idx_reviews_trip_id_unique" });
db.driver_reviews.createIndex({ "passengerId": 1 }, { name: "idx_reviews_passenger_id" });
db.driver_reviews.createIndex({ "rating": 1 }, { name: "idx_reviews_rating" });
db.driver_reviews.createIndex({ "createdAt": -1 }, { name: "idx_reviews_created_desc" });

print('✅ Created driver_reviews collection');

// Create driver_earnings collection
db.createCollection('driver_earnings', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["driverId", "tripId", "amount", "date"],
            properties: {
                driverId: {
                    bsonType: "objectId",
                    description: "Reference to driver ID"
                },
                tripId: {
                    bsonType: "objectId",
                    description: "Reference to trip ID"
                },
                amount: {
                    bsonType: "double",
                    minimum: 0,
                    description: "Earning amount in VND"
                },
                commission: {
                    bsonType: "double",
                    minimum: 0,
                    description: "Platform commission in VND"
                },
                netAmount: {
                    bsonType: "double",
                    minimum: 0,
                    description: "Net earning after commission"
                },
                date: {
                    bsonType: "date",
                    description: "Earning date"
                }
            }
        }
    }
});

// Create indexes for earnings
db.driver_earnings.createIndex({ "driverId": 1 }, { name: "idx_earnings_driver_id" });
db.driver_earnings.createIndex({ "tripId": 1 }, { unique: true, name: "idx_earnings_trip_id_unique" });
db.driver_earnings.createIndex({ "date": -1 }, { name: "idx_earnings_date_desc" });
db.driver_earnings.createIndex({ "driverId": 1, "date": -1 }, { name: "idx_driver_date_compound" });

print('✅ Created driver_earnings collection');

// Create database statistics views
db.createView("driver_statistics", "drivers", [
    {
        $group: {
            _id: "$status",
            count: { $sum: 1 },
            avgRating: { $avg: "$rating" },
            totalTrips: { $sum: "$totalTrips" }
        }
    }
]);

db.createView("driver_location_stats", "driver_locations", [
    {
        $group: {
            _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
            },
            totalUpdates: { $sum: 1 },
            uniqueDrivers: { $addToSet: "$driverId" }
        }
    },
    {
        $project: {
            date: "$_id",
            totalUpdates: 1,
            uniqueDrivers: { $size: "$uniqueDrivers" }
        }
    }
]);

print('✅ Created driver statistics views');

print('========================================');
print('✅ Driver Service database initialization completed successfully');
print('📊 Collections created: drivers, driver_locations, driver_reviews, driver_earnings');
print('🌍 Geospatial indexes created for location-based queries');
print('⏰ TTL indexes created for location history cleanup');
print('🔍 Performance indexes created for complex queries');
print('📈 Statistics views created for analytics');
print('========================================');