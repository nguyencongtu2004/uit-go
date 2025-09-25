// MongoDB initialization script for Trip Service database
// This script runs when the container starts for the first time

print('========================================');
print('Initializing UIT-Go Trips Database');
print('========================================');

// Switch to the trips database
db = db.getSiblingDB('uitgo_trips');

print('✅ Switched to database: uitgo_trips');

// Create trips collection with validation
db.createCollection('trips', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["passengerId", "pickupLocation", "destinationLocation", "status", "createdAt"],
            properties: {
                passengerId: {
                    bsonType: "objectId",
                    description: "Reference to passenger user ID"
                },
                driverId: {
                    bsonType: "objectId",
                    description: "Reference to assigned driver ID"
                },
                pickupLocation: {
                    bsonType: "object",
                    required: ["type", "coordinates", "address"],
                    properties: {
                        type: { bsonType: "string", enum: ["Point"] },
                        coordinates: {
                            bsonType: "array",
                            minItems: 2,
                            maxItems: 2,
                            items: { bsonType: "double" }
                        },
                        address: { bsonType: "string", description: "Pickup address" }
                    }
                },
                destinationLocation: {
                    bsonType: "object",
                    required: ["type", "coordinates", "address"],
                    properties: {
                        type: { bsonType: "string", enum: ["Point"] },
                        coordinates: {
                            bsonType: "array",
                            minItems: 2,
                            maxItems: 2,
                            items: { bsonType: "double" }
                        },
                        address: { bsonType: "string", description: "Destination address" }
                    }
                },
                status: {
                    bsonType: "string",
                    enum: [
                        "REQUESTED",
                        "SEARCHING",
                        "ACCEPTED",
                        "DRIVER_ARRIVING",
                        "PICKED_UP",
                        "IN_PROGRESS",
                        "COMPLETED",
                        "CANCELLED"
                    ],
                    description: "Trip status"
                },
                tripType: {
                    bsonType: "string",
                    enum: ["STANDARD", "PREMIUM", "SHARED"],
                    description: "Type of trip service"
                },
                estimatedDistance: {
                    bsonType: "double",
                    minimum: 0,
                    description: "Estimated distance in kilometers"
                },
                estimatedDuration: {
                    bsonType: "int",
                    minimum: 0,
                    description: "Estimated duration in minutes"
                },
                estimatedFare: {
                    bsonType: "double",
                    minimum: 0,
                    description: "Estimated fare in VND"
                },
                actualDistance: {
                    bsonType: "double",
                    minimum: 0,
                    description: "Actual distance traveled in kilometers"
                },
                actualDuration: {
                    bsonType: "int",
                    minimum: 0,
                    description: "Actual trip duration in minutes"
                },
                actualFare: {
                    bsonType: "double",
                    minimum: 0,
                    description: "Final fare amount in VND"
                },
                paymentMethod: {
                    bsonType: "string",
                    enum: ["CASH", "CARD", "WALLET"],
                    description: "Payment method used"
                },
                paymentStatus: {
                    bsonType: "string",
                    enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED"],
                    description: "Payment processing status"
                },
                driverAcceptedAt: {
                    bsonType: "date",
                    description: "When driver accepted the trip"
                },
                pickupAt: {
                    bsonType: "date",
                    description: "When passenger was picked up"
                },
                completedAt: {
                    bsonType: "date",
                    description: "When trip was completed"
                },
                cancelledAt: {
                    bsonType: "date",
                    description: "When trip was cancelled"
                },
                cancellationReason: {
                    bsonType: "string",
                    maxLength: 200,
                    description: "Reason for cancellation"
                },
                route: {
                    bsonType: "object",
                    properties: {
                        type: { bsonType: "string", enum: ["LineString"] },
                        coordinates: {
                            bsonType: "array",
                            items: {
                                bsonType: "array",
                                minItems: 2,
                                maxItems: 2,
                                items: { bsonType: "double" }
                            }
                        }
                    }
                },
                createdAt: {
                    bsonType: "date",
                    description: "Trip request timestamp"
                },
                updatedAt: {
                    bsonType: "date",
                    description: "Last update timestamp"
                }
            }
        }
    }
});

print('✅ Created trips collection with validation schema');

// Create indexes for performance and geospatial queries
db.trips.createIndex({ "passengerId": 1 }, { name: "idx_trips_passenger_id" });
db.trips.createIndex({ "driverId": 1 }, { name: "idx_trips_driver_id" });
db.trips.createIndex({ "status": 1 }, { name: "idx_trips_status" });
db.trips.createIndex({ "pickupLocation": "2dsphere" }, { name: "idx_pickup_location_geo" });
db.trips.createIndex({ "destinationLocation": "2dsphere" }, { name: "idx_destination_location_geo" });
db.trips.createIndex({ "createdAt": -1 }, { name: "idx_trips_created_desc" });
db.trips.createIndex({ "completedAt": -1 }, { name: "idx_trips_completed_desc" });

// Compound indexes for complex queries
db.trips.createIndex({ "status": 1, "createdAt": -1 }, { name: "idx_status_created_compound" });
db.trips.createIndex({ "passengerId": 1, "status": 1 }, { name: "idx_passenger_status_compound" });
db.trips.createIndex({ "driverId": 1, "status": 1 }, { name: "idx_driver_status_compound" });
db.trips.createIndex({ "paymentStatus": 1 }, { name: "idx_payment_status" });
db.trips.createIndex({ "tripType": 1 }, { name: "idx_trip_type" });

print('✅ Created performance and geospatial indexes');

// Create trip_tracking collection for real-time location updates during trips
db.createCollection('trip_tracking', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["tripId", "driverId", "location", "timestamp"],
            properties: {
                tripId: {
                    bsonType: "objectId",
                    description: "Reference to trip ID"
                },
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

// Create indexes for trip tracking
db.trip_tracking.createIndex({ "tripId": 1 }, { name: "idx_tracking_trip_id" });
db.trip_tracking.createIndex({ "driverId": 1 }, { name: "idx_tracking_driver_id" });
db.trip_tracking.createIndex({ "location": "2dsphere" }, { name: "idx_tracking_location_geo" });
db.trip_tracking.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 604800, name: "idx_tracking_timestamp_ttl" }); // 7 days TTL
db.trip_tracking.createIndex({ "tripId": 1, "timestamp": 1 }, { name: "idx_trip_timestamp_compound" });

print('✅ Created trip_tracking collection with TTL indexes');

// Create trip_fare_breakdown collection for detailed fare calculations
db.createCollection('trip_fare_breakdown', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["tripId", "baseFare", "totalFare"],
            properties: {
                tripId: {
                    bsonType: "objectId",
                    description: "Reference to trip ID"
                },
                baseFare: {
                    bsonType: "double",
                    minimum: 0,
                    description: "Base fare amount"
                },
                distanceFare: {
                    bsonType: "double",
                    minimum: 0,
                    description: "Distance-based fare"
                },
                timeFare: {
                    bsonType: "double",
                    minimum: 0,
                    description: "Time-based fare"
                },
                surgeMultiplier: {
                    bsonType: "double",
                    minimum: 1,
                    description: "Surge pricing multiplier"
                },
                discount: {
                    bsonType: "double",
                    minimum: 0,
                    description: "Discount amount"
                },
                tax: {
                    bsonType: "double",
                    minimum: 0,
                    description: "Tax amount"
                },
                totalFare: {
                    bsonType: "double",
                    minimum: 0,
                    description: "Final total fare"
                },
                currency: {
                    bsonType: "string",
                    enum: ["VND"],
                    description: "Currency code"
                }
            }
        }
    }
});

// Create indexes for fare breakdown
db.trip_fare_breakdown.createIndex({ "tripId": 1 }, { unique: true, name: "idx_fare_trip_id_unique" });

print('✅ Created trip_fare_breakdown collection');

// Create driver_trip_offers collection for tracking trip offers to drivers
db.createCollection('driver_trip_offers', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["tripId", "driverId", "status", "offeredAt"],
            properties: {
                tripId: {
                    bsonType: "objectId",
                    description: "Reference to trip ID"
                },
                driverId: {
                    bsonType: "objectId",
                    description: "Reference to driver ID"
                },
                status: {
                    bsonType: "string",
                    enum: ["OFFERED", "ACCEPTED", "REJECTED", "EXPIRED"],
                    description: "Offer status"
                },
                offeredAt: {
                    bsonType: "date",
                    description: "When offer was made"
                },
                respondedAt: {
                    bsonType: "date",
                    description: "When driver responded to offer"
                },
                expiresAt: {
                    bsonType: "date",
                    description: "When offer expires"
                }
            }
        }
    }
});

// Create indexes for trip offers
db.driver_trip_offers.createIndex({ "tripId": 1 }, { name: "idx_offers_trip_id" });
db.driver_trip_offers.createIndex({ "driverId": 1 }, { name: "idx_offers_driver_id" });
db.driver_trip_offers.createIndex({ "status": 1 }, { name: "idx_offers_status" });
db.driver_trip_offers.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0, name: "idx_offers_expires_ttl" });
db.driver_trip_offers.createIndex({ "offeredAt": -1 }, { name: "idx_offers_offered_desc" });

print('✅ Created driver_trip_offers collection with TTL indexes');

// Create database statistics views
db.createView("trip_statistics", "trips", [
    {
        $group: {
            _id: "$status",
            count: { $sum: 1 },
            avgFare: { $avg: "$actualFare" },
            avgDistance: { $avg: "$actualDistance" },
            avgDuration: { $avg: "$actualDuration" }
        }
    }
]);

db.createView("daily_trip_summary", "trips", [
    {
        $match: {
            createdAt: { $exists: true }
        }
    },
    {
        $group: {
            _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
            },
            totalTrips: { $sum: 1 },
            completedTrips: {
                $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
            },
            cancelledTrips: {
                $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] }
            },
            totalRevenue: {
                $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$actualFare", 0] }
            },
            avgFare: {
                $avg: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$actualFare", null] }
            }
        }
    },
    {
        $sort: { "_id": -1 }
    }
]);

print('✅ Created trip statistics views');

// Create surge pricing zones collection
db.createCollection('surge_zones', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["name", "area", "multiplier", "isActive"],
            properties: {
                name: {
                    bsonType: "string",
                    description: "Zone name"
                },
                area: {
                    bsonType: "object",
                    properties: {
                        type: { bsonType: "string", enum: ["Polygon"] },
                        coordinates: {
                            bsonType: "array",
                            items: {
                                bsonType: "array",
                                items: {
                                    bsonType: "array",
                                    minItems: 2,
                                    maxItems: 2,
                                    items: { bsonType: "double" }
                                }
                            }
                        }
                    }
                },
                multiplier: {
                    bsonType: "double",
                    minimum: 1,
                    maximum: 5,
                    description: "Surge pricing multiplier"
                },
                isActive: {
                    bsonType: "bool",
                    description: "Whether surge is currently active"
                },
                activatedAt: {
                    bsonType: "date",
                    description: "When surge was activated"
                },
                deactivatedAt: {
                    bsonType: "date",
                    description: "When surge was deactivated"
                }
            }
        }
    }
});

// Create indexes for surge zones
db.surge_zones.createIndex({ "area": "2dsphere" }, { name: "idx_surge_area_geo" });
db.surge_zones.createIndex({ "isActive": 1 }, { name: "idx_surge_active" });
db.surge_zones.createIndex({ "name": 1 }, { unique: true, name: "idx_surge_name_unique" });

print('✅ Created surge_zones collection');

print('========================================');
print('✅ Trip Service database initialization completed successfully');
print('📊 Collections created: trips, trip_tracking, trip_fare_breakdown, driver_trip_offers, surge_zones');
print('🌍 Geospatial indexes created for location-based queries');
print('⏰ TTL indexes created for temporary data cleanup');
print('🔍 Performance indexes created for complex queries');
print('📈 Statistics views created for analytics and reporting');
print('💰 Surge pricing zones configured for dynamic pricing');
print('========================================');