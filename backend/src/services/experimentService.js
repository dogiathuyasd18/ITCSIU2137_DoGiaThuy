import db from '../models/index.js';

const EXPERIMENT_NAME = 'price_ab';

const ensureTables = async () => {
  // Minimal tables for thesis A/B experiment tracking (no sequelize migrations needed).
  await db.sequelize.query(`
    CREATE TABLE IF NOT EXISTS experiment_config (
      name VARCHAR(64) PRIMARY KEY,
      percentage DECIMAL(8,4) NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.sequelize.query(`
    CREATE TABLE IF NOT EXISTS experiment_assignment (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      experiment_name VARCHAR(64) NOT NULL,
      user_id INT NOT NULL,
      variant VARCHAR(16) NOT NULL,
      assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_experiment_user (experiment_name, user_id)
    )
  `);

  await db.sequelize.query(`
    CREATE TABLE IF NOT EXISTS experiment_exposure (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      experiment_name VARCHAR(64) NOT NULL,
      user_id INT NOT NULL,
      product_id INT NULL,
      event VARCHAR(32) NOT NULL DEFAULT 'view',
      variant VARCHAR(16) NOT NULL,
      price_shown BIGINT NULL,
      occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_exp_user (experiment_name, user_id),
      KEY idx_exp_variant (experiment_name, variant)
    )
  `);
};

const ensureOrderColumns = async () => {
  // Add columns to shop_order to store the experiment metadata (safe to run multiple times).
  const [cols] = await db.sequelize.query(`SHOW COLUMNS FROM shop_order`);
  const has = (name) => cols?.some((c) => c.Field === name);

  const alters = [];
  if (!has('experiment_name')) alters.push(`ADD COLUMN experiment_name VARCHAR(64) NULL`);
  if (!has('variant')) alters.push(`ADD COLUMN variant VARCHAR(16) NULL`);
  if (!has('price_multiplier')) alters.push(`ADD COLUMN price_multiplier DECIMAL(8,4) NULL`);

  if (alters.length) {
    await db.sequelize.query(`ALTER TABLE shop_order ${alters.join(', ')}`);
  }
};

const setPriceExperiment = async ({ percentage, active }) => {
  await ensureTables();
  await ensureOrderColumns();

  const pct = Number(percentage);
  if (!Number.isFinite(pct) || pct < -0.9 || pct > 5) {
    // guard rails: -90%..+500% for thesis; adjust as needed
    throw new Error('Invalid percentage. Expected a number between -0.9 and 5 (e.g., 0.05 for +5%).');
  }

  const isActive = active ? 1 : 0;

  // Upsert config row
  await db.sequelize.query(
    `
      INSERT INTO experiment_config (name, percentage, active, updated_at)
      VALUES (:name, :percentage, :active, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE
        percentage = VALUES(percentage),
        active = VALUES(active),
        updated_at = CURRENT_TIMESTAMP
    `,
    { replacements: { name: EXPERIMENT_NAME, percentage: pct, active: isActive } }
  );

  return { name: EXPERIMENT_NAME, percentage: pct, active: Boolean(isActive) };
};

const getConfig = async () => {
  await ensureTables();
  const [rows] = await db.sequelize.query(`SELECT name, percentage, active, updated_at FROM experiment_config WHERE name = :name`, {
    replacements: { name: EXPERIMENT_NAME }
  });
  if (!rows?.length) return { name: EXPERIMENT_NAME, percentage: 0, active: false };
  const r = rows[0];
  return { name: r.name, percentage: Number(r.percentage) || 0, active: Boolean(r.active) };
};

const getOrCreateAssignment = async (userId) => {
  await ensureTables();
  const uid = Number(userId);
  if (!Number.isFinite(uid)) throw new Error('Invalid userId');

  const [rows] = await db.sequelize.query(
    `SELECT experiment_name, user_id, variant FROM experiment_assignment WHERE experiment_name = :exp AND user_id = :uid LIMIT 1`,
    { replacements: { exp: EXPERIMENT_NAME, uid } }
  );
  if (rows?.length) return { experiment_name: EXPERIMENT_NAME, user_id: uid, variant: rows[0].variant };

  const variant = Math.random() < 0.5 ? 'control' : 'treatment';
  await db.sequelize.query(
    `INSERT INTO experiment_assignment (experiment_name, user_id, variant) VALUES (:exp, :uid, :variant)`,
    { replacements: { exp: EXPERIMENT_NAME, uid, variant } }
  );
  return { experiment_name: EXPERIMENT_NAME, user_id: uid, variant };
};

const getPricingForUser = async (userId) => {
  const cfg = await getConfig();
  if (!cfg.active) return { active: false, experiment_name: EXPERIMENT_NAME, variant: null, multiplier: 1, percentage: 0 };

  const assignment = await getOrCreateAssignment(userId);
  const multiplier = assignment.variant === 'treatment' ? 1 + cfg.percentage : 1;
  return { active: true, experiment_name: EXPERIMENT_NAME, variant: assignment.variant, multiplier, percentage: cfg.percentage };
};

const applyPrice = (basePrice, multiplier) => {
  const n = Number(basePrice);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * multiplier);
};

const logExposure = async ({ userId, productId = null, event = 'view', basePrice = null }) => {
  await ensureTables();
  const pricing = await getPricingForUser(userId);
  if (!pricing.active) return { ok: true, skipped: true };

  const priceShown = basePrice != null ? applyPrice(basePrice, pricing.multiplier) : null;

  await db.sequelize.query(
    `
      INSERT INTO experiment_exposure (experiment_name, user_id, product_id, event, variant, price_shown)
      VALUES (:exp, :uid, :pid, :event, :variant, :price_shown)
    `,
    {
      replacements: {
        exp: EXPERIMENT_NAME,
        uid: Number(userId),
        pid: productId != null ? Number(productId) : null,
        event: String(event || 'view').slice(0, 32),
        variant: pricing.variant,
        price_shown: priceShown
      }
    }
  );

  return { ok: true, experiment: pricing.experiment_name, variant: pricing.variant, priceShown };
};

const getReport = async () => {
  await ensureTables();
  await ensureOrderColumns();

  // Aggregate exposures and orders by variant
  const [exposures] = await db.sequelize.query(
    `
      SELECT variant, COUNT(*) AS exposures
      FROM experiment_exposure
      WHERE experiment_name = :exp
      GROUP BY variant
    `,
    { replacements: { exp: EXPERIMENT_NAME } }
  );

  const [orders] = await db.sequelize.query(
    `
      SELECT variant, COUNT(*) AS bookings, SUM(order_total) AS revenue
      FROM shop_order
      WHERE experiment_name = :exp
      GROUP BY variant
    `,
    { replacements: { exp: EXPERIMENT_NAME } }
  );

  // Get individual order revenues for standard deviation calculation
  const [orderDetails] = await db.sequelize.query(
    `
      SELECT variant, order_total
      FROM shop_order
      WHERE experiment_name = :exp AND order_total IS NOT NULL
    `,
    { replacements: { exp: EXPERIMENT_NAME } }
  );

  // Group orders by variant for statistics
  const variantOrders = new Map();
  for (const order of orderDetails || []) {
    const variant = order.variant;
    if (!variantOrders.has(variant)) {
      variantOrders.set(variant, []);
    }
    variantOrders.get(variant).push(Number(order.order_total) || 0);
  }

  // Calculate predictions for each variant
  const calculatePredictions = (revenues) => {
    if (!revenues || revenues.length === 0) {
      return { pessimistic: 0, average: 0, optimistic: 0, stdDev: 0 };
    }

    const mean = revenues.reduce((sum, val) => sum + val, 0) / revenues.length;
    const variance = revenues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / revenues.length;
    const stdDev = Math.sqrt(variance);

    // Scenario Analysis:
    // Pessimistic: Mean - 1.5 * StdDev (worst case)
    // Average: Mean (most likely)
    // Optimistic: Mean + 1.5 * StdDev (best case)
    const pessimistic = Math.max(0, mean - 1.5 * stdDev); // Ensure non-negative
    const average = mean;
    const optimistic = mean + 1.5 * stdDev;

    return {
      pessimistic: Math.round(pessimistic),
      average: Math.round(average),
      optimistic: Math.round(optimistic),
      stdDev: Math.round(stdDev)
    };
  };

  const map = new Map();
  for (const e of exposures || []) {
    const variant = e.variant;
    const ordersForVariant = variantOrders.get(variant) || [];
    const predictions = calculatePredictions(ordersForVariant);
    
    map.set(variant, {
      variant: variant,
      exposures: Number(e.exposures) || 0,
      bookings: 0,
      revenue: 0,
      predictions: predictions
    });
  }

  for (const o of orders || []) {
    const variant = o.variant;
    const cur = map.get(variant) || {
      variant: variant,
      exposures: 0,
      bookings: 0,
      revenue: 0,
      predictions: { pessimistic: 0, average: 0, optimistic: 0, stdDev: 0 }
    };
    cur.bookings = Number(o.bookings) || 0;
    cur.revenue = Number(o.revenue) || 0;
    
    // Update predictions if we have revenue data
    if (cur.revenue > 0 && cur.bookings > 0) {
      const ordersForVariant = variantOrders.get(variant) || [];
      if (ordersForVariant.length > 0) {
        cur.predictions = calculatePredictions(ordersForVariant);
      } else {
        // If no individual orders, use average revenue per booking
        const avgRevenuePerBooking = cur.revenue / cur.bookings;
        cur.predictions = {
          pessimistic: Math.round(avgRevenuePerBooking * 0.7), // 30% lower
          average: Math.round(avgRevenuePerBooking),
          optimistic: Math.round(avgRevenuePerBooking * 1.3), // 30% higher
          stdDev: 0
        };
      }
    }
    
    map.set(variant, cur);
  }

  const rows = Array.from(map.values()).sort((a, b) => a.variant.localeCompare(b.variant));
  return { experiment: EXPERIMENT_NAME, rows };
};

export default {
  EXPERIMENT_NAME,
  setPriceExperiment,
  getConfig,
  getPricingForUser,
  applyPrice,
  logExposure,
  getReport,
  ensureOrderColumns
};

