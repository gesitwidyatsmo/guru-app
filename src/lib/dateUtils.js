/**
 * Utility functions for date manipulation with Asia/Jakarta (WIB) timezone awareness.
 */

/**
 * Returns date in 'YYYY-MM-DD' string format based on Asia/Jakarta timezone (WIB).
 * Handles Date objects, timestamp numbers, or ISO/date strings.
 * Defaults to current date/time if no argument is provided.
 *
 * @param {Date|string|number} [date=new Date()]
 * @returns {string} Date formatted as 'YYYY-MM-DD'
 */
export const getTodayDateString = (date = new Date()) => {
	const d = date instanceof Date ? date : new Date(date || Date.now());
	if (isNaN(d.getTime())) {
		return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
	}
	return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
};
