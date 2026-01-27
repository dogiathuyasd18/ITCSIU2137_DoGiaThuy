import db from '../models/index.js';
import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';
let handleDataChart = async (fromDate = null, toDate = null) => {
    try {
        let whereClause = {};

        // Add date filtering if dates are provided
        if (fromDate && toDate) {
            whereClause.createdAt = {
                [db.Sequelize.Op.between]: [new Date(fromDate), new Date(toDate)]
            };
        }

        const productMetricsData = await db.ProductMetrics.findAll({
            attributes: ['product_id', 'revenue', 'quantity', 'percent', 'rating'],
            where: whereClause,
            include: [
                {
                    model: db.Product,
                    as: 'product',
                    attributes: ['name']
                }
            ]
        });

        const transformed = (productMetricsData || []).map((row) => ({
            product_id: row.product_id,
            product_name: row.product?.name || `Product ${row.product_id}`,
            revenue: row.revenue,
            quantity: row.quantity,
            percent: row.percent,
            rating: row.rating
        }));

        return transformed;

    } catch (error) {
        console.error("Error in handleDataChart:", error);
        throw error;
    }
};

let getDataChart = async (req, res) => {
    try {
        const { fromDate = null, toDate = null } = req.query || {};
        const data = await handleDataChart(fromDate, toDate);
        return res.status(200).json({ data });
    } catch (error) {
        console.error("Error in getDataChart:", error);
        return res.status(500).json({ message: "Failed to load chart data" });
    }
};

/**
 * Admin-only: import backend/tourism_dataset.csv into tourism_data table.
 * Body: { truncate?: boolean } - if true, clears tourism_data before import.
 */
const importTourismData = async (req, res) => {
    try {
        const truncate = Boolean(req?.body?.truncate);
        const csvFilePath = path.resolve(process.cwd(), 'tourism_dataset.csv');

        if (!fs.existsSync(csvFilePath)) {
            return res.status(404).json({
                errCode: 404,
                message: `Dataset file not found: ${csvFilePath}`
            });
        }

        let beforeCount = await db.TourismData.count();
        if (truncate) {
            // truncate is faster and resets auto-increment if present
            await db.TourismData.destroy({ where: {}, truncate: true });
            beforeCount = 0;
        }

        let processed = 0;
        let parseErrors = 0;
        const BATCH_SIZE = 500;
        let batch = [];

        const toInt = (v) => {
            const n = parseInt(String(v ?? '').replace(/,/g, ''), 10);
            return Number.isFinite(n) ? n : null;
        };

        const toFloat = (v) => {
            const n = parseFloat(String(v ?? '').replace(/,/g, ''));
            return Number.isFinite(n) ? n : null;
        };

        const toBool = (v) => {
            const s = String(v ?? '').trim().toLowerCase();
            return s === 'yes' || s === 'true' || s === '1';
        };

        const flushBatch = async () => {
            if (!batch.length) return;
            // location_id has a UNIQUE constraint; ignore duplicates on re-import
            await db.TourismData.bulkCreate(batch, { ignoreDuplicates: true });
            batch = [];
        };

        await new Promise((resolve, reject) => {
            fs.createReadStream(csvFilePath)
                .pipe(csv())
                .on('data', function (row) {
                    const stream = this;
                    processed++;

                    try {
                        const location_id = row.Location ?? row.location_id ?? null;
                        const country = row.Country ?? row.country ?? null;
                        const category = row.Category ?? row.category ?? null;
                        const visitors = toInt(row.Visitors ?? row.visitors) ?? 0;
                        const rating = toFloat(row.Rating ?? row.rating);
                        const revenue = toFloat(row.Revenue ?? row.revenue) ?? 0;
                        const accommodation_available = toBool(row.Accommodation_Available ?? row.accommodation_available);

                        if (!location_id) {
                            parseErrors++;
                            return;
                        }

                        batch.push({
                            location_id: String(location_id),
                            country: country != null ? String(country) : null,
                            category: category != null ? String(category) : null,
                            visitors,
                            rating,
                            revenue,
                            accommodation_available
                        });

                        if (batch.length >= BATCH_SIZE) {
                            stream.pause();
                            flushBatch()
                                .then(() => stream.resume())
                                .catch((err) => reject(err));
                        }
                    } catch (e) {
                        parseErrors++;
                    }
                })
                .on('end', async () => {
                    try {
                        await flushBatch();
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                })
                .on('error', reject);
        });

        const afterCount = await db.TourismData.count();
        const inserted = afterCount - beforeCount;

        return res.status(200).json({
            errCode: 0,
            message: 'Import completed',
            data: {
                file: 'tourism_dataset.csv',
                truncate,
                beforeCount,
                afterCount,
                inserted,
                processed,
                parseErrors
            }
        });
    } catch (error) {
        console.error('Error importing tourism dataset:', error);
        return res.status(500).json({
            errCode: 500,
            message: 'Failed to import tourism dataset',
            error: error.message
        });
    }
};

// async function createTable() {
//     // Creates the table based on the CSV columns
//     await db.sequelize.query(`DROP TABLE IF EXISTS ${tableName};`);
//     await db.sequelize.query(`
//         CREATE TABLE ${tableName} (
//             id INT AUTO_INCREMENT PRIMARY KEY,
//             location_id VARCHAR(20) UNIQUE,
//             country VARCHAR(255),
//             category VARCHAR(255),
//             visitors INT,
//             rating DECIMAL(3, 2),
//             revenue DECIMAL(12, 2),
//             accommodation_available BOOLEAN
//         );
//     `);
//     console.log(`Table '${tableName}' created successfully.`);
// }

async function insertRow(row) {
    // Maps CSV columns to database columns
    const {
        Location: location_id,
        Country: country,
        Category: category,
        Visitors: visitors,
        Rating: rating,
        Revenue: revenue,
        Accommodation_Available: accommodation
    } = row;

    const sql = `
        INSERT INTO ${tableName} 
        (location_id, country, category, visitors, rating, revenue, accommodation_available) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        location_id,
        country,
        category,
        parseInt(visitors) || 0,
        parseFloat(rating) || 0,
        parseFloat(revenue) || 0,
        accommodation.toLowerCase() === 'yes' ? true : false
    ];

    // Use sequelize.query for raw SQL insert
    await db.sequelize.query(sql, { replacements: values });
}

// Legacy route used in web.js as GET /analysis.
// Keep it safe (no side effects) and guide clients to the new admin endpoint.


// let handleStatus = async (req, res) => {
//     try { 
//         const [rows] = await db.sequelize.query("SELECT location_id, revenue, rating, visitors, country, category FROM tourism_data;");

//         const toNum = (v) => {
//             const n = parseFloat(v);
//             return isNaN(n) ? null : n;
//         };
        
        
//         const compute = (arr) => {
//             if (!arr || arr.length === 0) return { mean: null, median: null, mode: null, range: null };
//             const sorted = [...arr].sort((a, b) => a - b);
//             const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
//             const totalRevenues = revenues.reduce((s, v) => s + v, 0);
//             const totalVisitors = visitors.reduce((s, v) => s + v, 0);

//             const mid = Math.floor(sorted.length / 2);
//             const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
//             const freq = new Map();
//             let bestVal = sorted[0];
//             let bestCount = 0;
//             for (const v of sorted) {
//                 const c = (freq.get(v) || 0) + 1;
//                 freq.set(v, c);
//                 if (c > bestCount) { bestCount = c; bestVal = v; }
//             }
//             const mode = bestVal;
//             const range = sorted[sorted.length - 1] - sorted[0];
//             return { mean, median, mode, range };
//         };
        

//         const revenues = rows.map((r) => toNum(r.revenue)).filter(v => v !== null);
//         const ratings = rows.map(r => toNum(r.rating)).filter(v => v !== null);
//         const visitors = rows.map(r => toNum(r.visitors)).filter(v => v !== null);

//         const classifyLocation = (row, benchmarks) => {
//             const is_high_profit = row.revenue > benchmarks.med_revenue;
//             const is_high_popular = row.visitors > benchmarks.med_visitors;
//             const is_high_quality = row.rating > benchmarks.med_rating;
        
//             if (is_high_quality) {
//                 if (is_high_popular && is_high_profit) return "Stars";
//                 if (!is_high_popular && is_high_profit) return "Hidden Gems";
//                 if (is_high_popular && !is_high_profit) return "Beloved but Underpriced";
//                 return "New Opportunities"; 
//             } else { 
//                 if (is_high_popular && is_high_profit) return "Stars at Risk";
//                 if (!is_high_popular && is_high_profit) return "Niche Traps";
//                 if (is_high_popular && !is_high_profit) return "Tourist Traps";
//                 return "Problem Areas"; 
//             }
//         };
//         const benchmarks = {
//             med_revenue: compute(revenues).median,
//             med_rating: compute(ratings).median,
//             med_visitors: compute(visitors).median
//         };

//         const statusCounts = {
//             "Stars": 0,
//             "Hidden Gems": 0,
//             "Beloved but Underpriced": 0,
//             "New Opportunities": 0,
//             "Stars at Risk": 0,
//             "Niche Traps": 0,
//             "Tourist Traps": 0,
//             "Problem Areas": 0
//         };

//         const statusProducts ={
//             "Stars": [],
//             "Hidden Gems": [],
//             "Beloved but Underpriced": [],
//             "New Opportunities": [],
//             "Stars at Risk": [],
//             "Niche Traps": [],
//             "Tourist Traps": [],
//             "Problem Areas": []
//         }

//         for (const row of rows) {
//             // Safely convert row data to numbers for comparison
//             const rowData = {
//                 location_id: row.location_id,
//                 country: row.country,
//                 category: row.category,
//                 revenue: toNum(row.revenue),
//                 rating: toNum(row.rating),
//                 visitors: toNum(row.visitors)
//             };

//             // Skip this row if any essential data is missing
//             if (rowData.revenue === null || rowData.rating === null || rowData.visitors === null) {
//                 continue;
//             }

//             // Classify the location and increment the correct counter
//             const status = classifyLocation(rowData, benchmarks);
//             if (statusCounts.hasOwnProperty(status)) {
//                 statusCounts[status]++;
//                 statusProducts[status].push({
//                     status: status,
//                     ...rowData
//                 });
//             }


//         }

//         return res.status(200).json({ 
//             data: statusCounts,
//             products: statusProducts 
//         });
//     } catch (error) { // Added catch block
//         console.error("Error in handleStatus:", error);
//         return res.status(500).json({
//             errCode: -1,
//             message: 'Error calculating status matrix: ' + error.message
//         });
//     }
// }

let handleStatus = async (req, res) => {
    try { 
        const [rows] = await db.sequelize.query("SELECT location_id, revenue, rating, visitors, country, category FROM tourism_data;");

        const toNum = (v) => {
            const n = parseFloat(v);
            return isNaN(n) ? null : n;
        };
        
        
        const compute = (arr) => {
            if (!arr || arr.length === 0) return { 
                mean: null, 
                median: null, 
                mode: null, 
                range: null,
                standardDeviation: null,
                variance: null,
                iqr: null,
                skewness: null
            };
            const sorted = [...arr].sort((a, b) => a - b);
            const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;

            const mid = Math.floor(sorted.length / 2);
            const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
            
            // Calculate Mode
            const freq = new Map();
            let bestVal = sorted[0];
            let bestCount = 0;
            for (const v of sorted) {
                const c = (freq.get(v) || 0) + 1;
                freq.set(v, c);
                if (c > bestCount) { bestCount = c; bestVal = v; }
            }
            const mode = bestVal;
            
            // Calculate Range
            const range = sorted.length > 0 ? sorted[sorted.length - 1] - sorted[0] : null;
            
            // Calculate Variance
            const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sorted.length;
            
            // Calculate Standard Deviation
            const standardDeviation = Math.sqrt(variance);
            
            // Calculate IQR (Interquartile Range)
            let iqr = null;
            if (sorted.length >= 4) {
                const q1Index = Math.floor(sorted.length * 0.25);
                const q3Index = Math.floor(sorted.length * 0.75);
                const q1 = sorted[q1Index];
                const q3 = sorted[q3Index];
                iqr = q3 - q1;
            }
            
            // Calculate Skewness (Pearson's moment coefficient of skewness)
            // Formula: skewness = (n / ((n-1) * (n-2))) * Σ((xi - mean) / stdDev)^3
            let skewness = null;
            if (sorted.length >= 3 && standardDeviation !== null && standardDeviation !== 0) {
                const n = sorted.length;
                const sumCubedDeviations = sorted.reduce((sum, val) => {
                    const deviation = (val - mean) / standardDeviation;
                    return sum + Math.pow(deviation, 3);
                }, 0);
                skewness = (n / ((n - 1) * (n - 2))) * sumCubedDeviations;
            }
            
            return { 
                mean, 
                median, 
                mode, 
                range,
                standardDeviation,
                variance,
                iqr,
                skewness
            };
        };
        

        const revenues = rows.map((r) => toNum(r.revenue)).filter(v => v !== null);
        const ratings = rows.map(r => toNum(r.rating)).filter(v => v !== null);
        const visitors = rows.map(r => toNum(r.visitors)).filter(v => v !== null);

        // Calculate statistics including Range and Mode
        const revenueStats = compute(revenues);
        const ratingStats = compute(ratings);
        const visitorStats = compute(visitors);

        const classifyLocation = (row, benchmarks) => {
            const is_high_profit = row.revenue > benchmarks.med_revenue;
            const is_high_popular = row.visitors > benchmarks.med_visitors;
            const is_high_quality = row.rating > benchmarks.med_rating;
        
            if (is_high_quality) {
                if (is_high_popular && is_high_profit) return "Stars";
                if (!is_high_popular && is_high_profit) return "Hidden Gems";
                if (is_high_popular && !is_high_profit) return "Beloved but Underpriced";
                return "New Opportunities"; 
            } else { 
                if (is_high_popular && is_high_profit) return "Stars at Risk";
                if (!is_high_popular && is_high_profit) return "Niche Traps";
                if (is_high_popular && !is_high_profit) return "Tourist Traps";
                return "Problem Areas"; 
            }
        };
        
        const benchmarks = {
            med_revenue: revenueStats.median,
            med_rating: ratingStats.median,
            med_visitors: visitorStats.median
        };

        const statusCounts = {
            "Stars": 0,
            "Hidden Gems": 0,
            "Beloved but Underpriced": 0,
            "New Opportunities": 0,
            "Stars at Risk": 0,
            "Niche Traps": 0,
            "Tourist Traps": 0,
            "Problem Areas": 0
        };

        const statusProducts ={
            "Stars": [],
            "Hidden Gems": [],
            "Beloved but Underpriced": [],
            "New Opportunities": [],
            "Stars at Risk": [],
            "Niche Traps": [],
            "Tourist Traps": [],
            "Problem Areas": []
        }

        // Calculate total revenue for percentage calculations
        const totalRevenue = revenues.reduce((sum, rev) => sum + rev, 0);

        // Calculate revenue by country
        const revenueByCountry = {};
        const revenueByCategory = {};

        for (const row of rows) {
            // Safely convert row data to numbers for comparison
            const rowData = {
                location_id: row.location_id,
                country: row.country,
                category: row.category,
                revenue: toNum(row.revenue),
                rating: toNum(row.rating),
                visitors: toNum(row.visitors)
            };

            // Skip this row if any essential data is missing
            if (rowData.revenue === null || rowData.rating === null || rowData.visitors === null) {
                continue;
            }

            // Accumulate revenue by country
            if (!revenueByCountry[rowData.country]) {
                revenueByCountry[rowData.country] = 0;
            }
            revenueByCountry[rowData.country] += rowData.revenue;

            // Accumulate revenue by category
            if (!revenueByCategory[rowData.category]) {
                revenueByCategory[rowData.category] = 0;
            }
            revenueByCategory[rowData.category] += rowData.revenue;

            // Classify the location and increment the correct counter
            const status = classifyLocation(rowData, benchmarks);
            if (statusCounts.hasOwnProperty(status)) {
                statusCounts[status]++;
                statusProducts[status].push({
                    status: status,
                    ...rowData
                });
            }
        }

        // Calculate percentage of revenue by country
        const revenuePercentageByCountry = Object.entries(revenueByCountry).map(([country, revenue]) => ({
            country: country,
            revenue: revenue,
            percentage: totalRevenue > 0 ? parseFloat(((revenue / totalRevenue) * 100).toFixed(2)) : 0
        })).sort((a, b) => b.revenue - a.revenue);

        // Calculate percentage of revenue by category
        const revenuePercentageByCategory = Object.entries(revenueByCategory).map(([category, revenue]) => ({
            category: category,
            revenue: revenue,
            percentage: totalRevenue > 0 ? parseFloat(((revenue / totalRevenue) * 100).toFixed(2)) : 0
        })).sort((a, b) => b.revenue - a.revenue);

        // Function to generate conclusions based on Standard Deviation, Variance, and IQR
        const generateConclusions = (stats, dataArray, metricName) => {
            const conclusions = {
                standardDeviation: null,
                variance: null,
                iqr: null,
                normalProducts: []
            };

            if (stats.standardDeviation !== null && stats.mean !== null && stats.mean !== 0) {
                // Coefficient of Variation (CV) = SD / Mean
                const coefficientOfVariation = stats.standardDeviation / Math.abs(stats.mean);
                // If CV < 0.3, it's consistent; if CV >= 0.3, it's risky
                conclusions.standardDeviation = coefficientOfVariation < 0.3 ? 'Consistency' : 'Risk';
            }

            if (stats.variance !== null && stats.mean !== null && stats.mean !== 0) {
                // Coefficient of Variation squared = Variance / Mean^2
                const cvSquared = stats.variance / Math.pow(stats.mean, 2);
                // If CV^2 < 0.1, it's stable; if CV^2 >= 0.1, it's instable
                conclusions.variance = cvSquared < 0.1 ? 'Stable' : 'Instable';
            }

            // Identify normal products using IQR (products within Q1 - 1.5*IQR and Q3 + 1.5*IQR)
            if (stats.iqr !== null && stats.median !== null && dataArray.length > 0) {
                const sorted = [...dataArray].sort((a, b) => a - b);
                const q1Index = Math.floor(sorted.length * 0.25);
                const q3Index = Math.floor(sorted.length * 0.75);
                const q1 = sorted[q1Index];
                const q3 = sorted[q3Index];
                const lowerBound = q1 - 1.5 * stats.iqr;
                const upperBound = q3 + 1.5 * stats.iqr;

                // Find products within normal range based on the metric
                for (const row of rows) {
                    const rowData = {
                        location_id: row.location_id,
                        country: row.country,
                        category: row.category,
                        revenue: toNum(row.revenue),
                        rating: toNum(row.rating),
                        visitors: toNum(row.visitors)
                    };

                    // Skip if essential data is missing
                    if (rowData.revenue === null || rowData.rating === null || rowData.visitors === null) {
                        continue;
                    }

                    // Check the appropriate metric value
                    let metricValue = null;
                    if (metricName === 'revenue') {
                        metricValue = rowData.revenue;
                    } else if (metricName === 'rating') {
                        metricValue = rowData.rating;
                    } else if (metricName === 'visitors') {
                        metricValue = rowData.visitors;
                    }

                    if (metricValue !== null && 
                        metricValue >= lowerBound && 
                        metricValue <= upperBound) {
                        conclusions.normalProducts.push({
                            location_id: rowData.location_id,
                            country: rowData.country,
                            category: rowData.category,
                            revenue: rowData.revenue,
                            rating: rowData.rating,
                            visitors: rowData.visitors,
                            [metricName]: metricValue
                        });
                    }
                }
            }

            return conclusions;
        };

        // Generate conclusions for each metric
        const revenueConclusions = generateConclusions(revenueStats, revenues, 'revenue');
        const ratingConclusions = generateConclusions(ratingStats, ratings, 'rating');
        const visitorConclusions = generateConclusions(visitorStats, visitors, 'visitors');

        return res.status(200).json({ 
            data: statusCounts,
            products: statusProducts,
            statistics: {
                revenue: {
                    mean: revenueStats.mean,
                    median: revenueStats.median,
                    mode: revenueStats.mode,
                    range: revenueStats.range,
                    standardDeviation: revenueStats.standardDeviation,
                    variance: revenueStats.variance,
                    iqr: revenueStats.iqr,
                    skewness: revenueStats.skewness
                },
                rating: {
                    mean: ratingStats.mean,
                    median: ratingStats.median,
                    mode: ratingStats.mode,
                    range: ratingStats.range,
                    standardDeviation: ratingStats.standardDeviation,
                    variance: ratingStats.variance,
                    iqr: ratingStats.iqr,
                    skewness: ratingStats.skewness
                },
                visitors: {
                    mean: visitorStats.mean,
                    median: visitorStats.median,
                    mode: visitorStats.mode,
                    range: visitorStats.range,
                    standardDeviation: visitorStats.standardDeviation,
                    variance: visitorStats.variance,
                    iqr: visitorStats.iqr,
                    skewness: visitorStats.skewness
                }
            },
            conclusions: {
                revenue: revenueConclusions,
                rating: ratingConclusions,
                visitors: visitorConclusions
            },
            revenueAnalysis: {
                totalRevenue: totalRevenue,
                byCountry: revenuePercentageByCountry,
                byCategory: revenuePercentageByCategory
            }
        });
    } catch (error) {
        console.error("Error in handleStatus:", error);
        return res.status(500).json({
            errCode: -1,
            message: 'Error calculating status matrix: ' + error.message
        });
    }
}

// Helper functions for handleCrossTab
const helperToNum = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
};

const helperComputeStats = (arr) => {
    if (!arr || arr.length === 0) return { mean: null, median: null, mode: null, range: null };
    const sorted = [...arr].sort((a, b) => a - b);
    const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    const freq = new Map();
    let bestVal = sorted[0];
    let bestCount = 0;
    for (const v of sorted) {
        const c = (freq.get(v) || 0) + 1;
        freq.set(v, c);
        if (c > bestCount) { bestCount = c; bestVal = v; }
    }
    const mode = bestVal;
    const range = sorted[sorted.length - 1] - sorted[0];
    return { mean, median, mode, range };
};

// Chi-Square Test Function
const chiSquareTest = (observed) => {
    // observed is a 2D array: [[a, b], [c, d]] for 2x2 table
    // or larger contingency table
    
    if (!observed || observed.length === 0) {
        return { chiSquare: null, pValue: null, df: null, significant: false, interpretation: 'No data provided' };
    }

    const rows = observed.length;
    const cols = observed[0].length;
    
    // Calculate row and column totals
    const rowTotals = observed.map(row => row.reduce((sum, val) => sum + val, 0));
    const colTotals = [];
    for (let j = 0; j < cols; j++) {
        colTotals[j] = observed.reduce((sum, row) => sum + (row[j] || 0), 0);
    }
    const grandTotal = rowTotals.reduce((sum, val) => sum + val, 0);
    
    if (grandTotal === 0) {
        return { chiSquare: null, pValue: null, df: null, significant: false, interpretation: 'No observations' };
    }
    
    // Calculate expected frequencies
    const expected = [];
    let chiSquare = 0;
    
    for (let i = 0; i < rows; i++) {
        expected[i] = [];
        for (let j = 0; j < cols; j++) {
            const exp = (rowTotals[i] * colTotals[j]) / grandTotal;
            expected[i][j] = exp;
            
            // Calculate chi-square statistic
            const obs = observed[i][j] || 0;
            if (exp > 0) {
                chiSquare += Math.pow(obs - exp, 2) / exp;
            }
        }
    }
    
    // Degrees of freedom
    const df = (rows - 1) * (cols - 1);
    
    // Calculate p-value using approximation (for df > 0)
    // Using simplified chi-square distribution approximation
    let pValue = null;
    if (df > 0) {
        // Simplified p-value calculation using chi-square CDF approximation
        // For more accuracy, you could use a proper statistical library
        // This is a basic approximation
        pValue = approximatePValue(chiSquare, df);
    }
    
    // Interpretation
    const alpha = 0.05; // Significance level
    const significant = pValue !== null && pValue < alpha;
    let interpretation = '';
    
    if (pValue === null) {
        interpretation = 'Cannot calculate p-value';
    } else if (significant) {
        interpretation = `Statistically significant relationship (p < ${alpha}). Variables are NOT independent.`;
    } else {
        interpretation = `No significant relationship (p ≥ ${alpha}). Variables appear independent.`;
    }
    
    return {
        chiSquare: parseFloat(chiSquare.toFixed(4)),
        pValue: pValue !== null ? parseFloat(pValue.toFixed(6)) : null,
        df: df,
        significant: significant,
        interpretation: interpretation,
        observed: observed,
        expected: expected,
        rowTotals: rowTotals,
        colTotals: colTotals,
        grandTotal: grandTotal
    };
};

// Approximate p-value from chi-square distribution
// This is a simplified approximation - for production, use a proper statistical library
const approximatePValue = (chiSquare, df) => {
    // Simplified approximation using Wilson-Hilferty transformation
    // For more accuracy, consider using a library like 'chi-squared' or 'jstat'
    if (df <= 0) return null;
    
    // Basic approximation: for large df, chi-square ~ normal
    // This is a rough approximation
    if (df > 30) {
        const z = Math.sqrt(2 * chiSquare) - Math.sqrt(2 * df - 1);
        // Approximate p-value from standard normal
        return 2 * (1 - normalCDF(Math.abs(z)));
    }
    
    // For smaller df, use a simpler approximation
    // This is very basic - in production, use proper chi-square CDF
    const criticalValues = {
        1: { 0.05: 3.84, 0.01: 6.63 },
        2: { 0.05: 5.99, 0.01: 9.21 },
        3: { 0.05: 7.81, 0.01: 11.34 },
        4: { 0.05: 9.49, 0.01: 13.28 },
        5: { 0.05: 11.07, 0.01: 15.09 }
    };
    
    if (criticalValues[df]) {
        if (chiSquare >= criticalValues[df][0.01]) return 0.01;
        if (chiSquare >= criticalValues[df][0.05]) return 0.05;
        return 0.10; // Rough estimate
    }
    
    // Default approximation
    return chiSquare > df * 2 ? 0.05 : 0.10;
};

// Normal CDF approximation
const normalCDF = (z) => {
    // Error function approximation
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
};

// Chi-Square Analysis Handler
let handleChiSquareAnalysis = async (req, res) => {
    try {
        const [rows] = await db.sequelize.query("SELECT country, category, visitors, rating, revenue FROM tourism_data;");
        
        // Pre-process data
        const processedLocations = rows.map(row => {
            const revenue = helperToNum(row.revenue);
            const visitors = helperToNum(row.visitors);
            const rating = helperToNum(row.rating);
            
            return {
                country: row.country,
                category: row.category,
                visitors,
                rating,
                revenue
            };
        }).filter(loc => loc.visitors !== null && loc.rating !== null && loc.revenue !== null);
        
        if (processedLocations.length === 0) {
            return res.status(400).json({
                errCode: 1,
                message: 'No valid data for Chi-Square analysis'
            });
        }
        
        // Calculate medians for dichotomization
        const revenues = processedLocations.map(loc => loc.revenue);
        const ratings = processedLocations.map(loc => loc.rating);
        const visitors = processedLocations.map(loc => loc.visitors);
        
        const revenueStats = helperComputeStats(revenues);
        const ratingStats = helperComputeStats(ratings);
        const visitorStats = helperComputeStats(visitors);
        
        const medianRevenue = revenueStats.median;
        const medianRating = ratingStats.median;
        const medianVisitors = visitorStats.median;
        
        // Test 1: Category vs High/Low Revenue
        const categoryRevenueTable = {};
        processedLocations.forEach(loc => {
            if (!categoryRevenueTable[loc.category]) {
                categoryRevenueTable[loc.category] = { high: 0, low: 0 };
            }
            if (loc.revenue > medianRevenue) {
                categoryRevenueTable[loc.category].high++;
            } else {
                categoryRevenueTable[loc.category].low++;
            }
        });
        
        const categoryRevenueObserved = Object.keys(categoryRevenueTable).map(cat => [
            categoryRevenueTable[cat].high,
            categoryRevenueTable[cat].low
        ]);
        const test1 = chiSquareTest(categoryRevenueObserved);
        
        // Test 2: Country vs High/Low Revenue
        const countryRevenueTable = {};
        processedLocations.forEach(loc => {
            if (!countryRevenueTable[loc.country]) {
                countryRevenueTable[loc.country] = { high: 0, low: 0 };
            }
            if (loc.revenue > medianRevenue) {
                countryRevenueTable[loc.country].high++;
            } else {
                countryRevenueTable[loc.country].low++;
            }
        });
        const countryRevenueObserved = Object.keys(countryRevenueTable).map(cty => [
            countryRevenueTable[cty].high,
            countryRevenueTable[cty].low
        ]);
        const test2 = chiSquareTest(countryRevenueObserved);
        
        // Test 3: Category vs High/Low Rating
        const categoryRatingTable = {};
        processedLocations.forEach(loc => {
            if (!categoryRatingTable[loc.category]) {
                categoryRatingTable[loc.category] = { high: 0, low: 0 };
            }
            if (loc.rating > medianRating) {
                categoryRatingTable[loc.category].high++;
            } else {
                categoryRatingTable[loc.category].low++;
            }
        });
        const categoryRatingObserved = Object.keys(categoryRatingTable).map(cat => [
            categoryRatingTable[cat].high,
            categoryRatingTable[cat].low
        ]);
        const test3 = chiSquareTest(categoryRatingObserved);
        
        // Test 4: Category vs Country (Contingency Table)
        const categoryCountryTable = {};
        const categories = new Set();
        const countries = new Set();
        
        processedLocations.forEach(loc => {
            categories.add(loc.category);
            countries.add(loc.country);
            const key = `${loc.category}|${loc.country}`;
            categoryCountryTable[key] = (categoryCountryTable[key] || 0) + 1;
        });
        
        const categoryList = Array.from(categories);
        const countryList = Array.from(countries);
        
        const categoryCountryObserved = categoryList.map(cat => 
            countryList.map(cty => categoryCountryTable[`${cat}|${cty}`] || 0)
        );
        const test4 = chiSquareTest(categoryCountryObserved);
        
        // Test 5: Category vs High/Low Visitors
        const categoryVisitorTable = {};
        processedLocations.forEach(loc => {
            if (!categoryVisitorTable[loc.category]) {
                categoryVisitorTable[loc.category] = { high: 0, low: 0 };
            }
            if (loc.visitors > medianVisitors) {
                categoryVisitorTable[loc.category].high++;
            } else {
                categoryVisitorTable[loc.category].low++;
            }
        });
        const categoryVisitorObserved = Object.keys(categoryVisitorTable).map(cat => [
            categoryVisitorTable[cat].high,
            categoryVisitorTable[cat].low
        ]);
        const test5 = chiSquareTest(categoryVisitorObserved);
        
        return res.status(200).json({
            errCode: 0,
            message: 'Chi-Square analysis completed',
            data: {
                tests: [
                    {
                        name: 'Category vs Revenue Performance',
                        description: 'Tests if category is independent of revenue performance (high/low)',
                        test: test1,
                        categories: Object.keys(categoryRevenueTable),
                        median: medianRevenue
                    },
                    {
                        name: 'Country vs Revenue Performance',
                        description: 'Tests if country is independent of revenue performance (high/low)',
                        test: test2,
                        countries: Object.keys(countryRevenueTable),
                        median: medianRevenue
                    },
                    {
                        name: 'Category vs Rating Performance',
                        description: 'Tests if category is independent of rating performance (high/low)',
                        test: test3,
                        categories: Object.keys(categoryRatingTable),
                        median: medianRating
                    },
                    {
                        name: 'Category vs Country',
                        description: 'Tests if category and country are independent',
                        test: test4,
                        categories: categoryList,
                        countries: countryList
                    },
                    {
                        name: 'Category vs Visitor Performance',
                        description: 'Tests if category is independent of visitor performance (high/low)',
                        test: test5,
                        categories: Object.keys(categoryVisitorTable),
                        median: medianVisitors
                    }
                ],
                medians: {
                    revenue: medianRevenue,
                    rating: medianRating,
                    visitors: medianVisitors
                }
            }
        });
        
    } catch (error) {
        console.error("Error in handleChiSquareAnalysis:", error);
        return res.status(500).json({
            errCode: -1,
            message: 'Error performing Chi-Square analysis: ' + error.message
        });
    }
};

/**
 * Calculates the Population Pearson Correlation Coefficient (ρ)
 * Used when the dataset represents the entire population.
 */
const getCorrelation = (x, y) => {
    const N = x.length; // Capital 'N' usually denotes Population size
    
    // Population correlation requires at least 2 data points to show a relationship
    if (N < 2) return 0;

    // 1. Calculate Sums (Σ)
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    
    // 2. Calculate Sum of Products (ΣXY)
    const sumXY = x.reduce((a, v, i) => a + v * (y[i] || 0), 0);
    
    // 3. Calculate Sum of Squares (ΣX² and ΣY²)
    const sumX2 = x.reduce((a, v) => a + v * v, 0);
    const sumY2 = y.reduce((a, v) => a + v * v, 0);

    // 4. Calculate the Numerator (Covariance-related)
    const num = (N * sumXY) - (sumX * sumY);

    // 5. Calculate the Denominator (Standard Deviation-related)
    // For a population, we use the total N rather than N-1
    const den = Math.sqrt(
        (N * sumX2 - Math.pow(sumX, 2)) * (N * sumY2 - Math.pow(sumY, 2))
    );

    // 6. Return result, handling the "Zero Variance" case
    // If every rating is the same (3.0, 3.0...), the denominator is 0.
    if (den === 0) return 0;

    return parseFloat((num / den).toFixed(3));
};

const getStandardDeviation = (array) => {
    const n = array.length;
    if (n < 2) return 0;
    const mean = array.reduce((a, b) => a + b) / n;
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
};

let handleCrossTab = async (req, res) => {
    try {
        const [rows] = await db.sequelize.query("SELECT country, category, visitors, rating, revenue FROM tourism_data;");

        // 1. Pre-process data: Convert to numbers and calculate ARPV
        const processedLocations = rows.map(row => {
            const revenue = helperToNum(row.revenue);
            const visitors = helperToNum(row.visitors);
            const rating = helperToNum(row.rating);
            
            return {
                country: row.country,
                category: row.category,
                visitors,
                rating,
                realRevenue: revenue,
                arpv: visitors > 0 ? (revenue / visitors) : 0
            };
        }).filter(loc => loc.visitors !== null && loc.rating !== null && loc.realRevenue !== null); // Filter out bad data

        
        // 2. Relationship 1: category <-> revenue, rating, quantity
        const categoryAgg = {};
        for (const loc of processedLocations) {
            if (!categoryAgg[loc.category]) {
                categoryAgg[loc.category] = { name: loc.category, totalRevenue: 0, totalVisitors: 0, ratingSum: 0, count: 0 };
            }
            const cat = categoryAgg[loc.category];
            cat.totalRevenue += loc.realRevenue;
            cat.totalVisitors += loc.visitors;
            cat.ratingSum += loc.rating;
            cat.count++;
        }
        const categoryReport = Object.values(categoryAgg).map(cat => ({
            name: cat.name,
            totalRevenue: cat.totalRevenue,
            totalVisitors: cat.totalVisitors, 
            avgRating: cat.count > 0 ? cat.ratingSum / cat.count : 0,
            avgArpv: cat.totalVisitors > 0 ? cat.totalRevenue / cat.totalVisitors : 0
        })).sort((a, b) => b.totalRevenue - a.totalRevenue);


        // 3. Relationship 2: country <-> revenue, quantity, rating
        const countryAgg = {};
        for (const loc of processedLocations) {
            if (!countryAgg[loc.country]) {
                countryAgg[loc.country] = { name: loc.country, totalRevenue: 0, totalVisitors: 0, ratingSum: 0, count: 0 };
            }
            const cty = countryAgg[loc.country];
            cty.totalRevenue += loc.realRevenue;
            cty.totalVisitors += loc.visitors;
            cty.ratingSum += loc.rating;
            cty.count++;
        }
        const countryReport = Object.values(countryAgg).map(cty => ({
            name: cty.name,
            totalRevenue: cty.totalRevenue,
            totalVisitors: cty.totalVisitors, 
            avgRating: cty.count > 0 ? cty.ratingSum / cty.count : 0,
            avgArpv: cty.totalVisitors > 0 ? cty.totalRevenue / cty.totalVisitors : 0
        })).sort((a, b) => b.totalRevenue - a.totalRevenue);


        // 4. Relationship 3: price (ARPV) <-> revenue, quantity
        const allArpvs = processedLocations.map(p => p.arpv);
        const arpvStats = helperComputeStats(allArpvs);
        const medianArpv = arpvStats.median;

        const arpvReport = {
            belowMedian: { title: `Below Median ARPV (≤ ${medianArpv.toFixed(2)})`, totalRevenue: 0, totalVisitors: 0, count: 0 },
            aboveMedian: { title: `Above Median ARPV (> ${medianArpv.toFixed(2)})`, totalRevenue: 0, totalVisitors: 0, count: 0 }
        };

        for (const loc of processedLocations) {
            const bin = (loc.arpv <= medianArpv) ? 'belowMedian' : 'aboveMedian';
            arpvReport[bin].totalRevenue += loc.realRevenue;
            arpvReport[bin].totalVisitors += loc.visitors;
            arpvReport[bin].count++;
        }
        
        const formatArpvBin = (bin) => ({
            ...bin,
            avgRevenue: bin.count > 0 ? bin.totalRevenue / bin.count : 0,
            avgVisitors: bin.count > 0 ? bin.totalVisitors / bin.count : 0,
        });

        const priceReport = [
            formatArpvBin(arpvReport.belowMedian),
            formatArpvBin(arpvReport.aboveMedian)
        ];

        // 5. Send the response
        return res.status(200).json({ 
            data: { 
                categoryReport, 
                countryReport, 
                priceReport 
            } 
        });

    } catch (e) {
        console.error("Error in handleCrossTab:", e);
        return res.status(500).json({ message: "Failed to compute crosstab data", error: e.message });
    }
}

let getAllUsers = async (req, res) => {
    // This query aggregates user data from multiple tables:
    // - Name: FirstName + LastName from users table (roleId = 1)
    // - Revenue: SUM(order_total) from shop_order table
    // - Quantity: SUM(quantity) from order_line table
    // - Rating: SUM(rating) from user_reviews table
    // GROUP BY user_id from shop_order table
    try {
        const sql = `
            SELECT
                so.user_id,
                u.firstName,
                u.lastName,
                SUM(so.order_total) AS totalRevenue,
                COALESCE(quantity_agg.total_quantity, 0) AS totalQuantity,
                COALESCE(rating_agg.total_rating, 0) AS totalRating
            FROM
                shop_order so
            INNER JOIN
                Users u ON so.user_id = u.id
            LEFT JOIN (
                SELECT 
                    so2.user_id,
                    SUM(ol.quantity) AS total_quantity
                FROM order_line ol
                INNER JOIN shop_order so2 ON ol.order_id = so2.id
                GROUP BY so2.user_id
            ) AS quantity_agg ON so.user_id = quantity_agg.user_id
            LEFT JOIN (
                SELECT 
                    user_id,
                    SUM(rating) AS total_rating
                FROM user_review
                GROUP BY user_id
            ) AS rating_agg ON so.user_id = rating_agg.user_id
            WHERE
                u.roleId = 1
            GROUP BY
                so.user_id, u.firstName, u.lastName, quantity_agg.total_quantity, rating_agg.total_rating
        `;
        
        const [rows] = await db.sequelize.query(sql);

        // Helper function to convert to number
        const toNum = (v) => {
            const n = parseFloat(v);
            return isNaN(n) ? null : n;
        };

        // Helper function to compute median
        const compute = (arr) => {
            if (!arr || arr.length === 0) return { mean: null, median: null, mode: null, range: null };
            const sorted = [...arr].sort((a, b) => a - b);
            const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
            const mid = Math.floor(sorted.length / 2);
            const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
            const freq = new Map();
            let bestVal = sorted[0];
            let bestCount = 0;
            for (const v of sorted) {
                const c = (freq.get(v) || 0) + 1;
                freq.set(v, c);
                if (c > bestCount) { bestCount = c; bestVal = v; }
            }
            const mode = bestVal;
            const range = sorted[sorted.length - 1] - sorted[0];
            return { mean, median, mode, range };
        };

        // Extract metrics
        const revenues = rows.map((r) => toNum(r.totalRevenue)).filter(v => v !== null && v !== 0);
        const ratings = rows.map(r => toNum(r.totalRating)).filter(v => v !== null);
        const quantities = rows.map(r => toNum(r.totalQuantity)).filter(v => v !== null);

        // Check if we have any data
        if (rows.length === 0) {
            console.log('No users found with orders');
            return res.status(200).json({ 
                data: {
                    "Stars": 0, "Hidden Gems": 0, "Beloved but Underpriced": 0, "New Opportunities": 0,
                    "Stars at Risk": 0, "Niche Traps": 0, "Tourist Traps": 0, "Problem Areas": 0
                },
                users: {
                    "Stars": [], "Hidden Gems": [], "Beloved but Underpriced": [], "New Opportunities": [],
                    "Stars at Risk": [], "Niche Traps": [], "Tourist Traps": [], "Problem Areas": []
                }
            });
        }

        // Calculate benchmarks (medians)
        // Use 0 as default if no data for a metric
        const benchmarks = {
            med_revenue: revenues.length > 0 ? compute(revenues).median : 0,
            med_rating: ratings.length > 0 ? compute(ratings).median : 0,
            med_quantity: quantities.length > 0 ? compute(quantities).median : 0
        };
        
        console.log('Benchmarks calculated:', benchmarks);
        console.log('Total rows from query:', rows.length);

        // Classification function
        const classifyUser = (userData, benchmarks) => {
            // 1. Determine High/Low for each of the 3 metrics
            const is_high_profit = userData.revenue > benchmarks.med_revenue;
            const is_high_popular = userData.quantity > benchmarks.med_quantity;
            const is_high_quality = userData.rating > benchmarks.med_rating;
        
            // 2. Use the conditions to find the correct status
            if (is_high_quality) {
                if (is_high_popular && is_high_profit) return "Stars";
                if (!is_high_popular && is_high_profit) return "Hidden Gems";
                if (is_high_popular && !is_high_profit) return "Beloved but Underpriced";
                return "New Opportunities"; // not popular, not profitable
            } else { // Low Quality
                if (is_high_popular && is_high_profit) return "Stars at Risk";
                if (!is_high_popular && is_high_profit) return "Niche Traps";
                if (is_high_popular && !is_high_profit) return "Tourist Traps";
                return "Problem Areas"; // not popular, not profitable
            }
        };

        // Initialize status containers
        const statusCounts = {
            "Stars": 0,
            "Hidden Gems": 0,
            "Beloved but Underpriced": 0,
            "New Opportunities": 0,
            "Stars at Risk": 0,
            "Niche Traps": 0,
            "Tourist Traps": 0,
            "Problem Areas": 0
        };

        const statusUsers = {
            "Stars": [],
            "Hidden Gems": [],
            "Beloved but Underpriced": [],
            "New Opportunities": [],
            "Stars at Risk": [],
            "Niche Traps": [],
            "Tourist Traps": [],
            "Problem Areas": []
        };

        // Process each user and classify
        for (const row of rows) {
            const userData = {
                id: row.user_id,
                name: `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'N/A',
                revenue: toNum(row.totalRevenue) || 0,
                rating: toNum(row.totalRating) || 0,
                quantity: toNum(row.totalQuantity) || 0
            };

            // Skip if revenue is missing (users must have at least one order with revenue > 0)
            if (userData.revenue === null) {
                console.log('Skipping user with null revenue:', userData);
                continue;
            }

            // Classify the user (rating and quantity can be 0)
            const status = classifyUser(userData, benchmarks);
            if (statusCounts.hasOwnProperty(status)) {
                statusCounts[status]++;
                statusUsers[status].push({
                    status: status,
                    ...userData
                });
            }
        }
        
        console.log('Processed users - Status counts:', statusCounts);
        console.log('Processed users - Total users:', Object.values(statusUsers).flat().length);

        return res.status(200).json({ 
            data: statusCounts,
            users: statusUsers 
        });

    } catch (error) {
        console.error("Error in getAllUsers:", error);
        return res.status(500).json({
            message: "Failed to load user list. Error: " + error.message,
            error: error.message
        });
    }
};

let handleUpdateData = async (data) =>{
    try {
        if (!data) {
            throw new Error('No data provided for update/create');
        }

        const {
            productName,
            stock_keeping_unit,
            price,
            description,
            country,
            category
        } = data;

        if (!stock_keeping_unit) {
            throw new Error('stock_keeping_unit is required');
        }

        // Helper function to get category_id from product_category table
        const getCategoryId = async (categoryInput) => {
            if (!categoryInput || categoryInput === '') return null;
            
            // Try to parse as integer (ID from dropdown)
            const categoryId = parseInt(categoryInput);
            if (!isNaN(categoryId) && categoryId > 0) {
                // Verify the category exists in product_category table
                const cat = await db.ProductCategory.findByPk(categoryId);
                if (cat) {
                    return categoryId; // Return the ID directly
                }
                throw new Error(`Category with ID ${categoryId} not found in product_category table`);
            }
            
            // If not a valid ID, try to find by name (backward compatibility)
            const cat = await db.ProductCategory.findOne({
                where: { category_name: categoryInput }
            });
            if (cat) {
                return cat.id;
            }
            throw new Error(`Category "${categoryInput}" not found in product_category table`);
        };

        // Helper function to get country_id from product_country table
        const getCountryId = async (countryInput) => {
            if (!countryInput || countryInput === '') return null;
            
            // Try to parse as integer (ID from dropdown)
            const countryId = parseInt(countryInput);
            if (!isNaN(countryId) && countryId > 0) {
                // Verify the country exists in product_country table
                const cty = await db.ProductCountry.findByPk(countryId);
                if (cty) {
                    return countryId; // Return the ID directly
                }
                throw new Error(`Country with ID ${countryId} not found in product_country table`);
            }
            
            // If not a valid ID, try to find by name (backward compatibility)
            const cty = await db.ProductCountry.findOne({
                where: { country_name: countryInput }
            });
            if (cty) {
                return cty.id;
            }
            throw new Error(`Country "${countryInput}" not found in product_country table`);
        };

        // Try to find existing product item by SKU
        let productItem = await db.ProductItem.findOne({
            where: { stock_keeping_unit }
        });

        let action = '';
        let product = null;

        // Normalize numeric fields
        const parsedPrice =
            price !== undefined &&
            price !== null &&
            price !== ''
                ? parseFloat(price)
                : null;

        if (productItem) {
            // ===== UPDATE EXISTING PRODUCT ITEM =====
            
            // Update stock_keeping_unit if provided and different
            if (data.stock_keeping_unit && data.stock_keeping_unit !== productItem.stock_keeping_unit) {
                // Check if new SKU already exists
                const existingSku = await db.ProductItem.findOne({
                    where: { stock_keeping_unit: data.stock_keeping_unit }
                });
                if (existingSku && existingSku.id !== productItem.id) {
                    throw new Error(`Stock keeping unit ${data.stock_keeping_unit} already exists`);
                }
                productItem.stock_keeping_unit = data.stock_keeping_unit;
            }
            
            if (parsedPrice !== null && !Number.isNaN(parsedPrice)) {
                productItem.price = parsedPrice;
            }
            if (description !== undefined && description !== null) {
                productItem.description = description;
            }

            await productItem.save();

            // Update Product
            product = await db.Product.findByPk(productItem.product_id);
            if (product) {
                if (productName && productName.trim() !== '') {
                    product.name = productName.trim();
                }
                
                // Update category_id from product_category table
                if (category !== undefined && category !== null && category !== '') {
                    const categoryId = await getCategoryId(category);
                    if (categoryId) {
                        product.category_id = categoryId; // Save ID directly to category_id column
                    }
                }
                
                // Update country_id from product_country table
                if (country !== undefined && country !== null && country !== '') {
                    const countryId = await getCountryId(country);
                    if (countryId) {
                        product.country_id = countryId; // Save ID directly to country_id column
                    }
                }
                
                await product.save();
            }

            action = 'updated';
        } else {
            // ===== CREATE NEW PRODUCT & PRODUCT ITEM =====
            // Get category_id and country_id from product_category and product_country tables
            const categoryId = category ? await getCategoryId(category) : 1; // Default to 1 if not provided
            const countryId = country ? await getCountryId(country) : null;

            const productNameToUse =
                (productName && productName.trim() !== '')
                    ? productName.trim()
                    : `Product ${stock_keeping_unit}`;

            // Create Product with category_id and country_id from respective tables
            product = await db.Product.create({
                name: productNameToUse,
                category_id: categoryId, // ID from product_category table
                country_id: countryId     // ID from product_country table
            });

            productItem = await db.ProductItem.create({
                stock_keeping_unit,
                price:
                    parsedPrice !== null && !Number.isNaN(parsedPrice)
                        ? parsedPrice
                        : 0,
                description: description || '',
                product_id: product.id
            });

            action = 'created';
        }

        return {
            action,
            product,
            productItem
        };
    } catch (error) {
        console.error('Error in handleUpdateData:', error);
        throw error;
    }
}

let getProducts = async (options = {}) => {
    try {
        const whereClause = {};
        if (options.stock_keeping_unit) {
            whereClause.stock_keeping_unit = options.stock_keeping_unit;
        }

        const productItems = await db.ProductItem.findAll({
            where: whereClause,
            include: [
                {
                    model: db.Product,
                    // Added 'country_id' to the attributes list
                    attributes: ['id', 'name', 'category_id', 'country_id'] 
                }
            ],
            order: [['stock_keeping_unit', 'ASC']]
        });

        if (!productItems || productItems.length === 0) {
            return [];
        }

        return productItems.map(item => ({
            stock_keeping_unit: item.stock_keeping_unit,
            quantity_in_stock: item.quantity_in_stock,
            price: item.price,
            description: item.description,
            // Assuming 'name' exists on ProductItem; if not, use item.Product.name
            name: item.name, 
            product_id: item.product_id,
            product: item.Product ? {
                id: item.Product.id,
                name: item.Product.name,
                category_id: item.Product.category_id,
                country_id: item.Product.country_id // Return the country_id to the UI
            } : null
        }));
    } catch (error) {
        console.error("Error in getProducts:", error);
        throw error;
    }
}


let getTimeTravel = async (options = {}) => {
    try {
      // Query product_schedule table joined with product_item and product
      let sql = `
        SELECT 
          pi.stock_keeping_unit AS sku,
          p.name AS name,
          ps.travel_date AS start_date,
          ps.end_date AS end_date,
          ps.quantity AS quantity
        FROM product_schedule ps
        INNER JOIN product_item pi ON ps.product_item_id = pi.id
        INNER JOIN product p ON pi.product_id = p.id
      `;
      let replacements = {};
  
      if (options.stock_keeping_unit) {
        sql += ` WHERE pi.stock_keeping_unit = :sku`;
        replacements.sku = options.stock_keeping_unit;
      }
  
      sql += ` ORDER BY ps.travel_date DESC`;
  
      // SELECT returns an array directly, no need to destructure
      const data = await db.sequelize.query(sql, {
        replacements,
        type: db.sequelize.QueryTypes.SELECT,
      });
  
      console.log('getTimeTravel: Found', data.length, 'schedules');
      return data;
    } catch (error) {
      console.error("Error in getTimeTravel:", error);
      throw error;
    }
  };

// Get travel dates by product_id (for booking form)
let getTravelDatesByProductId = async (productId) => {
    try {
        // Query product_schedule table joined with product_item and product
        let sql = `
            SELECT 
                ps.id AS schedule_id,
                ps.travel_date AS start_date,
                ps.end_date AS end_date,
                ps.quantity AS available_quantity,
                DATE_FORMAT(ps.travel_date, '%Y-%m-%d') AS formatted_start_date,
                DATE_FORMAT(ps.end_date, '%Y-%m-%d') AS formatted_end_date
            FROM product_schedule ps
            INNER JOIN product_item pi ON ps.product_item_id = pi.id
            INNER JOIN product p ON pi.product_id = p.id
            WHERE p.id = :productId
            AND ps.travel_date >= DATE_ADD(CURDATE(), INTERVAL 2 DAY)
            AND (ps.quantity IS NULL OR ps.quantity > 0)
            ORDER BY ps.travel_date ASC
        `;
        
        const data = await db.sequelize.query(sql, {
            replacements: { productId },
            type: db.sequelize.QueryTypes.SELECT,
        });
        
        console.log(`getTravelDatesByProductId: Found ${data.length} travel dates for product ${productId}`);
        return data;
    } catch (error) {
        console.error("Error in getTravelDatesByProductId:", error);
        throw error;
    }
};
  
  
  let handleUpdateTimeTravel = async (payload) => {
    const {
        stock_keeping_unit,
        start_date,
        end_date,
        quantity,
        price,
        description,
        productName
    } = payload;

    // Check product item exists
    const productItem = await db.ProductItem.findOne({
        where: { stock_keeping_unit },
        include: [{ model: db.Product }]
    });

    if (!productItem) {
        throw new Error(`Product with SKU ${stock_keeping_unit} not found`);
    }

    if (!productItem.id) {
        throw new Error(`Product item ${stock_keeping_unit} has no ID`);
    }

    // Convert dates to datetime format for product_schedule table
    const travelDate = start_date ? new Date(start_date) : null;
    const endDate = end_date ? new Date(end_date) : null;

    // Always create a new schedule record in product_schedule table (not update existing)
    const scheduleData = {
        product_item_id: productItem.id,
        travel_date: travelDate,
        end_date: endDate
    };
    
    // Add quantity if provided
    if (quantity !== undefined && quantity !== null && quantity !== '') {
        scheduleData.quantity = parseInt(quantity) || 0;
    }
    
    const scheduleResult = await db.ProductSchedule.create(scheduleData);
    console.log('✅ Created new product_schedule record:', {
        id: scheduleResult.id,
        product_item_id: productItem.id,
        travel_date: travelDate,
        end_date: endDate,
        quantity: scheduleResult.quantity
    });

    // Update product name if provided
    if (productName && productName.trim() !== '') {
        const product = await db.Product.findByPk(productItem.product_id);
        if (product) {
            product.name = productName.trim();
            await product.save();
            console.log('Updated product name:', productName);
        }
    }

    // Update product item if price or description provided
    if (price !== undefined || description !== undefined) {
        const updateData = {};
        if (price !== undefined) updateData.price = price;
        if (description !== undefined) updateData.description = description;
        
        await productItem.update(updateData);
        console.log('Updated product item:', updateData);
    }

    return {
        ...scheduleResult.toJSON(),
        start_date: start_date,
        end_date: end_date,
        product_item_id: productItem.id
    };
};

export default {
    handleDataChart: getDataChart,
    handleStatus,
    handleCrossTab,
    handleChiSquareAnalysis,
    getAllUsers,
    importTourismData,
    getProducts,
    getTimeTravel,
    getTravelDatesByProductId,
    handleUpdateTimeTravel,
    handleUpdateData,
    async handleStats(req, res) {
        try {
            const year = req.query.year ? parseInt(req.query.year, 10) : null;
            
            // Build query with optional year filter - try to get scenario columns
            let query = "SELECT revenue, rating, visitors, pessimistic, average, optimistic FROM tourism_data";
            const replacements = {};
            
            if (year && !isNaN(year)) {
                query += " WHERE year = :year";
                replacements.year = year;
            }
            
            query += ";";
            
            let rows;
            let hasScenarioColumns = false;
            try {
                [rows] = await db.sequelize.query(query, { replacements });
                // Check if scenario columns exist (property exists even if value is null)
                if (rows && rows.length > 0) {
                    const firstRow = rows[0];
                    // Check if properties exist in the row object (they exist even if null)
                    hasScenarioColumns = ('pessimistic' in firstRow || 'average' in firstRow || 'optimistic' in firstRow);
                }
            } catch (queryError) {
                // If scenario columns don't exist, try without them
                if (queryError.message && (queryError.message.includes('pessimistic') || queryError.message.includes('optimistic') || queryError.message.includes('average') || queryError.message.includes('Unknown column'))) {
                    console.warn("Scenario columns not found, using basic query");
                    try {
                        let basicQuery = "SELECT revenue, rating, visitors FROM tourism_data";
                        if (year && !isNaN(year)) {
                            basicQuery += " WHERE year = :year";
                            [rows] = await db.sequelize.query(basicQuery, { replacements });
                        } else {
                            [rows] = await db.sequelize.query(basicQuery);
                        }
                    } catch (yearError) {
                        if (yearError.message && (yearError.message.includes('year') || yearError.message.includes('Unknown column'))) {
                            console.warn("Year column not found, using basic query without year");
                            [rows] = await db.sequelize.query("SELECT revenue, rating, visitors FROM tourism_data;");
                        } else {
                            throw yearError;
                        }
                    }
                } else {
                    throw queryError;
                }
            }

            const toNum = (v) => {
                const n = parseFloat(v);
                return isNaN(n) ? null : n;
            };

            const compute = (arr) => {
                if (!arr || arr.length === 0) return { mean: null, median: null, mode: null, range: null, sum: null };
                const sorted = [...arr].sort((a, b) => a - b);
                const sum = sorted.reduce((s, v) => s + v, 0);
                const mean = sum / sorted.length;
                const mid = Math.floor(sorted.length / 2);
                const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
                const freq = new Map();
                let bestVal = sorted[0];
                let bestCount = 0;
                for (const v of sorted) {
                    const c = (freq.get(v) || 0) + 1;
                    freq.set(v, c);
                    if (c > bestCount) { bestCount = c; bestVal = v; }
                }
                const mode = bestVal;
                const range = sorted[sorted.length - 1] - sorted[0];
                return { mean, median, mode, range, sum };
            };

            const revenues = rows.map(r => toNum(r.revenue)).filter(v => v !== null);
            const ratings = rows.map(r => toNum(r.rating)).filter(v => v !== null);
            const visitors = rows.map(r => toNum(r.visitors)).filter(v => v !== null);

            // Get scenario predictions from database columns if they exist
            let scenarioPredictions = null;
            if (hasScenarioColumns && rows && rows.length > 0) {
                const pessimisticValues = rows.map(r => toNum(r.pessimistic)).filter(v => v !== null && v !== undefined);
                const averageValues = rows.map(r => toNum(r.average)).filter(v => v !== null && v !== undefined);
                const optimisticValues = rows.map(r => toNum(r.optimistic)).filter(v => v !== null && v !== undefined);
                
                // Calculate averages from database columns (per location) instead of totals
                if (pessimisticValues.length > 0 || averageValues.length > 0 || optimisticValues.length > 0) {
                    const avgPessimistic = pessimisticValues.length > 0 
                        ? pessimisticValues.reduce((sum, v) => sum + v, 0) / pessimisticValues.length 
                        : null;
                    const avgAverage = averageValues.length > 0 
                        ? averageValues.reduce((sum, v) => sum + v, 0) / averageValues.length 
                        : null;
                    const avgOptimistic = optimisticValues.length > 0 
                        ? optimisticValues.reduce((sum, v) => sum + v, 0) / optimisticValues.length 
                        : null;
                    
                    scenarioPredictions = {
                        pessimistic: avgPessimistic !== null ? avgPessimistic : null,
                        average: avgAverage !== null ? avgAverage : null,
                        optimistic: avgOptimistic !== null ? avgOptimistic : null,
                        source: 'database',
                        count: rows.length
                    };
                }
            }

            const result = {
                revenue: compute(revenues),
                rating: compute(ratings),
                visitors: compute(visitors),
                year: year || null,
                scenarioPredictions: scenarioPredictions
            };

            return res.status(200).json({ data: result });
        } catch (e) {
            console.error("Error computing stats:", e);
            return res.status(500).json({ message: "Failed to compute statistics", error: e.message });
        }
    },
    
    async getAvailableYears(req, res) {
        try {
            // Check if year column exists first
            try {
                const [rows] = await db.sequelize.query(
                    "SELECT DISTINCT year FROM tourism_data WHERE year IS NOT NULL ORDER BY year DESC;"
                );
                
                const years = rows.map(r => r.year).filter(y => y != null);
                
                return res.status(200).json({ 
                    errCode: 0, 
                    data: years 
                });
            } catch (colError) {
                // If year column doesn't exist, return empty array
                if (colError.message && colError.message.includes('year')) {
                    console.warn("Year column not found in tourism_data table. Year filtering will be disabled.");
                    return res.status(200).json({ 
                        errCode: 0, 
                        data: [] 
                    });
                }
                throw colError;
            }
        } catch (e) {
            console.error("Error fetching available years:", e);
            return res.status(500).json({ 
                errCode: -1,
                message: "Failed to fetch available years", 
                error: e.message 
            });
        }
    },

    /**
     * Calculate and store elasticity for consecutive years
     * Elasticity = (% Change in Quantity) / (% Change in Price)
     * Where Quantity = Visitors, Price = Average Revenue per Visitor (Revenue/Visitors)
     * 
     * Calculates:
     * - 2023->2024 elasticity, saves in 2024
     * - 2024->2025 elasticity, saves in 2025
     * - 2025->2026 elasticity, saves in 2026
     */
    async calculateAndStoreElasticity(req, res) {
        try {
            // Ensure elasticity column exists
            try {
                const [columns] = await db.sequelize.query(`SHOW COLUMNS FROM tourism_data LIKE 'elasticity'`);
                if (!columns || columns.length === 0) {
                    await db.sequelize.query(`
                        ALTER TABLE tourism_data 
                        ADD COLUMN elasticity DECIMAL(10, 4) NULL
                    `);
                    console.log('Added elasticity column to tourism_data table');
                }
            } catch (alterError) {
                // Column might already exist, continue
                console.log('Elasticity column check:', alterError.message);
            }

            const results = [];
            const yearPairs = [
                { from: 2023, to: 2024 },
                { from: 2024, to: 2025 },
                { from: 2025, to: 2026 }
            ];

            for (const { from, to } of yearPairs) {
                try {
                    // Get aggregated data for both years
                    const [yearFromData] = await db.sequelize.query(`
                        SELECT 
                            SUM(visitors) as total_visitors,
                            SUM(revenue) as total_revenue
                        FROM tourism_data
                        WHERE year = :yearFrom AND visitors > 0 AND revenue > 0
                    `, { replacements: { yearFrom: from } });

                    const [yearToData] = await db.sequelize.query(`
                        SELECT 
                            SUM(visitors) as total_visitors,
                            SUM(revenue) as total_revenue
                        FROM tourism_data
                        WHERE year = :yearTo AND visitors > 0 AND revenue > 0
                    `, { replacements: { yearTo: to } });

                    if (!yearFromData || !yearFromData[0] || !yearToData || !yearToData[0]) {
                        console.warn(`Insufficient data for elasticity calculation ${from}->${to}`);
                        results.push({ from, to, elasticity: null, message: 'Insufficient data' });
                        continue;
                    }

                    const fromData = yearFromData[0];
                    const toData = yearToData[0];

                    const visitorsFrom = parseFloat(fromData.total_visitors) || 0;
                    const revenueFrom = parseFloat(fromData.total_revenue) || 0;
                    const visitorsTo = parseFloat(toData.total_visitors) || 0;
                    const revenueTo = parseFloat(toData.total_revenue) || 0;

                    if (visitorsFrom === 0 || visitorsTo === 0 || revenueFrom === 0 || revenueTo === 0) {
                        console.warn(`Zero values found for elasticity calculation ${from}->${to}`);
                        results.push({ from, to, elasticity: null, message: 'Zero values in data' });
                        continue;
                    }

                    // Calculate average price per visitor for each year
                    const priceFrom = revenueFrom / visitorsFrom;
                    const priceTo = revenueTo / visitorsTo;

                    // Calculate percentage changes
                    const percentChangeVisitors = ((visitorsTo - visitorsFrom) / visitorsFrom) * 100;
                    const percentChangePrice = ((priceTo - priceFrom) / priceFrom) * 100;

                    // Calculate elasticity: Ed = (% Change in Quantity) / (% Change in Price)
                    let elasticity = null;
                    if (percentChangePrice !== 0) {
                        elasticity = percentChangeVisitors / percentChangePrice;
                    } else {
                        // If price didn't change, elasticity is undefined (perfectly inelastic or infinite)
                        elasticity = null;
                    }

                    // Update elasticity for all rows in the target year (to)
                    if (elasticity !== null && isFinite(elasticity)) {
                        await db.sequelize.query(`
                            UPDATE tourism_data
                            SET elasticity = :elasticity
                            WHERE year = :yearTo
                        `, { 
                            replacements: { 
                                elasticity: elasticity,
                                yearTo: to 
                            } 
                        });

                        results.push({
                            from,
                            to,
                            elasticity: elasticity,
                            visitorsFrom,
                            visitorsTo,
                            priceFrom: priceFrom.toFixed(2),
                            priceTo: priceTo.toFixed(2),
                            percentChangeVisitors: percentChangeVisitors.toFixed(2),
                            percentChangePrice: percentChangePrice.toFixed(2),
                            message: 'Success'
                        });
                    } else {
                        results.push({
                            from,
                            to,
                            elasticity: null,
                            message: 'Cannot calculate (price change is zero or invalid)'
                        });
                    }
                } catch (yearError) {
                    console.error(`Error calculating elasticity for ${from}->${to}:`, yearError);
                    results.push({
                        from,
                        to,
                        elasticity: null,
                        message: `Error: ${yearError.message}`
                    });
                }
            }

            return res.status(200).json({
                errCode: 0,
                message: 'Elasticity calculation completed',
                results
            });
        } catch (e) {
            console.error("Error calculating elasticity:", e);
            return res.status(500).json({
                errCode: -1,
                message: "Failed to calculate elasticity",
                error: e.message
            });
        }
    },

    /**
     * Price Optimization: Suggest price adjustments based on elasticity to maximize revenue
     * Uses elasticity data to recommend optimal price changes
     */
    async getPriceOptimizationSuggestions(req, res) {
        try {
            const { year } = req.query;
            
            // Get the latest year's data if year not specified
            let targetYear = year ? parseInt(year, 10) : null;
            if (!targetYear) {
                const [latestYearData] = await db.sequelize.query(`
                    SELECT MAX(year) as max_year
                    FROM tourism_data
                    WHERE year IS NOT NULL
                `);
                targetYear = latestYearData?.[0]?.max_year || null;
            }

            if (!targetYear) {
                return res.status(400).json({
                    errCode: -1,
                    message: "No year data available for price optimization"
                });
            }

            // Get aggregated data for the target year
            // Use MEDIAN instead of AVG to get more representative values (less affected by outliers)
            // First, get all individual values to calculate median
            const [allRows] = await db.sequelize.query(`
                SELECT 
                    visitors,
                    revenue,
                    elasticity
                FROM tourism_data
                WHERE year = :targetYear AND visitors > 0 AND revenue > 0
                ORDER BY revenue ASC
            `, { replacements: { targetYear } });

            if (!allRows || allRows.length === 0) {
                return res.status(404).json({
                    errCode: -1,
                    message: `No data found for year ${targetYear}`
                });
            }

            // Calculate median values (more robust than average)
            const revenues = allRows.map(r => parseFloat(r.revenue) || 0).filter(v => v > 0).sort((a, b) => a - b);
            const visitors = allRows.map(r => parseFloat(r.visitors) || 0).filter(v => v > 0).sort((a, b) => a - b);
            const elasticities = allRows.map(r => parseFloat(r.elasticity)).filter(v => !isNaN(v));

            const getMedian = (arr) => {
                if (arr.length === 0) return 0;
                const mid = Math.floor(arr.length / 2);
                return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
            };

            const medianRevenue = getMedian(revenues);
            const medianVisitors = getMedian(visitors);
            const avgElasticity = elasticities.length > 0 
                ? elasticities.reduce((sum, v) => sum + v, 0) / elasticities.length 
                : null;

            // Also get totals for reference
            const [summaryData] = await db.sequelize.query(`
                SELECT 
                    SUM(visitors) as total_visitors,
                    SUM(revenue) as total_revenue,
                    COUNT(*) as location_count
                FROM tourism_data
                WHERE year = :targetYear AND visitors > 0 AND revenue > 0
            `, { replacements: { targetYear } });

            const totalVisitors = parseFloat(summaryData?.[0]?.total_visitors) || 0;
            const totalRevenue = parseFloat(summaryData?.[0]?.total_revenue) || 0;
            const locationCount = parseFloat(summaryData?.[0]?.location_count) || 0;

            if (medianVisitors === 0 || medianRevenue === 0) {
                return res.status(400).json({
                    errCode: -1,
                    message: "Insufficient data for price optimization"
                });
            }

            // Use median revenue per location and median visitors per location for calculations
            // This gives more reasonable and representative values for price optimization
            const currentPrice = medianRevenue / medianVisitors;
            const baseRevenue = medianRevenue;
            const baseVisitors = medianVisitors;
            const elasticity = avgElasticity;

            // Price optimization logic based on elasticity
            let suggestions = [];
            
            if (elasticity === null || isNaN(elasticity)) {
                return res.status(200).json({
                    errCode: 0,
                    message: "Elasticity data not available. Please calculate elasticity first.",
                    year: targetYear,
                    currentData: {
                        totalRevenue: baseRevenue.toFixed(2),
                        totalVisitors: Math.round(baseVisitors),
                        currentPrice: currentPrice.toFixed(2),
                        locationCount: locationCount
                    },
                    suggestions: []
                });
            }

            // Determine optimal price change direction
            // If elasticity < -1: demand is elastic, lower prices to increase revenue
            // If elasticity > -1 and < 0: demand is inelastic, raise prices to increase revenue
            // If elasticity = -1: unit elastic, current price is optimal
            // If elasticity > 0: unusual case (Giffen good), but suggest price increases

            const isElastic = elasticity < -1;
            const isInelastic = (elasticity > -1 && elasticity < 0) || elasticity > 0;
            const isUnitElastic = Math.abs(elasticity + 1) < 0.1; // Close to -1

            if (isUnitElastic) {
                suggestions.push({
                    priceChangePercent: 0,
                    newPrice: currentPrice.toFixed(2),
                    expectedQuantityChangePercent: 0,
                    expectedNewQuantity: Math.round(baseVisitors),
                    expectedRevenue: baseRevenue.toFixed(2),
                    expectedRevenueChange: 0,
                    expectedRevenueChangePercent: 0,
                    recommendation: "maintain"
                });
            } else {
                // Generate multiple price change scenarios
                const priceChanges = isElastic 
                    ? [-10, -7.5, -5, -2.5] // Suggest price decreases for elastic demand
                    : [2.5, 5, 7.5, 10];   // Suggest price increases for inelastic demand

                for (const priceChangePercent of priceChanges) {
                    // Calculate expected quantity change: %ΔQ = elasticity × %ΔP
                    const expectedQuantityChangePercent = elasticity * priceChangePercent;
                    
                    // New price (ARPV)
                    const newPrice = currentPrice * (1 + priceChangePercent / 100);
                    
                    // New quantity (visitors) - using median visitors per location
                    const newQuantity = baseVisitors * (1 + expectedQuantityChangePercent / 100);
                    
                    // New revenue - using median revenue per location as base
                    const newRevenue = newPrice * newQuantity;
                    const revenueChange = newRevenue - baseRevenue;
                    const revenueChangePercent = (revenueChange / baseRevenue) * 100;

                    suggestions.push({
                        priceChangePercent: priceChangePercent,
                        newPrice: newPrice.toFixed(2),
                        expectedQuantityChangePercent: expectedQuantityChangePercent.toFixed(2),
                        expectedNewQuantity: Math.round(newQuantity),
                        expectedRevenue: newRevenue.toFixed(2),
                        expectedRevenueChange: revenueChange.toFixed(2),
                        expectedRevenueChangePercent: revenueChangePercent.toFixed(2),
                        recommendation: revenueChangePercent > 0 ? "recommended" : "not_recommended",
                        _revenueChangePercentNum: revenueChangePercent // Store numeric value for sorting
                    });
                }

                // Sort by expected revenue change (descending)
                suggestions.sort((a, b) => b._revenueChangePercentNum - a._revenueChangePercentNum);
                
                // Remove the temporary numeric field
                suggestions.forEach(s => delete s._revenueChangePercentNum);
            }

            // Find the best recommendation (highest revenue increase)
            const bestSuggestion = suggestions.length > 0 && parseFloat(suggestions[0].expectedRevenueChangePercent) > 0
                ? suggestions[0]
                : null;

            return res.status(200).json({
                errCode: 0,
                message: "Price optimization suggestions generated",
                year: targetYear,
                elasticity: elasticity.toFixed(4),
                elasticityInterpretation: isElastic 
                    ? "Elastic demand (price sensitive)" 
                    : isInelastic 
                        ? "Inelastic demand (price insensitive)" 
                        : "Unit elastic demand",
                currentData: {
                    totalRevenue: baseRevenue.toFixed(2),
                    totalVisitors: Math.round(baseVisitors),
                    currentPrice: currentPrice.toFixed(2),
                    locationCount: locationCount,
                    totalRevenueAll: totalRevenue.toFixed(2), // Keep total for reference if needed
                    totalVisitorsAll: Math.round(totalVisitors) // Keep total for reference if needed
                },
                bestSuggestion: bestSuggestion,
                allSuggestions: suggestions
            });
        } catch (e) {
            console.error("Error generating price optimization suggestions:", e);
            return res.status(500).json({
                errCode: -1,
                message: "Failed to generate price optimization suggestions",
                error: e.message
            });
        }
    }
};



