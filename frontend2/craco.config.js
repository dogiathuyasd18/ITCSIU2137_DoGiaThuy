module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        url: require.resolve('url/'),
      };
      return webpackConfig;
    }
  }
};
