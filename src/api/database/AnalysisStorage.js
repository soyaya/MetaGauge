/**
 * AnalysisStorage - thin re-export for direct imports
 */
import { AnalysisStorage } from './index.js';

export const findAll              = () => AnalysisStorage.findAll();
export const findById             = (id) => AnalysisStorage.findById(id);
export const findByUserId         = (userId, filters) => AnalysisStorage.findByUserId(userId, filters);
export const create               = (data) => AnalysisStorage.create(data);
export const update               = (id, data) => AnalysisStorage.update(id, data);
export const getStats             = (userId) => AnalysisStorage.getStats(userId);
export const getMonthlyCount      = (userId, monthStart) => AnalysisStorage.getMonthlyCount(userId, monthStart);

// Helper: find the most recent completed analysis for a contract address
export const findAnalysisByContractId = async (contractId) => {
  const all = await AnalysisStorage.findAll();
  return all
    .filter(a => a.status === 'completed' && (
      a.results?.target?.contract?.address?.toLowerCase() === contractId.toLowerCase() ||
      a.configId === contractId
    ))
    .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))[0] || null;
};

export default AnalysisStorage;
