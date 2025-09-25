const { RedisManager } = require('../../common/shared');

class UserRedisManager extends RedisManager {
    constructor() {
        super('UserService');
    }

    // Cache Keys
    static CACHE_KEYS = {
        USER_SESSION: 'user:session:',
        USER_PROFILE: 'user:profile:',
        USER_PERMISSIONS: 'user:permissions:',
        EMAIL_VERIFICATION: 'email:verify:',
        PASSWORD_RESET: 'password:reset:',
        LOGIN_ATTEMPTS: 'login:attempts:',
        BLACKLISTED_TOKENS: 'tokens:blacklist:',
        USER_PREFERENCES: 'user:preferences:',
        RATE_LIMIT: 'rate:limit:'
    };

    /**
     * Cache user session data
     */
    async cacheUserSession(userId, sessionData, ttlSeconds = 86400) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.USER_SESSION}${userId}`;
            await this.setex(key, ttlSeconds, JSON.stringify(sessionData));
            console.log(`📦 Cached user session for user ${userId}`);
        } catch (error) {
            console.error(`❌ Failed to cache user session: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get cached user session
     */
    async getUserSession(userId) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.USER_SESSION}${userId}`;
            const sessionData = await this.get(key);
            return sessionData ? JSON.parse(sessionData) : null;
        } catch (error) {
            console.error(`❌ Failed to get user session: ${error.message}`);
            return null;
        }
    }

    /**
     * Remove user session from cache
     */
    async removeUserSession(userId) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.USER_SESSION}${userId}`;
            await this.del(key);
            console.log(`🗑️ Removed user session for user ${userId}`);
        } catch (error) {
            console.error(`❌ Failed to remove user session: ${error.message}`);
        }
    }

    /**
     * Cache user profile data
     */
    async cacheUserProfile(userId, profileData, ttlSeconds = 3600) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.USER_PROFILE}${userId}`;
            await this.setex(key, ttlSeconds, JSON.stringify(profileData));
        } catch (error) {
            console.error(`❌ Failed to cache user profile: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get cached user profile
     */
    async getUserProfile(userId) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.USER_PROFILE}${userId}`;
            const profileData = await this.get(key);
            return profileData ? JSON.parse(profileData) : null;
        } catch (error) {
            console.error(`❌ Failed to get user profile: ${error.message}`);
            return null;
        }
    }

    /**
     * Store email verification token
     */
    async storeEmailVerificationToken(email, token, ttlSeconds = 3600) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.EMAIL_VERIFICATION}${email}`;
            await this.setex(key, ttlSeconds, token);
            console.log(`📧 Stored email verification token for ${email}`);
        } catch (error) {
            console.error(`❌ Failed to store email verification token: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verify email verification token
     */
    async verifyEmailToken(email, token) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.EMAIL_VERIFICATION}${email}`;
            const storedToken = await this.get(key);

            if (storedToken === token) {
                await this.del(key); // Remove token after successful verification
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Failed to verify email token: ${error.message}`);
            return false;
        }
    }

    /**
     * Store password reset token
     */
    async storePasswordResetToken(userId, token, ttlSeconds = 1800) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.PASSWORD_RESET}${userId}`;
            await this.setex(key, ttlSeconds, token);
            console.log(`🔐 Stored password reset token for user ${userId}`);
        } catch (error) {
            console.error(`❌ Failed to store password reset token: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verify password reset token
     */
    async verifyPasswordResetToken(userId, token) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.PASSWORD_RESET}${userId}`;
            const storedToken = await this.get(key);

            if (storedToken === token) {
                await this.del(key); // Remove token after successful verification
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Failed to verify password reset token: ${error.message}`);
            return false;
        }
    }

    /**
     * Track login attempts for rate limiting
     */
    async trackLoginAttempt(identifier, isSuccessful = false) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.LOGIN_ATTEMPTS}${identifier}`;

            if (isSuccessful) {
                // Clear attempts on successful login
                await this.del(key);
            } else {
                // Increment failed attempts
                const attempts = await this.incr(key);
                await this.expire(key, 900); // 15 minutes

                console.log(`🚨 Login attempt ${attempts} for ${identifier}`);
                return attempts;
            }
        } catch (error) {
            console.error(`❌ Failed to track login attempt: ${error.message}`);
            return 0;
        }
    }

    /**
     * Check if user is rate limited
     */
    async isRateLimited(identifier, maxAttempts = 5) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.LOGIN_ATTEMPTS}${identifier}`;
            const attempts = await this.get(key);
            return attempts ? parseInt(attempts) >= maxAttempts : false;
        } catch (error) {
            console.error(`❌ Failed to check rate limit: ${error.message}`);
            return false;
        }
    }

    /**
     * Add token to blacklist
     */
    async blacklistToken(tokenId, expiresAt) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.BLACKLISTED_TOKENS}${tokenId}`;
            const ttl = Math.floor((expiresAt - Date.now()) / 1000);

            if (ttl > 0) {
                await this.setex(key, ttl, '1');
                console.log(`🚫 Blacklisted token ${tokenId}`);
            }
        } catch (error) {
            console.error(`❌ Failed to blacklist token: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if token is blacklisted
     */
    async isTokenBlacklisted(tokenId) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.BLACKLISTED_TOKENS}${tokenId}`;
            const result = await this.get(key);
            return result !== null;
        } catch (error) {
            console.error(`❌ Failed to check token blacklist: ${error.message}`);
            return false;
        }
    }

    /**
     * Cache user permissions
     */
    async cacheUserPermissions(userId, permissions, ttlSeconds = 1800) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.USER_PERMISSIONS}${userId}`;
            await this.setex(key, ttlSeconds, JSON.stringify(permissions));
        } catch (error) {
            console.error(`❌ Failed to cache user permissions: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get cached user permissions
     */
    async getUserPermissions(userId) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.USER_PERMISSIONS}${userId}`;
            const permissions = await this.get(key);
            return permissions ? JSON.parse(permissions) : null;
        } catch (error) {
            console.error(`❌ Failed to get user permissions: ${error.message}`);
            return null;
        }
    }

    /**
     * Rate limiting for API endpoints
     */
    async checkRateLimit(identifier, windowSeconds = 3600, maxRequests = 100) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.RATE_LIMIT}${identifier}`;
            const current = await this.incr(key);

            if (current === 1) {
                await this.expire(key, windowSeconds);
            }

            return {
                current,
                remaining: Math.max(0, maxRequests - current),
                resetTime: Date.now() + (windowSeconds * 1000),
                isLimited: current > maxRequests
            };
        } catch (error) {
            console.error(`❌ Failed to check rate limit: ${error.message}`);
            return { current: 0, remaining: maxRequests, resetTime: Date.now(), isLimited: false };
        }
    }

    /**
     * Store user preferences
     */
    async storeUserPreferences(userId, preferences) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.USER_PREFERENCES}${userId}`;
            await this.setex(key, 86400, JSON.stringify(preferences)); // 24 hour cache
        } catch (error) {
            console.error(`❌ Failed to store user preferences: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get user preferences
     */
    async getUserPreferences(userId) {
        try {
            const key = `${UserRedisManager.CACHE_KEYS.USER_PREFERENCES}${userId}`;
            const preferences = await this.get(key);
            return preferences ? JSON.parse(preferences) : null;
        } catch (error) {
            console.error(`❌ Failed to get user preferences: ${error.message}`);
            return null;
        }
    }

    /**
     * Cleanup expired data (maintenance function)
     */
    async cleanup() {
        try {
            console.log(`🧹 ${this.serviceName} performing Redis cleanup...`);

            // Get all keys for this service
            const patterns = Object.values(UserRedisManager.CACHE_KEYS);
            let totalDeleted = 0;

            for (const pattern of patterns) {
                const keys = await this.keys(`${pattern}*`);
                if (keys.length > 0) {
                    // Check TTL and remove expired keys (shouldn't be necessary but good for cleanup)
                    for (const key of keys) {
                        const ttl = await this.ttl(key);
                        if (ttl === -1) { // No expiry set
                            console.log(`⚠️ Found key without TTL: ${key}`);
                        }
                    }
                }
            }

            console.log(`✅ ${this.serviceName} Redis cleanup completed. Processed keys.`);
            return totalDeleted;
        } catch (error) {
            console.error(`❌ Failed to cleanup Redis: ${error.message}`);
            return 0;
        }
    }
}

// Export singleton instance
const userRedis = new UserRedisManager();
module.exports = userRedis;