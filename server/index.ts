/**
 * @module server/index
 * @description Entry point for the Tadpole Engine backend.
 * Initializes the Gateway and handles process lifecycle events.
 * 
 * Usage: npm run engine
 */

import 'dotenv/config';
import { Gateway } from './gateway.js';

/**
 * The main Gateway instance orchestration engine services.
 */
const engine = new Gateway();

// Start the engine
engine.start();

/**
 * Handles graceful shutdown on SIGINT (Ctrl+C).
 */
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Tadpole Engine...');
    engine.stop();
    process.exit(0);
});

/**
 * Handles graceful shutdown on SIGTERM (termination signal).
 */
process.on('SIGTERM', () => {
    console.log('\n🛑 Terminating Tadpole Engine...');
    engine.stop();
    process.exit(0);
});

/**
 * Global error handler for unhandled promise rejections.
 */
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Ideally, we should restart the process or log to a file
});
