import experimentService from '../services/experimentService.js';

// Admin: set active percentage for the price A/B experiment
const setPriceExperiment = async (req, res) => {
  try {
    const { percentage, active } = req.body || {};
    const cfg = await experimentService.setPriceExperiment({
      percentage,
      active: active !== false // default true
    });
    return res.status(200).json({ errCode: 0, message: 'OK', data: cfg });
  } catch (e) {
    return res.status(400).json({ errCode: 1, message: e.message });
  }
};

// Admin: get config + aggregated results
const getPriceExperimentReport = async (_req, res) => {
  try {
    const cfg = await experimentService.getConfig();
    const report = await experimentService.getReport();
    return res.status(200).json({ errCode: 0, message: 'OK', data: { config: cfg, report } });
  } catch (e) {
    return res.status(500).json({ errCode: 500, message: e.message });
  }
};

// Customer: log exposure event (view/select) for the experiment
const logExposure = async (req, res) => {
  try {
    const userId = req.currentUser?.id;
    const { productId = null, event = 'view', basePrice = null } = req.body || {};
    if (!userId) return res.status(401).json({ errCode: 401, message: 'User not authenticated' });

    const out = await experimentService.logExposure({ userId, productId, event, basePrice });
    return res.status(200).json({ errCode: 0, message: 'OK', data: out });
  } catch (e) {
    return res.status(500).json({ errCode: 500, message: e.message });
  }
};

export default {
  setPriceExperiment,
  getPriceExperimentReport,
  logExposure
};

