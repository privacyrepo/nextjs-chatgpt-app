/** @type {import('next').NextConfig} */
const { i18n } = require('./next-i18next.config')
const nextConfig = {
  reactStrictMode: true,
  i18n,
  env: {
    // defaults to TRUE, unless API Keys are set at build time; this flag is used by the UI
    HAS_SERVER_KEY_OPENAI: !!process.env.OPENAI_API_KEY,
    HAS_SERVER_KEY_ELEVENLABS: !!process.env.ELEVENLABS_API_KEY,
    HAS_SERVER_KEY_PRODIA: !!process.env.PRODIA_API_KEY,
  },
  webpack(config, { isServer, dev }) {
    // @mui/joy: anything material gets redirected to Joy
    config.resolve.alias['@mui/material'] = '@mui/joy';

    // @dqbd/tiktoken: enable asynchronous WebAssembly
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };

    return config;
  },
};

module.exports = nextConfig;
