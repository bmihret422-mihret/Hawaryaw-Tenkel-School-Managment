/**
 * Calculate the arithmetic average of an array of student marks.
 * Returns 0 when no marks are provided.
 *
 * @param {number[]} marks
 * @returns {number}
 */
function calculateAverage(marks) {
  if (!Array.isArray(marks)) {
    throw new TypeError('Marks must be provided as an array.');
  }

  if (marks.length === 0) {
    return 0;
  }

  const total = marks.reduce((sum, mark) => {
    if (typeof mark !== 'number' || !Number.isFinite(mark)) {
      throw new TypeError('Each mark must be a finite number.');
    }
    return sum + mark;
  }, 0);

  return total / marks.length;
}

module.exports = calculateAverage;
