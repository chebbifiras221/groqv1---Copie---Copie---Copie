/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['i.imgur.com'], // Allow images from Imgur
  },
}

module.exports = nextConfig
