// MongoDB initialization script for User Service database
// This script runs when the container starts for the first time

print('========================================');
print('Initializing UIT-Go Users Database');
print('========================================');

// Switch to the users database
db = db.getSiblingDB('uitgo_users');

print('✅ Switched to database: uitgo_users');

// Create users collection with validation
db.createCollection('users', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["email", "password", "role", "createdAt"],
            properties: {
                email: {
                    bsonType: "string",
                    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
                    description: "Must be a valid email address"
                },
                password: {
                    bsonType: "string",
                    minLength: 60,
                    maxLength: 60,
                    description: "Must be a bcrypt hashed password"
                },
                role: {
                    bsonType: "string",
                    enum: ["PASSENGER", "DRIVER", "ADMIN"],
                    description: "Must be one of: PASSENGER, DRIVER, ADMIN"
                },
                firstName: {
                    bsonType: "string",
                    maxLength: 50,
                    description: "First name of the user"
                },
                lastName: {
                    bsonType: "string",
                    maxLength: 50,
                    description: "Last name of the user"
                },
                phone: {
                    bsonType: "string",
                    pattern: "^(\\+84|0)[3|5|7|8|9][0-9]{8}$",
                    description: "Must be a valid Vietnamese phone number"
                },
                isActive: {
                    bsonType: "bool",
                    description: "Account activation status"
                },
                isEmailVerified: {
                    bsonType: "bool",
                    description: "Email verification status"
                },
                createdAt: {
                    bsonType: "date",
                    description: "Account creation timestamp"
                },
                updatedAt: {
                    bsonType: "date",
                    description: "Last update timestamp"
                }
            }
        }
    }
});

print('✅ Created users collection with validation schema');

// Create indexes for performance
db.users.createIndex({ "email": 1 }, { unique: true, name: "idx_email_unique" });
db.users.createIndex({ "phone": 1 }, { unique: true, sparse: true, name: "idx_phone_unique" });
db.users.createIndex({ "role": 1 }, { name: "idx_role" });
db.users.createIndex({ "isActive": 1 }, { name: "idx_is_active" });
db.users.createIndex({ "createdAt": 1 }, { name: "idx_created_at" });
db.users.createIndex({ "email": 1, "role": 1 }, { name: "idx_email_role_compound" });

print('✅ Created performance indexes');

// Create sessions collection for JWT token blacklisting
db.createCollection('sessions', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["userId", "tokenId", "expiresAt"],
            properties: {
                userId: {
                    bsonType: "objectId",
                    description: "Reference to user ID"
                },
                tokenId: {
                    bsonType: "string",
                    description: "JWT token identifier"
                },
                isBlacklisted: {
                    bsonType: "bool",
                    description: "Token blacklist status"
                },
                expiresAt: {
                    bsonType: "date",
                    description: "Token expiration date"
                },
                createdAt: {
                    bsonType: "date",
                    description: "Session creation timestamp"
                }
            }
        }
    }
});

// Create indexes for sessions
db.sessions.createIndex({ "userId": 1 }, { name: "idx_sessions_user_id" });
db.sessions.createIndex({ "tokenId": 1 }, { unique: true, name: "idx_sessions_token_id_unique" });
db.sessions.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0, name: "idx_sessions_ttl" });
db.sessions.createIndex({ "isBlacklisted": 1 }, { name: "idx_sessions_blacklisted" });

print('✅ Created sessions collection with TTL indexes');

// Create user_profiles collection for extended user information
db.createCollection('user_profiles');

// Create indexes for user profiles
db.user_profiles.createIndex({ "userId": 1 }, { unique: true, name: "idx_profiles_user_id_unique" });
db.user_profiles.createIndex({ "location": "2dsphere" }, { name: "idx_profiles_location_geo" });

print('✅ Created user_profiles collection');

// Insert default admin user (for development only)
if (db.users.countDocuments() === 0) {
    const adminUser = {
        email: "admin@uitgo.dev",
        // Default password: "UitGo@2024!" (bcrypt hashed)
        password: "$2b$12$LQv3c1yqBPVHAlRUKfE9J.D5fKGtfv7o1Tq0qGEU9aXbV3Yp7VwKu",
        role: "ADMIN",
        firstName: "Admin",
        lastName: "UIT-Go",
        phone: "+84987654321",
        isActive: true,
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    db.users.insertOne(adminUser);
    print('✅ Created default admin user');
    print('   Email: admin@uitgo.dev');
    print('   Password: UitGo@2024!');
}

// Create database statistics view
db.createView("user_statistics", "users", [
    {
        $group: {
            _id: "$role",
            count: { $sum: 1 },
            active: {
                $sum: {
                    $cond: [{ $eq: ["$isActive", true] }, 1, 0]
                }
            }
        }
    }
]);

print('✅ Created user statistics view');

print('========================================');
print('✅ User Service database initialization completed successfully');
print('📊 Collections created: users, sessions, user_profiles, user_statistics (view)');
print('🔍 Indexes created for optimal query performance');
print('🛡️ Validation schemas applied for data integrity');
print('========================================');