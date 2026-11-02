module.exports = ({ config }) => {
  const baseUrl = (process.env.PAGES_BASE_PATH || '').replace(/\/$/, '');
  if (baseUrl && !/^\/[a-zA-Z0-9_-]+$/.test(baseUrl)) {
    throw new Error('PAGES_BASE_PATH must be empty or a single /repository-name path');
  }
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};
