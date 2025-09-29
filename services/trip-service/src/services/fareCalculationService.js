/**
 * Fare Calculation Service
 * Calculates trip fare based on distance and other factors
 */

// Default pricing configuration from environment variables
const BASE_PRICE = parseFloat(process.env.BASE_PRICE) || 5000; // Base price in VND
const PRICE_PER_KM = parseFloat(process.env.PRICE_PER_KM) || 12000; // Price per km in VND
const SURGE_MULTIPLIER = parseFloat(process.env.SURGE_MULTIPLIER) || 1.0; // Surge pricing multiplier
const MIN_FARE = parseFloat(process.env.MIN_FARE) || 15000; // Minimum fare in VND
const MAX_FARE = parseFloat(process.env.MAX_FARE) || 500000; // Maximum fare in VND

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 * 
 * @param {number} lat1 - Origin latitude
 * @param {number} lng1 - Origin longitude  
 * @param {number} lat2 - Destination latitude
 * @param {number} lng2 - Destination longitude
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers

    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;

    return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert degrees to radians
 * @param {number} degrees 
 * @returns {number} Radians
 */
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Calculate estimated trip duration in minutes based on distance
 * Assumes average speed of 30 km/h in city traffic
 * 
 * @param {number} distanceKm - Distance in kilometers
 * @returns {number} Estimated duration in minutes
 */
function calculateEstimatedDuration(distanceKm) {
    const averageSpeedKmh = 30; // Average city speed
    const durationHours = distanceKm / averageSpeedKmh;
    const durationMinutes = Math.ceil(durationHours * 60);

    return Math.max(durationMinutes, 5); // Minimum 5 minutes
}

/**
 * Calculate base fare without surge pricing
 * Formula: BASE_PRICE + (distance * PRICE_PER_KM)
 * 
 * @param {number} distanceKm - Distance in kilometers
 * @returns {number} Base fare in VND
 */
function calculateBaseFare(distanceKm) {
    const baseFare = BASE_PRICE + (distanceKm * PRICE_PER_KM);
    return Math.round(baseFare);
}

/**
 * Apply surge pricing based on current demand
 * For MVP, we'll use a simple time-based surge
 * 
 * @param {number} baseFare - Base fare amount
 * @param {Date} requestTime - Time of trip request
 * @returns {object} { surgeMultiplier, surgeFare }
 */
function applySurgePricing(baseFare, requestTime = new Date()) {
    let surgeMultiplier = SURGE_MULTIPLIER;

    const hour = requestTime.getHours();
    const dayOfWeek = requestTime.getDay(); // 0 = Sunday, 6 = Saturday

    // Peak hours surge (7-9 AM, 5-8 PM)
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20)) {
        surgeMultiplier = Math.max(surgeMultiplier, 1.5);
    }

    // Weekend surge (Friday-Sunday evening)
    if ((dayOfWeek >= 5) && (hour >= 18 && hour <= 23)) {
        surgeMultiplier = Math.max(surgeMultiplier, 1.3);
    }

    // Late night surge (10 PM - 6 AM)
    if (hour >= 22 || hour <= 6) {
        surgeMultiplier = Math.max(surgeMultiplier, 1.2);
    }

    const surgeFare = Math.round(baseFare * surgeMultiplier);

    return {
        surgeMultiplier: Math.round(surgeMultiplier * 100) / 100, // Round to 2 decimal places
        surgeFare
    };
}

/**
 * Calculate comprehensive trip fare
 * Main function that combines all pricing factors
 * 
 * @param {object} origin - { latitude, longitude, address }
 * @param {object} destination - { latitude, longitude, address }
 * @param {object} options - Additional pricing options
 * @returns {object} Detailed fare breakdown
 */
function calculateTripFare(origin, destination, options = {}) {
    try {
        // Validate input coordinates
        if (!isValidCoordinate(origin.latitude, origin.longitude) ||
            !isValidCoordinate(destination.latitude, destination.longitude)) {
            throw new Error('Invalid coordinates provided');
        }

        // Calculate distance
        const distance = calculateDistance(
            origin.latitude, origin.longitude,
            destination.latitude, destination.longitude
        );

        // Calculate estimated duration
        const estimatedDuration = calculateEstimatedDuration(distance);

        // Calculate base fare
        const baseFare = calculateBaseFare(distance);

        // Apply surge pricing
        const requestTime = options.requestTime || new Date();
        const { surgeMultiplier, surgeFare } = applySurgePricing(baseFare, requestTime);

        // Apply min/max fare limits
        let finalFare = Math.max(surgeFare, MIN_FARE);
        finalFare = Math.min(finalFare, MAX_FARE);

        // Calculate breakdown for transparency
        const breakdown = {
            baseFare,
            distanceFare: Math.round(distance * PRICE_PER_KM),
            surgeFare: surgeFare - baseFare,
            finalFare
        };

        return {
            success: true,
            estimatedFare: finalFare,
            distance: distance,
            estimatedDuration: estimatedDuration,
            surgeMultiplier: surgeMultiplier,
            breakdown: breakdown,
            currency: 'VND',
            calculatedAt: new Date().toISOString(),
            factors: {
                basePrice: BASE_PRICE,
                pricePerKm: PRICE_PER_KM,
                minFare: MIN_FARE,
                maxFare: MAX_FARE,
                appliedSurge: surgeMultiplier > 1.0
            }
        };

    } catch (error) {
        console.error('Fare calculation error:', error.message);
        return {
            success: false,
            error: 'Unable to calculate fare',
            message: error.message
        };
    }
}

/**
 * Validate coordinate values
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if valid
 */
function isValidCoordinate(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180;
}

/**
 * Calculate fare for multiple destinations (future feature)
 * @param {object} origin - Starting point
 * @param {array} destinations - Array of destinations
 * @returns {array} Array of fare calculations
 */
function calculateMultiDestinationFare(origin, destinations) {
    return destinations.map((destination, index) => {
        const result = calculateTripFare(origin, destination);
        return {
            destinationIndex: index,
            destination: destination,
            ...result
        };
    });
}

/**
 * Get current surge pricing information for an area
 * @param {number} lat - Latitude of the area
 * @param {number} lng - Longitude of the area
 * @returns {object} Current surge information
 */
function getCurrentSurgeInfo(lat, lng) {
    const now = new Date();
    const { surgeMultiplier } = applySurgePricing(BASE_PRICE, now);

    return {
        surgeMultiplier,
        isActive: surgeMultiplier > 1.0,
        reason: getSurgeReason(now),
        location: { latitude: lat, longitude: lng },
        timestamp: now.toISOString()
    };
}

/**
 * Get human-readable reason for surge pricing
 * @param {Date} time 
 * @returns {string} Surge reason
 */
function getSurgeReason(time) {
    const hour = time.getHours();
    const dayOfWeek = time.getDay();

    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20)) {
        return 'Peak hours (high demand)';
    }

    if ((dayOfWeek >= 5) && (hour >= 18 && hour <= 23)) {
        return 'Weekend evening (high demand)';
    }

    if (hour >= 22 || hour <= 6) {
        return 'Late night/early morning';
    }

    return 'Normal pricing';
}

/**
 * Estimate fare range for a trip (min/max based on traffic conditions)
 * @param {object} origin 
 * @param {object} destination 
 * @returns {object} Fare range
 */
function estimateFareRange(origin, destination) {
    const baseFare = calculateTripFare(origin, destination);

    if (!baseFare.success) {
        return baseFare;
    }

    // Calculate range based on potential surge variations
    const minFare = Math.round(baseFare.estimatedFare * 0.9); // -10%
    const maxFare = Math.round(baseFare.estimatedFare * 2.0); // Up to 2x surge

    return {
        success: true,
        minFare: Math.max(minFare, MIN_FARE),
        maxFare: Math.min(maxFare, MAX_FARE),
        estimatedFare: baseFare.estimatedFare,
        range: `${minFare.toLocaleString()} - ${maxFare.toLocaleString()} VND`,
        distance: baseFare.distance,
        estimatedDuration: baseFare.estimatedDuration
    };
}

module.exports = {
    calculateTripFare,
    calculateDistance,
    calculateEstimatedDuration,
    calculateBaseFare,
    applySurgePricing,
    calculateMultiDestinationFare,
    getCurrentSurgeInfo,
    estimateFareRange,

    // Utility functions
    isValidCoordinate,
    toRadians,

    // Constants for testing
    CONSTANTS: {
        BASE_PRICE,
        PRICE_PER_KM,
        SURGE_MULTIPLIER,
        MIN_FARE,
        MAX_FARE
    }
};